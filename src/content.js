(async () => {
  // Mark that the content script has been loaded
  window.autoRadioContentScriptLoaded = true

  // Add debounce protection against duplicate submissions
  let lastAutoSelectTime = 0;
  const DEBOUNCE_TIME = 500; // 500ms debounce

  // Use a variable that can be updated by storage changes
  let settings = await chrome.storage.sync.get(['selectionPattern', 'autoSubmit'])
  let selectionPattern = settings.selectionPattern || 'first'
  let autoSubmitEnabled = settings.autoSubmit || false

  // Listen for storage changes to update settings in real-time
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.selectionPattern) {
      selectionPattern = changes.selectionPattern.newValue
    }
    if (changes.autoSubmit !== undefined) {
      autoSubmitEnabled = changes.autoSubmit.newValue
    }
  })

  const autoSelectAndSubmit = async () => {
    const groups = {}

    document.querySelectorAll('input[type="radio"]').forEach((radio) => {
      if (!groups[radio.name]) {
        groups[radio.name] = []
      }
      groups[radio.name].push(radio)
    })

    if (Object.keys(groups).length === 0 && autoSubmitEnabled) {
      console.log("No radio groups found. Auto-submit will stop.")
      chrome.storage.sync.set({autoSubmit: false})

      // Send message to background script to update badge text (since content scripts can't access chrome.action)
      chrome.runtime.sendMessage({action: "updateBadge", text: ""})
      return
    }

    // Track which forms have been modified
    const formsWithRadios = new Set()

    Object.entries(groups).forEach(([groupName, radios]) => {
      let selected
      if (selectionPattern === 'first') {
        selected = radios[0]
      } else if (selectionPattern === 'last') {
        selected = radios[radios.length - 1]
      } else if (selectionPattern === 'random') {
        const randomIndex = Math.floor(Math.random() * radios.length)
        selected = radios[randomIndex]
      }
      if (selected) {
        selected.click()
        console.log(`Group: ${groupName}, Value Selected: ${selected.value}`)

        // Find the form containing this radio button
        const form = selected.closest('form')
        if (form) {
          formsWithRadios.add(form)
        }
      }
    })

    // Submit buttons in forms that contain radio buttons
    formsWithRadios.forEach(form => {
      const submitButton = form.querySelector('button[type="submit"]:not(.previous-button), input[type="submit"]:not(.previous-button)')
      if (submitButton && !submitButton.disabled && submitButton.checkVisibility()) {
        submitButton.click()
        console.log(`Clicked submit button in form`)
      }
    })
  }

  // Set up listeners for Rails frameworks
  const setupRailsListeners = () => {
    // Check if listeners are already set up
    if (window.railsListenersSetup) {
      console.log("Rails event listeners already set up, skipping")
      return
    }

    console.log("Setting up Rails framework event listeners")

    // Mark that listeners are set up
    window.railsListenersSetup = true

    // Helper function to check current state and run submit if enabled
    const checkAndSubmit = async (eventName) => {
      console.log(`${eventName} event triggered`)

      // Get the latest auto submit setting from storage
      const settings = await chrome.storage.sync.get(['autoSubmit'])
      const currentAutoSubmitEnabled = settings.autoSubmit || false

      // Always check the current value from storage
      if (currentAutoSubmitEnabled) {
        console.log("running auto select and submit")
        autoSelectAndSubmit()
      }
    }

    // Rails UJS events (adaptive forms)
    document.addEventListener('ajax:complete', () => {
      checkAndSubmit('ajax:complete')
    })
  }

  // Always set up the Rails listeners
  // This ensures the listeners are in place even if autoSubmit is toggled later
  await setupRailsListeners()

  // Get the actual configured shortcuts from the background script
  let actualShortcut = "Not Set"
  try {
    const shortcuts = await new Promise((resolve) => {
      chrome.runtime.sendMessage({action: "getShortcuts"}, (response) => {
        resolve(response)
      })
    })

    // Get the shortcut for auto-radio-submit command
    actualShortcut = shortcuts["auto-radio-submit"] || "Not Set"

    // // Convert Windows/Linux format to Mac format if on Mac
    // if (navigator.platform.includes('Mac') && actualShortcut.includes('Ctrl+')) {
    //   actualShortcut = actualShortcut.replace('Ctrl+', '⌘+').replace('Shift+', '⇧+')
    // }
  } catch (error) {
    console.error("Error fetching shortcuts:", error)
  }

  // Check if this was triggered directly by the Auto-Select & Submit shortcut
  if (window.isDirectShortcutTriggered) {
    console.log(`Script triggered by direct shortcut (${actualShortcut}), running auto select and submit regardless of settings`)
    // Reset the flag
    window.isDirectShortcutTriggered = false
    // Run auto-select and submit
    await autoSelectAndSubmit()
  } else {
    // Never automatically trigger on initial page load, even if autoSubmit is enabled
    // User must first use the shortcut to trigger auto-select and submit
    console.log(`Initial page load - waiting for manual trigger via shortcut (${actualShortcut})`)
  }

  // Listen for messages from the background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Message received:", message)

    if (message.action === "triggerAutoSelectAndSubmit") {
      // Check if we've recently processed this action (debounce)
      const now = Date.now();
      if (now - lastAutoSelectTime < DEBOUNCE_TIME) {
        console.log(`Ignoring duplicate trigger (debounced). Time since last: ${now - lastAutoSelectTime}ms`);
        if (sendResponse) {
          sendResponse({ success: false, reason: "debounced" });
        }
        return false; // No async response
      }

      // Update the last action time
      lastAutoSelectTime = now;
      console.log(`Received message to trigger auto select and submit via ${actualShortcut}`)
      autoSelectAndSubmit();

      // Respond to prevent "message channel closed" errors
      if (sendResponse) {
        sendResponse({ success: true });
      }
    } else if (message.action === "checkPageChange") {
      console.log("Received message to check page change")

      // Check if we've recently processed an action (debounce)
      const now = Date.now();
      if (now - lastAutoSelectTime < DEBOUNCE_TIME) {
        console.log(`Ignoring checkPageChange (debounced). Time since last: ${now - lastAutoSelectTime}ms`);
        if (sendResponse) {
          sendResponse({ success: false, reason: "debounced" });
        }
        return false;
      }

      // Get the latest auto submit setting
      chrome.storage.sync.get(['autoSubmit'], (result) => {
        const currentAutoSubmitEnabled = result.autoSubmit || false

        if (currentAutoSubmitEnabled) {
          // Update the last action time
          lastAutoSelectTime = now;

          // Check for radio buttons after a short delay to ensure page is loaded
          setTimeout(() => {
            // First check if there are any radio buttons on the page
            autoSelectAndSubmit()
          }, 300)
        }

        // Respond to prevent "message channel closed" errors
        if (sendResponse) {
          sendResponse({ success: true });
        }
      });

      // Return true to indicate we'll respond asynchronously
      return true;
    }

    // Return false by default since we're not using async response for other messages
    // This helps prevent "message channel closed" errors
    sendResponse && sendResponse({ error: "Unknown message action" });
    return false;
  })
})()

// Initialize from sync storage
let autoSubmitEnabled = false

// Add debounce protection for commands
let lastCommandTime = 0
const COMMAND_DEBOUNCE = 500 // 500ms debounce for commands

// Initialize from sync storage
chrome.storage.sync.get(['autoSubmit'], (result) => {
  autoSubmitEnabled = result.autoSubmit || false
  chrome.action.setBadgeText({text: autoSubmitEnabled ? 'ON' : ''})
  if (autoSubmitEnabled) {
    chrome.action.setBadgeBackgroundColor({color: '#4CAF50'})
  }
})

chrome.commands.onCommand.addListener((command) => {
  console.log(`Command received: ${command}`)

  // Check for command debounce - prevent duplicate triggers within 500ms
  const now = Date.now()
  if (now - lastCommandTime < COMMAND_DEBOUNCE) {
    console.log(`Ignoring duplicate command "${command}" (debounced). Time since last: ${now - lastCommandTime}ms`)
    return
  }
  lastCommandTime = now

  if (command === "auto-radio-submit") {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      const tabId = tabs[0].id
      console.log(`Auto-radio-submit shortcut triggered for tab: ${tabId}`)

      // Set the flag and trigger the auto select and submit
      chrome.scripting.executeScript({
        target: {tabId: tabId},
        func: () => {
          // Set a flag to indicate this was triggered directly by the shortcut
          window.isDirectShortcutTriggered = true
        }
      }, () => {
        // Content script should already be loaded via manifest's content_scripts
        // Send a message to trigger the action with timestamp to help with debouncing
        chrome.tabs.sendMessage(tabId, {
          action: "triggerAutoSelectAndSubmit",
          timestamp: Date.now()
        }, (response) => {
          // Log any errors but don't retry - the debounce will handle this
          if (chrome.runtime.lastError) {
            console.log(`Error sending message: ${chrome.runtime.lastError.message}`)
          }
        })
      })
    })
  }

  if (command === "toggle-auto-submit") {
    // Toggle state
    autoSubmitEnabled = !autoSubmitEnabled
    chrome.storage.sync.set({autoSubmit: autoSubmitEnabled})
    chrome.action.setBadgeText({text: autoSubmitEnabled ? 'ON' : ''})
    chrome.action.setBadgeBackgroundColor({color: '#4CAF50'})
    console.log(`Toggled auto-submit to: ${autoSubmitEnabled ? 'ON' : 'OFF'}`)
  }
})

// Content scripts are now automatically injected via manifest
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    chrome.storage.sync.get(['autoSubmit'], (result) => {
      // Update local variable to keep it in sync
      autoSubmitEnabled = result.autoSubmit || false

      // Content script is now automatically injected via manifest
      // We just need to send a message if auto submit is enabled
      if (autoSubmitEnabled) {
        // Allow the content script time to initialize
        setTimeout(() => {
          console.log(`Auto submit is enabled, sending checkPageChange message to tab ${tabId}`)
          chrome.tabs.sendMessage(tabId, {action: "checkPageChange"}, (response) => {
            // Handle errors due to content script not being ready yet
            if (chrome.runtime.lastError) {
              console.log(`Error sending message: ${chrome.runtime.lastError.message}`)
            }
          })
        }, 500)
      }
    })
  }
})

// Handle page navigation to notify content script
chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId === 0 && details.transitionType !== 'auto_subframe') { // main frame only, not iframes
    console.log(`Navigation detected in tab ${details.tabId}`)
    // We'll let onUpdated handle this now
  }
})

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Message from content script:", message)

  if (message.action === "updateBadge") {
    // Update badge text
    chrome.action.setBadgeText({text: message.text})
    if (message.text === "") {
      // If empty, make sure we update our local state
      autoSubmitEnabled = false
    }
    console.log(`Updated badge text to "${message.text}"`)
  } else if (message.action === "getShortcuts") {
    // Get the configured shortcuts and send them back
    chrome.commands.getAll((commands) => {
      const shortcuts = {}
      commands.forEach(command => {
        shortcuts[command.name] = command.shortcut || "Not Set"
      })
      console.log("Sending shortcuts back to content script:", shortcuts)
      sendResponse(shortcuts)
    })
    // Return true to indicate we'll send response asynchronously
    return true
  }

  // Always return true for async response
  return true
})

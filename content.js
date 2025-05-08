(async () => {
  const settings = await chrome.storage.sync.get(['selectionPattern', 'autoSubmit']);
  const selectionPattern = settings.selectionPattern || 'first';
  const autoSubmitEnabled = settings.autoSubmit || false;

  const autoSelectAndSubmit = async () => {
    const groups = {};

    document.querySelectorAll('input[type="radio"]').forEach((radio) => {
      if (!groups[radio.name]) {
        groups[radio.name] = [];
      }
      groups[radio.name].push(radio);
    });

    if (Object.keys(groups).length === 0) {
      console.log("No radio groups found. Auto-submit will stop.");
      chrome.storage.sync.set({ autoSubmit: false });
      chrome.action.setBadgeText({ text: '' });
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon.png',
        title: 'Auto Submit Stopped',
        message: 'No more forms detected.'
      });
      return;
    }

    Object.entries(groups).forEach(([groupName, radios]) => {
      let selected;
      if (selectionPattern === 'first') {
        selected = radios[0];
      } else if (selectionPattern === 'last') {
        selected = radios[radios.length - 1];
      } else if (selectionPattern === 'random') {
        const randomIndex = Math.floor(Math.random() * radios.length);
        selected = radios[randomIndex];
      }
      if (selected) {
        selected.click();
        console.log(`Group: ${groupName}, Value Selected: ${selected.value}`);
      }
    });

    const submitButton = document.querySelector('button[type="submit"]:not(.previous-button), input[type="submit"]:not(.previous-button)');
    if (submitButton && !submitButton.disabled && submitButton.checkVisibility()) {
      submitButton.click();
      console.log('Form Submitted!');
    }
  };

  // Detect Turbolinks/Rails UJS/Turbo
  const detectRailsFramework = () => {
    // Check for Turbolinks (Rails 5-6)
    const hasTurbolinks = typeof window.Turbolinks !== 'undefined' ||
                         document.querySelector('script[src*="turbolinks"]') !== null;

    // Check for Turbo (Rails 7)
    const hasTurbo = typeof window.Turbo !== 'undefined' ||
                    document.querySelector('script[src*="turbo"]') !== null ||
                    document.querySelector('meta[name="turbo-cache-control"]') !== null;

    // Check for Rails UJS
    const hasRailsUJS = typeof window.Rails !== 'undefined' ||
                        document.querySelector('script[src*="rails-ujs"]') !== null;

    return {
      hasTurbolinks,
      hasTurbo,
      hasRailsUJS,
      hasAnyRailsFramework: hasTurbolinks || hasTurbo || hasRailsUJS
    };
  };

  // Set up listeners for Rails frameworks
  const setupRailsListeners = () => {
    console.log("Setting up Rails framework event listeners");

    // Turbolinks events (Rails 5-6)
    document.addEventListener('turbolinks:load', () => {
      console.log("Turbolinks page loaded, running auto select and submit");
      if (autoSubmitEnabled) {
        autoSelectAndSubmit();
      }
    });

    // Turbo events (Rails 7)
    document.addEventListener('turbo:load', () => {
      console.log("Turbo page loaded, running auto select and submit");
      if (autoSubmitEnabled) {
        autoSelectAndSubmit();
      }
    });

    document.addEventListener('turbo:frame-load', () => {
      console.log("Turbo frame loaded, running auto select and submit");
      if (autoSubmitEnabled) {
        autoSelectAndSubmit();
      }
    });

    document.addEventListener('turbo:render', () => {
      console.log("Turbo render completed, running auto select and submit");
      if (autoSubmitEnabled) {
        setTimeout(() => autoSelectAndSubmit(), 100);
      }
    });

    // Rails UJS events
    document.addEventListener('ajax:complete', () => {
      console.log("Rails AJAX completed, running auto select and submit");
      if (autoSubmitEnabled) {
        setTimeout(() => autoSelectAndSubmit(), 100);
      }
    });

    // Rails 7 Hotwire Stimulus events
    document.addEventListener('stimulus:load', () => {
      console.log("Stimulus loaded, running auto select and submit");
      if (autoSubmitEnabled) {
        setTimeout(() => autoSelectAndSubmit(), 100);
      }
    });
  };

  // Initialize everything
  if (autoSubmitEnabled) {
    // Run immediately for the current page
    await autoSelectAndSubmit();

    // Try to detect Rails frameworks at different stages
    const detectAndSetupRails = () => {
      const railsFramework = detectRailsFramework();
      console.log("Detected Rails framework:", railsFramework);
      
      if (railsFramework.hasAnyRailsFramework) {
        console.log("Rails framework detected, setting up event listeners");
        setupRailsListeners();
        return true;
      }
      return false;
    };

    // First try: Check immediately
    let detected = detectAndSetupRails();
    
    // Second try: Check after DOMContentLoaded
    if (!detected) {
      console.log("No Rails framework detected initially, will try again after DOMContentLoaded");
      
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          console.log("DOMContentLoaded fired, checking again for Rails frameworks");
          detected = detectAndSetupRails();
          
          // Third try: Check with a small delay after DOMContentLoaded
          if (!detected) {
            console.log("No Rails framework detected after DOMContentLoaded, will try again with delay");
            setTimeout(() => {
              console.log("Checking for Rails frameworks after delay");
              detectAndSetupRails();
            }, 500);
          }
        });
      } else {
        // DOMContentLoaded already fired, try with delay
        console.log("DOMContentLoaded already fired, will try with delay");
        setTimeout(() => {
          console.log("Checking for Rails frameworks after delay");
          detectAndSetupRails();
        }, 500);
      }
    }

    // Listen for settings changes
    chrome.storage.onChanged.addListener((changes) => {
      // We don't need to do anything special when settings change
      // Event listeners will stay active
    });
  }
})();

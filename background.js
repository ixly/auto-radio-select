// Initialize from sync storage
let autoSubmitEnabled = false;

// Initialize from sync storage
chrome.storage.sync.get(['autoSubmit'], (result) => {
  autoSubmitEnabled = result.autoSubmit || false;
  chrome.action.setBadgeText({ text: autoSubmitEnabled ? 'ON' : '' });
  if (autoSubmitEnabled) {
    chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
  }
});

chrome.commands.onCommand.addListener((command) => {
  console.log(`Command received: ${command}`);

  if (command === "auto-radio-submit") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      console.log(`Executing content script on tab: ${tabs[0].id}`);
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        files: ["content.js"]
      });
    });
  }

  if (command === "toggle-auto-submit") {
    autoSubmitEnabled = !autoSubmitEnabled;
    chrome.storage.sync.set({ autoSubmit: autoSubmitEnabled });
    chrome.action.setBadgeText({ text: autoSubmitEnabled ? 'ON' : '' });
    chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon.png',
      title: 'Auto Submit Mode',
      message: autoSubmitEnabled ? 'Auto Submit Enabled' : 'Auto Submit Disabled'
    });
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    chrome.storage.sync.get(['autoSubmit'], (result) => {
      // Update local variable to keep it in sync
      autoSubmitEnabled = result.autoSubmit || false;
      
      if (autoSubmitEnabled) {
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ["content.js"]
        });
      }
    });
  }
});

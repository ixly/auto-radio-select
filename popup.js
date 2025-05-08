document.getElementById('saveSettings').addEventListener('click', () => {
  const selectionPattern = document.getElementById('selectionPattern').value
  const autoSubmit = document.getElementById('autoSubmit').checked
  chrome.storage.sync.set({selectionPattern, autoSubmit}, () => {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon.png',
      title: 'Settings Saved',
      message: 'Your selection pattern and auto submit preferences have been saved.'
    })

    // Display visual feedback in the popup itself
    const saveButton = document.getElementById('saveSettings')
    const originalText = saveButton.textContent
    saveButton.textContent = 'Saved!'
    saveButton.disabled = true
    setTimeout(() => {
      saveButton.textContent = originalText
      saveButton.disabled = false
    }, 1500)
  })
})

document.addEventListener('DOMContentLoaded', async () => {
  const settings = await chrome.storage.sync.get(['selectionPattern', 'autoSubmit'])
  if (settings.selectionPattern) {
    document.getElementById('selectionPattern').value = settings.selectionPattern
  }
  
  if (settings.autoSubmit !== undefined) {
    document.getElementById('autoSubmit').checked = settings.autoSubmit
  }

  // Get the actual configured shortcuts
  chrome.commands.getAll((commands) => {
    console.log('Available commands:', commands)
    
    const autoRadioSubmitCommand = commands.find(cmd => cmd.name === 'auto-radio-submit')
    if (autoRadioSubmitCommand) {
      document.getElementById('autoRadioSubmitKey').innerText = autoRadioSubmitCommand.shortcut || 'Not Set'
    }
    
    const toggleAutoSubmitCommand = commands.find(cmd => cmd.name === 'toggle-auto-submit')
    if (toggleAutoSubmitCommand) {
      document.getElementById('toggleAutoSubmitKey').innerText = toggleAutoSubmitCommand.shortcut || 'Not Set'
    }
  })
  
  // Set up the shortcuts link
  document.getElementById('shortcutsLink').addEventListener('click', (e) => {
    e.preventDefault()
    chrome.tabs.create({
      url: 'chrome://extensions/shortcuts'
    })
  })
})

function saveSettings() {
  const selectionPattern = document.getElementById('selectionPattern').value
  const autoSubmit = document.getElementById('autoSubmit').checked
  chrome.storage.sync.set({selectionPattern, autoSubmit}, () => {
    console.log('Settings saved:', { selectionPattern, autoSubmit })
  })
}

// Add change event listeners to save on change
document.getElementById('selectionPattern').addEventListener('change', saveSettings)
document.getElementById('autoSubmit').addEventListener('change', saveSettings)

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

// Popup script for the extension

/**
 * Format exchange rate with appropriate precision
 */
function formatExchangeRate(rate) {
  return rate.toFixed(2);
}

/**
 * Format last update time
 */
function formatLastUpdate(timestamp) {
  if (!timestamp) return 'никогда';
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  
  if (diffMins < 1) return 'только что';
  if (diffMins < 60) return `${diffMins}м назад`;
  if (diffHours < 24) return `${diffHours}ч назад`;
  
  return date.toLocaleDateString('ru-RU');
}

/**
 * Update display with current exchange rate
 */
function updateDisplay() {
  chrome.storage.local.get(['exchangeRate', 'lastFetchTime'], (result) => {
    const rate = result.exchangeRate || 100;
    const lastFetchTime = result.lastFetchTime || 0;
    
    document.getElementById('exchangeRate').textContent = formatExchangeRate(rate);
    document.getElementById('lastUpdate').textContent = formatLastUpdate(lastFetchTime);
  });
}

/**
 * Update exchange rate immediately
 */
function updateExchangeRateNow() {
  const btn = document.getElementById('updateNowBtn');
  const statusDiv = document.getElementById('status');
  
  btn.disabled = true;
  btn.textContent = 'Обновление...';
  statusDiv.textContent = 'Получение курса...';
  statusDiv.classList.add('show');

  fetch('https://api.exchangerate-api.com/v4/latest/USD')
    .then(response => {
      if (!response.ok) throw new Error('Network error');
      return response.json();
    })
    .then(data => {
      const rubRate = data.rates.RUB;
      chrome.storage.local.set({
        exchangeRate: rubRate,
        lastFetchTime: Date.now()
      }, () => {
        updateDisplay();
        statusDiv.textContent = `✓ Курс обновлён: 1 USD = ${rubRate.toFixed(2)} RUB`;
        statusDiv.classList.remove('error');
        btn.textContent = 'Обновить курс сейчас';
        btn.disabled = false;
        
        // Clear status after 3 seconds
        setTimeout(() => {
          statusDiv.classList.remove('show');
        }, 3000);
      });
    })
    .catch(error => {
      console.error('Error updating rate:', error);
      statusDiv.textContent = `✗ Ошибка: ${error.message}`;
      statusDiv.classList.add('error');
      statusDiv.classList.add('show');
      btn.textContent = 'Обновить курс сейчас';
      btn.disabled = false;
      
      // Clear status after 3 seconds
      setTimeout(() => {
        statusDiv.classList.remove('show');
      }, 3000);
    });
}

/**
 * Toggle settings panel
 */
function toggleSettings() {
  const settingsDiv = document.getElementById('settings');
  const btn = document.getElementById('settingsBtn');
  
  if (settingsDiv.style.display === 'none') {
    settingsDiv.style.display = 'block';
    btn.textContent = 'Скрыть параметры';
    loadSettings();
  } else {
    settingsDiv.style.display = 'none';
    btn.textContent = 'Параметры';
  }
}

/**
 * Load settings from storage
 */
function loadSettings() {
  chrome.storage.local.get(['enableConversion', 'onlySalesToggle'], (result) => {
    document.getElementById('enableToggle').checked = result.enableConversion !== false;
    document.getElementById('onlySalesToggle').checked = result.onlySalesToggle === true;
  });
}

/**
 * Save settings to storage
 */
function saveSettings() {
  chrome.storage.local.set({
    enableConversion: document.getElementById('enableToggle').checked,
    onlySalesToggle: document.getElementById('onlySalesToggle').checked
  });
}

// Event listeners
document.getElementById('updateNowBtn').addEventListener('click', updateExchangeRateNow);
document.getElementById('settingsBtn').addEventListener('click', toggleSettings);
document.getElementById('enableToggle').addEventListener('change', saveSettings);
document.getElementById('onlySalesToggle').addEventListener('change', saveSettings);

// Initialize
updateDisplay();

// Update display every 10 seconds
setInterval(updateDisplay, 10000);

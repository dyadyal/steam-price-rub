// Background service worker
chrome.runtime.onInstalled.addListener(() => {
  console.log('Steam Price RUB extension installed');
  
  // Initialize storage
  chrome.storage.local.get(['exchangeRate'], (result) => {
    if (!result.exchangeRate) {
      chrome.storage.local.set({
        exchangeRate: 100, // Default fallback rate
        lastFetchTime: 0
      });
    }
  });
});

// Respond to content script messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getExchangeRate') {
    chrome.storage.local.get(['exchangeRate'], (result) => {
      sendResponse({ rate: result.exchangeRate || 100 });
    });
    return true; // Keep the message channel open for async response
  }
  
  if (request.action === 'updateExchangeRate') {
    chrome.storage.local.set({
      exchangeRate: request.rate,
      lastFetchTime: Date.now()
    });
    sendResponse({ success: true });
  }
});

// Fetch exchange rate periodically (every 30 minutes)
async function updateExchangeRate() {
  try {
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
    const data = await response.json();
    const rubRate = data.rates.RUB;
    
    chrome.storage.local.set({
      exchangeRate: rubRate,
      lastFetchTime: Date.now()
    });
    
    console.log('Exchange rate updated:', rubRate);
  } catch (error) {
    console.error('Error updating exchange rate:', error);
  }
}

// Schedule periodic updates
chrome.alarms.create('updateExchangeRate', { periodInMinutes: 30 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'updateExchangeRate') {
    updateExchangeRate();
  }
});

// Initial update
updateExchangeRate();

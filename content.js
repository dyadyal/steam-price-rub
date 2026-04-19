// Fetch exchange rate and convert prices
const EXCHANGE_RATE_API = 'https://api.exchangerate-api.com/v4/latest/USD';
const CACHE_DURATION = 3600000; // 1 hour in milliseconds

let exchangeRate = null;
let lastFetchTime = 0;

/**
 * Fetch current USD to RUB exchange rate
 */
async function getExchangeRate() {
  const now = Date.now();
  
  // Use cached rate if it's fresh
  if (exchangeRate && (now - lastFetchTime) < CACHE_DURATION) {
    return exchangeRate;
  }

  try {
    const response = await fetch(EXCHANGE_RATE_API);
    if (!response.ok) throw new Error('Failed to fetch exchange rate');
    
    const data = await response.json();
    exchangeRate = data.rates.RUB;
    lastFetchTime = now;
    
    // Store in chrome storage for persistence
    chrome.storage.local.set({
      exchangeRate: exchangeRate,
      lastFetchTime: lastFetchTime
    });
    
    return exchangeRate;
  } catch (error) {
    console.error('Error fetching exchange rate:', error);
    
    // Try to restore from storage
    return new Promise((resolve) => {
      chrome.storage.local.get(['exchangeRate'], (result) => {
        exchangeRate = result.exchangeRate || 100; // Fallback rate
        resolve(exchangeRate);
      });
    });
  }
}

/**
 * Restore cached exchange rate on load
 */
chrome.storage.local.get(['exchangeRate'], (result) => {
  if (result.exchangeRate) {
    exchangeRate = result.exchangeRate;
  }
});

/**
 * Format price in RUB
 */
function formatPrice(price) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(price);
}

/**
 * Convert USD price to RUB
 */
function convertPrice(usdPrice, rate) {
  if (!usdPrice || isNaN(usdPrice) || !rate) return null;
  return Math.round(usdPrice * rate);
}

/**
 * Extract price value from text (handles $19.99, $19,99, etc.)
 */
function extractPrice(text) {
  if (!text) return null;
  const match = text.match(/[\$£€][\s]?(\d+[.,]\d{2})/);
  if (!match) return null;
  return parseFloat(match[1].replace(',', '.'));
}

/**
 * Process price element and add conversion
 */
async function processPriceElement(element, rate) {
  if (!element || !rate) return;
  
  const text = element.textContent.trim();
  const price = extractPrice(text);
  
  if (price === null) return;
  
  const rubPrice = convertPrice(price, rate);
  if (!rubPrice) return;

  // Create converted price element
  const converted = document.createElement('div');
  converted.className = 'steam-price-rub-converted';
  converted.style.cssText = `
    font-size: 0.9em;
    color: #1a9fff;
    font-weight: bold;
    margin-top: 2px;
  `;
  converted.textContent = `≈ ${formatPrice(rubPrice)}`;
  
  // Insert after the original price
  if (element.parentElement) {
    element.parentElement.style.position = 'relative';
    element.parentElement.insertBefore(converted, element.nextSibling);
  }
}

/**
 * Main function to find and convert all prices
 */
async function convertAllPrices() {
  const rate = await getExchangeRate();
  if (!rate) return;

  // Common price selectors on Steam
  const selectors = [
    '.price',                          // Game card prices
    '.discount_original_price',        // Original prices with discount
    '.discount_final_price',           // Discounted prices
    '[data-price-original]',           // Custom price attributes
    '.bundle_purchase_price',          // Bundle prices
    '.game_purchase_price',            // Game purchase prices
    '.package_price',                  // Package prices
    '.regular_price',                  // Regular prices
    '.sale_price',                     // Sale prices
    '[class*="price"]',                // Any element with "price" in class
  ];

  // Remove duplicates while processing
  const processed = new Set();
  
  for (const selector of selectors) {
    try {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        // Skip if already processed
        if (processed.has(element)) continue;
        
        // Skip if element is hidden
        if (element.offsetParent === null) continue;
        
        // Skip if already has conversion
        if (element.parentElement?.querySelector('.steam-price-rub-converted')) {
          processed.add(element);
          continue;
        }

        await processPriceElement(element, rate);
        processed.add(element);
      }
    } catch (error) {
      console.error(`Error processing selector ${selector}:`, error);
    }
  }
}

/**
 * Watch for dynamically loaded content
 */
const observer = new MutationObserver((mutations) => {
  // Debounce the conversion to avoid excessive processing
  clearTimeout(observer.timeout);
  observer.timeout = setTimeout(() => {
    convertAllPrices();
  }, 500);
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: false,
});

// Initial conversion
convertAllPrices();

// Periodically refresh exchange rate (every 30 minutes)
setInterval(() => {
  getExchangeRate();
}, 30 * 60 * 1000);

console.log('Steam Price RUB extension loaded');

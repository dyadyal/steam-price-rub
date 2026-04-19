console.log("Steam RUB loaded");

const RUB_SYMBOL = "\u20bd";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const API_URL = "https://open.er-api.com/v6/latest/USD";
const DEFAULT_RUB_RATES = {
  USD: 100,
  EUR: 110,
  GBP: 128,
  UAH: 2.2,
  KZT: 0.2,
  PLN: 26,
  TRY: 2.6,
  CNY: 14
};

const CURRENCY_PATTERNS = [
  { code: "UAH", regex: /(\d+(?:[.,]\d{1,2})?)\s*\u20b4/g },
  { code: "USD", regex: /\$\s*(\d+(?:[.,]\d{1,2})?)/g },
  { code: "EUR", regex: /\u20ac\s*(\d+(?:[.,]\d{1,2})?)|(\d+(?:[.,]\d{1,2})?)\s*\u20ac/g },
  { code: "GBP", regex: /\u00a3\s*(\d+(?:[.,]\d{1,2})?)/g },
  { code: "KZT", regex: /(\d+(?:[.,]\d{1,2})?)\s*\u20b8/g },
  { code: "PLN", regex: /(\d+(?:[.,]\d{1,2})?)\s*(?:z\u0142|PLN)/gi },
  { code: "TRY", regex: /(\d+(?:[.,]\d{1,2})?)\s*\u20ba|\u20ba\s*(\d+(?:[.,]\d{1,2})?)/g },
  { code: "CNY", regex: /\u00a5\s*(\d+(?:[.,]\d{1,2})?)|(\d+(?:[.,]\d{1,2})?)\s*\u00a5/g }
];

let rubRates = { ...DEFAULT_RUB_RATES };

function storageGet(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (result) => {
      resolve(result);
    });
  });
}

function storageSet(data) {
  return new Promise((resolve) => {
    chrome.storage.local.set(data, () => {
      resolve();
    });
  });
}

function buildRubRates(baseRates) {
  const usdToRub = baseRates.RUB;
  if (!usdToRub || !Number.isFinite(usdToRub)) {
    throw new Error("RUB rate not found");
  }

  return {
    USD: usdToRub,
    EUR: usdToRub / baseRates.EUR,
    GBP: usdToRub / baseRates.GBP,
    UAH: usdToRub / baseRates.UAH,
    KZT: usdToRub / baseRates.KZT,
    PLN: usdToRub / baseRates.PLN,
    TRY: usdToRub / baseRates.TRY,
    CNY: usdToRub / baseRates.CNY
  };
}

async function loadRates() {
  const stored = await storageGet(["rubRates", "rubRatesUpdatedAt"]);
  const isFresh =
    stored.rubRates &&
    stored.rubRatesUpdatedAt &&
    Date.now() - stored.rubRatesUpdatedAt < CACHE_TTL_MS;

  if (isFresh) {
    rubRates = { ...DEFAULT_RUB_RATES, ...stored.rubRates };
    return;
  }

  try {
    const response = await fetch(API_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const nextRates = buildRubRates(data?.rates || {});
    rubRates = nextRates;

    await storageSet({
      rubRates: nextRates,
      rubRatesUpdatedAt: Date.now()
    });
  } catch (error) {
    if (stored.rubRates) {
      rubRates = { ...DEFAULT_RUB_RATES, ...stored.rubRates };
    }
  }
}

function formatRub(value) {
  return `${Math.round(value).toLocaleString("ru-RU")} ${RUB_SYMBOL}`;
}

function replacePattern(text, pattern, currencyCode) {
  const rate = rubRates[currencyCode];
  if (!rate) {
    return text;
  }

  return text.replace(pattern, (...args) => {
    const match = args[0];
    const groups = args.slice(1, -2);
    const rawAmount = groups.find((value) => typeof value === "string" && value.length > 0);

    if (!rawAmount) {
      return match;
    }

    if (match.includes(`(${RUB_SYMBOL}`) || match.includes(` ${RUB_SYMBOL})`)) {
      return match;
    }

    const numericValue = Number.parseFloat(rawAmount.replace(",", "."));
    if (!Number.isFinite(numericValue)) {
      return match;
    }

    return `${match} (${formatRub(numericValue * rate)})`;
  });
}

function replacePricesInText(text) {
  let nextText = text;

  for (const pattern of CURRENCY_PATTERNS) {
    nextText = replacePattern(nextText, pattern.regex, pattern.code);
  }

  return nextText;
}

function shouldSkipNode(node) {
  const parent = node.parentElement;
  if (!parent) {
    return true;
  }

  const tagName = parent.tagName;
  return tagName === "SCRIPT" || tagName === "STYLE" || tagName === "NOSCRIPT";
}

function hasSupportedCurrency(text) {
  return /[\u20b4$\u20ac\u00a3\u20b8\u20ba\u00a5]|PLN|z\u0142/i.test(text);
}

function processTextNode(node) {
  if (!node || shouldSkipNode(node)) {
    return;
  }

  const sourceText = node.textContent || "";
  if (!hasSupportedCurrency(sourceText)) {
    return;
  }

  const updatedText = replacePricesInText(sourceText);
  if (updatedText !== sourceText) {
    node.textContent = updatedText;
  }
}

function scanPage(root = document.body) {
  if (!root) {
    return;
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();

  while (node) {
    processTextNode(node);
    node = walker.nextNode();
  }
}

function initObserver() {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const addedNode of mutation.addedNodes) {
        if (addedNode.nodeType === Node.TEXT_NODE) {
          processTextNode(addedNode);
          continue;
        }

        if (addedNode.nodeType === Node.ELEMENT_NODE) {
          scanPage(addedNode);
        }
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

async function init() {
  await loadRates();
  scanPage();
  initObserver();
}

init();

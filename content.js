console.log("Steam RUB loaded");

const DEFAULT_UAH_TO_RUB = 2.2;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const API_URL = "https://open.er-api.com/v6/latest/UAH";
const UAH_SYMBOL = "\u20b4";
const RUB_SYMBOL = "\u20bd";
const PRICE_PATTERN = new RegExp(`(\\d+(?:[.,]\\d{1,2})?)\\s*${UAH_SYMBOL}`, "g");

let uahToRub = DEFAULT_UAH_TO_RUB;

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

async function loadRate() {
  const stored = await storageGet(["uahToRub", "uahToRubUpdatedAt"]);
  const isFresh =
    stored.uahToRub &&
    stored.uahToRubUpdatedAt &&
    Date.now() - stored.uahToRubUpdatedAt < CACHE_TTL_MS;

  if (isFresh) {
    uahToRub = stored.uahToRub;
    return;
  }

  try {
    const response = await fetch(API_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const nextRate = data?.rates?.RUB;

    if (typeof nextRate === "number" && Number.isFinite(nextRate) && nextRate > 0) {
      uahToRub = nextRate;
      await storageSet({
        uahToRub: nextRate,
        uahToRubUpdatedAt: Date.now()
      });
      return;
    }

    throw new Error("RUB rate not found");
  } catch (error) {
    if (stored.uahToRub) {
      uahToRub = stored.uahToRub;
    }
  }
}

function toRubText(value) {
  const rubValue = Math.round(value * uahToRub);
  return `${rubValue} ${RUB_SYMBOL}`;
}

function replacePricesInText(text) {
  return text.replace(PRICE_PATTERN, (match, amount) => {
    if (match.includes(`(${RUB_SYMBOL}`) || match.includes(` ${RUB_SYMBOL})`)) {
      return match;
    }

    const numericValue = Number.parseFloat(amount.replace(",", "."));
    if (!Number.isFinite(numericValue)) {
      return match;
    }

    return `${match} (${toRubText(numericValue)})`;
  });
}

function shouldSkipNode(node) {
  const parent = node.parentElement;
  if (!parent) {
    return true;
  }

  const tagName = parent.tagName;
  return tagName === "SCRIPT" || tagName === "STYLE" || tagName === "NOSCRIPT";
}

function processTextNode(node) {
  if (!node || shouldSkipNode(node)) {
    return;
  }

  const sourceText = node.textContent || "";
  if (!sourceText.includes(UAH_SYMBOL)) {
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
  await loadRate();
  scanPage();
  initObserver();
}

init();

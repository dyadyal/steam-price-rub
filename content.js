console.log("Steam RUB loaded");

const UAH_TO_RUB = 2.2;
const UAH_SYMBOL = "\u20b4";
const RUB_SYMBOL = "\u20bd";
const PROCESSED_FLAG = "steamRubProcessed";
const PRICE_PATTERN = new RegExp(`(\\d+(?:[.,]\\d{1,2})?)\\s*${UAH_SYMBOL}`, "g");

function toRubText(value) {
  const rubValue = Math.round(value * UAH_TO_RUB);
  return `${rubValue} ${RUB_SYMBOL}`;
}

function replacePricesInText(text) {
  return text.replace(PRICE_PATTERN, (match, amount) => {
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
  if (!node || node[PROCESSED_FLAG]) {
    return;
  }

  if (shouldSkipNode(node)) {
    node[PROCESSED_FLAG] = true;
    return;
  }

  const sourceText = node.textContent || "";
  if (!sourceText.includes(UAH_SYMBOL)) {
    node[PROCESSED_FLAG] = true;
    return;
  }

  const updatedText = replacePricesInText(sourceText);
  if (updatedText !== sourceText) {
    node.textContent = updatedText;
  }

  node[PROCESSED_FLAG] = true;
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

scanPage();
initObserver();

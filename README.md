# Steam RUB

Minimal Chrome extension that scans the current page on `store.steampowered.com`, finds prices in Ukrainian hryvnia, and adds the converted ruble value next to them.

Example:

```text
33₴ -> 33₴ (73 ₽)
```

## Features

- Minimal project structure
- Works on `store.steampowered.com`
- Scans visible page text
- Converts `₴` prices to `₽`

## Project Files

```text
steam-price-rub/
├── manifest.json
├── content.js
└── README.md
```

## Installation

1. Open `chrome://extensions`
2. Enable Developer mode
3. Click `Load unpacked`
4. Select this project folder

## Current Logic

- The extension looks for prices in the format `33₴`
- The conversion uses a fixed rate: `1 UAH = 2.2 RUB`
- The original price is preserved, and the ruble value is appended next to it

## Notes

- This is a simple MVP
- The exchange rate is currently hardcoded
- Only the `₴` currency is supported right now

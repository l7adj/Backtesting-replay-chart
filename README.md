# Backtesting Replay Chart

Clean TradingView-like replay chart and trade journaling MVP built with React, Vite, TypeScript, and TradingView's free `lightweight-charts` library.

## Features

- TradingView-like dark chart workspace
- Candlestick chart with volume
- Market watchlist
- Timeframe selector
- Replay controls: play, pause, step, reset, speed
- Manual trade entry: Buy / Sell
- Manual close position
- Trade journal
- Basic stats: closed trades, win rate, total PnL

## Run locally

```bash
npm install
npm run dev
```

Open the URL shown in the terminal.

## Notes

This MVP uses generated demo candles. The next step is replacing generated candles with a real datafeed such as Binance, Bybit, Twelve Data, Polygon, or your own backend.

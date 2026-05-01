import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CandlestickSeries,
  createChart,
  HistogramSeries,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type ISeriesApi,
} from 'lightweight-charts';
import { BarChart3, Pause, Play, RotateCcw, SkipForward, TrendingDown, TrendingUp } from 'lucide-react';

type Side = 'long' | 'short';
type SymbolName = 'BTCUSDT' | 'ETHUSDT' | 'SOLUSDT' | 'EURUSD' | 'XAUUSD';

type ReplayCandle = CandlestickData & {
  volume: number;
};

type Trade = {
  id: number;
  side: Side;
  symbol: SymbolName;
  entryTime: string;
  exitTime?: string;
  entry: number;
  exit?: number;
  qty: number;
  pnl?: number;
  status: 'open' | 'closed';
};

const symbols: { symbol: SymbolName; label: string; seed: number; price: number }[] = [
  { symbol: 'BTCUSDT', label: 'Bitcoin', seed: 911, price: 64000 },
  { symbol: 'ETHUSDT', label: 'Ethereum', seed: 317, price: 3200 },
  { symbol: 'SOLUSDT', label: 'Solana', seed: 129, price: 145 },
  { symbol: 'EURUSD', label: 'Euro / Dollar', seed: 70, price: 1.08 },
  { symbol: 'XAUUSD', label: 'Gold', seed: 1947, price: 2350 },
];

const timeframes = ['1m', '5m', '15m', '1h', '4h'];
const speeds = [1, 2, 5, 10];

function seeded(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function dateAt(index: number, timeframe: string) {
  const step: Record<string, number> = { '1m': 1, '5m': 5, '15m': 15, '1h': 60, '4h': 240 };
  const date = new Date('2025-01-01T00:00:00Z');
  date.setMinutes(date.getMinutes() + index * (step[timeframe] ?? 15));
  return Math.floor(date.getTime() / 1000) as CandlestickData['time'];
}

function generateCandles(symbol: SymbolName, timeframe: string): ReplayCandle[] {
  const config = symbols.find((item) => item.symbol === symbol) ?? symbols[0];
  let price = config.price;
  const candles: ReplayCandle[] = [];

  for (let i = 0; i < 900; i += 1) {
    const wave = Math.sin(i / 21) * price * 0.0009;
    const noise = (seeded(config.seed + i * 13) - 0.5) * price * 0.004;
    const open = price;
    const close = Math.max(0.0001, open + wave + noise);
    const spread = Math.abs(close - open) + price * (0.001 + seeded(config.seed + i * 7) * 0.003);
    const high = Math.max(open, close) + spread * seeded(config.seed + i * 3);
    const low = Math.min(open, close) - spread * seeded(config.seed + i * 5);
    const volume = Math.round(1000 + seeded(config.seed + i * 19) * 120000);

    candles.push({
      time: dateAt(i, timeframe),
      open: Number(open.toFixed(symbol.includes('USD') && price < 10 ? 5 : 2)),
      high: Number(high.toFixed(symbol.includes('USD') && price < 10 ? 5 : 2)),
      low: Number(low.toFixed(symbol.includes('USD') && price < 10 ? 5 : 2)),
      close: Number(close.toFixed(symbol.includes('USD') && price < 10 ? 5 : 2)),
      volume,
    });
    price = close;
  }

  return candles;
}

function formatPrice(value: number) {
  if (value < 10) return value.toFixed(5);
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function timeLabel(time: CandlestickData['time']) {
  if (typeof time === 'number') return new Date(time * 1000).toLocaleString();
  if (typeof time === 'string') return time;
  return `${time.year}-${time.month}-${time.day}`;
}

function calculatePnl(trade: Trade, exit: number) {
  const diff = trade.side === 'long' ? exit - trade.entry : trade.entry - exit;
  return Number((diff * trade.qty).toFixed(2));
}

export default function App() {
  const chartNode = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  const [symbol, setSymbol] = useState<SymbolName>('BTCUSDT');
  const [timeframe, setTimeframe] = useState('15m');
  const [cursor, setCursor] = useState(140);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(2);
  const [qty, setQty] = useState(1);
  const [trades, setTrades] = useState<Trade[]>([]);

  const allCandles = useMemo(() => generateCandles(symbol, timeframe), [symbol, timeframe]);
  const visibleCandles = allCandles.slice(0, cursor);
  const current = visibleCandles[visibleCandles.length - 1];
  const previous = visibleCandles[visibleCandles.length - 2] ?? current;
  const change = current ? current.close - previous.close : 0;
  const changePercent = previous ? (change / previous.close) * 100 : 0;
  const openTrade = trades.find((trade) => trade.status === 'open');
  const closedTrades = trades.filter((trade) => trade.status === 'closed');
  const totalPnl = closedTrades.reduce((sum, trade) => sum + (trade.pnl ?? 0), 0);
  const wins = closedTrades.filter((trade) => (trade.pnl ?? 0) > 0).length;
  const winRate = closedTrades.length ? (wins / closedTrades.length) * 100 : 0;

  useEffect(() => {
    if (!chartNode.current) return;

    const chart = createChart(chartNode.current, {
      autoSize: true,
      layout: {
        background: { color: '#070b13' },
        textColor: '#b6c2d9',
      },
      grid: {
        vertLines: { color: 'rgba(148, 163, 184, 0.08)' },
        horzLines: { color: 'rgba(148, 163, 184, 0.08)' },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: 'rgba(148, 163, 184, 0.18)',
        scaleMargins: { top: 0.08, bottom: 0.23 },
      },
      timeScale: {
        borderColor: 'rgba(148, 163, 184, 0.18)',
        timeVisible: true,
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
      borderVisible: false,
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: '',
      lastValueVisible: false,
      priceLineVisible: false,
    });

    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

    chartRef.current = chart;
    candlesRef.current = candleSeries;
    volumeRef.current = volumeSeries;

    return () => chart.remove();
  }, []);

  useEffect(() => {
    const candleSeries = candlesRef.current;
    const volumeSeries = volumeRef.current;
    if (!candleSeries || !volumeSeries) return;

    candleSeries.setData(visibleCandles.map(({ volume: _volume, ...candle }) => candle));
    volumeSeries.setData(
      visibleCandles.map((candle) => ({
        time: candle.time,
        value: candle.volume,
        color: candle.close >= candle.open ? 'rgba(34,197,94,.28)' : 'rgba(239,68,68,.28)',
      })) as HistogramData[],
    );

    chartRef.current?.timeScale().fitContent();
  }, [visibleCandles]);

  useEffect(() => {
    setCursor(140);
    setPlaying(false);
    setTrades([]);
  }, [symbol, timeframe]);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setCursor((value) => Math.min(value + 1, allCandles.length));
    }, Math.max(80, 700 / speed));
    return () => window.clearInterval(id);
  }, [playing, speed, allCandles.length]);

  const resetReplay = () => {
    setPlaying(false);
    setCursor(140);
    setTrades([]);
  };

  const stepForward = () => setCursor((value) => Math.min(value + 1, allCandles.length));

  const openPosition = (side: Side) => {
    if (!current || openTrade) return;
    setTrades((items) => [
      {
        id: Date.now(),
        side,
        symbol,
        entryTime: timeLabel(current.time),
        entry: current.close,
        qty,
        status: 'open',
      },
      ...items,
    ]);
  };

  const closePosition = () => {
    if (!current || !openTrade) return;
    setTrades((items) =>
      items.map((trade) =>
        trade.id === openTrade.id
          ? {
              ...trade,
              exitTime: timeLabel(current.time),
              exit: current.close,
              pnl: calculatePnl(trade, current.close),
              status: 'closed',
            }
          : trade,
      ),
    );
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon"><BarChart3 size={22} /></div>
          <div>
            <h1>Backtesting Replay Chart</h1>
            <p>TradingView-like replay and trade journaling workspace</p>
          </div>
        </div>
        <div className="top-metrics">
          <div><span>Closed trades</span><strong>{closedTrades.length}</strong></div>
          <div><span>Win rate</span><strong>{winRate.toFixed(1)}%</strong></div>
          <div><span>Total PnL</span><strong className={totalPnl >= 0 ? 'green' : 'red'}>{totalPnl.toFixed(2)}</strong></div>
        </div>
      </header>

      <section className="workspace">
        <aside className="left-panel panel">
          <h2>Markets</h2>
          <div className="market-list">
            {symbols.map((item) => (
              <button key={item.symbol} className={item.symbol === symbol ? 'active market' : 'market'} onClick={() => setSymbol(item.symbol)}>
                <span><b>{item.symbol}</b><small>{item.label}</small></span>
                <small>{formatPrice(item.price)}</small>
              </button>
            ))}
          </div>

          <h2>Timeframe</h2>
          <div className="timeframes">
            {timeframes.map((frame) => (
              <button key={frame} className={frame === timeframe ? 'active' : ''} onClick={() => setTimeframe(frame)}>{frame}</button>
            ))}
          </div>
        </aside>

        <section className="chart-card panel">
          <div className="chart-header">
            <div>
              <div className="symbol-title">
                <h2>{symbol}</h2>
                <span className={change >= 0 ? 'green pill' : 'red pill'}>{change >= 0 ? '+' : ''}{formatPrice(change)} / {changePercent.toFixed(2)}%</span>
              </div>
              {current && <p>O {formatPrice(current.open)} · H {formatPrice(current.high)} · L {formatPrice(current.low)} · C {formatPrice(current.close)}</p>}
            </div>
            <div className="replay-controls">
              <button onClick={() => setPlaying((value) => !value)}>{playing ? <Pause size={16} /> : <Play size={16} />} {playing ? 'Pause' : 'Play'}</button>
              <button onClick={stepForward}><SkipForward size={16} /> Step</button>
              <button onClick={resetReplay}><RotateCcw size={16} /> Reset</button>
              <select value={speed} onChange={(event) => setSpeed(Number(event.target.value))}>
                {speeds.map((item) => <option key={item} value={item}>x{item}</option>)}
              </select>
            </div>
          </div>

          <div className="progress-row">
            <input type="range" min={50} max={allCandles.length} value={cursor} onChange={(event) => setCursor(Number(event.target.value))} />
            <span>{cursor}/{allCandles.length}</span>
          </div>
          <div ref={chartNode} className="chart-host" />
        </section>

        <aside className="right-panel">
          <div className="panel trade-ticket">
            <h2>Trade Ticket</h2>
            <label>Quantity<input type="number" value={qty} min={0.01} step={0.01} onChange={(event) => setQty(Number(event.target.value))} /></label>
            <div className="ticket-buttons">
              <button className="buy" disabled={!!openTrade} onClick={() => openPosition('long')}><TrendingUp size={16} /> Buy</button>
              <button className="sell" disabled={!!openTrade} onClick={() => openPosition('short')}><TrendingDown size={16} /> Sell</button>
            </div>
            <button className="close-button" disabled={!openTrade} onClick={closePosition}>Close position</button>
            {openTrade && <div className="open-box"><span>Open {openTrade.side}</span><b>{formatPrice(openTrade.entry)}</b></div>}
          </div>

          <div className="panel journal">
            <h2>Trade Journal</h2>
            <div className="trade-list">
              {trades.length === 0 && <p className="empty">No trades yet. Use replay then buy/sell.</p>}
              {trades.map((trade) => (
                <div className="trade-row" key={trade.id}>
                  <div>
                    <b className={trade.side === 'long' ? 'green' : 'red'}>{trade.side.toUpperCase()} {trade.symbol}</b>
                    <small>{trade.entryTime}</small>
                    {trade.exitTime && <small>Exit: {trade.exitTime}</small>}
                  </div>
                  <div className="trade-values">
                    <span>{formatPrice(trade.entry)} {trade.exit ? `→ ${formatPrice(trade.exit)}` : ''}</span>
                    <b className={(trade.pnl ?? 0) >= 0 ? 'green' : 'red'}>{trade.status === 'open' ? 'OPEN' : trade.pnl?.toFixed(2)}</b>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

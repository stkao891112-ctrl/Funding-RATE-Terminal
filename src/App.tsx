/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Settings, 
  RefreshCcw, 
  Plus, 
  Trash2, 
  Monitor, 
  Layout, 
  ChevronRight, 
  TrendingUp, 
  TrendingDown,
  Clock,
  ExternalLink,
  ChevronDown,
  Palette,
  Terminal,
  Columns
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types & Constants ---
type Theme = 'terminal' | 'swiss' | 'matrix';
type Period = '8H' | '1D' | '1Y';

const EXCHANGES = ['Binance', 'OKX', 'Bybit', 'Bitget', 'Backpack', 'Hyperliquid'];
const MULTI_PAIR_COINS = ['BTC', 'ETH', 'SOL'];
const PERIOD_MULT = { '8H': 1, '1D': 3, '1Y': 1095 };

const INITIAL_COINS = ['BTC', 'ETH', 'SOL', 'HYPE', 'PAXG', 'XAUT', 'BNB', 'XRP', 'AAVE', 'DOGE', 'ADA', 'SUI', 'TAO', 'UNI', 'DOT', 'LIT'];

interface RateData {
  [coin: string]: {
    Exchanges: {
      [exchange: string]: {
        USDT: number | string | null;
        USDC: number | string | null;
        USD?: number | string | null;
      };
    };
  };
}

interface ApiResponse {
  status: string;
  data: RateData;
  message?: string;
  cached?: boolean;
  age?: number;
}

// --- Icons Mapping ---
const ICON_MAP: Record<string, string> = {
  BTC: 'https://assets.coingecko.com/coins/images/1/standard/bitcoin.png',
  ETH: 'https://assets.coingecko.com/coins/images/279/standard/ethereum.png',
  SOL: 'https://assets.coingecko.com/coins/images/4128/standard/solana.png',
  HYPE: 'https://assets.coingecko.com/coins/images/50882/standard/hyperliquid.jpg',
  PAXG: 'https://assets.coingecko.com/coins/images/9519/small/paxg.PNG',
  XAUT: 'https://assets.coingecko.com/coins/images/10481/standard/Tether_Gold.png',
  BNB: 'https://assets.coingecko.com/coins/images/825/standard/bnb-icon2_2x.png',
  XRP: 'https://assets.coingecko.com/coins/images/44/standard/xrp-symbol-white-128.png',
  AAVE: 'https://assets.coingecko.com/coins/images/12645/standard/aave-token-round.png',
  DOGE: 'https://assets.coingecko.com/coins/images/5/standard/dogecoin.png',
  ADA: 'https://assets.coingecko.com/coins/images/975/standard/cardano.png',
  SUI: 'https://assets.coingecko.com/coins/images/26375/standard/sui_asset.jpeg',
  TAO: 'https://assets.coingecko.com/coins/images/28452/standard/ARUsPeNQ_400x400.jpeg',
  UNI: 'https://assets.coingecko.com/coins/images/12504/standard/uni.jpg',
  DOT: 'https://assets.coingecko.com/coins/images/12171/standard/polkadot.png',
  LIT: 'https://assets.coingecko.com/coins/images/71121/standard/lighter.png',
};

export default function App() {
  const [theme, setTheme] = useState<Theme>('terminal');
  const [coins, setCoins] = useState<string[]>(INITIAL_COINS);
  const [activeExchanges, setActiveExchanges] = useState<Set<string>>(new Set(EXCHANGES));
  const [period, setPeriod] = useState<Period>('1Y');
  const [data, setData] = useState<RateData>({});
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [isFetching, setIsFetching] = useState(false);
  const [timer, setTimer] = useState(30);
  const [newCoin, setNewCoin] = useState('');

  // Styles based on theme
  const getThemeClasses = useCallback(() => {
    switch (theme) {
      case 'matrix':
        return {
          bg: 'bg-[#000800] text-[#00ff41] font-mono selection:bg-[#00ff41] selection:text-black',
          card: 'bg-[#001200] border-[#004d00]',
          header: 'border-[#004d00] bg-[#000d00]',
          button: 'bg-[#001a00] border-[#00ff41] text-[#00ff41] hover:bg-[#00ff41] hover:text-black',
          accent: 'text-[#00ff41]',
          muted: 'text-[#006400]',
          border: 'border-[#004d00]',
          tableHead: 'bg-[#001a00] text-[#00ff41]',
          pos: 'text-[#00ff41]',
          neg: 'text-[#ff3131]',
        };
      case 'swiss':
        return {
          bg: 'bg-[#f7f5f2] text-[#1a1a1a] font-sans selection:bg-[#1a1a1a] selection:text-white',
          card: 'bg-white border-[#e5e5e5] shadow-sm',
          header: 'border-[#e5e5e5] bg-white',
          button: 'bg-white border-[#1a1a1a] text-[#1a1a1a] hover:bg-[#1a1a1a] hover:text-white',
          accent: 'text-[#1a1a1a]',
          muted: 'text-[#8c8c8c]',
          border: 'border-[#e5e5e5]',
          tableHead: 'bg-[#f0f0f0] text-[#1a1a1a]',
          pos: 'text-[#059669]',
          neg: 'text-[#dc2626]',
        };
      case 'terminal':
      default:
        return {
          bg: 'bg-[#0d0d0f] text-[#e2e2e7] font-sans selection:bg-[#00ff9d] selection:text-black',
          card: 'bg-[#151518] border-[#202024]',
          header: 'border-[#202024] bg-[#0d0d0f]/80 backdrop-blur-md',
          button: 'bg-[#1c1c1f] border-[#2c2c31] text-white hover:border-[#00ff9d] hover:text-[#00ff9d]',
          accent: 'text-[#00ff9d]',
          muted: 'text-[#71717a]',
          border: 'border-[#202024]',
          tableHead: 'bg-[#1c1c1f] text-[#e2e2e7]',
          pos: 'text-[#00ff9d]',
          neg: 'text-[#ff4d4d]',
        };
    }
  }, [theme]);

  const classes = getThemeClasses();

  const fetchRates = useCallback(async () => {
    if (isFetching) return;
    setIsFetching(true);
    try {
      // Assuming /api/funding as in user code
      const response = await fetch(`/api/funding?assets=${coins.join(',')}`);
      
      let result: ApiResponse;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        result = await response.json();
      } else {
        const text = await response.text();
        console.error('Non-JSON response received:', text);
        throw new Error(`Expected JSON but received ${contentType || 'text'}. Check console for details.`);
      }

      if (!response.ok) {
        throw new Error(result.message || `HTTP error! status: ${response.status}`);
      }
      
      if (result.status === 'success') {
        setData(result.data);
        const now = new Date();
        setLastUpdate(now.toLocaleTimeString());
      }
    } catch (error) {
      console.error('Fetch error:', error);
      setLastUpdate('Fetch Error: Check Console');
      // 不再靜默顯示模擬數據，讓用戶看到問題
    } finally {
      setIsFetching(false);
      setTimer(30);
    }
  }, [coins, isFetching]);

  useEffect(() => {
    fetchRates();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          fetchRates();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [fetchRates]);

  const toggleExchange = (ex: string) => {
    const next = new Set(activeExchanges);
    if (next.has(ex)) next.delete(ex);
    else next.add(ex);
    setActiveExchanges(next);
  };

  const addCoin = () => {
    const c = newCoin.trim().toUpperCase();
    if (c && !coins.includes(c)) {
      setCoins([...coins, c]);
      setNewCoin('');
    }
  };

  const removeCoin = (c: string) => {
    setCoins(coins.filter(item => item !== c));
  };

  const formatPercentage = (val: number | string | null | undefined) => {
    if (val === null || val === undefined) return null;
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(num)) return null;
    
    const calculated = num * PERIOD_MULT[period];
    const isPos = calculated > 0;
    const valueStr = Math.abs(calculated).toFixed(period === '1Y' ? 2 : 4);
    
    return {
      text: `${isPos ? '+' : '-'}${valueStr}%`,
      className: isPos ? classes.pos : classes.neg,
    };
  };

  const visibleExchanges = useMemo(() => 
    EXCHANGES.filter(ex => activeExchanges.has(ex)), 
  [activeExchanges]);

  // Theme icons helper
  const getThemeIcon = (t: Theme) => {
    switch(t) {
      case 'terminal': return <Terminal size={12} />;
      case 'swiss': return <Columns size={12} />;
      case 'matrix': return <Monitor size={12} />;
    }
  };

  return (
    <div className={`min-h-screen transition-colors duration-500 pb-20 ${classes.bg}`}>
      {/* --- Sticky Header --- */}
      <header className={`sticky top-0 z-50 border-b px-4 py-3 flex items-center justify-between ${classes.header}`}>
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${classes.button}`}>
            <TrendingUp size={18} className={classes.accent} />
          </div>
          <div className="flex flex-col">
            <h1 className="text-sm font-bold tracking-widest uppercase">
              Funding Terminal
            </h1>
            <div className="flex items-center gap-2">
               <div className={`w-1.5 h-1.5 rounded-full ${isFetching ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`} />
               <span className={`text-[8px] font-bold uppercase ${classes.muted}`}>
                 {isFetching ? 'Syncing...' : 'Live'} • {timer}s
               </span>
            </div>
          </div>
        </div>

        {/* --- THEME PICKER IN HEADER --- */}
        <div className="flex items-center gap-2 md:gap-4">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/20 border border-white/5">
            <Palette size={12} className={classes.muted} />
            <div className="flex gap-1">
              {(['terminal', 'swiss', 'matrix'] as Theme[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`flex items-center gap-1 px-2 py-1 rounded transition-all text-[9px] font-bold uppercase ${
                    theme === t ? classes.accent + ' bg-white/10 ring-1 ring-white/10' : 'opacity-30 hover:opacity-100'
                  }`}
                  title={`Switch to ${t} theme`}
                >
                  {getThemeIcon(t)}
                  <span className="hidden sm:inline">{t}</span>
                </button>
              ))}
            </div>
          </div>
          
          <button 
            onClick={fetchRates}
            className={`p-2 rounded-full transition-all active:scale-95 ${classes.button} ${isFetching ? 'animate-spin' : ''}`}
          >
            <RefreshCcw size={16} />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-2 sm:px-4 mt-6 space-y-6 sm:space-y-8">
        {/* --- Top Controls --- */}
        <section className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
          {/* Period Controls */}
          <div className={`p-4 sm:p-5 rounded-xl border ${classes.card}`}>
            <label className={`text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] mb-3 sm:mb-4 block ${classes.muted}`}>Monitoring Period</label>
            <div className="flex flex-wrap gap-4 sm:gap-6">
              <div className="space-y-2 sm:space-y-3">
                <span className="text-[10px] sm:text-[11px] font-bold block">Aggregation Window</span>
                <div className="flex gap-1 sm:gap-2 p-1 rounded-lg bg-black/20 w-fit border border-white/5">
                  {(['8H', '1D', '1Y'] as Period[]).map(p => (
                    <button
                      key={p}
                      onClick={() => setPeriod(p)}
                      className={`px-3 sm:px-4 py-1.5 rounded-md text-[9px] sm:text-[10px] font-bold uppercase transition-all ${
                        period === p ? classes.accent + ' bg-white/5 shadow-lg shadow-black/20' : 'opacity-40 hover:opacity-100'
                      }`}
                    >
                      {p === '8H' ? '8H' : p === '1D' ? '1D' : '1Y'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Add Coin */}
          <div className={`col-span-1 lg:col-span-3 p-4 sm:p-5 rounded-xl border ${classes.card}`}>
             <label className={`text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] mb-3 sm:mb-4 block ${classes.muted}`}>Asset Monitor</label>
             <div className="flex gap-2">
               <input 
                type="text"
                value={newCoin}
                onChange={(e) => setNewCoin(e.target.value)}
                placeholder="Ticker (e.g. BTC)"
                className={`bg-transparent border-b outline-none px-2 py-1 text-sm flex-1 ${classes.border} focus:border-white transition-colors w-full`}
                onKeyDown={(e) => e.key === 'Enter' && addCoin()}
               />
               <button 
                onClick={addCoin}
                className={`flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-[10px] sm:text-xs font-bold ${classes.button}`}
               >
                 <Plus size={14} /> Add
               </button>
             </div>
             
             <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-4 max-h-24 overflow-y-auto no-scrollbar">
               {coins.map(c => (
                 <motion.span 
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  key={c}
                  className={`inline-flex items-center gap-1.5 sm:gap-2 px-2 py-1 rounded border text-[9px] sm:text-[10px] font-mono ${classes.card}`}
                 >
                   {c}
                   <button onClick={() => removeCoin(c)} className="opacity-50 hover:opacity-100 hover:text-red-500">
                     <Trash2 size={10} />
                   </button>
                 </motion.span>
               ))}
             </div>
          </div>
        </section>

        {/* --- Exchanges Filter --- */}
        <section className={`p-3 sm:p-4 rounded-xl border ${classes.card}`}>
          <div className="flex items-center justify-between mb-3 px-1">
            <span className={`text-[8px] sm:text-[9px] font-bold uppercase tracking-widest ${classes.muted}`}>Hubs</span>
            <button 
              onClick={() => setActiveExchanges(new Set(EXCHANGES))}
              className={`text-[8px] sm:text-[9px] font-bold uppercase underline underline-offset-4 ${classes.accent}`}
            >
              Reset
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {EXCHANGES.map(ex => (
              <button
                key={ex}
                onClick={() => toggleExchange(ex)}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg border text-[10px] sm:text-[11px] font-bold transition-all ${
                  activeExchanges.has(ex) 
                    ? `bg-white/5 border-white/20 text-white` 
                    : `opacity-30 grayscale border-transparent`
                } hover:opacity-100 hover:grayscale-0`}
              >
                {ex}
              </button>
            ))}
          </div>
        </section>

        {/* --- Main Data Table --- */}
        <section className="overflow-hidden">
          <div className={`rounded-xl border shadow-2xl overflow-x-auto no-scrollbar ${classes.card}`}>
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className={`${classes.tableHead}`}>
                  <th className="py-5 px-4 sm:px-6 sticky left-0 z-10 bg-inherit border-b border-r border-[#ffffff08] w-[140px] sm:w-[200px]">
                    <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest opacity-50">Asset</span>
                  </th>
                  {visibleExchanges.map(ex => (
                    <th key={ex} className="py-5 px-4 border-b border-[#ffffff08] text-center">
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-50">{ex}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence mode="popLayout">
                  {coins.map((coin, idx) => {
                    const coinRates = data[coin];
                    const isMulti = MULTI_PAIR_COINS.includes(coin);

                    return (
                      <motion.tr 
                        key={coin}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className={`group border-b last:border-0 ${classes.border} hover:bg-white/[0.02] transition-colors`}
                      >
                        <td className="py-4 px-4 sm:px-6 sticky left-0 z-10 bg-inherit border-r border-[#ffffff08]">
                          <div className="flex items-center gap-2 sm:gap-4">
                            {ICON_MAP[coin] ? (
                              <img src={ICON_MAP[coin]} alt={coin} className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-black/20 p-0.5" referrerPolicy="no-referrer" />
                            ) : (
                              <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[9px] sm:text-[10px] font-black ${classes.button}`}>
                                {coin.slice(0, 2)}
                              </div>
                            )}
                            <div className="flex flex-col gap-0.5">
                              <span className="text-xs sm:text-sm font-bold tracking-tight">{coin}</span>
                              <span className={`text-[8px] sm:text-[9px] uppercase font-mono ${classes.muted}`}>PERP</span>
                            </div>
                          </div>
                        </td>

                        {visibleExchanges.map(ex => {
                          const exData = coinRates?.Exchanges?.[ex];
                          const isSpecialEx = ex === 'Backpack' || ex === 'Hyperliquid';
                          
                          if (!exData) {
                            return (
                              <td key={ex} className="py-4 px-4 text-center">
                                <span className="opacity-10">—</span>
                              </td>
                            );
                          }

                          if (isSpecialEx) {
                            const rate = formatPercentage(exData.USDC || exData.USDT);
                            const isHero = MULTI_PAIR_COINS.includes(coin);
                            return (
                              <td key={ex} className="py-4 px-4 text-center">
                                {rate ? (
                                  <span className={`${isHero ? 'text-base sm:text-lg' : 'text-xs sm:text-sm'} font-mono font-bold ${rate.className}`}>{rate.text}</span>
                                ) : <span className="opacity-10">—</span>}
                              </td>
                            );
                          }

                          if (isMulti) {
                            // Render multi-pair rows
                            const usdt = formatPercentage(exData.USDT);
                            const usdc = formatPercentage(exData.USDC);
                            const usd = formatPercentage(exData.USD);
                            const isHero = MULTI_PAIR_COINS.includes(coin);

                            return (
                              <td key={ex} className="py-4 px-4">
                                <div className="space-y-1.5 flex flex-col items-center">
                                  {usdt && (
                                    <div className={`flex items-center justify-between ${isHero ? 'w-28 px-3 py-1' : 'w-24 px-2 py-0.5'} rounded bg-black/10 border border-white/[0.03]`}>
                                      <span className="text-[8px] font-bold text-green-500/60 uppercase">USDT</span>
                                      <span className={`${isHero ? 'text-xs sm:text-sm' : 'text-[9px] sm:text-[10px]'} font-mono font-bold ${usdt.className}`}>{usdt.text}</span>
                                    </div>
                                  )}
                                  {usdc && (
                                    <div className={`flex items-center justify-between ${isHero ? 'w-24 sm:w-28 px-2 sm:px-3 py-1' : 'w-20 sm:w-24 px-1 sm:px-2 py-0.5'} rounded bg-black/10 border border-white/[0.03]`}>
                                      <span className="text-[8px] font-bold text-blue-400/60 uppercase">USDC</span>
                                      <span className={`${isHero ? 'text-xs sm:text-sm' : 'text-[9px] sm:text-[10px]'} font-mono font-bold ${usdc.className}`}>{usdc.text}</span>
                                    </div>
                                  )}
                                  {usd && (
                                    <div className={`flex items-center justify-between ${isHero ? 'w-24 sm:w-28 px-2 sm:px-3 py-1' : 'w-20 sm:w-24 px-1 sm:px-2 py-0.5'} rounded bg-black/10 border border-white/[0.03]`}>
                                      <span className="text-[8px] font-bold text-yellow-500/60 uppercase">COIN</span>
                                      <span className={`${isHero ? 'text-xs sm:text-sm' : 'text-[9px] sm:text-[10px]'} font-mono font-bold ${usd.className}`}>{usd.text}</span>
                                    </div>
                                  )}
                                </div>
                              </td>
                            );
                          }

                          const mainRate = formatPercentage(exData.USDT || exData.USDC);
                          const isHero = MULTI_PAIR_COINS.includes(coin);
                          return (
                            <td key={ex} className="py-4 px-4 text-center">
                               {mainRate ? (
                                <span className={`${isHero ? 'text-base sm:text-lg' : 'text-xs sm:text-sm'} font-mono font-bold ${mainRate.className}`}>{mainRate.text}</span>
                               ) : <span className="opacity-10">—</span>}
                            </td>
                          )
                        })}
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </section>

        {/* --- Footer Stats --- */}
        <footer className={`flex flex-col md:flex-row items-center justify-between gap-4 py-8 border-t border-dashed ${classes.border}`}>
          <div className="flex items-center gap-6">
            <div className="flex flex-col">
              <span className={`text-[9px] uppercase font-bold ${classes.muted}`}>Last Sync</span>
              <span className="text-xs font-mono">{lastUpdate || 'Waiting...'}</span>
            </div>
            <div className="flex flex-col">
              <span className={`text-[9px] uppercase font-bold ${classes.muted}`}>Monitoring</span>
              <span className="text-xs font-mono">{coins.length} Assets / {activeExchanges.size} Hubs</span>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
             <Clock size={12} className={classes.muted} />
             <span className={`text-[10px] font-bold uppercase ${classes.muted}`}>Real-time Execution Engine</span>
          </div>
        </footer>
      </main>

      {/* --- Float Navigation (Mobile) --- */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] block md:hidden">
        <div className="flex items-center gap-2 p-2 rounded-2xl bg-black/80 backdrop-blur-xl border border-white/10 shadow-2xl">
           <button className="p-3 rounded-xl bg-white/10 text-white"><Layout size={20} /></button>
           <button className="p-3 rounded-xl opacity-50"><Settings size={20} /></button>
           <button className="p-3 rounded-xl opacity-50"><Monitor size={20} /></button>
        </div>
      </div>
    </div>
  );
}

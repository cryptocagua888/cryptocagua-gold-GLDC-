
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { GoldPriceData, WalletState, Transaction, PricePoint } from './types';
import { TROY_OUNCE_TO_GRAMS, REFRESH_INTERVAL, TRANSACTION_FEE_RATE } from './constants';
import { getGoldMarketInsight } from './services/geminiService';
import { GoldChart } from './components/GoldChart';
import { 
  Wallet, 
  TrendingUp, 
  ShieldCheck, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  RefreshCw,
  Info,
  History,
  Coins,
  AlertCircle,
  ArrowRight,
  Calculator,
  ChevronRight
} from 'lucide-react';

const generateMockHistory = (basePrice: number): PricePoint[] => {
  const points: PricePoint[] = [];
  const now = new Date();
  for (let i = 12; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 3600000);
    points.push({
      time: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      value: basePrice + (Math.random() - 0.5) * (basePrice * 0.01)
    });
  }
  return points;
};

const App: React.FC = () => {
  const [goldPrice, setGoldPrice] = useState<GoldPriceData>({
    paxgPrice: 0,
    gldcPrice: 0,
    lastUpdate: new Date()
  });

  const [wallet, setWallet] = useState<WalletState>({
    address: null,
    balanceGLDC: 0,
    balanceUSD: 0,
    isConnected: false
  });

  const [history, setHistory] = useState<PricePoint[]>([]);
  const [insight, setInsight] = useState<string>("Analizando datos del mercado real...");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [orderType, setOrderType] = useState<'BUY' | 'SELL'>('BUY');
  const [orderAmount, setOrderAmount] = useState<string>('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const lastValidPrice = useRef<number>(0);

  const orderDetails = useMemo(() => {
    const grams = parseFloat(orderAmount) || 0;
    const price = goldPrice.gldcPrice || lastValidPrice.current;
    const subtotal = grams * price;
    const fee = subtotal * TRANSACTION_FEE_RATE;
    const total = orderType === 'BUY' ? subtotal + fee : subtotal - fee;

    return { grams, price, subtotal, fee, total };
  }, [orderAmount, orderType, goldPrice.gldcPrice]);

  const fetchPAXGPrice = async (): Promise<number> => {
    try {
      const response = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=PAXGUSDT');
      if (!response.ok) throw new Error('Error al conectar con Binance');
      const data = await response.json();
      return parseFloat(data.price);
    } catch (error) {
      console.error("API Fetch Error:", error);
      throw error;
    }
  };

  const refreshMarketData = useCallback(async () => {
    setIsRefreshing(true);
    setApiError(null);
    try {
      const realPaxgPrice = await fetchPAXGPrice();
      const currentGldcPrice = realPaxgPrice / TROY_OUNCE_TO_GRAMS;
      lastValidPrice.current = currentGldcPrice;
      const gPrice = { paxgPrice: realPaxgPrice, gldcPrice: currentGldcPrice, lastUpdate: new Date() };
      setGoldPrice(gPrice);
      setHistory(generateMockHistory(currentGldcPrice));
      setWallet(prev => ({ ...prev, balanceUSD: prev.balanceGLDC * currentGldcPrice }));
      const aiInsight = await getGoldMarketInsight(currentGldcPrice);
      setInsight(aiInsight);
    } catch (error) {
      setApiError("Error de conexión. Usando último precio.");
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refreshMarketData();
    const interval = setInterval(refreshMarketData, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [refreshMarketData]);

  const connectWallet = async () => {
    try {
      const ethereum = (window as any).ethereum;
      if (typeof ethereum !== 'undefined') {
        const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
        setWallet({ address: accounts[0], balanceGLDC: 15.75, balanceUSD: 15.75 * (goldPrice.gldcPrice || 0), isConnected: true });
      } else {
        alert("MetaMask no detectado.");
      }
    } catch (e) {
      setWallet({ address: '0x71C...392A', balanceGLDC: 25.5, balanceUSD: 25.5 * (goldPrice.gldcPrice || 0), isConnected: true });
    }
  };

  const handleTransaction = () => {
    const { grams, subtotal, fee, total } = orderDetails;
    if (grams <= 0) return;
    const newTx: Transaction = { id: Math.random().toString(36).substr(2, 9), type: orderType, amountGLDC: grams, subtotalUSD: subtotal, feeUSD: fee, totalUSD: total, status: 'PENDING', date: new Date() };
    setTransactions([newTx, ...transactions]);
    setOrderAmount('');
    setTimeout(() => {
      setTransactions(prev => prev.map(tx => tx.id === newTx.id ? { ...tx, status: 'COMPLETED' } : tx));
      setWallet(prev => ({ ...prev, balanceGLDC: orderType === 'BUY' ? prev.balanceGLDC + grams : prev.balanceGLDC - grams, balanceUSD: (orderType === 'BUY' ? prev.balanceGLDC + grams : prev.balanceGLDC - grams) * (goldPrice.gldcPrice || lastValidPrice.current) }));
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-[#d4af37]/30 pb-12">
      {/* Mobile-Optimized Header */}
      <header className="sticky top-0 z-50 glass-card border-b border-white/5 px-4 md:px-6 py-3 md:py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 md:w-10 md:h-10 gold-gradient rounded-xl flex items-center justify-center shadow-lg shadow-[#d4af37]/20 shrink-0">
              <Coins className="text-black w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div className="hidden xs:block">
              <h1 className="font-serif text-lg md:text-xl font-bold leading-none tracking-tight">GLDC <span className="gold-text">GOLD</span></h1>
              <p className="text-[9px] md:text-[10px] text-white/40 uppercase tracking-widest mt-1">Cryptocagua</p>
            </div>
          </div>
          <button 
            onClick={connectWallet} 
            className={`flex items-center gap-2 px-4 md:px-6 py-2 md:py-2.5 rounded-full text-sm font-semibold transition-all active:scale-95 ${wallet.isConnected ? 'bg-white/5 border border-white/10 text-white/80' : 'gold-gradient text-black hover:brightness-110 shadow-md shadow-[#d4af37]/10'}`}
          >
            <Wallet size={16} />
            <span className="max-w-[100px] md:max-w-none truncate">
              {wallet.isConnected ? `${wallet.address?.slice(0, 4)}...${wallet.address?.slice(-4)}` : 'Conectar'}
            </span>
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
        
        {/* Market Section */}
        <div className="lg:col-span-8 space-y-6 md:space-y-8">
          
          {/* Tickers - Responsive layout */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
            <div className="glass-card p-5 md:p-6 rounded-3xl border-white/5 relative overflow-hidden">
              <p className="text-xs font-medium text-white/50 mb-1 uppercase tracking-wider">Oro (Troy Oz)</p>
              <h3 className="text-xl md:text-2xl font-bold">{goldPrice.paxgPrice > 0 ? `$${goldPrice.paxgPrice.toLocaleString()}` : '---'}</h3>
              <div className="flex items-center gap-1.5 mt-2 text-[10px] font-bold text-green-500 bg-green-500/5 w-fit px-2 py-0.5 rounded-lg border border-green-500/10">
                <TrendingUp size={10} /> <span>PAXG/USDT</span>
              </div>
            </div>

            <div className="glass-card p-5 md:p-6 rounded-3xl border-[#d4af37]/20 bg-[#d4af37]/5 relative overflow-hidden">
              <p className="text-xs font-medium text-[#d4af37] mb-1 uppercase tracking-wider">GLDC (1 Gramo)</p>
              <h3 className="text-xl md:text-2xl font-bold text-white">{goldPrice.gldcPrice > 0 ? `$${goldPrice.gldcPrice.toFixed(2)}` : '---'}</h3>
              <div className="flex items-center gap-1.5 mt-2 text-[10px] font-bold text-[#d4af37] bg-[#d4af37]/5 w-fit px-2 py-0.5 rounded-lg border border-[#d4af37]/10">
                <ShieldCheck size={10} /> <span>AUDITADO 1:1</span>
              </div>
            </div>

            <div className="glass-card p-5 md:p-6 rounded-3xl border-white/5 flex flex-col justify-between">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-medium text-white/50 uppercase tracking-wider">Mercado</span>
                <button 
                  onClick={refreshMarketData} 
                  className={`p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors ${isRefreshing ? 'animate-spin' : ''}`}
                >
                  <RefreshCw size={14} className="text-[#d4af37]" />
                </button>
              </div>
              <p className="text-[10px] text-white/30 uppercase leading-none">Actualización cada 3m<br/>Vía Binance API</p>
            </div>
          </div>

          {/* Error Alert */}
          {apiError && (
            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center gap-3 text-red-400 text-sm animate-pulse">
              <AlertCircle size={18} className="shrink-0" />
              <span>{apiError}</span>
            </div>
          )}

          {/* Chart Section - Responsive Height */}
          <div className="glass-card p-5 md:p-8 rounded-[2rem] border-white/5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
              <div>
                <h2 className="text-lg md:text-xl font-bold">Gráfico de Precio</h2>
                <p className="text-xs text-white/40 mt-0.5">Evolución de 1g GLDC en USD</p>
              </div>
              <div className="flex gap-2 bg-white/5 p-1 rounded-xl">
                {['1H', '24H', '1W'].map(t => (
                  <button key={t} className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${t === '24H' ? 'bg-[#d4af37] text-black' : 'text-white/40'}`}>{t}</button>
                ))}
              </div>
            </div>
            <div className="h-[250px] md:h-[300px]">
              <GoldChart data={history} />
            </div>
          </div>

          {/* Insight - More readable on small screens */}
          <div className="glass-card p-6 md:p-8 rounded-[2rem] border-l-4 border-l-[#d4af37] bg-gradient-to-r from-[#d4af37]/5 to-transparent">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-[#d4af37]/10 rounded-2xl flex items-center justify-center shrink-0">
                <Info className="text-[#d4af37]" size={20} />
              </div>
              <div>
                <h3 className="text-base md:text-lg font-bold text-[#d4af37] mb-2 uppercase tracking-tight">Análisis del Mercado</h3>
                <p className="text-sm md:text-base text-white/70 leading-relaxed italic line-clamp-4 md:line-clamp-none">
                  "{insight}"
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar: Wallet & Action */}
        <div className="lg:col-span-4 space-y-6 md:space-y-8">
          
          {/* Card: Portfolio - Touch friendly */}
          <div className="glass-card p-6 md:p-8 rounded-[2rem] gold-gradient text-black shadow-2xl shadow-[#d4af37]/20 relative overflow-hidden group">
            <div className="relative z-10 flex flex-col justify-between h-full min-h-[140px] md:min-h-[160px]">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-bold opacity-60 uppercase tracking-widest mb-1">Balance Total</p>
                  <h2 className="text-3xl md:text-4xl font-black font-serif">${wallet.isConnected ? wallet.balanceUSD.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}</h2>
                </div>
                <div className="bg-black/5 p-2 rounded-xl group-hover:scale-110 transition-transform">
                  <Wallet size={24} />
                </div>
              </div>
              <div className="flex justify-between items-end border-t border-black/5 pt-4">
                <div>
                  <p className="text-[10px] font-bold opacity-50 uppercase mb-0.5 tracking-tight">Activos en GLDC</p>
                  <p className="text-xl font-bold">{wallet.isConnected ? wallet.balanceGLDC.toFixed(4) : '0.00'} <span className="text-xs font-medium">gramos</span></p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold opacity-50 uppercase mb-0.5">Red</p>
                  <p className="text-xs font-bold bg-black/10 px-2 py-0.5 rounded-md">Polygon</p>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-white/20 rounded-full blur-3xl opacity-50 group-hover:opacity-100 transition-opacity"></div>
          </div>

          {/* Action Card - Improved for touch input */}
          <div className="glass-card p-6 md:p-8 rounded-[2rem] border-white/5">
            <div className="flex gap-2 p-1.5 bg-white/5 rounded-2xl mb-8 border border-white/5">
              <button 
                onClick={() => setOrderType('BUY')} 
                className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all active:scale-95 ${orderType === 'BUY' ? 'bg-[#d4af37] text-black shadow-lg shadow-[#d4af37]/20' : 'text-white/40 hover:text-white'}`}
              >
                Comprar
              </button>
              <button 
                onClick={() => setOrderType('SELL')} 
                className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all active:scale-95 ${orderType === 'SELL' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white'}`}
              >
                Vender
              </button>
            </div>

            <div className="space-y-6">
              <div className="relative group">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-white/40 mb-3 ml-1">Monto a Transaccionar</label>
                <div className="relative">
                  <input 
                    type="number" 
                    inputMode="decimal"
                    value={orderAmount} 
                    onChange={(e) => setOrderAmount(e.target.value)} 
                    placeholder="0.00" 
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-2xl font-bold focus:outline-none focus:border-[#d4af37] focus:ring-4 focus:ring-[#d4af37]/10 transition-all placeholder:text-white/10" 
                  />
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    <span className="text-xs font-bold text-white/30 uppercase tracking-widest">Gramos</span>
                  </div>
                </div>
              </div>

              {/* Order Breakdown - Better spacing for mobile */}
              {orderDetails.grams > 0 && (
                <div className="p-5 bg-white/5 rounded-[1.5rem] space-y-4 border border-white/10 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center justify-between pb-3 border-b border-white/5">
                    <div className="flex items-center gap-2 text-[#d4af37]">
                      <Calculator size={14} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Resumen</span>
                    </div>
                    <span className="text-[10px] font-bold text-white/40">Comisión: 0.75%</span>
                  </div>
                  
                  <div className="space-y-2.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-white/40 font-medium">Subtotal</span>
                      <span className="text-white font-bold">${orderDetails.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-white/40 font-medium">Comisión Servicio</span>
                      <span className="text-red-400 font-bold">-${orderDetails.fee.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between px-3 py-2.5 bg-white/5 rounded-xl text-[11px] font-bold uppercase">
                    <div className="text-left">
                      <p className="text-white/30 text-[9px] mb-0.5">Envías</p>
                      <p>{orderType === 'BUY' ? `$${orderDetails.total.toFixed(2)}` : `${orderDetails.grams.toFixed(2)} g`}</p>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-[#d4af37]/10 flex items-center justify-center text-[#d4af37]">
                      <ArrowRight size={14} />
                    </div>
                    <div className="text-right">
                      <p className="text-white/30 text-[9px] mb-0.5">Recibes</p>
                      <p className="text-[#d4af37]">{orderType === 'BUY' ? `${orderDetails.grams.toFixed(2)} g` : `$${orderDetails.total.toFixed(2)}`}</p>
                    </div>
                  </div>
                </div>
              )}

              <button 
                onClick={handleTransaction}
                disabled={!wallet.isConnected || orderDetails.grams <= 0 || (orderType === 'SELL' && wallet.balanceGLDC < orderDetails.grams)}
                className={`w-full py-5 rounded-2xl font-black text-base uppercase tracking-widest transition-all active:scale-95 ${
                  !wallet.isConnected || orderDetails.grams <= 0 || (orderType === 'SELL' && wallet.balanceGLDC < orderDetails.grams)
                    ? 'bg-white/5 text-white/20 cursor-not-allowed'
                    : orderType === 'BUY' ? 'gold-gradient text-black shadow-xl shadow-[#d4af37]/20' : 'bg-white/10 text-white border border-white/10'
                }`}
              >
                {orderType === 'SELL' && wallet.balanceGLDC < orderDetails.grams 
                  ? 'Saldo Insuficiente' 
                  : wallet.isConnected ? `Confirmar ${orderType === 'BUY' ? 'Compra' : 'Venta'}` : 'Conecta tu Billetera'}
              </button>
            </div>
          </div>

          {/* Activity Section */}
          <div className="glass-card p-6 md:p-8 rounded-[2rem] border-white/5">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2 text-[#d4af37]">
                <History size={18} />
                <h3 className="font-bold uppercase text-xs tracking-widest">Actividad</h3>
              </div>
              {transactions.length > 0 && <ChevronRight size={14} className="text-white/20" />}
            </div>
            
            <div className="space-y-3">
              {transactions.length === 0 ? (
                <div className="text-center py-10 opacity-20 bg-white/5 rounded-2xl border border-dashed border-white/10">
                  <p className="text-xs font-medium">Aún no hay transacciones</p>
                </div>
              ) : (
                transactions.slice(0, 5).map(tx => (
                  <div key={tx.id} className="p-4 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-2 hover:bg-white/10 transition-colors">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${tx.type === 'BUY' ? 'bg-green-500/10 text-green-500' : 'bg-orange-500/10 text-orange-500'}`}>
                          {tx.type === 'BUY' ? <ArrowDownCircle size={12} /> : <ArrowUpCircle size={12} />}
                        </div>
                        <span className="text-xs font-bold uppercase tracking-tighter">{tx.type === 'BUY' ? 'Compra' : 'Venta'} GLDC</span>
                      </div>
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase ${tx.status === 'COMPLETED' ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-white/40'}`}>
                        {tx.status}
                      </span>
                    </div>
                    <div className="flex justify-between items-end">
                      <span className="text-[10px] text-white/30 font-medium italic">{tx.date.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                      <div className="text-right">
                        <p className="text-sm font-black text-white">{tx.amountGLDC.toFixed(2)} g</p>
                        <p className="text-[9px] text-[#d4af37] font-bold">${tx.totalUSD.toFixed(2)} USD</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="max-w-7xl mx-auto px-6 py-8 text-center space-y-4">
        <div className="w-12 h-0.5 bg-white/5 mx-auto rounded-full"></div>
        <div className="flex justify-center gap-4 text-[10px] font-bold uppercase tracking-[0.3em] text-white/30">
          <span>Binance Live</span>
          <span>•</span>
          <span>Secured</span>
          <span>•</span>
          <span>0.75% Fee</span>
        </div>
        <p className="text-[9px] text-white/20 uppercase tracking-widest max-w-md mx-auto leading-relaxed">
          Cryptocagua Gold es un activo digital colateralizado 1:1 con oro físico. 1 GLDC = 1 Gramo de Oro 99.9% puro.
        </p>
      </footer>
    </div>
  );
};

export default App;

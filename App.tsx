
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { BrowserProvider, formatUnits } from 'ethers';
import { GoldPriceData, WalletState, Transaction, PricePoint } from './types';
import { TROY_OUNCE_TO_GRAMS, REFRESH_INTERVAL, TRANSACTION_FEE_RATE, GLDC_TOKEN_ADDRESS, BSCSCAN_API_KEY } from './constants';
import { getGoldMarketInsight } from './services/geminiService';
import { GoldChart } from './components/GoldChart';
import { 
  RefreshCw,
  Coins,
  X,
  Loader2,
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  CircleDot,
  AlertCircle
} from 'lucide-react';

const App: React.FC = () => {
  // Configuración de administración
  const env = (window as any).process?.env || {};
  const ADMIN_USDT_WALLET = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
  const ADMIN_EMAIL = "soporte@cryptocagua.com";

  // Estados
  const [isAppReady, setIsAppReady] = useState(false);
  const [isWalletConnecting, setIsWalletConnecting] = useState(false);
  const [goldPrice, setGoldPrice] = useState<GoldPriceData>({
    paxgPrice: 2380.50, // Precio base de fallback
    gldcPrice: 2380.50 / TROY_OUNCE_TO_GRAMS,
    lastUpdate: new Date()
  });

  const [wallet, setWallet] = useState<WalletState>({
    address: null,
    balanceGLDC: 0,
    balanceUSD: 0,
    isConnected: false
  });

  const [history, setHistory] = useState<PricePoint[]>([]);
  const [insight, setInsight] = useState<string>("El oro digital GLDC ofrece seguridad y liquidez inmediata.");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [orderType, setOrderType] = useState<'BUY' | 'SELL'>('BUY');
  const [orderAmount, setOrderAmount] = useState<string>('');
  
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showSellModal, setShowSellModal] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [payoutAddress, setPayoutAddress] = useState('');
  const [userName, setUserName] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  const lastValidPrice = useRef<number>(2380.50 / TROY_OUNCE_TO_GRAMS);

  // Cálculos de orden
  const orderDetails = useMemo(() => {
    const grams = parseFloat(orderAmount) || 0;
    const price = goldPrice.gldcPrice || lastValidPrice.current;
    const subtotal = grams * price;
    const fee = subtotal * TRANSACTION_FEE_RATE;
    const total = orderType === 'BUY' ? subtotal + fee : subtotal - fee;
    return { grams, price, subtotal, fee, total };
  }, [orderAmount, orderType, goldPrice.gldcPrice]);

  // Función robusta de balance
  const fetchBalance = useCallback(async (walletAddr: string) => {
    if (!walletAddr || !GLDC_TOKEN_ADDRESS) return;
    try {
      const apiKey = BSCSCAN_API_KEY === 'YourApiKeyToken' ? 'freekey' : BSCSCAN_API_KEY;
      const url = `https://api.bscscan.com/api?module=account&action=tokenbalance&contractaddress=${GLDC_TOKEN_ADDRESS}&address=${walletAddr}&tag=latest&apikey=${apiKey}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === "1") {
        const balance = parseFloat(formatUnits(data.result, 18));
        setWallet(prev => ({
          ...prev,
          balanceGLDC: balance,
          balanceUSD: balance * lastValidPrice.current
        }));
      }
    } catch (e) {
      console.warn("No se pudo obtener el balance de la red.");
    }
  }, []);

  // Sincronización de mercados
  const syncMarkets = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // Intentar Binance
      const res = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=PAXGUSDT');
      if (!res.ok) throw new Error("Binance Down");
      const data = await res.json();
      const realPaxgPrice = parseFloat(data.price);
      const currentGldcPrice = realPaxgPrice / TROY_OUNCE_TO_GRAMS;
      
      lastValidPrice.current = currentGldcPrice;
      setGoldPrice({ paxgPrice: realPaxgPrice, gldcPrice: currentGldcPrice, lastUpdate: new Date() });

      // IA Insights
      const aiInsight = await getGoldMarketInsight(currentGldcPrice);
      if (aiInsight) setInsight(String(aiInsight));

      // Balance si está conectado
      if (wallet.address) fetchBalance(wallet.address);
    } catch (e) {
      console.warn("Usando precios de respaldo por error de red.");
    } finally {
      setIsRefreshing(false);
      setIsAppReady(true);
    }
  }, [wallet.address, fetchBalance]);

  // Generar gráfico simulado
  useEffect(() => {
    const points: PricePoint[] = [];
    const now = new Date();
    for (let i = 15; i >= 0; i--) {
      points.push({
        time: new Date(now.getTime() - i * 3600000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        value: lastValidPrice.current + (Math.random() - 0.5) * 0.5
      });
    }
    setHistory(points);
  }, [goldPrice.gldcPrice]);

  // Ciclo de vida
  useEffect(() => {
    syncMarkets();
    const interval = setInterval(syncMarkets, REFRESH_INTERVAL);
    // Timeout de emergencia: Si en 2 segundos no ha sincronizado, forzar entrada
    const emergencyTimer = setTimeout(() => setIsAppReady(true), 2000);
    return () => {
      clearInterval(interval);
      clearTimeout(emergencyTimer);
    };
  }, [syncMarkets]);

  const connectWallet = async () => {
    const ethereum = (window as any).ethereum;
    if (!ethereum) {
      alert("Instala MetaMask para continuar.");
      return;
    }
    setIsWalletConnecting(true);
    try {
      const provider = new BrowserProvider(ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      setWallet(prev => ({ ...prev, address: accounts[0], isConnected: true }));
      await fetchBalance(accounts[0]);
    } catch (e) {
      console.error(e);
    } finally {
      setIsWalletConnecting(false);
    }
  };

  const handleAction = (extraInfo: string) => {
    const subject = `ORDEN GLDC - ${orderType}`;
    const body = `ID: ${Math.random().toString(36).substr(2, 9).toUpperCase()}\nTipo: ${orderType}\nMonto: ${orderAmount}g\nUsuario: ${wallet.address}\nInfo: ${extraInfo}`;
    window.open(`mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
    setShowPaymentModal(false);
    setShowSellModal(false);
    setOrderAmount('');
  };

  if (!isAppReady) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-8">
        <div className="relative">
          <div className="w-20 h-20 gold-gradient rounded-full animate-ping opacity-20 absolute inset-0"></div>
          <div className="w-20 h-20 gold-gradient rounded-[2rem] animate-spin flex items-center justify-center relative z-10">
            <Coins className="text-black w-10 h-10" />
          </div>
        </div>
        <div className="text-center space-y-2">
          <p className="text-[10px] font-black uppercase tracking-[0.6em] text-[#d4af37]">Sincronizando Cryptocagua</p>
          <p className="text-[9px] text-white/20 uppercase tracking-widest animate-pulse">Cargando reserva de oro física...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-32 animate-fade-in">
      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-[#050505]/90 backdrop-blur-md border-b border-white/5 px-6 py-5 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 gold-gradient rounded-xl flex items-center justify-center shadow-lg">
            <Coins className="text-black w-6 h-6" />
          </div>
          <h1 className="font-serif text-xl font-black tracking-tight">CRYPTOCAGUA <span className="gold-text">GOLD</span></h1>
        </div>
        <button 
          onClick={connectWallet}
          disabled={isWalletConnecting}
          className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${wallet.isConnected ? 'bg-white/5 text-white border border-white/10' : 'gold-gradient text-black shadow-xl hover:scale-105'}`}
        >
          {isWalletConnecting ? <Loader2 className="animate-spin w-4 h-4" /> : wallet.isConnected ? `${wallet.address?.slice(0, 6)}...${wallet.address?.slice(-4)}` : 'Sincronizar Wallet'}
        </button>
      </header>

      <main className="max-w-7xl mx-auto px-6 pt-12 grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* IZQUIERDA: MERCADO */}
        <div className="lg:col-span-8 space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-[#111] p-10 rounded-[3rem] border border-white/5">
              <p className="text-[10px] font-black text-white/30 uppercase mb-2 tracking-widest">Precio Mercado Oz</p>
              <h3 className="text-4xl font-black text-white tracking-tighter">${goldPrice.paxgPrice.toLocaleString()}</h3>
            </div>
            <div className="bg-[#111] p-10 rounded-[3rem] border-2 border-[#d4af37]/40 shadow-2xl relative group transition-all hover:border-[#d4af37]">
              <p className="text-[10px] font-black text-[#d4af37] uppercase mb-2 tracking-widest">GLDC / 1 Gramo Oro</p>
              <h3 className="text-4xl font-black text-white tracking-tighter">${goldPrice.gldcPrice.toFixed(2)}</h3>
              <div className="mt-4 flex items-center gap-2 text-[9px] font-black text-green-400 uppercase">
                <TrendingUp size={14} /> Actualizado {goldPrice.lastUpdate.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
              </div>
            </div>
          </div>

          <div className="bg-[#0a0a0a] p-10 rounded-[3.5rem] border border-white/5 shadow-inner">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-[11px] font-black uppercase tracking-[0.4em] text-white/30">Gráfico de Rendimiento</h2>
              <button onClick={syncMarkets} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                <RefreshCw size={18} className={`${isRefreshing ? 'animate-spin' : ''} text-[#d4af37]`} />
              </button>
            </div>
            <GoldChart data={history} />
          </div>

          <div className="bg-[#d4af37]/5 p-10 rounded-[2.5rem] border border-[#d4af37]/20 flex gap-8 items-center">
            <div className="w-14 h-14 bg-[#d4af37] rounded-2xl flex items-center justify-center shrink-0">
              <ShieldCheck className="text-black" size={28} />
            </div>
            <p className="text-lg font-medium italic text-white/80 leading-relaxed">"{insight}"</p>
          </div>
        </div>

        {/* DERECHA: DASHBOARD */}
        <div className="lg:col-span-4 space-y-10">
          {/* BALANCE DISPLAY - ALTO CONTRASTE */}
          <div className="bg-[#d4af37] p-12 rounded-[4rem] shadow-2xl relative overflow-hidden group">
            <div className="relative z-10">
              <p className="text-[12px] font-black uppercase text-black/60 mb-1 tracking-widest">VALOR EN RESERVA (USD)</p>
              <h2 className="text-6xl font-black text-black tracking-tighter tabular-nums mb-12">
                ${wallet.balanceUSD.toLocaleString(undefined, {minimumFractionDigits:2})}
              </h2>
              <div className="pt-8 border-t border-black/10 flex justify-between items-end">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-black/40 uppercase tracking-widest">Tus Gramos GLDC</p>
                  <p className="text-4xl font-black text-black tabular-nums">{wallet.balanceGLDC.toFixed(3)}g</p>
                </div>
                <div className="text-[9px] font-black bg-black text-[#d4af37] px-4 py-2 rounded-xl uppercase">BSC NET</div>
              </div>
            </div>
            <Coins size={180} className="absolute -bottom-10 -right-10 opacity-10 text-black rotate-12 transition-transform group-hover:scale-110" />
          </div>

          {/* COMPRA/VENTA WIDGET */}
          <div className="bg-[#111] p-10 rounded-[4rem] border border-white/10 shadow-xl">
            <div className="flex bg-black p-2 rounded-3xl mb-12">
              <button onClick={() => setOrderType('BUY')} className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${orderType === 'BUY' ? 'bg-[#d4af37] text-black shadow-lg' : 'text-white/30 hover:text-white'}`}>Comprar</button>
              <button onClick={() => setOrderType('SELL')} className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${orderType === 'SELL' ? 'bg-white text-black shadow-lg' : 'text-white/30 hover:text-white'}`}>Vender</button>
            </div>

            <div className="space-y-8">
              <div className="space-y-4">
                <label className="text-[11px] font-black uppercase text-white/20 ml-4 tracking-[0.2em]">Monto en Gramos</label>
                <div className="relative">
                  <input 
                    type="number" 
                    value={orderAmount} 
                    onChange={(e) => setOrderAmount(e.target.value)} 
                    className="w-full bg-black border-2 border-white/5 rounded-[2.5rem] py-10 text-5xl font-black text-center text-white outline-none focus:border-[#d4af37] transition-all" 
                    placeholder="0.0"
                  />
                  <span className="absolute right-10 top-1/2 -translate-y-1/2 text-white/10 font-black text-xs">GLDC</span>
                </div>
              </div>

              {orderDetails.grams > 0 && (
                <div className="p-8 bg-black/40 rounded-[2.5rem] border border-white/5 space-y-4 animate-fade-in">
                  <div className="flex justify-between text-[11px] font-black uppercase text-white/40"><span>Subtotal</span><span className="text-white">${orderDetails.subtotal.toFixed(2)}</span></div>
                  <div className="flex justify-between text-[11px] font-black uppercase text-white/40"><span>Tarifa Red</span><span className="text-red-400">-${orderDetails.fee.toFixed(2)}</span></div>
                  <div className="pt-6 border-t border-white/10 flex justify-between items-center"><span className="text-[#d4af37] font-black text-xs uppercase tracking-widest">Total</span><span className="text-4xl font-black">${orderDetails.total.toFixed(2)}</span></div>
                </div>
              )}

              <button 
                onClick={() => orderType === 'BUY' ? setShowPaymentModal(true) : setShowSellModal(true)}
                disabled={!wallet.isConnected || orderDetails.grams <= 0}
                className={`w-full py-8 rounded-[2.5rem] font-black uppercase text-[12px] tracking-[0.3em] flex items-center justify-center gap-4 transition-all active:scale-95 shadow-2xl ${wallet.isConnected && orderDetails.grams > 0 ? (orderType === 'BUY' ? 'gold-gradient text-black' : 'bg-white text-black') : 'bg-white/5 text-white/10 cursor-not-allowed'}`}
              >
                {orderType === 'BUY' ? 'Solicitar Oro' : 'Vender Token'}
                <ArrowRight size={20} />
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* MODALES REFORZADOS */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-6 backdrop-blur-3xl animate-fade-in">
          <div className="bg-[#111] w-full max-w-md p-10 rounded-[4rem] border-2 border-[#d4af37]/20 relative shadow-[0_0_100px_rgba(212,175,55,0.1)]">
            <button onClick={() => setShowPaymentModal(false)} className="absolute top-8 right-8 text-white/20 hover:text-white transition-colors"><X size={32}/></button>
            <div className="text-center mb-8">
              <h3 className="text-2xl font-black mb-1">Pago en USDT</h3>
              <p className="text-[10px] text-white/20 uppercase tracking-widest">Protocolo de Fondeo Seguro</p>
            </div>
            <div className="space-y-8">
              <div className="p-8 bg-black rounded-[2.5rem] border border-white/5 text-center">
                <p className="text-[10px] font-black text-[#d4af37] uppercase mb-4 tracking-widest">Dirección USDT (BSC BEP-20)</p>
                <code className="text-[10px] break-all block mb-6 text-white/60 font-mono bg-white/5 p-4 rounded-xl leading-relaxed">{ADMIN_USDT_WALLET}</code>
                <button onClick={() => {navigator.clipboard.writeText(ADMIN_USDT_WALLET); setIsCopied(true); setTimeout(()=>setIsCopied(false),2000)}} className="px-8 py-3 bg-[#d4af37] text-black rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95">
                  {isCopied ? '¡Copiado!' : 'Copiar Wallet'}
                </button>
              </div>
              <div className="bg-[#d4af37] p-8 rounded-[2.5rem] text-center shadow-xl">
                <p className="text-[10px] font-black text-black/60 uppercase mb-1">Pagar Exacto</p>
                <p className="text-5xl font-black text-black">${orderDetails.total.toFixed(2)}</p>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-white/20 ml-4">Hash de Transacción (TXID)</label>
                <input type="text" value={txHash} onChange={(e)=>setTxHash(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl py-6 px-8 text-sm text-[#d4af37] font-mono outline-none focus:border-[#d4af37] transition-all" placeholder="0x..." />
              </div>
              <button onClick={() => handleAction(txHash)} disabled={!txHash} className={`w-full py-7 rounded-[2.5rem] font-black text-[12px] uppercase tracking-[0.4em] ${txHash ? 'gold-gradient text-black shadow-xl' : 'bg-white/5 text-white/10 cursor-not-allowed'}`}>Reportar Pago</button>
            </div>
          </div>
        </div>
      )}

      {showSellModal && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-6 backdrop-blur-3xl animate-fade-in">
          <div className="bg-[#111] w-full max-w-md p-10 rounded-[4rem] border-2 border-white/10 relative">
            <button onClick={() => setShowSellModal(false)} className="absolute top-8 right-8 text-white/20 hover:text-white transition-colors"><X size={32}/></button>
            <div className="text-center mb-8">
              <h3 className="text-2xl font-black mb-1">Venta de GLDC</h3>
              <p className="text-[10px] text-white/20 uppercase tracking-widest">Solicitud de Liquidación</p>
            </div>
            <div className="space-y-8">
              <div className="bg-black p-8 rounded-[2.5rem] border-2 border-[#d4af37]/30 text-center">
                <p className="text-[10px] font-black text-white/40 uppercase mb-1">Recibirás Neto (USDT)</p>
                <p className="text-5xl font-black text-[#d4af37]">${orderDetails.total.toFixed(2)}</p>
              </div>
              <div className="space-y-4">
                <input type="text" value={userName} onChange={(e)=>setUserName(e.target.value)} className="w-full bg-black border border-white/5 rounded-2xl py-6 px-8 text-sm text-white focus:border-[#d4af37] outline-none transition-all" placeholder="Tu nombre completo" />
                <input type="text" value={payoutAddress} onChange={(e)=>setPayoutAddress(e.target.value)} className="w-full bg-black border border-white/5 rounded-2xl py-6 px-8 text-sm text-[#d4af37] font-mono focus:border-[#d4af37] outline-none transition-all" placeholder="Tu Wallet USDT Destino" />
              </div>
              <button onClick={() => handleAction(payoutAddress)} disabled={!payoutAddress || !userName} className={`w-full py-7 rounded-[2.5rem] font-black text-[12px] uppercase tracking-[0.4em] ${payoutAddress && userName ? 'bg-white text-black shadow-xl' : 'bg-white/5 text-white/10 cursor-not-allowed'}`}>Confirmar Solicitud</button>
              <div className="flex items-start gap-3 p-4 bg-red-500/5 rounded-2xl border border-red-500/10">
                <AlertCircle className="text-red-500 shrink-0" size={16} />
                <p className="text-[9px] text-red-500/60 uppercase tracking-wider font-bold">Asegúrate de enviar tus tokens GLDC a la wallet de reserva tras generar esta solicitud.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className="text-center py-24 opacity-10 border-t border-white/5 mt-20">
        <p className="text-[10px] font-black uppercase tracking-[1.5em]">Cryptocagua Gold Reserve • GLDC v6.0</p>
      </footer>
    </div>
  );
};

export default App;

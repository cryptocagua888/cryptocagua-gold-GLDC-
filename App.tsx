
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { BrowserProvider, formatUnits } from 'ethers';
import { GoldPriceData, WalletState, PricePoint } from './types';
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
  Wallet
} from 'lucide-react';

const App: React.FC = () => {
  const ADMIN_USDT_WALLET = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
  const ADMIN_EMAIL = "soporte@cryptocagua.com";
  const AI_UPDATE_THRESHOLD = 1800000; // 30 minutos para evitar error 429

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isWalletConnecting, setIsWalletConnecting] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const [goldPrice, setGoldPrice] = useState<GoldPriceData>({
    paxgPrice: 2450.00,
    gldcPrice: 2450.00 / TROY_OUNCE_TO_GRAMS,
    lastUpdate: new Date()
  });

  const [wallet, setWallet] = useState<WalletState>({
    address: null,
    balanceGLDC: 0,
    balanceUSD: 0,
    isConnected: false
  });

  const [history, setHistory] = useState<PricePoint[]>([]);
  const [insight, setInsight] = useState<string>("Analizando tendencias globales de reserva en oro físico...");
  const [orderType, setOrderType] = useState<'BUY' | 'SELL'>('BUY');
  const [orderAmount, setOrderAmount] = useState<string>('');
  
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showSellModal, setShowSellModal] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [payoutAddress, setPayoutAddress] = useState('');
  const [userName, setUserName] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  const lastValidPrice = useRef<number>(goldPrice.gldcPrice);
  const lastInsightUpdate = useRef<number>(0);

  const orderDetails = useMemo(() => {
    const grams = parseFloat(orderAmount) || 0;
    const price = goldPrice.gldcPrice || lastValidPrice.current;
    const subtotal = grams * price;
    const fee = subtotal * TRANSACTION_FEE_RATE;
    const total = orderType === 'BUY' ? subtotal + fee : subtotal - fee;
    return { grams, price, subtotal, fee, total };
  }, [orderAmount, orderType, goldPrice.gldcPrice]);

  const fetchBalance = useCallback(async (address: string) => {
    if (!address) return;
    try {
      const url = `https://api.bscscan.com/api?module=account&action=tokenbalance&contractaddress=${GLDC_TOKEN_ADDRESS}&address=${address}&tag=latest&apikey=${BSCSCAN_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === '1') {
        const balance = parseFloat(formatUnits(data.result, 18));
        setWallet(prev => ({
          ...prev,
          address: address,
          isConnected: true,
          balanceGLDC: balance,
          balanceUSD: balance * (goldPrice.gldcPrice || lastValidPrice.current)
        }));
      }
    } catch (e) {
      console.error("BscScan fetch error:", e);
    }
  }, [goldPrice.gldcPrice]);

  const syncData = useCallback(async (forceAi = false) => {
    setIsRefreshing(true);
    
    // 1. Precio de mercado
    try {
      const res = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=PAXGUSDT');
      const data = await res.json();
      if (data?.price) {
        const paxg = parseFloat(data.price);
        const gldc = paxg / TROY_OUNCE_TO_GRAMS;
        lastValidPrice.current = gldc;
        setGoldPrice({ paxgPrice: paxg, gldcPrice: gldc, lastUpdate: new Date() });
      }
    } catch (e) {
      console.log("Error de precio, usando valor anterior.");
    } finally {
      setIsRefreshing(false);
    }

    // 2. IA Insight (Solo cada 30 min o si se fuerza manualmente)
    const now = Date.now();
    if (forceAi || (now - lastInsightUpdate.current > AI_UPDATE_THRESHOLD)) {
      setIsAiLoading(true);
      getGoldMarketInsight(lastValidPrice.current).then(res => {
        setInsight(res);
        lastInsightUpdate.current = now;
      }).catch(() => {
        setInsight("El mercado del oro mantiene una resistencia histórica frente a la volatilidad fiat.");
      }).finally(() => {
        setIsAiLoading(false);
      });
    }

    // 3. Saldo de wallet
    if (wallet.address) {
      fetchBalance(wallet.address);
    }
  }, [wallet.address, fetchBalance]);

  useEffect(() => {
    // Primera carga asíncrona pero sin forzar IA si ya hay datos (o respetando el threshold de 0)
    syncData(false); 
    
    const interval = setInterval(() => syncData(false), REFRESH_INTERVAL);

    // Mock Chart Data
    const points: PricePoint[] = [];
    const base = 79.20;
    for (let i = 20; i >= 0; i--) {
      points.push({
        time: `${20-i}:00`,
        value: base + (Math.random() - 0.5) * 4
      });
    }
    setHistory(points);

    return () => clearInterval(interval);
  }, [syncData]);

  const connectWallet = async () => {
    const providerGlobal = (window as any).ethereum;
    if (!providerGlobal) {
      alert("Por favor, instala MetaMask para operar con GLDC.");
      return;
    }
    setIsWalletConnecting(true);
    try {
      const provider = new BrowserProvider(providerGlobal);
      const accounts = await provider.send("eth_requestAccounts", []);
      if (accounts[0]) {
        await fetchBalance(accounts[0]);
      }
    } catch (e) {
      console.error("Connection error:", e);
    } finally {
      setIsWalletConnecting(false);
    }
  };

  const handleAction = (extra: string) => {
    const id = Math.random().toString(36).substr(2, 6).toUpperCase();
    const subject = `ORDEN GLDC - ${orderType} - ${id}`;
    const body = `DETALLE DE OPERACIÓN:\nID: ${id}\nTipo: ${orderType}\nGramos: ${orderAmount}\nTotal USD: $${orderDetails.total.toFixed(2)}\nWallet Usuario: ${wallet.address}\nReferencia: ${extra}`;
    window.open(`mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
    setShowPaymentModal(false);
    setShowSellModal(false);
    setOrderAmount('');
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-20 animate-fade-in">
      {/* NAVBAR */}
      <nav className="sticky top-0 z-50 bg-[#050505]/80 backdrop-blur-xl border-b border-white/5 px-6 lg:px-12 py-5 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 gold-gradient rounded-xl flex items-center justify-center shadow-xl">
            <Coins className="text-black w-6 h-6" />
          </div>
          <h1 className="font-serif text-xl font-black uppercase tracking-tight">Cryptocagua <span className="gold-text">Gold</span></h1>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={() => syncData(true)} // El botón de refrescar sí fuerza la IA
            disabled={isRefreshing || isAiLoading}
            className="p-2.5 bg-white/5 rounded-lg hover:bg-white/10 transition-all border border-white/5 disabled:opacity-50"
            title="Refrescar mercado y análisis"
          >
            <RefreshCw size={16} className={`${(isRefreshing || isAiLoading) ? 'animate-spin' : ''} text-[#d4af37]`} />
          </button>
          
          <button 
            onClick={connectWallet}
            disabled={isWalletConnecting}
            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2 transition-all active:scale-95 ${wallet.isConnected ? 'bg-white/5 border border-white/10' : 'gold-gradient text-black shadow-lg shadow-[#d4af37]/10'}`}
          >
            {isWalletConnecting ? <Loader2 size={14} className="animate-spin" /> : <Wallet size={14} />}
            {wallet.isConnected ? `${wallet.address?.slice(0, 6)}...${wallet.address?.slice(-4)}` : 'Conectar Wallet'}
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 lg:px-12 mt-12 grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 space-y-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-[#111] p-8 rounded-[2.5rem] border border-white/5 relative group transition-all hover:bg-[#151515]">
              <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-2">Onza Troy (PAXG)</p>
              <h3 className="text-5xl font-black tracking-tight">${goldPrice.paxgPrice.toLocaleString(undefined, {minimumFractionDigits: 2})}</h3>
              <div className="mt-4 flex items-center gap-2 text-green-500">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-[9px] font-bold uppercase tracking-tighter">Spot Live</span>
              </div>
            </div>
            
            <div className="bg-[#111] p-8 rounded-[2.5rem] border-2 border-[#d4af37]/20 relative">
              <p className="text-[10px] font-black text-[#d4af37] uppercase tracking-widest mb-2">GLDC Token / 1 Gramo</p>
              <h3 className="text-5xl font-black tracking-tight">${goldPrice.gldcPrice.toFixed(2)}</h3>
              <p className="mt-4 text-[9px] font-bold text-white/40 uppercase">Respaldo Físico Auditado</p>
            </div>
          </div>

          <div className="bg-[#0a0a0a] p-10 rounded-[3rem] border border-white/5 shadow-2xl">
            <div className="flex justify-between items-center mb-10">
              <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20">Gráfico de Referencia 24H</h4>
              <div className="px-3 py-1 bg-[#d4af37]/10 text-[#d4af37] text-[9px] font-bold rounded-full border border-[#d4af37]/20 uppercase tracking-widest">Activo Real</div>
            </div>
            <GoldChart data={history} />
          </div>

          <div className="bg-[#d4af37]/5 p-10 rounded-[2.5rem] border border-[#d4af37]/10 flex items-start gap-8 relative overflow-hidden group">
            <div className="w-12 h-12 bg-[#d4af37] rounded-2xl flex items-center justify-center shrink-0 shadow-xl group-hover:scale-110 transition-transform">
              {isAiLoading ? <Loader2 className="text-black animate-spin" size={24} /> : <ShieldCheck className="text-black" size={24} />}
            </div>
            <div className="relative z-10">
              <p className="text-[9px] font-black uppercase tracking-widest text-[#d4af37]/50 mb-1 flex items-center gap-2">
                Análisis Gemini AI 
                {isAiLoading && <span className="animate-pulse">...procesando</span>}
              </p>
              <p className="text-lg font-medium italic text-white/80 leading-snug">
                "{insight}"
              </p>
            </div>
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <TrendingUp size={80} className="text-[#d4af37]" />
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-10">
          <div className="bg-[#d4af37] p-10 rounded-[3.5rem] shadow-2xl relative overflow-hidden group">
            <div className="relative z-10 text-black">
              <p className="text-[11px] font-black uppercase text-black/40 tracking-wider mb-2">Tu Patrimonio Oro</p>
              <h2 className="text-6xl font-black tracking-tighter mb-8">
                ${wallet.balanceUSD.toLocaleString(undefined, {minimumFractionDigits:2})}
              </h2>
              <div className="pt-8 border-t border-black/10 flex justify-between items-end">
                <div>
                  <p className="text-[10px] font-black text-black/40 uppercase mb-1">Saldo GLDC</p>
                  <p className="text-4xl font-black">{wallet.balanceGLDC.toFixed(4)}g</p>
                </div>
                <div className="px-3 py-1.5 bg-black text-[#d4af37] text-[9px] font-black rounded-lg uppercase tracking-tighter">BSC</div>
              </div>
            </div>
            <Coins size={180} className="absolute -bottom-8 -right-8 opacity-10 text-black rotate-12 group-hover:rotate-0 transition-transform duration-700" />
          </div>

          <div className="bg-[#111] p-10 rounded-[3.5rem] border border-white/5 shadow-2xl">
            <div className="flex bg-black p-2 rounded-3xl mb-10">
              <button onClick={() => setOrderType('BUY')} className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${orderType === 'BUY' ? 'bg-[#d4af37] text-black shadow-lg' : 'text-white/20 hover:text-white'}`}>Adquirir</button>
              <button onClick={() => setOrderType('SELL')} className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${orderType === 'SELL' ? 'bg-white text-black shadow-lg' : 'text-white/20 hover:text-white'}`}>Liquidar</button>
            </div>

            <div className="space-y-8">
              <div className="text-center">
                <label className="text-[10px] font-black uppercase text-white/10 tracking-[0.3em] block mb-4">Monto en Gramos</label>
                <input 
                  type="number" 
                  value={orderAmount}
                  onChange={(e) => setOrderAmount(e.target.value)}
                  className="w-full bg-black border border-white/5 rounded-3xl py-8 text-5xl font-black text-center text-white outline-none focus:border-[#d4af37]/50 transition-all placeholder:text-white/5"
                  placeholder="0.00"
                />
              </div>

              {orderDetails.grams > 0 && (
                <div className="bg-black/50 p-6 rounded-3xl border border-white/5 space-y-3 animate-fade-in shadow-inner">
                  <div className="flex justify-between text-[10px] font-bold uppercase text-white/30"><span>Subtotal</span><span>${orderDetails.subtotal.toFixed(2)}</span></div>
                  <div className="flex justify-between text-[10px] font-bold uppercase text-white/30"><span>Tarifa Gestión</span><span className="text-red-400">-${orderDetails.fee.toFixed(2)}</span></div>
                  <div className="pt-4 border-t border-white/5 flex justify-between items-center"><span className="text-[#d4af37] text-[10px] font-black uppercase tracking-widest">Total Orden</span><span className="text-3xl font-black tracking-tight">${orderDetails.total.toFixed(2)}</span></div>
                </div>
              )}

              <button 
                onClick={() => orderType === 'BUY' ? setShowPaymentModal(true) : setShowSellModal(true)}
                disabled={!wallet.isConnected || orderDetails.grams <= 0}
                className={`w-full py-7 rounded-3xl font-black uppercase text-[11px] tracking-widest flex items-center justify-center gap-3 transition-all active:scale-95 shadow-xl ${wallet.isConnected && orderDetails.grams > 0 ? (orderType === 'BUY' ? 'gold-gradient text-black' : 'bg-white text-black') : 'bg-white/5 text-white/10 cursor-not-allowed'}`}
              >
                {orderType === 'BUY' ? 'Generar Pago' : 'Confirmar Retiro'}
                <ArrowRight size={18} />
              </button>

              {!wallet.isConnected && (
                <p className="text-[9px] text-center text-white/20 uppercase font-bold tracking-widest animate-pulse">Debes conectar tu wallet para operar</p>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* MODALES */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-6 backdrop-blur-2xl animate-fade-in">
          <div className="bg-[#111] w-full max-w-lg p-12 rounded-[3.5rem] border border-[#d4af37]/30 relative shadow-2xl">
            <button onClick={() => setShowPaymentModal(false)} className="absolute top-8 right-8 text-white/10 hover:text-white transition-colors"><X size={32}/></button>
            <h3 className="text-3xl font-black text-center mb-2 uppercase tracking-tighter">Pasarela USDT</h3>
            <p className="text-[10px] text-center text-white/20 uppercase tracking-widest mb-10">Red Binance Smart Chain (BEP-20)</p>
            <div className="space-y-8">
              <div className="p-8 bg-black rounded-3xl border border-white/5 text-center shadow-inner">
                <p className="text-[9px] font-black text-[#d4af37] uppercase mb-3">Dirección de Recepción</p>
                <code className="text-[11px] break-all block mb-6 text-white/50 font-mono bg-white/5 p-4 rounded-xl border border-white/5">{ADMIN_USDT_WALLET}</code>
                <button onClick={() => {navigator.clipboard.writeText(ADMIN_USDT_WALLET); setIsCopied(true); setTimeout(()=>setIsCopied(false),2000)}} className="px-10 py-3.5 bg-[#d4af37] text-black rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95">
                  {isCopied ? 'Copiado con éxito' : 'Copiar Dirección'}
                </button>
              </div>
              <div className="bg-[#d4af37] p-8 rounded-3xl text-center shadow-lg">
                <p className="text-[10px] font-black text-black/40 uppercase mb-1">Total a Depositar</p>
                <p className="text-5xl font-black text-black">${orderDetails.total.toFixed(2)}</p>
              </div>
              <div className="space-y-4">
                <input type="text" value={txHash} onChange={(e)=>setTxHash(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl py-5 px-6 text-[11px] text-[#d4af37] font-mono focus:border-[#d4af37] outline-none transition-all" placeholder="Pega el TXID de tu transferencia" />
                <button onClick={() => handleAction(txHash)} disabled={!txHash} className={`w-full py-6 rounded-2xl font-black text-[11px] uppercase tracking-widest ${txHash ? 'gold-gradient text-black shadow-lg shadow-[#d4af37]/20' : 'bg-white/5 text-white/10 cursor-not-allowed'}`}>Notificar Depósito</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSellModal && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-6 backdrop-blur-2xl animate-fade-in">
          <div className="bg-[#111] w-full max-w-lg p-12 rounded-[3.5rem] border border-white/10 relative shadow-2xl">
            <button onClick={() => setShowSellModal(false)} className="absolute top-8 right-8 text-white/10 hover:text-white"><X size={32}/></button>
            <h3 className="text-3xl font-black text-center mb-2 uppercase tracking-tighter">Venta de GLDC</h3>
            <p className="text-[10px] text-center text-white/20 uppercase tracking-widest mb-10">Recibe USDT en tu Wallet</p>
            <div className="space-y-8">
              <div className="bg-black p-10 rounded-3xl border border-[#d4af37]/30 text-center shadow-inner">
                <p className="text-[10px] font-black text-white/40 uppercase mb-1">Monto de Liquidación</p>
                <p className="text-5xl font-black text-[#d4af37] tracking-tight">${orderDetails.total.toFixed(2)}</p>
              </div>
              <div className="space-y-4">
                <input type="text" value={userName} onChange={(e)=>setUserName(e.target.value)} className="w-full bg-black border border-white/5 rounded-2xl py-5 px-6 text-[11px] text-white focus:border-[#d4af37] outline-none transition-all" placeholder="Tu nombre y apellido" />
                <input type="text" value={payoutAddress} onChange={(e)=>setPayoutAddress(e.target.value)} className="w-full bg-black border border-white/5 rounded-2xl py-5 px-6 text-[11px] text-[#d4af37] font-mono focus:border-[#d4af37] outline-none transition-all" placeholder="Tu Wallet USDT (BEP20)" />
              </div>
              <button onClick={() => handleAction(payoutAddress)} disabled={!payoutAddress || !userName} className={`w-full py-6 rounded-2xl font-black text-[11px] uppercase tracking-widest ${payoutAddress && userName ? 'bg-white text-black shadow-lg' : 'bg-white/5 text-white/10 cursor-not-allowed'}`}>Solicitar Conversión</button>
            </div>
          </div>
        </div>
      )}

      <footer className="max-w-7xl mx-auto px-12 py-20 border-t border-white/5 mt-20 flex flex-col md:flex-row justify-between items-center gap-8 opacity-40">
        <div className="flex items-center gap-3">
          <Coins size={20} className="text-[#d4af37]" />
          <p className="text-[10px] font-black uppercase tracking-widest text-[#d4af37]">Cryptocagua Gold Reserve • 2024</p>
        </div>
        <div className="flex gap-10">
          <span className="text-[9px] font-bold uppercase tracking-widest">Respaldo Físico</span>
          <span className="text-[9px] font-bold uppercase tracking-widest">Contrato Auditado</span>
          <span className="text-[9px] font-bold uppercase tracking-widest">Soporte 24/7</span>
        </div>
      </footer>
    </div>
  );
};

export default App;

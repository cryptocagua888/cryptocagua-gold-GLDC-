
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

  // Inicializamos listos para mostrar la UI
  const [isAppReady, setIsAppReady] = useState(true);
  const [isWalletConnecting, setIsWalletConnecting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Valores por defecto para evitar el blanco inicial
  const [goldPrice, setGoldPrice] = useState<GoldPriceData>({
    paxgPrice: 2400.00,
    gldcPrice: 2400.00 / TROY_OUNCE_TO_GRAMS,
    lastUpdate: new Date()
  });

  const [wallet, setWallet] = useState<WalletState>({
    address: null,
    balanceGLDC: 0,
    balanceUSD: 0,
    isConnected: false
  });

  const [history, setHistory] = useState<PricePoint[]>([]);
  const [insight, setInsight] = useState<string>("Sincronizando datos de mercado...");
  const [orderType, setOrderType] = useState<'BUY' | 'SELL'>('BUY');
  const [orderAmount, setOrderAmount] = useState<string>('');
  
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showSellModal, setShowSellModal] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [payoutAddress, setPayoutAddress] = useState('');
  const [userName, setUserName] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  const lastValidPrice = useRef<number>(2400 / TROY_OUNCE_TO_GRAMS);
  const lastInsightUpdate = useRef<number>(0);

  const orderDetails = useMemo(() => {
    const grams = parseFloat(orderAmount) || 0;
    const price = goldPrice.gldcPrice || lastValidPrice.current;
    const subtotal = grams * price;
    const fee = subtotal * TRANSACTION_FEE_RATE;
    const total = orderType === 'BUY' ? subtotal + fee : subtotal - fee;
    return { grams, price, subtotal, fee, total };
  }, [orderAmount, orderType, goldPrice.gldcPrice]);

  const fetchBalanceBscScan = useCallback(async (address: string) => {
    if (!address || !BSCSCAN_API_KEY) return;
    try {
      const url = `https://api.bscscan.com/api?module=account&action=tokenbalance&contractaddress=${GLDC_TOKEN_ADDRESS}&address=${address}&tag=latest&apikey=${BSCSCAN_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === '1') {
        const balance = parseFloat(formatUnits(data.result, 18));
        setWallet(prev => ({
          ...prev,
          balanceGLDC: balance,
          balanceUSD: balance * lastValidPrice.current
        }));
      }
    } catch (e) {
      console.error("Error al consultar saldo en BscScan:", e);
    }
  }, []);

  const syncMarkets = useCallback(async (forceInsight = false) => {
    setIsRefreshing(true);
    try {
      // Intentamos obtener el precio de Binance
      const res = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=PAXGUSDT').catch(() => null);
      
      if (res && res.ok) {
        const data = await res.json();
        if (data && data.price) {
          const paxg = parseFloat(data.price);
          const gldc = paxg / TROY_OUNCE_TO_GRAMS;
          lastValidPrice.current = gldc;
          setGoldPrice({ paxgPrice: paxg, gldcPrice: gldc, lastUpdate: new Date() });
        }
      }
      
      // Consultamos Insight de Gemini cada 10 min para no agotar cuota
      const now = Date.now();
      if (forceInsight || now - lastInsightUpdate.current > 600000) {
        getGoldMarketInsight(lastValidPrice.current).then(res => {
          setInsight(res);
          lastInsightUpdate.current = now;
        });
      }

      // Si hay billetera, actualizamos saldo
      if (wallet.address) {
        await fetchBalanceBscScan(wallet.address);
      }
    } catch (e) {
      console.error("Error en sincronización de mercado:", e);
    } finally {
      setIsRefreshing(false);
    }
  }, [wallet.address, fetchBalanceBscScan]);

  useEffect(() => {
    // Primera carga rápida de datos
    syncMarkets(true);
    const interval = setInterval(() => syncMarkets(false), REFRESH_INTERVAL);

    // Generar gráfico simulado inicial
    const points: PricePoint[] = [];
    const now = new Date();
    for (let i = 20; i >= 0; i--) {
      points.push({
        time: new Date(now.getTime() - i * 3600000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        value: 75.50 + (Math.random() - 0.5) * 2.5
      });
    }
    setHistory(points);

    return () => clearInterval(interval);
  }, [syncMarkets]);

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
      const userAddress = accounts[0];
      
      setWallet(prev => ({ ...prev, address: userAddress, isConnected: true }));
      
      // Consultar saldo de inmediato tras conectar
      await fetchBalanceBscScan(userAddress);
    } catch (e) {
      console.error("Error conectando MetaMask:", e);
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
    <div className="min-h-screen bg-[#050505] text-white pb-32 animate-fade-in">
      {/* NAVBAR */}
      <nav className="sticky top-0 z-50 bg-[#050505]/95 backdrop-blur-2xl border-b border-white/5 px-10 py-6 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 gold-gradient rounded-2xl flex items-center justify-center shadow-2xl">
            <Coins className="text-black w-7 h-7" />
          </div>
          <h1 className="font-serif text-2xl font-black tracking-tighter uppercase">Cryptocagua <span className="gold-text">Gold</span></h1>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={() => syncMarkets(true)}
            className="p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
            title="Refrescar datos"
          >
            <RefreshCw size={18} className={`${isRefreshing ? 'animate-spin' : ''} text-[#d4af37]`} />
          </button>
          
          <button 
            onClick={connectWallet}
            disabled={isWalletConnecting}
            className={`px-8 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all active:scale-95 flex items-center gap-3 ${wallet.isConnected ? 'bg-white/5 border border-white/10 text-white' : 'gold-gradient text-black shadow-[0_10px_40px_rgba(212,175,55,0.2)] hover:brightness-110'}`}
          >
            {isWalletConnecting ? <Loader2 className="animate-spin w-4 h-4" /> : <Wallet size={16} />}
            {wallet.isConnected ? `${wallet.address?.slice(0, 6)}...${wallet.address?.slice(-4)}` : 'Conectar Billetera'}
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-8 mt-16 grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* COLUMNA IZQUIERDA */}
        <div className="lg:col-span-8 space-y-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-[#111] p-10 rounded-[3.5rem] border border-white/5 relative overflow-hidden transition-all hover:bg-[#151515]">
              <p className="text-[11px] font-black text-white/30 uppercase tracking-[0.4em] mb-3">Onza Troy (PAXG)</p>
              <h3 className="text-6xl font-black tracking-tighter">${goldPrice.paxgPrice.toLocaleString(undefined, {minimumFractionDigits:2})}</h3>
              <div className="absolute top-10 right-10 flex items-center gap-2">
                <span className="text-[9px] font-black text-green-500 uppercase tracking-widest">En Vivo</span>
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              </div>
            </div>
            
            <div className="bg-[#111] p-10 rounded-[3.5rem] border-2 border-[#d4af37]/30 relative overflow-hidden">
              <p className="text-[11px] font-black text-[#d4af37] uppercase tracking-[0.4em] mb-3">GLDC (1 Gramo de Oro)</p>
              <h3 className="text-6xl font-black tracking-tighter text-white">${goldPrice.gldcPrice.toFixed(2)}</h3>
              <p className="text-[10px] font-black text-green-400/80 uppercase mt-5 flex items-center gap-2">
                <TrendingUp size={16}/> Respaldo Físico 100%
              </p>
            </div>
          </div>

          <div className="bg-[#0a0a0a] p-12 rounded-[4.5rem] border border-white/5 shadow-[0_50px_100px_rgba(0,0,0,0.5)]">
            <h4 className="text-[12px] font-black uppercase tracking-[0.5em] text-white/20 mb-12">Rendimiento Histórico del Oro</h4>
            <GoldChart data={history} />
          </div>

          <div className="bg-[#d4af37]/5 p-12 rounded-[3rem] border border-[#d4af37]/10 flex items-start gap-10">
            <div className="w-16 h-16 bg-[#d4af37] rounded-3xl flex items-center justify-center shrink-0 shadow-2xl">
              <ShieldCheck className="text-black" size={32} />
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#d4af37]/50">Estrategia de Inversión (AI)</p>
              <p className="text-xl font-medium italic text-white/90 leading-relaxed">"{insight}"</p>
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA */}
        <div className="lg:col-span-4 space-y-12">
          {/* BALANCE CARD */}
          <div className="bg-[#d4af37] p-14 rounded-[5rem] shadow-[0_40px_120px_rgba(212,175,55,0.2)] relative overflow-hidden group">
            <div className="relative z-10 text-black">
              <p className="text-[13px] font-black uppercase text-black/40 tracking-[0.4em] mb-4">Tus Reservas</p>
              <h2 className="text-7xl font-black tracking-tighter tabular-nums mb-8">
                ${wallet.balanceUSD.toLocaleString(undefined, {minimumFractionDigits:2})}
              </h2>
              <div className="pt-10 border-t border-black/10 flex justify-between items-end">
                <div>
                  <p className="text-[11px] font-black text-black/40 uppercase tracking-widest mb-1">Total GLDC</p>
                  <p className="text-5xl font-black">{wallet.balanceGLDC.toFixed(4)}g</p>
                </div>
                <div className="px-5 py-2.5 bg-black text-[#d4af37] text-[10px] font-black rounded-2xl uppercase tracking-[0.2em]">BSC</div>
              </div>
            </div>
            <Coins size={220} className="absolute -bottom-12 -right-12 opacity-10 text-black rotate-12 transition-transform duration-700 group-hover:scale-125" />
          </div>

          {/* PANEL DE ACCIÓN */}
          <div className="bg-[#111] p-12 rounded-[5rem] border border-white/5 shadow-2xl">
            <div className="flex bg-black p-2.5 rounded-[2.5rem] mb-14">
              <button onClick={() => setOrderType('BUY')} className={`flex-1 py-5 rounded-[2rem] text-[11px] font-black uppercase tracking-widest transition-all ${orderType === 'BUY' ? 'bg-[#d4af37] text-black shadow-xl' : 'text-white/20 hover:text-white'}`}>Adquirir</button>
              <button onClick={() => setOrderType('SELL')} className={`flex-1 py-5 rounded-[2rem] text-[11px] font-black uppercase tracking-widest transition-all ${orderType === 'SELL' ? 'bg-white text-black shadow-xl' : 'text-white/20 hover:text-white'}`}>Liquidar</button>
            </div>

            <div className="space-y-10">
              <div className="text-center space-y-6">
                <label className="text-[12px] font-black uppercase text-white/10 tracking-[0.5em] block">Cantidad en Gramos</label>
                <input 
                  type="number" 
                  value={orderAmount}
                  onChange={(e) => setOrderAmount(e.target.value)}
                  className="w-full bg-black border-2 border-white/5 rounded-[3.5rem] py-12 text-6xl font-black text-center text-white outline-none focus:border-[#d4af37] transition-all placeholder:text-white/5"
                  placeholder="0.00"
                />
              </div>

              {orderDetails.grams > 0 && (
                <div className="bg-black/60 p-10 rounded-[3.5rem] border border-white/5 space-y-5 animate-fade-in shadow-inner">
                  <div className="flex justify-between text-[11px] font-black uppercase text-white/30"><span>Subtotal</span><span>${orderDetails.subtotal.toFixed(2)}</span></div>
                  <div className="flex justify-between text-[11px] font-black uppercase text-white/30"><span>Comisión (0.75%)</span><span className="text-red-400">-${orderDetails.fee.toFixed(2)}</span></div>
                  <div className="pt-8 border-t border-white/10 flex justify-between items-center"><span className="text-[#d4af37] text-[11px] font-black uppercase tracking-widest">Total a pagar</span><span className="text-4xl font-black tracking-tighter">${orderDetails.total.toFixed(2)}</span></div>
                </div>
              )}

              <button 
                onClick={() => orderType === 'BUY' ? setShowPaymentModal(true) : setShowSellModal(true)}
                disabled={!wallet.isConnected || orderDetails.grams <= 0}
                className={`w-full py-10 rounded-[3.5rem] font-black uppercase text-[13px] tracking-[0.4em] flex items-center justify-center gap-5 transition-all active:scale-95 shadow-[0_20px_60px_rgba(0,0,0,0.3)] ${wallet.isConnected && orderDetails.grams > 0 ? (orderType === 'BUY' ? 'gold-gradient text-black' : 'bg-white text-black') : 'bg-white/5 text-white/10 cursor-not-allowed'}`}
              >
                {orderType === 'BUY' ? 'Confirmar Compra' : 'Solicitar Retiro'}
                <ArrowRight size={24} />
              </button>

              {!wallet.isConnected && (
                <p className="text-[10px] text-center text-white/30 uppercase tracking-widest">Conecta tu wallet para operar</p>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* MODAL COMPRA */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[100] bg-black/98 flex items-center justify-center p-8 backdrop-blur-3xl animate-fade-in">
          <div className="bg-[#111] w-full max-w-xl p-16 rounded-[5rem] border-2 border-[#d4af37]/30 relative shadow-[0_0_150px_rgba(212,175,55,0.15)]">
            <button onClick={() => setShowPaymentModal(false)} className="absolute top-12 right-12 text-white/10 hover:text-white transition-colors"><X size={48}/></button>
            <h3 className="text-4xl font-black text-center mb-2 tracking-tighter uppercase">Pasarela USDT</h3>
            <p className="text-[11px] text-center text-white/20 uppercase tracking-[0.5em] mb-16">Depósito Seguro Red BEP-20</p>
            <div className="space-y-12">
              <div className="p-10 bg-black rounded-[4rem] border border-white/5 text-center shadow-inner">
                <p className="text-[11px] font-black text-[#d4af37] uppercase tracking-[0.3em] mb-5">Wallet de Recepción</p>
                <code className="text-[12px] break-all block mb-10 text-white/50 font-mono bg-white/5 p-6 rounded-3xl border border-white/5">{ADMIN_USDT_WALLET}</code>
                <button onClick={() => {navigator.clipboard.writeText(ADMIN_USDT_WALLET); setIsCopied(true); setTimeout(()=>setIsCopied(false),2000)}} className="px-14 py-5 bg-[#d4af37] text-black rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-90 shadow-xl">
                  {isCopied ? '¡Copiado!' : 'Copiar Wallet'}
                </button>
              </div>
              <div className="bg-[#d4af37] p-12 rounded-[4rem] text-center shadow-2xl">
                <p className="text-[12px] font-black text-black/40 uppercase mb-2">Monto exacto a enviar</p>
                <p className="text-6xl font-black text-black tracking-tighter">${orderDetails.total.toFixed(2)}</p>
              </div>
              <div className="space-y-4">
                <input type="text" value={txHash} onChange={(e)=>setTxHash(e.target.value)} className="w-full bg-black border-2 border-white/10 rounded-3xl py-7 px-10 text-sm text-[#d4af37] font-mono outline-none focus:border-[#d4af37] transition-all" placeholder="TXID de la transferencia" />
                <button onClick={() => handleAction(txHash)} disabled={!txHash} className={`w-full py-9 rounded-[3rem] font-black text-[13px] uppercase tracking-widest ${txHash ? 'gold-gradient text-black shadow-2xl shadow-[#d4af37]/20' : 'bg-white/5 text-white/10 cursor-not-allowed'}`}>Notificar Pago</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL VENTA */}
      {showSellModal && (
        <div className="fixed inset-0 z-[100] bg-black/98 flex items-center justify-center p-8 backdrop-blur-3xl animate-fade-in">
          <div className="bg-[#111] w-full max-w-xl p-16 rounded-[5rem] border-2 border-white/10 relative">
            <button onClick={() => setShowSellModal(false)} className="absolute top-12 right-12 text-white/10 hover:text-white transition-colors"><X size={48}/></button>
            <h3 className="text-4xl font-black text-center mb-2 tracking-tighter uppercase">Liquidación</h3>
            <p className="text-[11px] text-center text-white/20 uppercase tracking-[0.5em] mb-16">Recibe USDT en tu Wallet</p>
            <div className="space-y-12">
              <div className="bg-black p-12 rounded-[4rem] border-2 border-[#d4af37]/30 text-center shadow-2xl">
                <p className="text-[12px] font-black text-white/40 uppercase mb-2">USD a recibir (Neto)</p>
                <p className="text-6xl font-black text-[#d4af37] tracking-tighter">${orderDetails.total.toFixed(2)}</p>
              </div>
              <div className="space-y-6">
                <input type="text" value={userName} onChange={(e)=>setUserName(e.target.value)} className="w-full bg-black border-2 border-white/5 rounded-3xl py-7 px-10 text-sm text-white focus:border-white transition-all" placeholder="Nombre completo del titular" />
                <input type="text" value={payoutAddress} onChange={(e)=>setPayoutAddress(e.target.value)} className="w-full bg-black border-2 border-white/5 rounded-3xl py-7 px-10 text-sm text-[#d4af37] font-mono focus:border-[#d4af37] transition-all" placeholder="Wallet USDT Destino (BEP20)" />
              </div>
              <button onClick={() => handleAction(payoutAddress)} disabled={!payoutAddress || !userName} className={`w-full py-9 rounded-[3rem] font-black text-[13px] uppercase tracking-widest ${payoutAddress && userName ? 'bg-white text-black shadow-2xl' : 'bg-white/5 text-white/10 cursor-not-allowed'}`}>Procesar Retiro</button>
            </div>
          </div>
        </div>
      )}

      <footer className="text-center py-20 opacity-20 border-t border-white/5 mt-20">
        <p className="text-[10px] font-black uppercase tracking-[2em] text-[#d4af37]">Cryptocagua Gold • Reserva Física Auditada</p>
      </footer>
    </div>
  );
};

export default App;

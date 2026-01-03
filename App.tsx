
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { BrowserProvider, Contract, formatUnits } from 'ethers';
import { GoldPriceData, WalletState, Transaction, PricePoint } from './types';
import { TROY_OUNCE_TO_GRAMS, REFRESH_INTERVAL, TRANSACTION_FEE_RATE, GLDC_TOKEN_ADDRESS } from './constants';
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
  AlertCircle,
  ExternalLink
} from 'lucide-react';

const ERC20_ABI = ["function balanceOf(address) view returns (uint256)"];

const App: React.FC = () => {
  const ADMIN_USDT_WALLET = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
  const ADMIN_EMAIL = "soporte@cryptocagua.com";

  // Estados de carga
  const [isAppReady, setIsAppReady] = useState(false);
  const [isWalletConnecting, setIsWalletConnecting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Datos de Mercado
  const [goldPrice, setGoldPrice] = useState<GoldPriceData>({
    paxgPrice: 2350.00,
    gldcPrice: 2350.00 / TROY_OUNCE_TO_GRAMS,
    lastUpdate: new Date()
  });

  const [wallet, setWallet] = useState<WalletState>({
    address: null,
    balanceGLDC: 0,
    balanceUSD: 0,
    isConnected: false
  });

  const [history, setHistory] = useState<PricePoint[]>([]);
  const [insight, setInsight] = useState<string>("El oro digital es la reserva de valor definitiva.");
  const [orderType, setOrderType] = useState<'BUY' | 'SELL'>('BUY');
  const [orderAmount, setOrderAmount] = useState<string>('');
  
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showSellModal, setShowSellModal] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [payoutAddress, setPayoutAddress] = useState('');
  const [userName, setUserName] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  const lastValidPrice = useRef<number>(2350 / TROY_OUNCE_TO_GRAMS);

  // Cálculos dinámicos
  const orderDetails = useMemo(() => {
    const grams = parseFloat(orderAmount) || 0;
    const price = goldPrice.gldcPrice || lastValidPrice.current;
    const subtotal = grams * price;
    const fee = subtotal * TRANSACTION_FEE_RATE;
    const total = orderType === 'BUY' ? subtotal + fee : subtotal - fee;
    return { grams, price, subtotal, fee, total };
  }, [orderAmount, orderType, goldPrice.gldcPrice]);

  // FUNCIÓN CRÍTICA: Obtener balance directamente de la blockchain
  const fetchBalanceBlockchain = useCallback(async (address: string) => {
    // Cast window to any to access ethereum property to fix TS error
    if (!address || typeof (window as any).ethereum === 'undefined') return;

    try {
      // Cast window to any to access ethereum property to fix TS error
      const provider = new BrowserProvider((window as any).ethereum);
      const contract = new Contract(GLDC_TOKEN_ADDRESS, ERC20_ABI, provider);
      const balanceRaw = await contract.balanceOf(address);
      const balance = parseFloat(formatUnits(balanceRaw, 18));
      
      setWallet(prev => ({
        ...prev,
        balanceGLDC: balance,
        balanceUSD: balance * lastValidPrice.current
      }));
    } catch (e) {
      console.error("Error consultando la blockchain:", e);
    }
  }, []);

  // Sincronizar Precios (Binance)
  const syncMarkets = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=PAXGUSDT');
      const data = await res.json();
      if (data.price) {
        const paxg = parseFloat(data.price);
        const gldc = paxg / TROY_OUNCE_TO_GRAMS;
        lastValidPrice.current = gldc;
        setGoldPrice({ paxgPrice: paxg, gldcPrice: gldc, lastUpdate: new Date() });
      }

      // Gemini Insight
      getGoldMarketInsight(lastValidPrice.current).then(setInsight);

      // Si hay billetera, actualizar balance
      if (wallet.address) {
        await fetchBalanceBlockchain(wallet.address);
      }
    } catch (e) {
      console.warn("Error sincronizando mercados, usando fallback.");
    } finally {
      setIsRefreshing(false);
      setIsAppReady(true);
    }
  }, [wallet.address, fetchBalanceBlockchain]);

  // Inicialización
  useEffect(() => {
    // Forzar renderizado en 1 segundo si la API tarda
    const timeout = setTimeout(() => setIsAppReady(true), 1500);
    syncMarkets();
    const interval = setInterval(syncMarkets, REFRESH_INTERVAL);
    
    // Gráfico inicial
    const points: PricePoint[] = [];
    const now = new Date();
    for (let i = 12; i >= 0; i--) {
      points.push({
        time: new Date(now.getTime() - i * 3600000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        value: lastValidPrice.current + (Math.random() - 0.5) * 0.4
      });
    }
    setHistory(points);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [syncMarkets]);

  const connectWallet = async () => {
    // Cast window to any to access ethereum property to fix TS error
    if (typeof (window as any).ethereum === 'undefined') {
      alert("Por favor instala MetaMask para operar con GLDC.");
      return;
    }
    setIsWalletConnecting(true);
    try {
      // Cast window to any to access ethereum property to fix TS error
      const provider = new BrowserProvider((window as any).ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      setWallet(prev => ({ ...prev, address: accounts[0], isConnected: true }));
      await fetchBalanceBlockchain(accounts[0]);
    } catch (e) {
      console.error(e);
    } finally {
      setIsWalletConnecting(false);
    }
  };

  const handleAction = (extra: string) => {
    const id = Math.random().toString(36).substr(2, 8).toUpperCase();
    const subject = `GLDC ORDER ${id} - ${orderType}`;
    const body = `Resumen de Operación:\nID: ${id}\nTipo: ${orderType}\nMonto: ${orderAmount} GLDC\nTotal USD: $${orderDetails.total.toFixed(2)}\nWallet: ${wallet.address}\nInfo adicional: ${extra}`;
    window.open(`mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
    setShowPaymentModal(false);
    setShowSellModal(false);
    setOrderAmount('');
  };

  if (!isAppReady) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center">
        <div className="w-16 h-16 gold-gradient rounded-2xl animate-spin flex items-center justify-center">
          <Coins className="text-black w-8 h-8" />
        </div>
        <p className="mt-6 text-[10px] font-black uppercase tracking-[0.5em] text-[#d4af37] animate-pulse">Abriendo Bóveda GLDC...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-32 animate-fade-in">
      {/* NAVIGATION */}
      <nav className="sticky top-0 z-50 bg-[#050505]/80 backdrop-blur-xl border-b border-white/5 px-8 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 gold-gradient rounded-xl flex items-center justify-center">
            <Coins className="text-black w-6 h-6" />
          </div>
          <span className="font-serif text-lg font-black tracking-tight">CRYPTOCAGUA <span className="gold-text">GOLD</span></span>
        </div>
        <button 
          onClick={connectWallet}
          disabled={isWalletConnecting}
          className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${wallet.isConnected ? 'bg-white/5 border border-white/10 text-white' : 'gold-gradient text-black shadow-lg hover:scale-105 active:scale-95'}`}
        >
          {isWalletConnecting ? <Loader2 className="animate-spin w-4 h-4" /> : wallet.isConnected ? `${wallet.address?.slice(0, 6)}...${wallet.address?.slice(-4)}` : 'Conectar Billetera'}
        </button>
      </nav>

      <main className="max-w-7xl mx-auto px-6 mt-12 grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* LADO IZQUIERDO: MERCADO */}
        <div className="lg:col-span-8 space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[#111] p-8 rounded-[2.5rem] border border-white/5">
              <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-1">Oro Spot Oz</p>
              <h3 className="text-4xl font-black">${goldPrice.paxgPrice.toLocaleString()}</h3>
            </div>
            <div className="bg-[#111] p-8 rounded-[2.5rem] border-2 border-[#d4af37]/30 relative overflow-hidden">
              <p className="text-[10px] font-black text-[#d4af37] uppercase tracking-widest mb-1">GLDC / Gramo</p>
              <h3 className="text-4xl font-black text-white">${goldPrice.gldcPrice.toFixed(2)}</h3>
              <div className="mt-3 flex items-center gap-2 text-[9px] font-black text-green-400 uppercase">
                <TrendingUp size={12} /> Mercado en Tiempo Real
              </div>
            </div>
          </div>

          <div className="bg-[#0a0a0a] p-8 rounded-[3rem] border border-white/5">
            <div className="flex justify-between items-center mb-8">
              <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20">Gráfico de Rendimiento (USD)</h4>
              <RefreshCw size={16} className={`text-[#d4af37] ${isRefreshing ? 'animate-spin' : 'cursor-pointer'}`} onClick={syncMarkets} />
            </div>
            <GoldChart data={history} />
          </div>

          <div className="bg-[#d4af37]/5 p-8 rounded-3xl border border-[#d4af37]/10 flex items-start gap-6">
            <ShieldCheck className="text-[#d4af37] shrink-0 mt-1" size={24} />
            <p className="text-sm font-medium italic text-white/70 leading-relaxed">"{insight}"</p>
          </div>
        </div>

        {/* LADO DERECHO: ACCIONES */}
        <div className="lg:col-span-4 space-y-8">
          {/* CARD DE BALANCE */}
          <div className="bg-[#d4af37] p-10 rounded-[3.5rem] shadow-2xl relative overflow-hidden group">
            <div className="relative z-10">
              <span className="text-[11px] font-black uppercase text-black/50 tracking-widest">Saldo Valorizado</span>
              <h2 className="text-5xl font-black text-black tracking-tighter my-4">
                ${wallet.balanceUSD.toLocaleString(undefined, {minimumFractionDigits:2})}
              </h2>
              <div className="pt-6 border-t border-black/10 flex justify-between items-center">
                <div>
                  <p className="text-[9px] font-black text-black/40 uppercase">Gramos en Billetera</p>
                  <p className="text-3xl font-black text-black">{wallet.balanceGLDC.toFixed(4)}g</p>
                </div>
                <div className="bg-black text-[#d4af37] text-[8px] font-black px-3 py-1.5 rounded-lg uppercase tracking-widest">BEP-20</div>
              </div>
            </div>
            <Coins size={160} className="absolute -bottom-12 -right-12 opacity-10 text-black rotate-12" />
          </div>

          {/* FORMULARIO DE OPERACIÓN */}
          <div className="bg-[#111] p-10 rounded-[3.5rem] border border-white/5">
            <div className="flex bg-black p-1.5 rounded-2xl mb-10">
              <button onClick={() => setOrderType('BUY')} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${orderType === 'BUY' ? 'bg-[#d4af37] text-black shadow-lg' : 'text-white/20 hover:text-white'}`}>Comprar</button>
              <button onClick={() => setOrderType('SELL')} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${orderType === 'SELL' ? 'bg-white text-black shadow-lg' : 'text-white/20 hover:text-white'}`}>Vender</button>
            </div>

            <div className="space-y-6">
              <div className="text-center">
                <label className="text-[10px] font-black uppercase text-white/20 tracking-widest block mb-4">Gramos a operar</label>
                <input 
                  type="number" 
                  value={orderAmount}
                  onChange={(e) => setOrderAmount(e.target.value)}
                  className="w-full bg-black border-2 border-white/5 rounded-3xl py-8 text-4xl font-black text-center text-white outline-none focus:border-[#d4af37] transition-all"
                  placeholder="0.0"
                />
              </div>

              {orderDetails.grams > 0 && (
                <div className="bg-black/40 p-6 rounded-3xl border border-white/5 space-y-3">
                  <div className="flex justify-between text-[10px] font-black uppercase">
                    <span className="text-white/30">Subtotal</span>
                    <span>${orderDetails.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-black uppercase">
                    <span className="text-white/30">Tarifa Red</span>
                    <span className="text-red-400">-${orderDetails.fee.toFixed(2)}</span>
                  </div>
                  <div className="pt-3 border-t border-white/10 flex justify-between items-center">
                    <span className="text-[#d4af37] text-[10px] font-black uppercase">Total Neto</span>
                    <span className="text-3xl font-black">${orderDetails.total.toFixed(2)}</span>
                  </div>
                </div>
              )}

              <button 
                onClick={() => orderType === 'BUY' ? setShowPaymentModal(true) : setShowSellModal(true)}
                disabled={!wallet.isConnected || orderDetails.grams <= 0}
                className={`w-full py-6 rounded-3xl font-black uppercase text-[11px] tracking-widest flex items-center justify-center gap-3 transition-all ${wallet.isConnected && orderDetails.grams > 0 ? (orderType === 'BUY' ? 'gold-gradient text-black shadow-xl hover:scale-[1.02]' : 'bg-white text-black shadow-lg hover:scale-[1.02]') : 'bg-white/5 text-white/10 cursor-not-allowed'}`}
              >
                {orderType === 'BUY' ? 'Generar Orden' : 'Retirar Fondos'}
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* MODAL COMPRA */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-6 backdrop-blur-3xl animate-fade-in">
          <div className="bg-[#111] w-full max-w-md p-10 rounded-[4rem] border-2 border-[#d4af37]/20 relative">
            <button onClick={() => setShowPaymentModal(false)} className="absolute top-8 right-8 text-white/30 hover:text-white transition-colors"><X size={28}/></button>
            <h3 className="text-2xl font-black text-center mb-1">Pago en USDT</h3>
            <p className="text-[9px] text-center text-white/20 uppercase tracking-[0.3em] mb-10">Transfiera el monto exacto</p>
            <div className="space-y-8">
              <div className="p-6 bg-black rounded-3xl border border-white/5 text-center">
                <p className="text-[9px] font-black text-[#d4af37] uppercase mb-3">Red BSC (BEP-20)</p>
                <code className="text-[10px] break-all block mb-6 text-white/70 font-mono bg-white/5 p-4 rounded-xl">{ADMIN_USDT_WALLET}</code>
                <button onClick={() => {navigator.clipboard.writeText(ADMIN_USDT_WALLET); setIsCopied(true); setTimeout(()=>setIsCopied(false),2000)}} className="px-6 py-2 bg-[#d4af37] text-black rounded-lg text-[10px] font-black uppercase">
                  {isCopied ? 'Copiado!' : 'Copiar Dirección'}
                </button>
              </div>
              <div className="bg-[#d4af37] p-8 rounded-3xl text-center shadow-xl">
                <p className="text-[10px] font-black text-black/50 uppercase mb-1">Total a enviar</p>
                <p className="text-4xl font-black text-black">${orderDetails.total.toFixed(2)}</p>
              </div>
              <input type="text" value={txHash} onChange={(e)=>setTxHash(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl py-5 px-6 text-sm text-[#d4af37] font-mono outline-none focus:border-[#d4af37]" placeholder="Pega el Hash (TXID) aquí" />
              <button onClick={() => handleAction(txHash)} disabled={!txHash} className={`w-full py-6 rounded-3xl font-black text-[11px] uppercase tracking-widest ${txHash ? 'gold-gradient text-black shadow-xl' : 'bg-white/5 text-white/10'}`}>Notificar Pago</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL VENTA */}
      {showSellModal && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-6 backdrop-blur-3xl animate-fade-in">
          <div className="bg-[#111] w-full max-w-md p-10 rounded-[4rem] border-2 border-white/10 relative">
            <button onClick={() => setShowSellModal(false)} className="absolute top-8 right-8 text-white/30 hover:text-white transition-colors"><X size={28}/></button>
            <h3 className="text-2xl font-black text-center mb-1">Venta GLDC</h3>
            <p className="text-[9px] text-center text-white/20 uppercase tracking-[0.3em] mb-10">Liquidación a USDT</p>
            <div className="space-y-6">
              <div className="bg-black p-8 rounded-3xl border-2 border-[#d4af37]/30 text-center">
                <p className="text-[10px] font-black text-white/30 uppercase mb-1">Recibirás Neto</p>
                <p className="text-4xl font-black text-[#d4af37]">${orderDetails.total.toFixed(2)}</p>
              </div>
              <input type="text" value={userName} onChange={(e)=>setUserName(e.target.value)} className="w-full bg-black border border-white/5 rounded-2xl py-5 px-6 text-sm text-white" placeholder="Tu Nombre" />
              <input type="text" value={payoutAddress} onChange={(e)=>setPayoutAddress(e.target.value)} className="w-full bg-black border border-white/5 rounded-2xl py-5 px-6 text-sm text-[#d4af37] font-mono" placeholder="Tu Wallet USDT Destino" />
              <button onClick={() => handleAction(payoutAddress)} disabled={!payoutAddress || !userName} className={`w-full py-6 rounded-3xl font-black text-[11px] uppercase tracking-widest ${payoutAddress && userName ? 'bg-white text-black shadow-lg' : 'bg-white/5 text-white/10'}`}>Solicitar Retiro</button>
            </div>
          </div>
        </div>
      )}

      <footer className="text-center py-20 opacity-10 mt-20 border-t border-white/5">
        <p className="text-[10px] font-black uppercase tracking-[1em]">Cryptocagua Gold Reserve • GLDC</p>
      </footer>
    </div>
  );
};

export default App;

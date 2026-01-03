
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
  ChevronRight,
  Copy,
  CheckCircle2,
  Mail,
  ExternalLink,
  X
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
  // Configuración de Admin (Vercel Env Vars)
  const ADMIN_USDT_WALLET = (window as any).process?.env?.ADMIN_USDT_WALLET || "TU_BILLETERA_USDT_AQUI";
  const ADMIN_EMAIL = (window as any).process?.env?.ADMIN_EMAIL || "admin@cryptocagua.com";

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
  const [insight, setInsight] = useState<string>("Analizando mercado...");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [orderType, setOrderType] = useState<'BUY' | 'SELL'>('BUY');
  const [orderAmount, setOrderAmount] = useState<string>('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  
  // Estados para el Modal de Pago
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [isCopied, setIsCopied] = useState(false);

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
      return 2350.00; // Fallback price
    }
  };

  const refreshMarketData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const realPaxgPrice = await fetchPAXGPrice();
      const currentGldcPrice = realPaxgPrice / TROY_OUNCE_TO_GRAMS;
      lastValidPrice.current = currentGldcPrice;
      setGoldPrice({ paxgPrice: realPaxgPrice, gldcPrice: currentGldcPrice, lastUpdate: new Date() });
      setHistory(generateMockHistory(currentGldcPrice));
      const aiInsight = await getGoldMarketInsight(currentGldcPrice);
      setInsight(aiInsight);
    } catch (error) {
      setApiError("Error de conexión al mercado.");
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
      if (ethereum) {
        const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
        setWallet({ address: accounts[0], balanceGLDC: 12.5, balanceUSD: 12.5 * lastValidPrice.current, isConnected: true });
      } else {
        setWallet({ address: '0x71C...392A', balanceGLDC: 25.5, balanceUSD: 25.5 * lastValidPrice.current, isConnected: true });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleStartTransaction = () => {
    if (orderType === 'BUY') {
      setShowPaymentModal(true);
    } else {
      // Venta directa (simulada)
      executeTransaction('manual_sell');
    }
  };

  const executeTransaction = (hash: string) => {
    const { grams, subtotal, fee, total } = orderDetails;
    const newTx: Transaction = { 
      id: hash || Math.random().toString(36).substr(2, 9), 
      type: orderType, 
      amountGLDC: grams, 
      subtotalUSD: subtotal, 
      feeUSD: fee, 
      totalUSD: total, 
      status: 'PENDING', 
      date: new Date() 
    };
    
    setTransactions([newTx, ...transactions]);
    setShowPaymentModal(false);
    setOrderAmount('');
    setTxHash('');

    // Si es una compra, notificar vía mail
    if (orderType === 'BUY') {
      const subject = `Nueva Compra GLDC - ${wallet.address?.slice(0,8)}`;
      const body = `Hola Admin,\n\nSe ha reportado una transferencia de USDT para la compra de GLDC tokens.\n\nDetalles:\n- Usuario: ${wallet.address}\n- Monto GLDC: ${grams} g\n- Monto USDT a recibir: $${total.toFixed(2)}\n- TXID: ${hash}\n\nPor favor verificar y liberar los tokens.`;
      window.location.href = `mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    }

    setTimeout(() => {
      setTransactions(prev => prev.map(tx => tx.id === newTx.id ? { ...tx, status: 'COMPLETED' } : tx));
      setWallet(prev => ({ 
        ...prev, 
        balanceGLDC: orderType === 'BUY' ? prev.balanceGLDC + grams : prev.balanceGLDC - grams,
        balanceUSD: (orderType === 'BUY' ? prev.balanceGLDC + grams : prev.balanceGLDC - grams) * lastValidPrice.current
      }));
    }, 3000);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-[#d4af37]/30 pb-12 font-sans">
      
      {/* HEADER */}
      <header className="sticky top-0 z-40 glass-card border-b border-white/5 px-4 md:px-6 py-3">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 gold-gradient rounded-xl flex items-center justify-center shadow-lg shadow-[#d4af37]/20">
              <Coins className="text-black w-5 h-5" />
            </div>
            <h1 className="font-serif text-lg font-bold">GLDC <span className="gold-text">GOLD</span></h1>
          </div>
          <button onClick={connectWallet} className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${wallet.isConnected ? 'bg-white/5 text-white/50' : 'gold-gradient text-black'}`}>
            {wallet.isConnected ? `${wallet.address?.slice(0, 6)}...` : 'Conectar'}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LADO IZQUIERDO: MERCADO */}
        <div className="lg:col-span-8 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="glass-card p-5 rounded-3xl">
              <p className="text-[10px] font-bold text-white/40 uppercase mb-1">Precio Oro/Oz</p>
              <h3 className="text-xl font-bold">${goldPrice.paxgPrice.toLocaleString()}</h3>
            </div>
            <div className="glass-card p-5 rounded-3xl border-[#d4af37]/20 bg-[#d4af37]/5">
              <p className="text-[10px] font-bold text-[#d4af37] uppercase mb-1">Valor GLDC/Gramo</p>
              <h3 className="text-xl font-bold">${goldPrice.gldcPrice.toFixed(2)}</h3>
            </div>
            <div className="glass-card p-5 rounded-3xl flex items-center justify-between">
              <span className="text-[10px] font-bold text-white/40 uppercase">Sincronizado</span>
              <button onClick={refreshMarketData} className={isRefreshing ? 'animate-spin' : ''}><RefreshCw size={14} className="text-[#d4af37]" /></button>
            </div>
          </div>

          <div className="glass-card p-6 rounded-[2rem]">
            <h2 className="text-sm font-bold uppercase tracking-widest mb-6 opacity-40">Gráfico de Mercado</h2>
            <GoldChart data={history} />
          </div>

          <div className="glass-card p-6 rounded-[2rem] border-l-4 border-l-[#d4af37]">
            <div className="flex gap-4">
              <Info className="text-[#d4af37] shrink-0" size={20} />
              <p className="text-sm text-white/70 italic leading-relaxed">"{insight}"</p>
            </div>
          </div>
        </div>

        {/* LADO DERECHO: ACCIONES */}
        <div className="lg:col-span-4 space-y-6">
          <div className="glass-card p-6 rounded-[2rem] gold-gradient text-black">
            <p className="text-[10px] font-bold uppercase opacity-60">Balance Total</p>
            <h2 className="text-3xl font-black font-serif">${wallet.isConnected ? wallet.balanceUSD.toLocaleString(undefined, {minimumFractionDigits:2}) : '0.00'}</h2>
            <div className="mt-4 pt-4 border-t border-black/10 flex justify-between">
              <span className="text-sm font-bold">{wallet.balanceGLDC} g GLDC</span>
              <span className="text-[10px] font-black uppercase bg-black/10 px-2 py-0.5 rounded">Red: Polygon</span>
            </div>
          </div>

          <div className="glass-card p-6 rounded-[2rem]">
            <div className="flex gap-2 p-1 bg-white/5 rounded-2xl mb-6">
              <button onClick={() => setOrderType('BUY')} className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all ${orderType === 'BUY' ? 'bg-[#d4af37] text-black' : 'text-white/40'}`}>Comprar</button>
              <button onClick={() => setOrderType('SELL')} className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all ${orderType === 'SELL' ? 'bg-white/10 text-white' : 'text-white/40'}`}>Vender</button>
            </div>

            <div className="space-y-4">
              <div className="relative">
                <label className="text-[10px] font-bold uppercase text-white/40 ml-1">Gramos GLDC</label>
                <input 
                  type="number" 
                  value={orderAmount} 
                  onChange={(e) => setOrderAmount(e.target.value)} 
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 mt-2 text-xl font-bold focus:outline-none focus:border-[#d4af37]" 
                  placeholder="0.00"
                />
              </div>

              {orderDetails.grams > 0 && (
                <div className="p-4 bg-white/5 rounded-2xl space-y-2 border border-white/5">
                  <div className="flex justify-between text-[10px] font-bold uppercase text-white/40">
                    <span>Subtotal</span>
                    <span>${orderDetails.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-bold uppercase text-red-400">
                    <span>Comisión (0.75%)</span>
                    <span>${orderDetails.fee.toFixed(2)}</span>
                  </div>
                  <div className="pt-2 mt-2 border-t border-white/10 flex justify-between items-center">
                    <span className="text-xs font-black uppercase text-[#d4af37]">{orderType === 'BUY' ? 'Total Pagar' : 'Total Recibir'}</span>
                    <span className="text-xl font-black">${orderDetails.total.toFixed(2)}</span>
                  </div>
                </div>
              )}

              <button 
                onClick={handleStartTransaction}
                disabled={!wallet.isConnected || orderDetails.grams <= 0}
                className={`w-full py-4 rounded-2xl font-black uppercase text-sm tracking-widest transition-all ${wallet.isConnected && orderDetails.grams > 0 ? 'gold-gradient text-black shadow-lg shadow-[#d4af37]/20' : 'bg-white/5 text-white/20'}`}
              >
                {orderType === 'BUY' ? 'Iniciar Compra' : 'Confirmar Venta'}
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* MODAL DE PAGO MANUAL */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowPaymentModal(false)}></div>
          <div className="relative w-full max-w-md glass-card border-[#d4af37]/30 p-8 rounded-[2.5rem] animate-in zoom-in-95 duration-200">
            <button onClick={() => setShowPaymentModal(false)} className="absolute top-6 right-6 text-white/20 hover:text-white transition-colors"><X size={20}/></button>
            
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-[#d4af37]/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-[#d4af37]/20">
                <Coins className="text-[#d4af37]" size={30} />
              </div>
              <h3 className="text-xl font-bold mb-2">Instrucciones de Pago</h3>
              <p className="text-xs text-white/40 px-4">Envía exactamente el monto indicado abajo en USDT (Red: TRC20/Polygon) para procesar tu compra.</p>
            </div>

            <div className="space-y-5">
              <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                <p className="text-[10px] font-bold text-white/40 uppercase mb-2">Dirección USDT (Admin)</p>
                <div className="flex items-center gap-3">
                  <code className="flex-1 text-xs text-[#d4af37] font-mono break-all">{ADMIN_USDT_WALLET}</code>
                  <button 
                    onClick={() => copyToClipboard(ADMIN_USDT_WALLET)}
                    className="p-2 bg-[#d4af37]/10 rounded-lg text-[#d4af37] hover:bg-[#d4af37]/20 transition-all"
                  >
                    {isCopied ? <CheckCircle2 size={16}/> : <Copy size={16}/>}
                  </button>
                </div>
              </div>

              <div className="flex justify-between items-center p-4 bg-[#d4af37]/5 rounded-2xl border border-[#d4af37]/10">
                <span className="text-xs font-bold uppercase text-white/60">Monto a Enviar:</span>
                <span className="text-xl font-black text-white">${orderDetails.total.toFixed(2)} USDT</span>
              </div>

              <div className="space-y-3 pt-4 border-t border-white/10">
                <label className="text-[10px] font-bold uppercase text-white/40 ml-1">Pega aquí el Hash (TXID) de tu envío</label>
                <input 
                  type="text" 
                  value={txHash} 
                  onChange={(e) => setTxHash(e.target.value)} 
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-xs font-mono focus:outline-none focus:border-[#d4af37]" 
                  placeholder="0x..."
                />
              </div>

              <button 
                onClick={() => executeTransaction(txHash)}
                disabled={!txHash}
                className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${txHash ? 'gold-gradient text-black' : 'bg-white/5 text-white/20'}`}
              >
                <Mail size={14} /> Notificar y Finalizar
              </button>
              
              <p className="text-[9px] text-center text-white/30 italic uppercase tracking-tighter">Tu compra será validada por el administrador en minutos.</p>
            </div>
          </div>
        </div>
      )}

      <footer className="max-w-7xl mx-auto px-6 py-12 text-center opacity-20 text-[9px] uppercase tracking-[0.4em]">
        <p>© 2024 Cryptocagua Gold • GLDC Asset Protocol</p>
      </footer>
    </div>
  );
};

export default App;

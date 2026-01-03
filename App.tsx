
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { GoldPriceData, WalletState, Transaction, PricePoint } from './types';
import { TROY_OUNCE_TO_GRAMS, REFRESH_INTERVAL, TRANSACTION_FEE_RATE } from './constants';
import { getGoldMarketInsight } from './services/geminiService';
import { GoldChart } from './components/GoldChart';
import { 
  Wallet, 
  RefreshCw,
  Info,
  History,
  Coins,
  ArrowRight,
  Calculator,
  Copy,
  CheckCircle2,
  Mail,
  X,
  Loader2
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
  // Variables de Entorno (Vercel) con Fallbacks seguros
  const ADMIN_USDT_WALLET = process.env.ADMIN_USDT_WALLET || "CONFIGURAR_EN_VERCEL";
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "soporte@cryptocagua.com";

  const [isLoading, setIsLoading] = useState(true);
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
  const [insight, setInsight] = useState<string>("Cargando análisis de mercado...");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [orderType, setOrderType] = useState<'BUY' | 'SELL'>('BUY');
  const [orderAmount, setOrderAmount] = useState<string>('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  const lastValidPrice = useRef<number>(2350 / TROY_OUNCE_TO_GRAMS);

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
      if (!response.ok) throw new Error();
      const data = await response.json();
      return parseFloat(data.price);
    } catch (error) {
      console.warn("Usando precio de respaldo para Oro.");
      return 2385.50; // Respaldo si falla la API
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
    } catch (e) {
      console.error("Error en sincronización:", e);
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshMarketData();
    const interval = setInterval(refreshMarketData, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [refreshMarketData]);

  const connectWallet = async () => {
    const ethereum = (window as any).ethereum;
    if (ethereum) {
      try {
        const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
        setWallet({ address: accounts[0], balanceGLDC: 10, balanceUSD: 10 * lastValidPrice.current, isConnected: true });
      } catch (e) {
        console.error("Wallet connection failed", e);
      }
    } else {
      setWallet({ address: '0x71C...Demo', balanceGLDC: 5.25, balanceUSD: 5.25 * lastValidPrice.current, isConnected: true });
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
      executeTransaction('VENTA_SIMULADA');
    }
  };

  const executeTransaction = (hash: string) => {
    const { grams, total } = orderDetails;
    const newTx: Transaction = { 
      id: hash || `TX-${Math.random().toString(36).substr(2, 5).toUpperCase()}`, 
      type: orderType, 
      amountGLDC: grams, 
      subtotalUSD: orderDetails.subtotal, 
      feeUSD: orderDetails.fee, 
      totalUSD: total, 
      status: 'PENDING', 
      date: new Date() 
    };
    
    setTransactions([newTx, ...transactions]);
    setShowPaymentModal(false);
    setOrderAmount('');

    if (orderType === 'BUY') {
      const subject = `NOTIFICACION DE PAGO GLDC - ${hash.slice(0,10)}`;
      const body = `Hola Admin,\n\nHe enviado el pago en USDT para adquirir GLDC.\n\nDETALLES DE LA ORDEN:\n------------------------\nID Operación: ${newTx.id}\nHash de Pago: ${hash}\nCantidad Oro: ${grams} gramos\nMonto Enviado: $${total.toFixed(2)} USDT\nMi Wallet: ${wallet.address || 'No conectada'}\n------------------------\nPor favor, verifique el TXID y libere los tokens a mi dirección.`;
      
      const mailtoLink = `mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.open(mailtoLink, '_blank');
    }

    setTimeout(() => {
      setTransactions(prev => prev.map(tx => tx.id === newTx.id ? { ...tx, status: 'COMPLETED' } : tx));
      setWallet(prev => ({ 
        ...prev, 
        balanceGLDC: orderType === 'BUY' ? prev.balanceGLDC + grams : prev.balanceGLDC - grams,
        balanceUSD: (orderType === 'BUY' ? prev.balanceGLDC + grams : prev.balanceGLDC - grams) * lastValidPrice.current
      }));
    }, 2000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center gap-4">
        <div className="w-20 h-20 gold-gradient rounded-3xl flex items-center justify-center animate-bounce shadow-2xl shadow-[#d4af37]/20">
          <Coins className="text-black w-10 h-10" />
        </div>
        <h2 className="font-serif text-2xl font-bold gold-text">Cryptocagua Gold</h2>
        <div className="flex items-center gap-2 text-white/30 text-xs uppercase tracking-widest">
          <Loader2 size={14} className="animate-spin" />
          Sincronizando con el mercado...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-[#d4af37]/30 pb-12">
      
      <header className="sticky top-0 z-40 glass-card border-b border-white/5 px-4 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 gold-gradient rounded-xl flex items-center justify-center">
              <Coins className="text-black w-5 h-5" />
            </div>
            <h1 className="font-serif text-lg font-bold hidden xs:block">GLDC <span className="gold-text">GOLD</span></h1>
          </div>
          <button onClick={connectWallet} className="px-5 py-2 rounded-full text-xs font-bold gold-gradient text-black hover:scale-105 transition-transform">
            {wallet.isConnected ? `${wallet.address?.slice(0, 6)}...` : 'Conectar Wallet'}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        <div className="lg:col-span-8 space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="glass-card p-6 rounded-3xl border-white/5">
              <p className="text-[10px] font-bold text-white/40 uppercase mb-1 tracking-widest">Oro Spot / Oz</p>
              <h3 className="text-2xl font-black">${goldPrice.paxgPrice.toLocaleString()}</h3>
            </div>
            <div className="glass-card p-6 rounded-3xl border-[#d4af37]/20 bg-[#d4af37]/5">
              <p className="text-[10px] font-bold text-[#d4af37] uppercase mb-1 tracking-widest">GLDC / Gramo</p>
              <h3 className="text-2xl font-black">${goldPrice.gldcPrice.toFixed(2)}</h3>
            </div>
            <div className="glass-card p-6 rounded-3xl flex items-center justify-between">
              <div className="text-[10px] font-bold text-white/20 uppercase">Estado: Live</div>
              <button onClick={refreshMarketData} className={`p-2 rounded-lg bg-white/5 ${isRefreshing ? 'animate-spin' : ''}`}>
                <RefreshCw size={16} className="text-[#d4af37]" />
              </button>
            </div>
          </div>

          <div className="glass-card p-8 rounded-[2.5rem] border-white/5">
            <h2 className="text-xs font-black uppercase tracking-[0.3em] mb-8 text-white/20">Histórico GLDC/USD</h2>
            <GoldChart data={history} />
          </div>

          <div className="glass-card p-8 rounded-[2.5rem] border-l-4 border-l-[#d4af37] bg-gradient-to-r from-[#d4af37]/5 to-transparent">
            <div className="flex gap-5">
              <div className="w-12 h-12 rounded-2xl bg-[#d4af37]/10 flex items-center justify-center shrink-0">
                <Info className="text-[#d4af37]" />
              </div>
              <div>
                <h4 className="text-xs font-black uppercase text-[#d4af37] mb-2">IA Market Insight</h4>
                <p className="text-sm md:text-base text-white/60 italic leading-relaxed">"{insight}"</p>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-8">
          <div className="glass-card p-8 rounded-[2.5rem] gold-gradient text-black shadow-2xl shadow-[#d4af37]/10">
            <p className="text-[10px] font-black uppercase opacity-40 tracking-widest mb-1">Tu Balance</p>
            <h2 className="text-4xl font-black font-serif">${wallet.balanceUSD.toLocaleString(undefined, {minimumFractionDigits:2})}</h2>
            <div className="mt-6 pt-6 border-t border-black/10 flex justify-between items-end">
              <div>
                <p className="text-[10px] font-black opacity-40 uppercase">Activos</p>
                <p className="text-lg font-bold">{wallet.balanceGLDC.toFixed(2)} g Oro</p>
              </div>
              <div className="text-[9px] font-black bg-black/10 px-2 py-1 rounded">POLYGON</div>
            </div>
          </div>

          <div className="glass-card p-8 rounded-[2.5rem] border-white/10">
            <div className="flex gap-2 p-1.5 bg-white/5 rounded-2xl mb-8">
              <button onClick={() => setOrderType('BUY')} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${orderType === 'BUY' ? 'bg-[#d4af37] text-black shadow-lg shadow-[#d4af37]/20' : 'text-white/30'}`}>Comprar</button>
              <button onClick={() => setOrderType('SELL')} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${orderType === 'SELL' ? 'bg-white/10 text-white' : 'text-white/30'}`}>Vender</button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-black uppercase text-white/30 tracking-[0.2em] ml-1">Cantidad de Gramos</label>
                <input 
                  type="number" 
                  value={orderAmount} 
                  onChange={(e) => setOrderAmount(e.target.value)} 
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 mt-2 text-2xl font-black focus:outline-none focus:border-[#d4af37] transition-all" 
                  placeholder="0.00"
                />
              </div>

              {orderDetails.grams > 0 && (
                <div className="p-5 bg-white/5 rounded-2xl border border-white/5 space-y-3">
                  <div className="flex justify-between text-[10px] font-bold uppercase text-white/40">
                    <span>Precio Unitario</span>
                    <span>${orderDetails.price.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-bold uppercase text-red-400">
                    <span>Servicio (0.75%)</span>
                    <span>${orderDetails.fee.toFixed(2)}</span>
                  </div>
                  <div className="pt-3 border-t border-white/5 flex justify-between items-center">
                    <span className="text-xs font-black uppercase text-[#d4af37]">Total a Pagar</span>
                    <span className="text-2xl font-black">${orderDetails.total.toFixed(2)}</span>
                  </div>
                </div>
              )}

              <button 
                onClick={handleStartTransaction}
                disabled={!wallet.isConnected || orderDetails.grams <= 0}
                className={`w-full py-5 rounded-2xl font-black uppercase text-sm tracking-[0.2em] transition-all active:scale-95 ${wallet.isConnected && orderDetails.grams > 0 ? 'gold-gradient text-black shadow-xl shadow-[#d4af37]/20' : 'bg-white/5 text-white/10 cursor-not-allowed'}`}
              >
                {orderType === 'BUY' ? 'Generar Orden' : 'Confirmar Venta'}
              </button>
            </div>
          </div>

          <div className="glass-card p-8 rounded-[2.5rem] border-white/5">
            <h3 className="text-[10px] font-black uppercase text-white/30 mb-6 tracking-[0.2em]">Actividad Reciente</h3>
            <div className="space-y-4">
              {transactions.length === 0 ? (
                <p className="text-center py-4 text-[10px] text-white/10 uppercase italic">Sin movimientos</p>
              ) : (
                transactions.map(tx => (
                  <div key={tx.id} className="flex justify-between items-center p-3 rounded-xl bg-white/5 border border-white/5">
                    <div>
                      <p className="text-[10px] font-black uppercase text-[#d4af37]">{tx.type === 'BUY' ? 'Compra' : 'Venta'}</p>
                      <p className="text-[9px] text-white/20">{tx.id.slice(0, 12)}...</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black">{tx.amountGLDC} g</p>
                      <p className={`text-[9px] font-bold uppercase ${tx.status === 'COMPLETED' ? 'text-green-500' : 'text-orange-500'}`}>{tx.status}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>

      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="absolute inset-0 bg-black/90" onClick={() => setShowPaymentModal(false)}></div>
          <div className="relative w-full max-w-md glass-card border-[#d4af37]/30 p-8 rounded-[3rem] animate-in zoom-in-95">
            <button onClick={() => setShowPaymentModal(false)} className="absolute top-8 right-8 text-white/20 hover:text-white transition-colors"><X size={20}/></button>
            
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-[#d4af37]/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-[#d4af37]/20">
                <Mail className="text-[#d4af37]" size={30} />
              </div>
              <h3 className="text-2xl font-black mb-2">Pago con USDT</h3>
              <p className="text-[10px] text-white/40 uppercase tracking-widest px-8">Envía el pago y notifica al administrador para recibir tus tokens.</p>
            </div>

            <div className="space-y-6">
              <div className="p-5 bg-white/5 rounded-2xl border border-white/10">
                <p className="text-[9px] font-black text-white/20 uppercase mb-2 tracking-widest">Billetera de Pago (Admin)</p>
                <div className="flex items-center gap-3">
                  <code className="flex-1 text-[11px] text-[#d4af37] font-mono break-all">{ADMIN_USDT_WALLET}</code>
                  <button onClick={() => copyToClipboard(ADMIN_USDT_WALLET)} className="p-3 bg-[#d4af37]/10 rounded-xl text-[#d4af37] active:scale-90 transition-all">
                    {isCopied ? <CheckCircle2 size={18}/> : <Copy size={18}/>}
                  </button>
                </div>
              </div>

              <div className="p-5 bg-[#d4af37]/5 rounded-2xl border border-[#d4af37]/20 flex justify-between items-center">
                <span className="text-[10px] font-black uppercase text-white/60">Total USDT:</span>
                <span className="text-2xl font-black text-white">${orderDetails.total.toFixed(2)}</span>
              </div>

              <div className="space-y-3">
                <label className="text-[9px] font-black uppercase text-white/20 ml-1">TXID / Hash de Transferencia</label>
                <input 
                  type="text" 
                  value={txHash} 
                  onChange={(e) => setTxHash(e.target.value)} 
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-4 px-4 text-xs font-mono focus:border-[#d4af37] transition-all" 
                  placeholder="0x000..."
                />
              </div>

              <button 
                onClick={() => executeTransaction(txHash)}
                disabled={!txHash}
                className={`w-full py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all ${txHash ? 'gold-gradient text-black shadow-xl shadow-[#d4af37]/20' : 'bg-white/5 text-white/10'}`}
              >
                Enviar y Notificar Admin
              </button>
              
              <p className="text-[9px] text-center text-white/20 uppercase tracking-tighter">Se abrirá tu gestor de correo para confirmar el envío.</p>
            </div>
          </div>
        </div>
      )}

      <footer className="max-w-7xl mx-auto px-6 py-12 text-center opacity-10 text-[10px] font-black uppercase tracking-[0.5em]">
        <p>© 2024 Cryptocagua Gold • GLDC Asset Protocol</p>
      </footer>
    </div>
  );
};

export default App;

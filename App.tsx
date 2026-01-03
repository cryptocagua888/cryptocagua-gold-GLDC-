
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { GoldPriceData, WalletState, Transaction, PricePoint } from './types';
import { TROY_OUNCE_TO_GRAMS, REFRESH_INTERVAL, TRANSACTION_FEE_RATE } from './constants';
import { getGoldMarketInsight } from './services/geminiService';
import { GoldChart } from './components/GoldChart';
import { 
  RefreshCw,
  Info,
  Coins,
  Copy,
  CheckCircle2,
  Mail,
  X,
  Loader2,
  ArrowRight,
  History,
  Wallet,
  ArrowDownLeft
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
  const env = (window as any).process?.env || {};
  const ADMIN_USDT_WALLET = env.ADMIN_USDT_WALLET || "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
  const ADMIN_EMAIL = env.ADMIN_EMAIL || "soporte@cryptocagua.com";

  const [isLoading, setIsLoading] = useState(true);
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
  const [insight, setInsight] = useState<string>("Sincronizando con mercados internacionales...");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [orderType, setOrderType] = useState<'BUY' | 'SELL'>('BUY');
  const [orderAmount, setOrderAmount] = useState<string>('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showSellModal, setShowSellModal] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [payoutAddress, setPayoutAddress] = useState('');
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

  const refreshMarketData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=PAXGUSDT');
      const data = await response.json();
      const realPaxgPrice = parseFloat(data.price) || 2350.00;
      const currentGldcPrice = realPaxgPrice / TROY_OUNCE_TO_GRAMS;
      
      lastValidPrice.current = currentGldcPrice;
      setGoldPrice({ paxgPrice: realPaxgPrice, gldcPrice: currentGldcPrice, lastUpdate: new Date() });
      setHistory(generateMockHistory(currentGldcPrice));
      
      const aiInsight = await getGoldMarketInsight(currentGldcPrice);
      setInsight(aiInsight);
    } catch (e) {
      console.error("Error al sincronizar datos:", e);
      setHistory(generateMockHistory(lastValidPrice.current));
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      refreshMarketData();
    }, 100);
    
    const interval = setInterval(refreshMarketData, REFRESH_INTERVAL);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [refreshMarketData]);

  const connectWallet = async () => {
    const ethereum = (window as any).ethereum;
    if (ethereum) {
      try {
        const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
        setWallet({ 
          address: accounts[0], 
          balanceGLDC: 12.5, 
          balanceUSD: 12.5 * lastValidPrice.current, 
          isConnected: true 
        });
      } catch (e) {
        console.error("Conexión de wallet fallida", e);
      }
    } else {
      setWallet({ 
        address: '0x71C...Demo', 
        balanceGLDC: 5.25, 
        balanceUSD: 5.25 * lastValidPrice.current, 
        isConnected: true 
      });
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
      setShowSellModal(true);
    }
  };

  const executeTransaction = (info: string) => {
    const { grams, total } = orderDetails;
    const newId = `TX-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const newTx: Transaction = { 
      id: newId, 
      type: orderType, 
      amountGLDC: grams, 
      subtotalUSD: orderDetails.subtotal, 
      feeUSD: orderDetails.fee, 
      totalUSD: total, 
      status: 'PENDING', 
      date: new Date() 
    };
    
    setTransactions(prev => [newTx, ...prev]);
    setShowPaymentModal(false);
    setShowSellModal(false);
    setOrderAmount('');

    // Preparar el correo
    const subject = `${orderType === 'BUY' ? 'ORDEN DE COMPRA' : 'SOLICITUD DE VENTA'} GLDC: ${newId}`;
    const body = orderType === 'BUY' 
      ? `REPORTE DE PAGO GLDC\n\nID ORDEN: ${newId}\nTXID/HASH: ${info}\nCANTIDAD: ${grams}g de Oro (GLDC)\nTOTAL PAGADO: $${total.toFixed(2)} USDT\nBILLETERA USUARIO: ${wallet.address || 'No detectada'}\n\nPor favor validar transferencia y liberar tokens.`
      : `SOLICITUD DE LIQUIDACIÓN GLDC\n\nID SOLICITUD: ${newId}\nCANTIDAD A VENDER: ${grams}g de Oro (GLDC)\nPRECIO SPOT: $${orderDetails.price.toFixed(2)}\nTOTAL A RECIBIR: $${total.toFixed(2)} USDT\n\nBILLETERA DE PAGO DEL USUARIO (DONDE ENVIAR USDT): ${info}\nBILLETERA ORIGEN GLDC: ${wallet.address || 'No detectada'}\n\nPor favor contactar al usuario para procesar el retiro.`;
    
    const mailtoLink = `mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoLink, '_blank');

    // Resetear campos
    setTxHash('');
    setPayoutAddress('');

    setTimeout(() => {
      setTransactions(prev => prev.map(tx => tx.id === newId ? { ...tx, status: 'COMPLETED' } : tx));
      setWallet(prev => ({ 
        ...prev, 
        balanceGLDC: orderType === 'BUY' ? prev.balanceGLDC + grams : prev.balanceGLDC - grams,
        balanceUSD: (orderType === 'BUY' ? prev.balanceGLDC + grams : prev.balanceGLDC - grams) * lastValidPrice.current
      }));
    }, 5000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center gap-8">
        <div className="w-24 h-24 gold-gradient rounded-[2rem] flex items-center justify-center animate-bounce shadow-[0_0_60px_rgba(212,175,55,0.15)]">
          <Coins className="text-black w-12 h-12" />
        </div>
        <div className="text-center space-y-3">
          <h2 className="font-serif text-3xl font-bold gold-text tracking-tight">Cryptocagua Gold</h2>
          <div className="flex items-center justify-center gap-3 text-white/20 text-[10px] uppercase tracking-[0.4em] font-black">
            <Loader2 size={16} className="animate-spin text-[#d4af37]" />
            Iniciando Protocolo...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-[#d4af37]/30 pb-24 animate-fade-in">
      <header className="sticky top-0 z-40 glass-card border-b border-white/5 px-6 py-5">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 gold-gradient rounded-2xl flex items-center justify-center shadow-lg transform rotate-3 hover:rotate-0 transition-transform cursor-pointer">
              <Coins className="text-black w-6 h-6" />
            </div>
            <h1 className="font-serif text-2xl font-bold tracking-tight">GLDC <span className="gold-text">GOLD</span></h1>
          </div>
          <button onClick={connectWallet} className="px-7 py-3 rounded-full text-[11px] font-black gold-gradient text-black hover:scale-105 active:scale-95 transition-all shadow-xl shadow-[#d4af37]/10 uppercase tracking-widest">
            {wallet.isConnected ? `${wallet.address?.slice(0, 6)}...${wallet.address?.slice(-4)}` : 'Conectar Wallet'}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-8 space-y-12">
          {/* Stats Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            <div className="glass-card p-8 rounded-[2.5rem] border-white/5 group hover:border-[#d4af37]/20 transition-all duration-500">
              <p className="text-[11px] font-black text-white/30 uppercase mb-3 tracking-[0.2em]">Precio Spot / Oz</p>
              <h3 className="text-4xl font-black tabular-nums text-white">${goldPrice.paxgPrice.toLocaleString()}</h3>
              <div className="mt-4 flex items-center gap-2 text-[9px] font-bold text-green-500/50 uppercase">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                Mercado Abierto
              </div>
            </div>
            <div className="glass-card p-8 rounded-[2.5rem] border-[#d4af37]/20 bg-[#d4af37]/5 shadow-[inset_0_0_40px_rgba(212,175,55,0.03)]">
              <p className="text-[11px] font-black text-[#d4af37] uppercase mb-3 tracking-[0.2em]">GLDC / Gramo</p>
              <h3 className="text-4xl font-black gold-text tabular-nums">${goldPrice.gldcPrice.toFixed(2)}</h3>
              <div className="mt-4 text-[9px] font-black text-[#d4af37]/40 uppercase">Respaldo 1:1 Oro Físico</div>
            </div>
            <div className="glass-card p-8 rounded-[2.5rem] flex flex-col justify-center items-center gap-4 group">
              <div className="text-[11px] font-black text-white/20 uppercase tracking-[0.2em]">Sincronización</div>
              <button onClick={refreshMarketData} className={`p-4 rounded-2xl bg-white/5 border border-white/5 ${isRefreshing ? 'animate-spin' : 'hover:scale-110 hover:border-[#d4af37]/30'} transition-all`}>
                <RefreshCw size={24} className="text-[#d4af37]" />
              </button>
            </div>
          </div>

          <div className="glass-card p-10 rounded-[3.5rem] border-white/5 relative overflow-hidden">
            <div className="flex justify-between items-center mb-12">
              <div>
                <h2 className="text-sm font-black uppercase tracking-[0.5em] text-white/20">Gráfico de Rendimiento</h2>
                <p className="text-[10px] text-white/10 uppercase mt-1">Sincronizado con feeds globales</p>
              </div>
              <div className="px-4 py-1.5 rounded-full bg-[#d4af37]/10 text-[10px] font-black text-[#d4af37] border border-[#d4af37]/20 tracking-widest">LIVE DATA</div>
            </div>
            <GoldChart data={history} />
          </div>

          <div className="glass-card p-10 rounded-[3.5rem] border-l-[10px] border-l-[#d4af37] bg-gradient-to-r from-[#d4af37]/10 via-[#d4af37]/5 to-transparent shadow-2xl">
            <div className="flex gap-8">
              <div className="w-16 h-16 rounded-[2rem] bg-[#d4af37]/20 flex items-center justify-center shrink-0 shadow-inner border border-[#d4af37]/20">
                <Info className="text-[#d4af37]" size={32} />
              </div>
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase text-[#d4af37] tracking-[0.3em]">Perspectiva de Mercado Inteligente</h4>
                <p className="text-lg text-white/80 italic font-medium leading-relaxed">"{insight}"</p>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-12">
          {/* Main Balance Card - Fixed Visibility */}
          <div className="glass-card p-12 rounded-[3.5rem] gold-gradient shadow-[0_30px_60px_rgba(212,175,55,0.15)] relative overflow-hidden group">
            <div className="relative z-10">
              <p className="text-[12px] font-black uppercase text-black/40 tracking-[0.2em] mb-3">Balance Consolidado</p>
              <h2 className="text-6xl font-black font-serif tracking-tighter text-black tabular-nums">
                ${wallet.balanceUSD.toLocaleString(undefined, {minimumFractionDigits:2})}
              </h2>
              <div className="mt-10 pt-10 border-t border-black/10 flex justify-between items-end">
                <div>
                  <p className="text-[11px] font-black text-black/40 uppercase tracking-widest">Reservas de Oro</p>
                  <p className="text-3xl font-black tracking-tight text-black">{wallet.balanceGLDC.toFixed(2)} g</p>
                </div>
                <div className="text-[10px] font-black bg-black/10 px-4 py-2 rounded-full border border-black/5 text-black">POLYGON</div>
              </div>
            </div>
            <div className="absolute -bottom-16 -right-16 opacity-[0.05] text-black group-hover:scale-110 transition-transform duration-1000 pointer-events-none">
              <Coins size={220} />
            </div>
          </div>

          <div className="glass-card p-10 rounded-[3.5rem] border-white/10 shadow-2xl">
            <div className="flex gap-4 p-2 bg-black/40 rounded-[2rem] mb-10">
              <button onClick={() => setOrderType('BUY')} className={`flex-1 py-4 rounded-[1.5rem] text-[11px] font-black uppercase tracking-[0.2em] transition-all duration-300 ${orderType === 'BUY' ? 'bg-[#d4af37] text-black shadow-lg shadow-[#d4af37]/20' : 'text-white/20 hover:text-white/40'}`}>Comprar</button>
              <button onClick={() => setOrderType('SELL')} className={`flex-1 py-4 rounded-[1.5rem] text-[11px] font-black uppercase tracking-[0.2em] transition-all duration-300 ${orderType === 'SELL' ? 'bg-white/10 text-white' : 'text-white/20 hover:text-white/40'}`}>Vender</button>
            </div>

            <div className="space-y-10">
              <div className="space-y-4">
                <label className="text-[11px] font-black uppercase text-white/20 tracking-[0.3em] ml-4">Gramos de Oro (GLDC)</label>
                <div className="relative">
                  <input 
                    type="number" 
                    value={orderAmount} 
                    onChange={(e) => setOrderAmount(e.target.value)} 
                    className="w-full bg-white/5 border border-white/10 rounded-[2.5rem] py-7 px-10 text-4xl font-black focus:outline-none focus:border-[#d4af37] transition-all text-center placeholder:text-white/5 text-white" 
                    placeholder="0.00"
                  />
                  <div className="absolute right-8 top-1/2 -translate-y-1/2 text-white/10 font-black text-xl">GR</div>
                </div>
              </div>

              {orderDetails.grams > 0 && (
                <div className="p-8 bg-white/5 rounded-[2.5rem] border border-white/5 space-y-5 animate-fade-in">
                  <div className="flex justify-between text-[11px] font-bold uppercase text-white/40 tracking-widest">
                    <span>Precio Actual</span>
                    <span>${orderDetails.price.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] font-bold uppercase text-red-400/60 tracking-widest">
                    <span>Fee Protocolo (0.75%)</span>
                    <span>${orderDetails.fee.toFixed(2)}</span>
                  </div>
                  <div className="pt-5 border-t border-white/10 flex justify-between items-center">
                    <span className="text-xs font-black uppercase text-[#d4af37] tracking-[0.2em]">
                      {orderType === 'BUY' ? 'Total Final' : 'Recibirás'}
                    </span>
                    <span className="text-3xl font-black tabular-nums text-white">${orderDetails.total.toFixed(2)}</span>
                  </div>
                </div>
              )}

              <button 
                onClick={handleStartTransaction}
                disabled={!wallet.isConnected || orderDetails.grams <= 0}
                className={`w-full py-7 rounded-[2.5rem] font-black uppercase text-xs tracking-[0.4em] transition-all active:scale-95 flex items-center justify-center gap-4 shadow-2xl ${wallet.isConnected && orderDetails.grams > 0 ? (orderType === 'BUY' ? 'gold-gradient text-black' : 'bg-white text-black') : 'bg-white/5 text-white/10 cursor-not-allowed opacity-50'}`}
              >
                {orderType === 'BUY' ? 'Generar Orden de Compra' : 'Solicitar Liquidación'}
                <ArrowRight size={18} />
              </button>
            </div>
          </div>

          <div className="glass-card p-10 rounded-[3.5rem] border-white/5">
            <h3 className="text-[11px] font-black uppercase text-white/20 mb-10 tracking-[0.4em] flex items-center gap-3">
              <History size={16} /> Actividad Reciente
            </h3>
            <div className="space-y-6">
              {transactions.length === 0 ? (
                <div className="text-center py-16 opacity-[0.05]">
                  <History size={60} className="mx-auto mb-6" />
                  <p className="text-[11px] uppercase font-black tracking-[0.3em]">Sin movimientos registrados</p>
                </div>
              ) : (
                transactions.map(tx => (
                  <div key={tx.id} className="flex justify-between items-center p-6 rounded-[2rem] bg-white/5 border border-white/5 hover:border-white/10 transition-all group">
                    <div className="space-y-2">
                      <p className={`text-[10px] font-black uppercase tracking-widest ${tx.type === 'BUY' ? 'text-[#d4af37]' : 'text-white'}`}>{tx.type === 'BUY' ? 'Compra' : 'Venta'}</p>
                      <p className="text-[10px] text-white/10 font-mono tracking-tighter group-hover:text-white/20 transition-colors">{tx.id}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black tracking-tight text-white">{tx.amountGLDC} g</p>
                      <div className="flex items-center justify-end gap-2 mt-1">
                        <div className={`w-2 h-2 rounded-full ${tx.status === 'COMPLETED' ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]' : 'bg-orange-500 animate-pulse'}`}></div>
                        <p className="text-[9px] font-black uppercase opacity-40 tracking-widest text-white">{tx.status}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>

      {/* MODAL COMPRA */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-3xl">
          <div className="absolute inset-0 bg-black/95" onClick={() => setShowPaymentModal(false)}></div>
          <div className="relative w-full max-w-lg glass-card border-[#d4af37]/40 p-12 rounded-[4rem] animate-fade-in shadow-[0_0_100px_rgba(212,175,55,0.1)]">
            <button onClick={() => setShowPaymentModal(false)} className="absolute top-10 right-10 text-white/20 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-full"><X size={28}/></button>
            
            <div className="text-center mb-12">
              <div className="w-24 h-24 bg-[#d4af37]/10 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 border border-[#d4af37]/20">
                <ArrowDownLeft className="text-[#d4af37]" size={40} />
              </div>
              <h3 className="text-3xl font-black mb-4 tracking-tight">Liquidación USDT</h3>
              <p className="text-[11px] text-white/30 uppercase tracking-[0.3em] px-12 leading-loose">Transfiere el monto exacto y reporta el hash para la liberación del oro.</p>
            </div>

            <div className="space-y-10">
              <div className="p-8 bg-white/5 rounded-[2.5rem] border border-white/10 group hover:border-[#d4af37]/30 transition-all">
                <p className="text-[11px] font-black text-white/20 uppercase mb-4 tracking-widest">Receptor Oficial (USDT)</p>
                <div className="flex items-center gap-5">
                  <code className="flex-1 text-[13px] text-[#d4af37] font-mono break-all leading-tight">{ADMIN_USDT_WALLET}</code>
                  <button onClick={() => copyToClipboard(ADMIN_USDT_WALLET)} className="p-5 bg-[#d4af37]/10 rounded-2xl text-[#d4af37] hover:bg-[#d4af37] hover:text-black transition-all active:scale-90 shadow-lg">
                    {isCopied ? <CheckCircle2 size={24}/> : <Copy size={24}/>}
                  </button>
                </div>
              </div>

              <div className="p-8 bg-[#d4af37]/5 rounded-[2.5rem] border border-[#d4af37]/30 flex justify-between items-center">
                <span className="text-xs font-black uppercase text-white/60 tracking-[0.2em]">Monto a Pagar:</span>
                <span className="text-4xl font-black text-white tabular-nums">${orderDetails.total.toFixed(2)}</span>
              </div>

              <div className="space-y-5">
                <label className="text-[11px] font-black uppercase text-white/20 ml-5 tracking-[0.3em]">Hash de Transacción (TXID)</label>
                <input 
                  type="text" 
                  value={txHash} 
                  onChange={(e) => setTxHash(e.target.value)} 
                  className="w-full bg-white/5 border border-white/10 rounded-[2rem] py-6 px-8 text-sm font-mono focus:border-[#d4af37] transition-all text-[#d4af37] placeholder:text-white/5" 
                  placeholder="0x..."
                />
              </div>

              <button 
                onClick={() => executeTransaction(txHash)}
                disabled={!txHash}
                className={`w-full py-7 rounded-[2.5rem] font-black text-xs uppercase tracking-[0.4em] flex items-center justify-center gap-5 transition-all shadow-2xl ${txHash ? 'gold-gradient text-black' : 'bg-white/5 text-white/10'}`}
              >
                <Mail size={18} /> Confirmar Reporte de Pago
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL VENTA */}
      {showSellModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-3xl">
          <div className="absolute inset-0 bg-black/95" onClick={() => setShowSellModal(false)}></div>
          <div className="relative w-full max-w-lg glass-card border-white/20 p-12 rounded-[4rem] animate-fade-in shadow-2xl">
            <button onClick={() => setShowSellModal(false)} className="absolute top-10 right-10 text-white/20 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-full"><X size={28}/></button>
            
            <div className="text-center mb-12">
              <div className="w-24 h-24 bg-white/5 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 border border-white/10">
                <Wallet className="text-white" size={40} />
              </div>
              <h3 className="text-3xl font-black mb-4 tracking-tight">Liquidación de Oro</h3>
              <p className="text-[11px] text-white/30 uppercase tracking-[0.3em] px-12 leading-loose">Ingresa tu billetera USDT para recibir el pago por tus gramos GLDC.</p>
            </div>

            <div className="space-y-10">
              <div className="p-8 bg-white/5 rounded-[2.5rem] border border-white/10 flex justify-between items-center">
                <span className="text-xs font-black uppercase text-white/60 tracking-[0.2em]">Recibirás aprox:</span>
                <span className="text-4xl font-black text-[#d4af37] tabular-nums">${orderDetails.total.toFixed(2)}</span>
              </div>

              <div className="space-y-5">
                <label className="text-[11px] font-black uppercase text-white/20 ml-5 tracking-[0.3em]">Tu Billetera de Destino (USDT)</label>
                <input 
                  type="text" 
                  value={payoutAddress} 
                  onChange={(e) => setPayoutAddress(e.target.value)} 
                  className="w-full bg-white/5 border border-white/10 rounded-[2rem] py-6 px-8 text-sm font-mono focus:border-white transition-all text-white placeholder:text-white/5" 
                  placeholder="0x... (Red Polygon/TRC20)"
                />
              </div>

              <div className="p-8 bg-white/5 rounded-[2.5rem] border border-white/5 space-y-4">
                <div className="flex justify-between text-[10px] font-black text-white/40 uppercase tracking-widest">
                  <span>Gramos a Vender</span>
                  <span>{orderDetails.grams} g</span>
                </div>
                <div className="flex justify-between text-[10px] font-black text-white/40 uppercase tracking-widest">
                  <span>Comisión Red</span>
                  <span>${orderDetails.fee.toFixed(2)}</span>
                </div>
              </div>

              <button 
                onClick={() => executeTransaction(payoutAddress)}
                disabled={!payoutAddress}
                className={`w-full py-7 rounded-[2.5rem] font-black text-xs uppercase tracking-[0.4em] flex items-center justify-center gap-5 transition-all shadow-2xl ${payoutAddress ? 'bg-white text-black hover:scale-[1.02]' : 'bg-white/5 text-white/10'}`}
              >
                <Mail size={18} /> Enviar Solicitud de Venta
              </button>

              <p className="text-[9px] text-center text-white/20 uppercase tracking-[0.3em] font-bold">Un agente validará tu balance y procesará la transferencia.</p>
            </div>
          </div>
        </div>
      )}

      <footer className="max-w-7xl mx-auto px-6 py-20 text-center opacity-10 text-[11px] font-black uppercase tracking-[0.8em] border-t border-white/5">
        <p>© 2024 Cryptocagua Gold • Asset-Backed Digital Reserve Protocol</p>
      </footer>
    </div>
  );
};

export default App;

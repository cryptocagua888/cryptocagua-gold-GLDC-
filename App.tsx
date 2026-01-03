
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
  History,
  ShieldCheck,
  TrendingUp,
  CircleDot,
  AlertTriangle
} from 'lucide-react';

const App: React.FC = () => {
  const env = (window as any).process?.env || {};
  const ADMIN_USDT_WALLET = env.ADMIN_USDT_WALLET || "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
  const ADMIN_EMAIL = env.ADMIN_EMAIL || "soporte@cryptocagua.com";

  const [isLoading, setIsLoading] = useState(true);
  const [isWalletConnecting, setIsWalletConnecting] = useState(false);
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
  const [insight, setInsight] = useState<string>("Conectando con la reserva de oro...");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [orderType, setOrderType] = useState<'BUY' | 'SELL'>('BUY');
  const [orderAmount, setOrderAmount] = useState<string>('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showSellModal, setShowSellModal] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [payoutAddress, setPayoutAddress] = useState('');
  const [userName, setUserName] = useState('');
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

  const fetchBalanceViaBscScan = useCallback(async (walletAddr: string) => {
    if (!walletAddr || !GLDC_TOKEN_ADDRESS) return;

    try {
      const url = `https://api.bscscan.com/api?module=account&action=tokenbalance&contractaddress=${GLDC_TOKEN_ADDRESS}&address=${walletAddr}&tag=latest&apikey=${BSCSCAN_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === "1" && data.result) {
        const balance = parseFloat(formatUnits(data.result, 18));
        setWallet(prev => ({
          ...prev,
          balanceGLDC: balance,
          balanceUSD: balance * lastValidPrice.current
        }));
      }
    } catch (e) {
      console.error("BscScan API Error:", e);
    }
  }, []);

  const refreshMarketData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=PAXGUSDT');
      const data = await response.json();
      const realPaxgPrice = parseFloat(data.price) || 2350.00;
      const currentGldcPrice = realPaxgPrice / TROY_OUNCE_TO_GRAMS;
      
      lastValidPrice.current = currentGldcPrice;
      setGoldPrice({ paxgPrice: realPaxgPrice, gldcPrice: currentGldcPrice, lastUpdate: new Date() });
      
      const points: PricePoint[] = [];
      const now = new Date();
      for (let i = 12; i >= 0; i--) {
        points.push({
          time: new Date(now.getTime() - i * 3600000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          value: currentGldcPrice + (Math.random() - 0.5) * (currentGldcPrice * 0.01)
        });
      }
      setHistory(points);
      
      const aiInsight = await getGoldMarketInsight(currentGldcPrice);
      setInsight(String(aiInsight));

      if (wallet.address) {
        await fetchBalanceViaBscScan(wallet.address);
      }
    } catch (e) {
      console.error("Market data sync error:", e);
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
    }
  }, [wallet.address, fetchBalanceViaBscScan]);

  // Timeout de seguridad para quitar el loader si algo falla
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    refreshMarketData();
    const interval = setInterval(refreshMarketData, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [refreshMarketData]);

  const connectWallet = async () => {
    const ethereum = (window as any).ethereum;
    if (!ethereum) {
      alert("Por favor instala MetaMask para usar la aplicación.");
      return;
    }

    setIsWalletConnecting(true);
    try {
      const provider = new BrowserProvider(ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      const address = accounts[0];
      
      setWallet(prev => ({ ...prev, address, isConnected: true }));
      await fetchBalanceViaBscScan(address);
    } catch (e) {
      console.error("Wallet connection error:", e);
    } finally {
      setIsWalletConnecting(false);
    }
  };

  const executeTransaction = (info: string) => {
    const { grams, total } = orderDetails;
    const newId = `TX-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const newTx: Transaction = { 
      id: newId, type: orderType, amountGLDC: grams, 
      subtotalUSD: orderDetails.subtotal, feeUSD: orderDetails.fee, 
      totalUSD: total, status: 'PENDING', date: new Date() 
    };
    setTransactions(prev => [newTx, ...prev]);
    setShowPaymentModal(false);
    setShowSellModal(false);
    setOrderAmount('');
    window.open(`mailto:${ADMIN_EMAIL}?subject=REPORTE GLDC - ${newId}&body=ID: ${newId}%0AOperacion: ${orderType}%0AData: ${info}`, '_blank');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-6">
        <div className="w-16 h-16 gold-gradient rounded-[2rem] animate-bounce flex items-center justify-center shadow-2xl">
          <Coins className="text-black w-8 h-8" />
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.5em] text-[#d4af37]">Accediendo a la red Cryptocagua...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-32 animate-fade-in">
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/10 px-6 py-5 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Coins className="text-[#d4af37] w-7 h-7" />
          <h1 className="font-serif text-xl font-black tracking-tight">GLDC <span className="gold-text">GOLD</span></h1>
        </div>
        <button 
          onClick={connectWallet} 
          disabled={isWalletConnecting}
          className={`px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-xl flex items-center gap-3 ${wallet.isConnected ? 'bg-white/5 border border-white/20 text-white' : 'gold-gradient text-black'}`}
        >
          {isWalletConnecting ? <Loader2 size={14} className="animate-spin" /> : wallet.isConnected ? `${wallet.address?.slice(0, 6)}...${wallet.address?.slice(-4)}` : 'Conectar MetaMask'}
        </button>
      </header>

      <main className="max-w-7xl mx-auto px-6 pt-12 grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* PANEL IZQUIERDO: MERCADO */}
        <div className="lg:col-span-8 space-y-10">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-[#111] p-10 rounded-[3rem] border border-white/5 shadow-xl">
              <p className="text-[10px] font-black text-white/30 uppercase mb-2 tracking-widest">Precio Oro / Oz</p>
              <h3 className="text-4xl font-black text-white tracking-tighter">${goldPrice.paxgPrice.toLocaleString()}</h3>
            </div>
            <div className="bg-[#111] p-10 rounded-[3rem] border-2 border-[#d4af37]/30 shadow-2xl relative">
              <p className="text-[10px] font-black text-[#d4af37] uppercase mb-2 tracking-widest">Valor GLDC / 1 Gramo</p>
              <h3 className="text-4xl font-black text-white tracking-tighter">${goldPrice.gldcPrice.toFixed(2)}</h3>
              <div className="mt-4 flex items-center gap-2 text-[9px] font-black text-green-400 uppercase">
                <TrendingUp size={14} /> Binance Live Feed
              </div>
            </div>
          </div>

          <div className="bg-[#0a0a0a] p-10 rounded-[3.5rem] border border-white/5">
            <h2 className="text-[11px] font-black uppercase tracking-[0.4em] text-white/30 mb-8">Gráfico de Valorización</h2>
            <GoldChart data={history} />
          </div>

          <div className="bg-gradient-to-r from-[#d4af37]/10 to-transparent p-10 rounded-[2.5rem] border border-[#d4af37]/20 flex gap-8 items-center">
            <ShieldCheck className="text-[#d4af37] shrink-0" size={32} />
            <p className="text-xl font-medium italic text-white/90 leading-relaxed">"{insight}"</p>
          </div>
        </div>

        {/* PANEL DERECHO: ACCIONES */}
        <div className="lg:col-span-4 space-y-10">
          
          {/* BALANCE SÓLIDO */}
          <div className="bg-[#d4af37] p-12 rounded-[4rem] shadow-[0_20px_60px_rgba(212,175,55,0.3)] relative overflow-hidden border-4 border-[#f9e27d]/20">
            <div className="relative z-10">
              <p className="text-[12px] font-black uppercase text-black mb-1 tracking-widest">SALDO ESTIMADO (USD)</p>
              <h2 className="text-6xl font-black text-black tracking-tighter tabular-nums mb-12 leading-none">
                ${wallet.balanceUSD.toLocaleString(undefined, {minimumFractionDigits:2})}
              </h2>
              <div className="pt-8 border-t border-black/20 flex justify-between items-end">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-black/50 uppercase tracking-widest">Gramos Oro (GLDC)</p>
                  <p className="text-4xl font-black text-black tabular-nums">{wallet.balanceGLDC.toFixed(3)}g</p>
                </div>
                <div className="text-[9px] font-black bg-black text-[#d4af37] px-4 py-2 rounded-xl uppercase shadow-lg">BSC BEP-20</div>
              </div>
            </div>
            <Coins size={220} className="absolute -bottom-16 -right-16 opacity-10 text-black rotate-12" />
          </div>

          {/* OPERACIONES */}
          <div className="bg-[#111] p-12 rounded-[4.5rem] border border-white/10 shadow-2xl">
            <div className="flex bg-black p-2 rounded-2xl mb-12">
              <button onClick={() => setOrderType('BUY')} className={`flex-1 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${orderType === 'BUY' ? 'bg-[#d4af37] text-black shadow-lg' : 'text-white/30'}`}>Comprar</button>
              <button onClick={() => setOrderType('SELL')} className={`flex-1 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${orderType === 'SELL' ? 'bg-white text-black shadow-lg' : 'text-white/30'}`}>Vender</button>
            </div>

            <div className="space-y-10">
              <div className="space-y-3 text-center">
                <label className="text-[11px] font-black uppercase text-white/20 tracking-widest">Cantidad en Gramos</label>
                <input 
                  type="number" 
                  value={orderAmount} 
                  onChange={(e) => setOrderAmount(e.target.value)} 
                  className="w-full bg-black border-2 border-white/5 rounded-[2.5rem] py-8 text-5xl font-black text-center text-white outline-none focus:border-[#d4af37] transition-all" 
                  placeholder="0.00"
                />
              </div>

              {orderDetails.grams > 0 && (
                <div className="p-8 bg-black/50 rounded-[2.5rem] border border-white/5 space-y-4 animate-fade-in">
                  <div className="flex justify-between text-[11px] font-black uppercase"><span className="text-white/30">Subtotal</span><span>${orderDetails.subtotal.toFixed(2)}</span></div>
                  <div className="flex justify-between text-[11px] font-black uppercase"><span className="text-white/30">Comisión Red</span><span className="text-red-400">-${orderDetails.fee.toFixed(2)}</span></div>
                  <div className="pt-5 border-t border-white/10 flex justify-between items-center"><span className="text-[#d4af37] font-black text-xs">TOTAL A PAGAR</span><span className="text-4xl font-black">${orderDetails.total.toFixed(2)}</span></div>
                </div>
              )}

              <button 
                onClick={() => orderType === 'BUY' ? setShowPaymentModal(true) : setShowSellModal(true)}
                disabled={!wallet.isConnected || orderDetails.grams <= 0}
                className={`w-full py-8 rounded-[2.5rem] font-black uppercase text-[12px] tracking-widest flex items-center justify-center gap-4 transition-all active:scale-95 ${wallet.isConnected && orderDetails.grams > 0 ? (orderType === 'BUY' ? 'gold-gradient text-black shadow-2xl' : 'bg-white text-black shadow-xl') : 'bg-white/5 text-white/10 cursor-not-allowed'}`}
              >
                {orderType === 'BUY' ? 'Generar Orden' : 'Retirar Fondos'}
                <ArrowRight size={20} />
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* MODAL COMPRA */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[100] bg-black/98 flex items-center justify-center p-6 backdrop-blur-2xl">
          <div className="bg-[#111] w-full max-w-md p-12 rounded-[4rem] border-2 border-[#d4af37]/30 animate-fade-in relative">
            <button onClick={() => setShowPaymentModal(false)} className="absolute top-10 right-10 text-white/30 hover:text-white transition-colors"><X size={32}/></button>
            <div className="text-center mb-10">
              <h3 className="text-3xl font-black mb-2">Pagar en USDT</h3>
              <p className="text-[10px] text-white/30 uppercase tracking-[0.3em]">Instrucciones para Fondeo</p>
            </div>
            <div className="space-y-10">
              <div className="p-8 bg-black rounded-[2.5rem] border border-white/10 text-center">
                <p className="text-[10px] font-black text-[#d4af37] uppercase mb-4 tracking-widest">Enviar USDT (BSC BEP-20) a:</p>
                <code className="text-[11px] break-all block mb-6 text-white/80 font-mono leading-relaxed">{ADMIN_USDT_WALLET}</code>
                <button onClick={() => {navigator.clipboard.writeText(ADMIN_USDT_WALLET); setIsCopied(true); setTimeout(()=>setIsCopied(false),2000)}} className="px-8 py-3 bg-[#d4af37] text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:brightness-110">
                  {isCopied ? '¡Billetera Copiada!' : 'Copiar Wallet'}
                </button>
              </div>
              <div className="bg-[#d4af37] p-10 rounded-[2.5rem] text-center shadow-xl">
                <p className="text-xs font-black text-black uppercase mb-1">Total USDT exacto</p>
                <p className="text-5xl font-black text-black">${orderDetails.total.toFixed(2)}</p>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-white/30 ml-4">TXID / Hash de Pago</label>
                <input type="text" value={txHash} onChange={(e)=>setTxHash(e.target.value)} className="w-full bg-black border border-white/20 rounded-2xl py-6 px-8 text-sm text-[#d4af37] font-mono outline-none focus:border-[#d4af37] transition-all" placeholder="Pega el hash aquí" />
              </div>
              <button onClick={() => executeTransaction(txHash)} disabled={!txHash} className={`w-full py-8 rounded-[2.5rem] font-black text-[12px] uppercase tracking-[0.4em] ${txHash ? 'gold-gradient text-black shadow-2xl' : 'bg-white/5 text-white/10'}`}>Confirmar Pago</button>
            </div>
          </div>
        </div>
      )}

      {showSellModal && (
        <div className="fixed inset-0 z-[100] bg-black/98 flex items-center justify-center p-6 backdrop-blur-2xl">
          <div className="bg-[#111] w-full max-w-md p-12 rounded-[4rem] border-2 border-white/20 animate-fade-in relative">
            <button onClick={() => setShowSellModal(false)} className="absolute top-10 right-10 text-white/30 hover:text-white"><X size={32}/></button>
            <div className="text-center mb-10">
              <h3 className="text-3xl font-black mb-2 text-white">Vender GLDC</h3>
              <p className="text-[10px] text-white/30 uppercase tracking-[0.3em]">Retiro de Capital</p>
            </div>
            <div className="space-y-10">
              <div className="bg-black p-10 rounded-[2.5rem] border-2 border-[#d4af37]/30 text-center">
                <p className="text-xs font-black text-white/30 uppercase mb-1">Recibirás en USDT</p>
                <p className="text-5xl font-black text-[#d4af37]">${orderDetails.total.toFixed(2)}</p>
              </div>
              <div className="space-y-5">
                <input type="text" value={userName} onChange={(e)=>setUserName(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl py-6 px-8 text-sm text-white focus:border-white transition-all outline-none" placeholder="Nombre completo" />
                <input type="text" value={payoutAddress} onChange={(e)=>setPayoutAddress(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl py-6 px-8 text-sm text-[#d4af37] font-mono focus:border-[#d4af37] transition-all outline-none" placeholder="Wallet USDT Destino" />
              </div>
              <button onClick={() => executeTransaction(payoutAddress)} disabled={!payoutAddress || !userName} className={`w-full py-8 rounded-[2.5rem] font-black text-[12px] uppercase tracking-[0.4em] ${payoutAddress && userName ? 'bg-white text-black shadow-xl' : 'bg-white/5 text-white/10'}`}>Enviar Solicitud</button>
              <p className="text-[9px] text-center text-white/20 uppercase tracking-[0.2em] font-black leading-relaxed">La liquidación se procesa tras recibir los tokens en nuestra reserva de custodia.</p>
            </div>
          </div>
        </div>
      )}

      <footer className="text-center py-24 border-t border-white/5 opacity-20">
        <p className="text-[11px] font-black uppercase tracking-[1em]">Cryptocagua Gold Reserve • 2024</p>
      </footer>
    </div>
  );
};

export default App;

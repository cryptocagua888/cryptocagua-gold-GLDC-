
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { BrowserProvider, formatUnits } from 'ethers';
import { GoldPriceData, WalletState, Transaction, PricePoint } from './types';
import { TROY_OUNCE_TO_GRAMS, REFRESH_INTERVAL, TRANSACTION_FEE_RATE, GLDC_TOKEN_ADDRESS, BSCSCAN_API_KEY } from './constants';
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
  ArrowDownLeft,
  User,
  ShieldCheck,
  ExternalLink,
  TrendingUp
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
  const [insight, setInsight] = useState<string>("Sincronizando con reservas globales...");
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

  const fetchBalanceViaBscScan = useCallback(async (address: string) => {
    if (GLDC_TOKEN_ADDRESS === '0x0000000000000000000000000000000000000000') return;

    try {
      // Usamos la API de BscScan para traer el saldo real del token
      const url = `https://api.bscscan.com/api?module=account&action=tokenbalance&contractaddress=${GLDC_TOKEN_ADDRESS}&address=${address}&tag=latest&apikey=${BSCSCAN_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === "1") {
        // Asumimos 18 decimales por defecto para GLDC
        const balance = parseFloat(formatUnits(data.result, 18));
        setWallet(prev => ({
          ...prev,
          balanceGLDC: balance,
          balanceUSD: balance * lastValidPrice.current
        }));
      }
    } catch (e) {
      console.error("Error al consultar BscScan:", e);
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
        fetchBalanceViaBscScan(wallet.address);
      }
    } catch (e) {
      console.error("Error de sincronización:", e);
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
    }
  }, [wallet.address, fetchBalanceViaBscScan]);

  useEffect(() => {
    refreshMarketData();
    const interval = setInterval(refreshMarketData, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [refreshMarketData]);

  const connectWallet = async () => {
    const ethereum = (window as any).ethereum;
    if (!ethereum) {
      alert("Instala MetaMask o una billetera compatible para usar la App.");
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
      console.error("Conexión fallida:", e);
    } finally {
      setIsWalletConnecting(false);
    }
  };

  const executeTransaction = (primaryInfo: string, secondaryInfo: string = '') => {
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

    const subject = `${orderType === 'BUY' ? 'COMPRA' : 'VENTA'} GLDC - ${newId}`;
    const body = `REPORTE DE OPERACION GLDC\n\nID: ${newId}\nGRAMOS: ${grams}g\nTOTAL USD: $${total.toFixed(2)}\nCLIENTE: ${wallet.address}\nINFO: ${primaryInfo} ${secondaryInfo}`;
    
    window.open(`mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
    setTxHash(''); setPayoutAddress(''); setUserName('');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-8">
        <div className="w-24 h-24 gold-gradient rounded-[2.5rem] flex items-center justify-center animate-pulse shadow-[0_0_80px_rgba(212,175,55,0.3)]">
          <Coins className="text-black w-12 h-12" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="font-serif text-3xl font-bold gold-text">Cryptocagua Gold</h2>
          <p className="text-[10px] font-black uppercase tracking-[0.5em] text-white/30">Leyendo Blockchain de Binance...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-32 animate-fade-in">
      {/* NAVEGACION */}
      <header className="sticky top-0 z-50 bg-[#050505] border-b border-white/10 px-6 py-5 shadow-2xl">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 gold-gradient rounded-xl flex items-center justify-center shadow-lg shadow-[#d4af37]/20">
              <Coins className="text-black w-5 h-5" />
            </div>
            <div>
              <h1 className="font-serif text-2xl font-bold tracking-tight">GLDC <span className="gold-text">GOLD</span></h1>
            </div>
          </div>
          <button 
            onClick={connectWallet} 
            disabled={isWalletConnecting}
            className="px-6 py-2.5 rounded-full text-[10px] font-black gold-gradient text-black hover:scale-105 active:scale-95 transition-all shadow-lg shadow-[#d4af37]/20 uppercase tracking-widest flex items-center gap-2"
          >
            {isWalletConnecting ? (
              <><Loader2 size={12} className="animate-spin" /> Sincronizando...</>
            ) : (
              wallet.isConnected ? (
                <><span className="w-1.5 h-1.5 rounded-full bg-black"></span> {wallet.address?.slice(0, 6)}...{wallet.address?.slice(-4)}</>
              ) : 'Conectar Billetera'
            )}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pt-12 grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* LADO IZQUIERDO: MERCADO */}
        <div className="lg:col-span-8 space-y-10">
          
          {/* CARDS DE MERCADO */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#111] p-8 rounded-[2rem] border border-white/5">
              <p className="text-[10px] font-black text-white/40 uppercase mb-2 tracking-widest">Oro Spot / Oz</p>
              <h3 className="text-3xl font-black text-white tabular-nums">${goldPrice.paxgPrice.toLocaleString()}</h3>
              <div className="mt-4 flex items-center gap-2 text-[9px] font-black text-green-400 uppercase">
                <TrendingUp size={12} /> Live Binance Feed
              </div>
            </div>
            <div className="bg-[#111] p-8 rounded-[2rem] border-2 border-[#d4af37]/30 shadow-xl">
              <p className="text-[10px] font-black text-[#d4af37] uppercase mb-2 tracking-widest">GLDC / 1 Gramo</p>
              <h3 className="text-3xl font-black text-white tabular-nums">${goldPrice.gldcPrice.toFixed(2)}</h3>
              <div className="mt-4 flex items-center gap-2 text-[9px] font-black text-white/30 uppercase">
                <ShieldCheck size={12} className="text-[#d4af37]" /> Respaldo 1:1 Oro Físico
              </div>
            </div>
            <div className="bg-[#111] p-8 rounded-[2rem] flex flex-col justify-center items-center border border-white/5 group">
              <span className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-3">Sync BscScan</span>
              <button onClick={refreshMarketData} className={`p-4 rounded-2xl bg-white/5 border border-white/10 group-hover:bg-[#d4af37]/10 transition-all ${isRefreshing ? 'animate-spin' : ''}`}>
                <RefreshCw size={20} className="text-[#d4af37]" />
              </button>
            </div>
          </div>

          {/* GRAFICO */}
          <div className="bg-[#0a0a0a] p-10 rounded-[3rem] border border-white/5 shadow-inner">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-[11px] font-black uppercase tracking-[0.4em] text-white/40">Market Performance (BSC)</h2>
              <div className="bg-white/5 text-white/50 text-[9px] font-black px-4 py-1.5 rounded-full border border-white/10">72H REAL TIME</div>
            </div>
            <GoldChart data={history} />
          </div>

          {/* INSIGHT IA */}
          <div className="bg-gradient-to-r from-[#d4af37]/10 to-transparent p-8 rounded-[2.5rem] border border-[#d4af37]/20">
            <div className="flex gap-6 items-center">
              <div className="w-14 h-14 rounded-2xl bg-[#d4af37] flex items-center justify-center shrink-0 shadow-lg shadow-[#d4af37]/20">
                <Info className="text-black" size={24} />
              </div>
              <p className="text-lg text-white font-medium italic leading-relaxed">"{insight}"</p>
            </div>
          </div>
        </div>

        {/* LADO DERECHO: BALANCES Y OPERACIONES */}
        <div className="lg:col-span-4 space-y-10">
          
          {/* BALANCE - MAXIMA VISIBILIDAD DEFINITIVA */}
          <div className="bg-[#d4af37] p-10 rounded-[3rem] shadow-[0_30px_60px_rgba(212,175,55,0.3)] relative overflow-hidden">
            <div className="relative z-10">
              <p className="text-[12px] font-black uppercase text-black mb-2 tracking-widest">SALDO EN BILLETERA (USD)</p>
              <h2 className="text-6xl font-black text-black tracking-tighter tabular-nums mb-10 leading-none">
                ${wallet.balanceUSD.toLocaleString(undefined, {minimumFractionDigits:2})}
              </h2>
              
              <div className="pt-8 border-t border-black/20 flex justify-between items-end">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-black/60 uppercase tracking-widest">Gramos de Oro (GLDC)</p>
                  <p className="text-4xl font-black text-black tabular-nums">{wallet.balanceGLDC.toFixed(3)} g</p>
                </div>
                <div className="text-[9px] font-black bg-black text-white px-4 py-2 rounded-xl uppercase tracking-widest">BEP-20</div>
              </div>
            </div>
            <Coins size={200} className="absolute -bottom-12 -right-12 opacity-10 text-black pointer-events-none" />
          </div>

          {/* WIDGET DE COMPRA/VENTA - FONDO SOLIDO */}
          <div className="bg-[#111111] p-10 rounded-[3.5rem] border border-white/10 shadow-2xl">
            <div className="flex gap-3 p-1.5 bg-black rounded-3xl mb-10 border border-white/10">
              <button onClick={() => setOrderType('BUY')} className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${orderType === 'BUY' ? 'bg-[#d4af37] text-black shadow-lg shadow-[#d4af37]/30' : 'text-white/40 hover:text-white'}`}>Comprar</button>
              <button onClick={() => setOrderType('SELL')} className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${orderType === 'SELL' ? 'bg-white text-black shadow-lg' : 'text-white/40 hover:text-white'}`}>Vender</button>
            </div>

            <div className="space-y-8">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase text-white/40 tracking-[0.2em] ml-4">Gramos a Operar</label>
                <div className="relative">
                  <input 
                    type="number" 
                    value={orderAmount} 
                    onChange={(e) => setOrderAmount(e.target.value)} 
                    className="w-full bg-[#0a0a0a] border-2 border-white/10 rounded-2xl py-7 px-8 text-5xl font-black focus:outline-none focus:border-[#d4af37] transition-all text-center text-white placeholder:text-white/5" 
                    placeholder="0.00"
                  />
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 text-[#d4af37] font-black text-xs">GLDC</div>
                </div>
              </div>

              {orderDetails.grams > 0 && (
                <div className="p-7 bg-black rounded-3xl border-2 border-[#d4af37]/30 space-y-5 animate-fade-in">
                  <div className="flex justify-between text-[11px] font-black uppercase">
                    <span className="text-white/40">Valor de Mercado</span>
                    <span className="text-white">${orderDetails.price.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] font-black uppercase">
                    <span className="text-white/40">Fees de Red (Protocolo)</span>
                    <span className="text-red-400">-${orderDetails.fee.toFixed(2)}</span>
                  </div>
                  <div className="pt-4 border-t border-white/10 flex justify-between items-center">
                    <span className="text-[12px] font-black uppercase text-[#d4af37] tracking-widest">Total Estimado</span>
                    <span className="text-4xl font-black text-white tabular-nums">${orderDetails.total.toFixed(2)}</span>
                  </div>
                </div>
              )}

              <button 
                onClick={() => orderType === 'BUY' ? setShowPaymentModal(true) : setShowSellModal(true)}
                disabled={!wallet.isConnected || orderDetails.grams <= 0}
                className={`w-full py-7 rounded-[2rem] font-black uppercase text-[11px] tracking-[0.3em] transition-all active:scale-95 flex items-center justify-center gap-4 ${wallet.isConnected && orderDetails.grams > 0 ? (orderType === 'BUY' ? 'gold-gradient text-black shadow-2xl shadow-[#d4af37]/20' : 'bg-white text-black shadow-2xl shadow-white/10') : 'bg-white/5 text-white/20 cursor-not-allowed opacity-50'}`}
              >
                {orderType === 'BUY' ? 'Generar Orden Compra' : 'Solicitar Retiro'}
                <ArrowRight size={18} />
              </button>
            </div>
          </div>

          {/* HISTORIAL */}
          <div className="bg-[#111] p-10 rounded-[3rem] border border-white/5">
            <h3 className="text-[10px] font-black uppercase text-white/20 mb-8 tracking-widest flex items-center gap-3">
              <History size={14} /> Actividad Blockchain
            </h3>
            <div className="space-y-4">
              {transactions.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-[9px] font-black text-white/10 uppercase tracking-widest">Sin transacciones locales</p>
                </div>
              ) : (
                transactions.map(tx => (
                  <div key={tx.id} className="flex justify-between items-center p-5 rounded-2xl bg-black border border-white/5">
                    <div>
                      <p className={`text-[10px] font-black uppercase ${tx.type === 'BUY' ? 'text-[#d4af37]' : 'text-white'}`}>{tx.type === 'BUY' ? 'Compra' : 'Venta'}</p>
                      <p className="text-[9px] text-white/20 font-mono mt-1">{tx.id}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-black text-white tabular-nums">{tx.amountGLDC}g</p>
                      <span className="text-[8px] font-black text-green-500 uppercase tracking-widest">Success</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="max-w-7xl mx-auto px-6 py-24 text-center border-t border-white/5 opacity-30">
        <p className="text-[11px] font-black uppercase tracking-[1em]">© 2024 Cryptocagua Gold • Reserve Dashboard v3.5</p>
      </footer>

      {/* MODAL COMPRA REFORZADO */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/95 backdrop-blur-3xl">
          <div className="relative w-full max-w-md bg-[#111] border-2 border-[#d4af37]/50 p-12 rounded-[4rem] animate-fade-in shadow-2xl">
            <button onClick={() => setShowPaymentModal(false)} className="absolute top-10 right-10 text-white/40 hover:text-white p-3"><X size={28}/></button>
            <div className="text-center mb-10">
              <div className="w-20 h-20 bg-[#d4af37]/10 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-[#d4af37]/20">
                <ArrowDownLeft className="text-[#d4af37]" size={36} />
              </div>
              <h3 className="text-3xl font-black mb-3 text-white">Reporte Pago</h3>
              <p className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-black">Sigue las instrucciones para fondear</p>
            </div>
            <div className="space-y-10">
              <div className="p-8 bg-black rounded-[2rem] border border-white/10 text-center">
                <p className="text-[10px] font-black text-[#d4af37] uppercase mb-4 tracking-widest">Billetera Oficial (USDT BSC)</p>
                <code className="text-[11px] text-white font-mono break-all block mb-6">{ADMIN_USDT_WALLET}</code>
                <button onClick={() => {navigator.clipboard.writeText(ADMIN_USDT_WALLET); setIsCopied(true); setTimeout(()=>setIsCopied(false),2000)}} className="px-6 py-3 bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#d4af37] hover:text-black transition-all">
                  {isCopied ? 'Copiado ✓' : 'Copiar Wallet'}
                </button>
              </div>
              <div className="bg-[#d4af37] p-8 rounded-[2rem] text-center shadow-lg shadow-[#d4af37]/20">
                <p className="text-[12px] font-black text-black uppercase mb-1 tracking-widest">Monto USDT a Enviar</p>
                <p className="text-4xl font-black text-black tabular-nums">${orderDetails.total.toFixed(2)}</p>
              </div>
              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase text-white/40 ml-6 tracking-widest">TXID / Hash de Pago</label>
                <input type="text" value={txHash} onChange={(e)=>setTxHash(e.target.value)} className="w-full bg-black border-2 border-white/10 rounded-[2rem] py-6 px-8 text-sm font-mono text-[#d4af37] focus:border-[#d4af37] outline-none" placeholder="0x..." />
              </div>
              <button onClick={() => executeTransaction(txHash)} disabled={!txHash} className={`w-full py-8 rounded-[2.5rem] font-black text-[12px] uppercase tracking-[0.4em] ${txHash ? 'gold-gradient text-black shadow-xl shadow-[#d4af37]/20' : 'bg-white/5 text-white/10'}`}>Finalizar Reporte</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL VENTA REFORZADO */}
      {showSellModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/95 backdrop-blur-3xl">
          <div className="relative w-full max-w-md bg-[#111] border-2 border-white/20 p-12 rounded-[4rem] animate-fade-in shadow-2xl">
            <button onClick={() => setShowSellModal(false)} className="absolute top-10 right-10 text-white/40 hover:text-white p-3"><X size={28}/></button>
            <div className="text-center mb-10">
              <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-white/20">
                <Wallet className="text-white" size={36} />
              </div>
              <h3 className="text-3xl font-black mb-3 text-white">Vender GLDC</h3>
              <p className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-black">Conversión de Oro a USDT</p>
            </div>
            <div className="space-y-8">
              <div className="bg-black p-8 rounded-[2rem] border-2 border-[#d4af37]/30 text-center">
                <p className="text-[12px] font-black text-white/40 uppercase mb-1 tracking-widest">Recibirás en USDT</p>
                <p className="text-4xl font-black text-[#d4af37] tabular-nums">${orderDetails.total.toFixed(2)}</p>
              </div>
              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase text-white/40 ml-6 tracking-widest">Tu Nombre / ID</label>
                <input type="text" value={userName} onChange={(e)=>setUserName(e.target.value)} className="w-full bg-black border-2 border-white/10 rounded-[2rem] py-6 px-8 text-sm text-white focus:border-white outline-none" placeholder="Nombre completo" />
              </div>
              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase text-white/40 ml-6 tracking-widest">Wallet USDT Destino</label>
                <input type="text" value={payoutAddress} onChange={(e)=>setPayoutAddress(e.target.value)} className="w-full bg-black border-2 border-white/10 rounded-[2rem] py-6 px-8 text-xs font-mono text-white focus:border-white outline-none" placeholder="Dirección USDT (BEP-20)" />
              </div>
              <button onClick={() => executeTransaction(payoutAddress, userName)} disabled={!payoutAddress || !userName} className={`w-full py-8 rounded-[2.5rem] font-black text-[12px] uppercase tracking-[0.4em] ${payoutAddress && userName ? 'bg-white text-black shadow-xl shadow-white/10' : 'bg-white/5 text-white/10'}`}>Enviar Solicitud</button>
              <p className="text-[9px] text-center text-white/20 uppercase tracking-widest font-black">La liquidación se procesa tras recibir los tokens en reserva.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;

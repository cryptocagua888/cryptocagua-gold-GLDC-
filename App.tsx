
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
  TrendingUp,
  CircleDot
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
  const [insight, setInsight] = useState<string>("Sincronizando reservas...");
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

  // LECTURA DIRECTA DE BSCSCAN (SIN USAR CONTRATO ETHERS)
  const fetchBalanceViaBscScan = useCallback(async (address: string) => {
    if (GLDC_TOKEN_ADDRESS === '0x0000000000000000000000000000000000000000') return;

    try {
      const url = `https://api.bscscan.com/api?module=account&action=tokenbalance&contractaddress=${GLDC_TOKEN_ADDRESS}&address=${address}&tag=latest&apikey=${BSCSCAN_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === "1" && data.result) {
        // Formateamos asumiendo 18 decimales (estándar BSC)
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
        fetchBalanceViaBscScan(wallet.address);
      }
    } catch (e) {
      console.error("Market Sync Error:", e);
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
      alert("Por favor instala MetaMask para acceder a tu balance.");
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
      console.error("Wallet Connection Error:", e);
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

    const subject = `GLDC ${orderType} - ${newId}`;
    const body = `REPORTE DE TRANSACCION\n\nID: ${newId}\nGRAMOS: ${grams}g\nTOTAL: $${total.toFixed(2)}\nCLIENTE: ${wallet.address}\nDATA: ${primaryInfo} ${secondaryInfo}`;
    
    window.open(`mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-6">
        <div className="w-20 h-20 gold-gradient rounded-3xl animate-pulse flex items-center justify-center shadow-2xl">
          <Coins className="text-black w-10 h-10" />
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.5em] text-[#d4af37]">Accediendo a la Reserva...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-32 animate-fade-in">
      {/* HEADER COMPACTO */}
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-lg border-b border-white/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Coins className="text-[#d4af37] w-6 h-6" />
            <h1 className="font-serif text-xl font-bold tracking-tight">CRYPTOCAGUA <span className="gold-text">GOLD</span></h1>
          </div>
          <button 
            onClick={connectWallet} 
            disabled={isWalletConnecting}
            className="px-6 py-2 rounded-full text-[10px] font-black gold-gradient text-black hover:scale-105 transition-all shadow-lg uppercase tracking-widest flex items-center gap-2"
          >
            {isWalletConnecting ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              wallet.isConnected ? (
                <><CircleDot size={8} className="text-black" /> {wallet.address?.slice(0, 6)}...{wallet.address?.slice(-4)}</>
              ) : 'Conectar MetaMask'
            )}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pt-12 grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* PANEL IZQUIERDO */}
        <div className="lg:col-span-8 space-y-10">
          
          {/* CARDS PRECIO */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[#111] p-8 rounded-[2rem] border border-white/5 shadow-xl">
              <p className="text-[10px] font-black text-white/30 uppercase mb-2 tracking-widest">Precio Oro / Troy Oz</p>
              <h3 className="text-4xl font-black text-white">${goldPrice.paxgPrice.toLocaleString()}</h3>
            </div>
            <div className="bg-[#111] p-8 rounded-[2rem] border-2 border-[#d4af37]/30 shadow-2xl relative overflow-hidden">
              <p className="text-[10px] font-black text-[#d4af37] uppercase mb-2 tracking-widest">Valor GLDC / 1 Gramo</p>
              <h3 className="text-4xl font-black text-white">${goldPrice.gldcPrice.toFixed(2)}</h3>
              <div className="mt-4 flex items-center gap-2 text-[9px] font-black text-green-400 uppercase">
                <TrendingUp size={14} /> Mercado Binance Actualizado
              </div>
            </div>
          </div>

          {/* CHART */}
          <div className="bg-[#0a0a0a] p-10 rounded-[3rem] border border-white/5">
            <h2 className="text-[11px] font-black uppercase tracking-[0.4em] text-white/30 mb-8">Evolución de Reserva (72H)</h2>
            <GoldChart data={history} />
          </div>

          {/* IA ADVISOR */}
          <div className="bg-[#d4af37]/10 p-8 rounded-[2rem] border border-[#d4af37]/20 flex gap-6 items-center">
            <div className="w-12 h-12 bg-[#d4af37] rounded-2xl flex items-center justify-center shrink-0 shadow-lg">
              <ShieldCheck className="text-black" size={24} />
            </div>
            <p className="text-lg font-medium italic text-white/90">"{insight}"</p>
          </div>
        </div>

        {/* PANEL DERECHO: BALANCES Y ACCIONES */}
        <div className="lg:col-span-4 space-y-10">
          
          {/* BALANCE PRINCIPAL - MÁXIMO CONTRASTE (SIN TRANSPARENCIAS) */}
          <div className="bg-[#d4af37] p-10 rounded-[3rem] shadow-[0_20px_50px_rgba(212,175,55,0.3)] relative overflow-hidden">
            <div className="relative z-10">
              <p className="text-[11px] font-black uppercase text-black mb-1 tracking-widest">SALDO DISPONIBLE (USD)</p>
              <h2 className="text-6xl font-black text-black tracking-tighter tabular-nums mb-10 leading-none">
                ${wallet.balanceUSD.toLocaleString(undefined, {minimumFractionDigits:2})}
              </h2>
              
              <div className="pt-8 border-t border-black/20 flex justify-between items-end">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-black/50 uppercase tracking-widest">Gramos Oro (GLDC)</p>
                  <p className="text-4xl font-black text-black tabular-nums">{wallet.balanceGLDC.toFixed(3)}g</p>
                </div>
                <div className="text-[9px] font-black bg-black text-white px-3 py-1.5 rounded-lg uppercase">BSC Network</div>
              </div>
            </div>
            <Coins size={180} className="absolute -bottom-8 -right-8 opacity-10 text-black" />
          </div>

          {/* OPERACIONES */}
          <div className="bg-[#111] p-10 rounded-[3rem] border border-white/10">
            <div className="flex bg-black p-1.5 rounded-2xl mb-10">
              <button onClick={() => setOrderType('BUY')} className={`flex-1 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${orderType === 'BUY' ? 'bg-[#d4af37] text-black shadow-lg' : 'text-white/30'}`}>Comprar</button>
              <button onClick={() => setOrderType('SELL')} className={`flex-1 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${orderType === 'SELL' ? 'bg-white text-black shadow-lg' : 'text-white/30'}`}>Vender</button>
            </div>

            <div className="space-y-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-white/30 ml-4">Gramos a Operar</label>
                <input 
                  type="number" 
                  value={orderAmount} 
                  onChange={(e) => setOrderAmount(e.target.value)} 
                  className="w-full bg-black border-2 border-white/5 rounded-2xl py-6 px-6 text-4xl font-black focus:border-[#d4af37] transition-all text-center text-white outline-none" 
                  placeholder="0.00"
                />
              </div>

              {orderDetails.grams > 0 && (
                <div className="p-6 bg-black rounded-2xl border border-white/5 space-y-4 animate-fade-in">
                  <div className="flex justify-between text-[11px] font-black uppercase">
                    <span className="text-white/30">Precio</span>
                    <span>${orderDetails.price.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] font-black uppercase">
                    <span className="text-white/30">Fees</span>
                    <span className="text-red-400">-${orderDetails.fee.toFixed(2)}</span>
                  </div>
                  <div className="pt-4 border-t border-white/10 flex justify-between items-center">
                    <span className="text-[12px] font-black text-[#d4af37] uppercase">Total</span>
                    <span className="text-3xl font-black">${orderDetails.total.toFixed(2)}</span>
                  </div>
                </div>
              )}

              <button 
                onClick={() => orderType === 'BUY' ? setShowPaymentModal(true) : setShowSellModal(true)}
                disabled={!wallet.isConnected || orderDetails.grams <= 0}
                className={`w-full py-6 rounded-2xl font-black uppercase text-[11px] tracking-widest flex items-center justify-center gap-3 transition-all ${wallet.isConnected && orderDetails.grams > 0 ? (orderType === 'BUY' ? 'gold-gradient text-black shadow-xl' : 'bg-white text-black') : 'bg-white/5 text-white/10'}`}
              >
                {orderType === 'BUY' ? 'Generar Orden' : 'Retirar Fondos'}
                <ArrowRight size={16} />
              </button>
            </div>
          </div>

          {/* HISTORIAL */}
          <div className="bg-[#111] p-8 rounded-[2.5rem] border border-white/5">
            <h3 className="text-[10px] font-black uppercase text-white/20 mb-6 tracking-widest flex items-center gap-2">
              <History size={14} /> Actividad Local
            </h3>
            {transactions.length === 0 ? (
              <p className="text-[9px] text-center text-white/10 uppercase tracking-widest py-4">Sin operaciones recientes</p>
            ) : (
              <div className="space-y-3">
                {transactions.map(tx => (
                  <div key={tx.id} className="bg-black p-4 rounded-xl border border-white/5 flex justify-between items-center">
                    <div>
                      <p className={`text-[10px] font-black uppercase ${tx.type === 'BUY' ? 'text-[#d4af37]' : 'text-white'}`}>{tx.type}</p>
                      <p className="text-[8px] font-mono text-white/20">{tx.id}</p>
                    </div>
                    <p className="font-black">{tx.amountGLDC}g</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* MODALES REFORZADOS (SIN TRANSPARENCIAS) */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-6 backdrop-blur-md">
          <div className="bg-[#111] w-full max-w-md p-10 rounded-[3rem] border-2 border-[#d4af37]/30 animate-fade-in">
            <div className="flex justify-between items-center mb-10">
              <h3 className="text-2xl font-black">Confirmar Compra</h3>
              <button onClick={() => setShowPaymentModal(false)}><X size={24}/></button>
            </div>
            <div className="space-y-8">
              <div className="bg-black p-6 rounded-2xl border border-white/10 text-center">
                <p className="text-[10px] font-black text-[#d4af37] uppercase mb-4 tracking-widest">Enviar USDT a (BSC)</p>
                <code className="text-xs break-all block mb-6">{ADMIN_USDT_WALLET}</code>
                <button onClick={() => {navigator.clipboard.writeText(ADMIN_USDT_WALLET); setIsCopied(true); setTimeout(()=>setIsCopied(false),2000)}} className="px-5 py-2.5 bg-[#d4af37] text-black rounded-lg text-[9px] font-black uppercase tracking-widest">
                  {isCopied ? 'Copiado!' : 'Copiar Wallet'}
                </button>
              </div>
              <div className="bg-[#d4af37] p-8 rounded-2xl text-center shadow-lg">
                <p className="text-xs font-black text-black uppercase mb-1">Total a Enviar</p>
                <p className="text-4xl font-black text-black">${orderDetails.total.toFixed(2)}</p>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-white/30 ml-2">Hash de Pago (TXID)</label>
                <input type="text" value={txHash} onChange={(e)=>setTxHash(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl py-5 px-6 text-sm text-[#d4af37] font-mono" placeholder="0x..." />
              </div>
              <button onClick={() => executeTransaction(txHash)} disabled={!txHash} className={`w-full py-6 rounded-2xl font-black text-[11px] uppercase tracking-widest ${txHash ? 'gold-gradient text-black' : 'bg-white/5 text-white/10'}`}>Reportar Pago</button>
            </div>
          </div>
        </div>
      )}

      {showSellModal && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-6 backdrop-blur-md">
          <div className="bg-[#111] w-full max-w-md p-10 rounded-[3rem] border-2 border-white/20 animate-fade-in">
            <div className="flex justify-between items-center mb-10">
              <h3 className="text-2xl font-black text-white">Vender GLDC</h3>
              <button onClick={() => setShowSellModal(false)}><X size={24}/></button>
            </div>
            <div className="space-y-8">
              <div className="bg-black p-8 rounded-2xl border-2 border-[#d4af37]/30 text-center">
                <p className="text-xs font-black text-white/30 uppercase mb-1">Recibirás en USDT</p>
                <p className="text-4xl font-black text-[#d4af37]">${orderDetails.total.toFixed(2)}</p>
              </div>
              <div className="space-y-4">
                <input type="text" value={userName} onChange={(e)=>setUserName(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl py-5 px-6 text-sm text-white" placeholder="Tu nombre" />
                <input type="text" value={payoutAddress} onChange={(e)=>setPayoutAddress(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl py-5 px-6 text-sm text-white font-mono" placeholder="Wallet USDT Destino" />
              </div>
              <button onClick={() => executeTransaction(payoutAddress, userName)} disabled={!payoutAddress || !userName} className={`w-full py-6 rounded-2xl font-black text-[11px] uppercase tracking-widest ${payoutAddress && userName ? 'bg-white text-black' : 'bg-white/5 text-white/10'}`}>Enviar Solicitud</button>
              <p className="text-[9px] text-center text-white/20 uppercase tracking-widest font-black leading-loose">Se procesará el pago tras recibir los tokens en nuestra reserva fría.</p>
            </div>
          </div>
        </div>
      )}

      <footer className="text-center py-20 border-t border-white/5 opacity-20">
        <p className="text-[10px] font-black uppercase tracking-[1em]">Cryptocagua Gold • Reserve v4.0</p>
      </footer>
    </div>
  );
};

export default App;

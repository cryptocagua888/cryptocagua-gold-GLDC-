
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { BrowserProvider, Contract, formatUnits, JsonRpcProvider } from 'ethers';
import { 
  Wallet, 
  Coins, 
  RefreshCw, 
  ChevronRight,
  Send,
  X,
  AlertCircle,
  ShieldCheck,
  Loader2,
  PlusCircle,
  TrendingUp,
  History as HistoryIcon
} from 'lucide-react';
import { AreaChart, Area, Tooltip, ResponsiveContainer } from 'recharts';
import { GoldState, WalletState, PricePoint } from './types';
import { 
  TROY_OUNCE_TO_GRAMS, 
  GLDC_TOKEN_ADDRESS, 
  FEE_RATE, 
  TREASURY_WALLET, 
  SUPPORT_EMAIL 
} from './constants';
import { getMarketAnalysis } from './services/aiService';

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)", 
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)"
];

const BSC_NODES = [
  "https://bsc-dataseed1.binance.org",
  "https://rpc.ankr.com/bsc",
  "https://binance.llamarpc.com"
];

const App: React.FC = () => {
  const [gold, setGold] = useState<GoldState>({ 
    spotPrice: 2400, 
    gramPrice: 77.16, 
    change24h: 0.45, 
    loading: false 
  });
  const [wallet, setWallet] = useState<WalletState>({ 
    address: null, 
    balanceGLDC: 0, 
    balanceUSD: 0, 
    isConnected: false 
  });
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [history, setHistory] = useState<PricePoint[]>([]);
  const [analysis, setAnalysis] = useState<string>("Conectando con la reserva de oro física...");
  const [orderAmount, setOrderAmount] = useState<string>("");
  const [orderType, setOrderType] = useState<'BUY' | 'SELL'>('BUY');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [wrongNetwork, setWrongNetwork] = useState(false);

  const currentBalanceUSD = useMemo(() => {
    return (wallet.balanceGLDC || 0) * (gold.gramPrice || 77.16);
  }, [wallet.balanceGLDC, gold.gramPrice]);

  const orderDetails = useMemo(() => {
    const amount = parseFloat(orderAmount) || 0;
    const subtotal = amount * gold.gramPrice;
    const fee = subtotal * FEE_RATE;
    const total = orderType === 'BUY' ? subtotal + fee : subtotal - fee;
    return { subtotal, fee, total };
  }, [orderAmount, gold.gramPrice, orderType]);

  const fetchWalletBalance = useCallback(async (address: string, isSilent = false) => {
    if (!address) return;
    if (!isSilent) setIsLoadingBalance(true);
    
    try {
      const eth = (window as any).ethereum;
      if (eth && !wrongNetwork) {
        try {
          const browserProvider = new BrowserProvider(eth);
          const contract = new Contract(GLDC_TOKEN_ADDRESS, ERC20_ABI, browserProvider);
          const [rawBalance, decimals] = await Promise.all([
            contract.balanceOf(address),
            contract.decimals().catch(() => 18)
          ]);
          const balFormatted = parseFloat(formatUnits(rawBalance, decimals));
          
          setWallet(prev => ({ 
            ...prev, 
            address, 
            isConnected: true, 
            balanceGLDC: balFormatted,
            balanceUSD: balFormatted * gold.gramPrice
          }));
          if (!isSilent) setIsLoadingBalance(false);
          return;
        } catch (e) {
          console.warn("MetaMask provider falló, usando fallback RPC...");
        }
      }

      for (const rpc of BSC_NODES) {
        try {
          const provider = new JsonRpcProvider(rpc);
          const contract = new Contract(GLDC_TOKEN_ADDRESS, ERC20_ABI, provider);
          const [rawBalance, decimals] = await Promise.all([
            contract.balanceOf(address),
            contract.decimals().catch(() => 18)
          ]);
          const balFormatted = parseFloat(formatUnits(rawBalance, decimals));
          setWallet(prev => ({ 
            ...prev, 
            address, 
            isConnected: true, 
            balanceGLDC: balFormatted,
            balanceUSD: balFormatted * gold.gramPrice
          }));
          if (!isSilent) setIsLoadingBalance(false);
          return;
        } catch (e) {
          console.warn(`Error en nodo ${rpc}`);
        }
      }
    } catch (e) {
      console.error("Error crítico de lectura:", e);
    } finally {
      setIsLoadingBalance(false);
    }
  }, [gold.gramPrice, wrongNetwork]);

  const fetchMarketData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=PAXGUSDT');
      const data = await res.json();
      if (data?.price) {
        const spot = parseFloat(data.price);
        const gram = spot / TROY_OUNCE_TO_GRAMS;
        setGold(prev => ({ ...prev, spotPrice: spot, gramPrice: gram }));
        getMarketAnalysis(gram).then(setAnalysis);
        
        if (wallet.address) {
          fetchWalletBalance(wallet.address, true);
        }
      }
    } catch (e) { console.error(e); } finally { setIsRefreshing(false); }
  }, [fetchWalletBalance, wallet.address]);

  const connectWallet = async () => {
    const eth = (window as any).ethereum;
    if (!eth) { alert("Instala MetaMask."); return; }
    try {
      const accounts = await eth.request({ method: "eth_requestAccounts" });
      if (accounts[0]) {
        const chainId = await eth.request({ method: 'eth_chainId' });
        setWrongNetwork(chainId !== '0x38');
        setWallet(prev => ({ ...prev, address: accounts[0], isConnected: true }));
        fetchWalletBalance(accounts[0]);
      }
    } catch (e) { console.error(e); }
  };

  const addTokenToMetaMask = async () => {
    const eth = (window as any).ethereum;
    if (!eth) return;
    try {
      await eth.request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address: GLDC_TOKEN_ADDRESS,
            symbol: 'GLDC',
            decimals: 18,
            image: 'https://cryptocagua.com/logo-gldc.png',
          },
        },
      });
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchMarketData();
    setHistory(Array.from({ length: 24 }, (_, i) => ({
      time: `${i}:00`,
      price: 77.16 + (Math.random() - 0.5) * 2
    })));
    
    const eth = (window as any).ethereum;
    if (eth) {
      eth.request({ method: 'eth_accounts' }).then((accounts: string[]) => {
        if (accounts[0]) {
          setWallet(prev => ({ ...prev, address: accounts[0], isConnected: true }));
          eth.request({ method: 'eth_chainId' }).then((chainId: string) => {
            setWrongNetwork(chainId !== '0x38');
            fetchWalletBalance(accounts[0]);
          });
        }
      });
      eth.on('accountsChanged', (accs: string[]) => {
        if (accs[0]) {
          setWallet(prev => ({ ...prev, address: accs[0], isConnected: true }));
          fetchWalletBalance(accs[0]);
        } else {
          setWallet({ address: null, balanceGLDC: 0, balanceUSD: 0, isConnected: false });
        }
      });
      eth.on('chainChanged', () => window.location.reload());
    }
    
    const balancePoll = setInterval(() => {
      if (wallet.address && !wrongNetwork) fetchWalletBalance(wallet.address, true);
    }, 15000);

    const marketPoll = setInterval(fetchMarketData, 60000);
    return () => { clearInterval(balancePoll); clearInterval(marketPoll); };
  }, [fetchMarketData, fetchWalletBalance, wallet.address, wrongNetwork]);

  return (
    <div className="min-h-screen pb-20">
      {wrongNetwork && wallet.isConnected && (
        <div className="bg-red-600 text-white px-6 py-4 flex flex-wrap items-center justify-center gap-4 text-[10px] font-black sticky top-0 z-[100] shadow-2xl">
          <AlertCircle size={18} className="animate-pulse" />
          <span className="tracking-widest uppercase">Red Incorrecta. Cambia a Binance Smart Chain para operar con GLDC.</span>
          <button 
            onClick={() => (window as any).ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x38' }] })}
            className="bg-white text-red-600 px-6 py-1.5 rounded-full hover:scale-105 transition-all"
          >
            Sincronizar BSC
          </button>
        </div>
      )}

      <nav className="glass border-b border-white/5 px-6 sm:px-12 py-6 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-4 cursor-pointer" onClick={() => window.location.reload()}>
          <div className="w-12 h-12 gold-gradient rounded-2xl flex items-center justify-center shadow-gold transition-transform hover:scale-110">
            <Coins className="text-black" size={28} />
          </div>
          <div className="hidden sm:block">
            <h1 className="font-serif text-3xl font-black tracking-tighter leading-none">CRYPTOCAGUA</h1>
            <p className="text-[9px] font-black text-yellow-500/70 uppercase tracking-[0.5em] mt-1">Token de Oro Físico</p>
          </div>
        </div>

        <button 
          onClick={connectWallet}
          className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase flex items-center gap-3 transition-all active:scale-95 ${wallet.isConnected && wallet.address ? 'bg-white/5 border border-white/10 text-white/60' : 'gold-gradient text-black shadow-lg hover:shadow-yellow-500/20'}`}
        >
          <Wallet size={18} /> 
          {wallet.isConnected && wallet.address ? `${wallet.address.slice(0,6)}...${wallet.address.slice(-4)}` : 'Conectar Wallet'}
        </button>
      </nav>

      <main className="max-w-7xl mx-auto px-6 sm:px-12 mt-12 grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="glass p-10 rounded-[3rem] border-white/5 relative group">
              <p className="text-[10px] font-black uppercase tracking-widest opacity-30 mb-4">Referencia Oro Global</p>
              <div className="flex items-baseline gap-4">
                <h2 className="text-5xl font-black tracking-tighter">${gold.spotPrice.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
                <span className="text-green-500 font-black text-sm">+{gold.change24h}%</span>
              </div>
            </div>
            <div className="glass p-10 rounded-[3rem] border-2 border-yellow-500/20 shadow-gold-sm relative overflow-hidden">
              <div className="absolute -right-6 -top-6 opacity-[0.03] rotate-12"><ShieldCheck size={180} /></div>
              <p className="text-[10px] font-black uppercase text-yellow-500 tracking-[0.4em] mb-4">Gramo GLDC</p>
              <h2 className="text-5xl font-black tracking-tighter gold-text">${gold.gramPrice.toFixed(2)}</h2>
            </div>
          </div>

          <div className="glass p-10 rounded-[4rem]">
            <div className="flex justify-between items-center mb-12 text-[10px] font-black uppercase tracking-[0.4em] text-white/30">
              <span className="flex items-center gap-3"><div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div> Mercado en Vivo</span>
              <button onClick={fetchMarketData} className="p-2 hover:bg-white/5 rounded-xl transition-all"><RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''}/></button>
            </div>
            <div className="h-[380px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history}>
                  <defs><linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#D4AF37" stopOpacity={0.4}/><stop offset="100%" stopColor="#D4AF37" stopOpacity={0}/></linearGradient></defs>
                  <Area type="monotone" dataKey="price" stroke="#D4AF37" fill="url(#gold)" strokeWidth={4} />
                  <Tooltip contentStyle={{ background: '#0a0a0a', border: '1px solid #333', borderRadius: '20px' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-yellow-500/[0.03] border border-yellow-500/10 p-10 rounded-[4rem] flex flex-col md:flex-row items-center gap-8">
            <HistoryIcon className="text-yellow-500 shrink-0" size={40} />
            <p className="text-lg font-medium text-white/60 italic leading-relaxed">"{analysis}"</p>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-10">
          <div className="gold-gradient p-12 rounded-[4.5rem] text-black shadow-gold-lg relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-4">
                <p className="text-[11px] font-black uppercase opacity-60 tracking-widest">Reserva GLDC</p>
                {wallet.isConnected && <button onClick={addTokenToMetaMask} className="p-2 bg-black/5 hover:bg-black/15 rounded-2xl transition-all"><PlusCircle size={22} /></button>}
              </div>
              <h3 className="text-6xl font-black tracking-tighter mb-12">
                {isLoadingBalance ? <Loader2 size={40} className="animate-spin opacity-40" /> : (wallet.isConnected ? `$${currentBalanceUSD.toLocaleString(undefined, {minimumFractionDigits: 2})}` : '$0.00')}
              </h3>
              <div className="pt-10 border-t border-black/10">
                <p className="text-[9px] font-bold opacity-60 uppercase mb-2">Balance en Gramos</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-4xl font-black">{wallet.isConnected ? wallet.balanceGLDC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 }) : '0.00'}</p>
                  <span className="text-xl font-bold opacity-40">g</span>
                </div>
              </div>
            </div>
          </div>

          <div className="glass p-12 rounded-[4.5rem] border-white/5 space-y-12">
            <div className="flex bg-black/40 p-2 rounded-3xl border border-white/5">
              <button onClick={() => setOrderType('BUY')} className={`flex-1 py-6 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${orderType === 'BUY' ? 'bg-yellow-500 text-black shadow-gold-sm' : 'text-white/20'}`}>Adquirir</button>
              <button onClick={() => setOrderType('SELL')} className={`flex-1 py-6 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${orderType === 'SELL' ? 'bg-white text-black shadow-xl' : 'text-white/20'}`}>Liquidar</button>
            </div>
            
            <div className="text-center space-y-6">
              <label className="text-[10px] font-black uppercase text-white/20 tracking-[0.5em]">Gramos a transar</label>
              <input type="number" value={orderAmount} onChange={(e) => setOrderAmount(e.target.value)} placeholder="0.00" className="w-full bg-black/60 border border-white/5 rounded-[3rem] py-14 text-7xl font-black text-center outline-none focus:border-yellow-500/40 transition-all placeholder:text-white/5" />
            </div>

            <button 
              onClick={() => setShowConfirm(true)}
              disabled={!wallet.isConnected || !orderAmount || wrongNetwork || isLoadingBalance}
              className={`w-full py-10 rounded-[3rem] font-black uppercase text-[12px] tracking-[0.3em] transition-all active:scale-[0.96] flex items-center justify-center gap-4 shadow-2xl ${wallet.isConnected && !wrongNetwork && orderAmount ? (orderType === 'BUY' ? 'gold-gradient text-black hover:scale-[1.03]' : 'bg-white text-black hover:scale-[1.03]') : 'bg-white/5 text-white/10 cursor-not-allowed'}`}
            >
              {orderType === 'BUY' ? 'Crear Reserva' : 'Canjear Oro'}
              <ChevronRight size={24} />
            </button>
          </div>
        </div>
      </main>

      {showConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 backdrop-blur-3xl bg-black/80">
          <div className="glass w-full max-w-2xl p-16 rounded-[5rem] border border-yellow-500/20 relative shadow-gold-lg animate-in fade-in zoom-in duration-300">
            <button onClick={() => setShowConfirm(false)} className="absolute top-12 right-12 text-white/20 hover:text-white transition-all"><X size={44}/></button>
            <h3 className="text-5xl font-black text-center mb-14 uppercase tracking-tighter">Confirmar Orden</h3>
            <div className="space-y-12">
              <div className="bg-black/60 p-12 rounded-[4rem] border border-white/5 text-center">
                <p className="text-[11px] font-black text-yellow-500 uppercase mb-4 tracking-[0.3em]">Dirección de Pago Segura</p>
                <code className="text-xs break-all block font-mono text-white/60 mb-8 select-all p-4 bg-yellow-500/10 rounded-xl border border-yellow-500/20 shadow-inner">
                  {TREASURY_WALLET}
                </code>
                
                <p className="text-[11px] font-black text-yellow-500 uppercase mb-2 tracking-[0.3em]">Monto Estimado</p>
                <h4 className="text-7xl font-black">${orderDetails.total.toLocaleString(undefined, {minimumFractionDigits: 2})} <span className="text-2xl opacity-20 uppercase">USDT</span></h4>
                <p className="text-[10px] opacity-30 mt-4 italic font-medium">Incluye comisión del {(FEE_RATE * 100).toFixed(2)}% por procesamiento físico.</p>
              </div>
              
              <div className="space-y-4">
                <button 
                  onClick={() => { 
                    setShowConfirm(false); 
                    window.location.href=`mailto:${SUPPORT_EMAIL}?subject=ORDEN GLDC: ${orderType} ${orderAmount}g&body=Solicitud de Orden Cryptocagua%0D%0A--------------------------------%0D%0ATipo: ${orderType}%0D%0ACantidad: ${orderAmount} gramos%0D%0AEquivalente: $${orderDetails.total.toFixed(2)} USDT%0D%0ABilletera Usuario: ${wallet.address}%0D%0A--------------------------------%0D%0APor favor, procesen mi solicitud.`; 
                  }} 
                  className="w-full py-10 gold-gradient text-black rounded-[3rem] font-black uppercase text-[13px] tracking-[0.3em] flex items-center justify-center gap-5 shadow-2xl hover:scale-[1.03] transition-transform"
                >
                  Enviar Notificación <Send size={24}/>
                </button>
                <p className="text-[10px] text-center text-white/20 font-black uppercase tracking-widest">Se abrirá tu gestor de correo predeterminado</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;

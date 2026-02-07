
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { BrowserProvider, Contract, formatUnits, JsonRpcProvider } from 'ethers';
import { 
  Wallet, 
  Coins, 
  RefreshCw, 
  Info,
  Key,
  ChevronRight,
  Send,
  X,
  AlertCircle,
  ShieldCheck,
  Loader2,
  PlusCircle
} from 'lucide-react';
import { AreaChart, Area, Tooltip, ResponsiveContainer } from 'recharts';
import { GoldState, WalletState, PricePoint } from './types';
import { 
  TROY_OUNCE_TO_GRAMS, 
  GLDC_TOKEN_ADDRESS, 
  FEE_RATE, 
  ADMIN_WALLET, 
  SUPPORT_EMAIL 
} from './constants';
import { getMarketAnalysis } from './services/aiService';

const MIN_ABI = ["function balanceOf(address) view returns (uint256)"];
const BSC_RPC_URLS = [
  "https://bsc-dataseed.binance.org/",
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
  const [analysis, setAnalysis] = useState<string>("Verificando reservas en tiempo real...");
  const [orderAmount, setOrderAmount] = useState<string>("");
  const [orderType, setOrderType] = useState<'BUY' | 'SELL'>('BUY');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [wrongNetwork, setWrongNetwork] = useState(false);

  const currentBalanceUSD = useMemo(() => {
    return (wallet.balanceGLDC || 0) * (gold.gramPrice || 77.16);
  }, [wallet.balanceGLDC, gold.gramPrice]);

  const orderDetails = useMemo(() => {
    const qty = parseFloat(orderAmount) || 0;
    const subtotal = qty * gold.gramPrice;
    const fee = subtotal * FEE_RATE;
    const total = orderType === 'BUY' ? subtotal + fee : subtotal - fee;
    return { qty, subtotal, fee, total };
  }, [orderAmount, gold.gramPrice, orderType]);

  const fetchWalletBalance = useCallback(async (address: string) => {
    if (!address) return;
    setIsLoadingBalance(true);
    console.group("Consultando Balance GLDC");
    console.log("Wallet:", address);
    console.log("Contrato:", GLDC_TOKEN_ADDRESS);
    
    try {
      let balance;
      let success = false;

      // Intento 1: Nodo RPC Directo (Más rápido y confiable)
      try {
        const provider = new JsonRpcProvider(BSC_RPC_URLS[0]);
        const contract = new Contract(GLDC_TOKEN_ADDRESS, MIN_ABI, provider);
        balance = await contract.balanceOf(address);
        success = true;
        console.log("Balance obtenido vía RPC Directo");
      } catch (e) {
        console.warn("Fallo RPC directo, intentando vía MetaMask...");
        // Intento 2: Inyectado (MetaMask)
        const eth = (window as any).ethereum;
        if (eth) {
          const browserProvider = new BrowserProvider(eth);
          const contract = new Contract(GLDC_TOKEN_ADDRESS, MIN_ABI, browserProvider);
          balance = await contract.balanceOf(address);
          success = true;
          console.log("Balance obtenido vía MetaMask");
        }
      }

      if (success && balance !== undefined) {
        const balFormatted = parseFloat(formatUnits(balance, 18));
        console.log("Resultado Formateado:", balFormatted);
        
        setWallet(prev => ({ 
          ...prev, 
          address, 
          isConnected: true, 
          balanceGLDC: balFormatted,
          balanceUSD: balFormatted * gold.gramPrice
        }));
      }
    } catch (e) {
      console.error("Error definitivo leyendo balance:", e);
    } finally {
      setIsLoadingBalance(false);
      console.groupEnd();
    }
  }, [gold.gramPrice]);

  const addTokenToWallet = async () => {
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
            image: 'https://cryptocagua.com/logo-gldc.png', // URL de tu logo si tienes
          },
        },
      });
    } catch (error) {
      console.error(error);
    }
  };

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

        const eth = (window as any).ethereum;
        if (eth && eth.selectedAddress) {
          fetchWalletBalance(eth.selectedAddress);
        }
      }
    } catch (e) { 
      console.error("Error mercado:", e); 
    } finally { 
      setIsRefreshing(false); 
    }
  }, [fetchWalletBalance]);

  const connectWallet = async () => {
    const eth = (window as any).ethereum;
    if (!eth) {
      alert("Por favor, instala MetaMask.");
      return;
    }
    
    try {
      const accounts = await eth.request({ method: "eth_requestAccounts" });
      if (accounts && accounts.length > 0) {
        const userAddress = accounts[0];
        const chainId = await eth.request({ method: 'eth_chainId' });
        const isCorrect = chainId === '0x38';
        setWrongNetwork(!isCorrect);
        setWallet(prev => ({ ...prev, address: userAddress, isConnected: true }));
        if (isCorrect) fetchWalletBalance(userAddress);
      }
    } catch (e) { 
      console.error(e); 
    }
  };

  const handleOrderSubmit = () => {
    const typeStr = orderType === 'BUY' ? 'COMPRA' : 'VENTA';
    const amount = parseFloat(orderAmount);
    if (isNaN(amount) || amount <= 0) return;

    const subject = `ORDEN DE ${typeStr} - GLDC`;
    const body = `Orden de ${typeStr} por ${amount} gramos.\nWallet: ${wallet.address}\nTotal: $${orderDetails.total.toFixed(2)}`;
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setShowConfirm(false);
    setOrderAmount("");
  };

  useEffect(() => {
    fetchMarketData();
    setHistory(Array.from({ length: 20 }, (_, i) => ({
      time: `${i}:00`,
      price: 77.16 + (Math.random() - 0.5) * 2
    })));
    
    const eth = (window as any).ethereum;
    if (eth) {
      eth.request({ method: 'eth_accounts' }).then((accounts: string[]) => {
        if (accounts && accounts.length > 0) {
          const userAddress = accounts[0];
          setWallet(prev => ({ ...prev, address: userAddress, isConnected: true }));
          eth.request({ method: 'eth_chainId' }).then((chainId: string) => {
            const isCorrect = chainId === '0x38';
            setWrongNetwork(!isCorrect);
            if (isCorrect) fetchWalletBalance(userAddress);
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
    
    const interval = setInterval(fetchMarketData, 60000);
    return () => clearInterval(interval);
  }, [fetchMarketData, fetchWalletBalance]);

  return (
    <div className="min-h-screen pb-12 transition-all duration-500">
      {wrongNetwork && wallet.isConnected && (
        <div className="bg-red-600 text-white px-6 py-4 flex flex-wrap items-center justify-center gap-4 text-xs font-black sticky top-0 z-[100] border-b border-red-500/50 shadow-2xl">
          <AlertCircle size={20} className="animate-pulse" />
          <span>RED INCORRECTA. PARA VER TU BALANCE GLDC DEBES ESTAR EN BINANCE SMART CHAIN</span>
          <button 
            onClick={() => (window as any).ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x38' }] })}
            className="bg-white text-red-600 px-6 py-2 rounded-full font-black uppercase hover:scale-105 transition-transform"
          >
            CAMBIAR A BSC
          </button>
        </div>
      )}

      <nav className="glass border-b border-white/5 px-4 sm:px-10 py-5 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 gold-gradient rounded-xl flex items-center justify-center shadow-2xl">
            <Coins className="text-black" size={26} />
          </div>
          <div className="hidden sm:block">
            <h1 className="font-serif text-2xl font-black tracking-tight">CRYPTOCAGUA</h1>
            <span className="text-[10px] font-black text-yellow-500 uppercase tracking-[0.4em]">Gold Reserve</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={connectWallet}
            className={`px-6 py-2.5 rounded-full text-[11px] font-black uppercase flex items-center gap-2 transition-all cursor-pointer shadow-lg active:scale-95 ${wallet.isConnected && wallet.address ? 'bg-white/5 border border-white/10 text-white' : 'gold-gradient text-black hover:scale-105'}`}
          >
            <Wallet size={16} /> 
            {wallet.isConnected && wallet.address 
              ? `${wallet.address.slice(0,6)}...${wallet.address.slice(-4)}` 
              : 'CONECTAR WALLET'}
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-10 mt-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass p-8 rounded-[2.5rem] relative overflow-hidden group">
              <p className="text-[10px] font-black uppercase text-white/30 tracking-widest mb-2">Referencia PAX Gold</p>
              <div className="flex items-end gap-3">
                <h2 className="text-5xl font-black tracking-tighter">${gold.spotPrice.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
                <span className="mb-2 text-green-500 font-bold text-sm">+{gold.change24h}%</span>
              </div>
            </div>
            <div className="glass p-8 rounded-[2.5rem] border-2 border-yellow-500/30 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10"><ShieldCheck size={40} className="text-yellow-500" /></div>
              <p className="text-[10px] font-black uppercase text-yellow-500 tracking-widest mb-2">Gramo GLDC (Oro Físico)</p>
              <h2 className="text-5xl font-black tracking-tighter gold-text">${gold.gramPrice.toFixed(2)}</h2>
            </div>
          </div>

          <div className="glass p-8 rounded-[3rem]">
            <div className="flex justify-between items-center mb-10">
              <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-white/40 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></div> Monitor Global
              </h3>
              <button onClick={fetchMarketData} className="p-2 hover:bg-white/5 rounded-full transition-all">
                <RefreshCw size={18} className={`${isRefreshing ? 'animate-spin' : ''} text-white/20`} />
              </button>
            </div>
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history}>
                  <defs>
                    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#D4AF37" stopOpacity={0.5}/>
                      <stop offset="100%" stopColor="#D4AF37" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="price" stroke="#D4AF37" fill="url(#g)" strokeWidth={4} />
                  <Tooltip contentStyle={{ background: '#000', border: '1px solid #333', borderRadius: '15px' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-8">
          <div className="gold-gradient p-10 rounded-[3.5rem] text-black shadow-2xl relative overflow-hidden group">
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-3">
                <p className="text-[11px] font-black uppercase opacity-60 tracking-widest">Balance Disponible</p>
                {wallet.isConnected && (
                  <button 
                    onClick={addTokenToWallet}
                    className="bg-black/10 hover:bg-black/20 p-2 rounded-full transition-all"
                    title="Añadir GLDC a MetaMask"
                  >
                    <PlusCircle size={18} />
                  </button>
                )}
              </div>
              <h3 className="text-6xl font-black tracking-tighter mb-10 leading-none">
                {isLoadingBalance ? (
                  <Loader2 size={40} className="animate-spin opacity-50" />
                ) : (
                  wallet.isConnected ? `$${currentBalanceUSD.toLocaleString(undefined, {minimumFractionDigits: 2})}` : '$0.00'
                )}
              </h3>
              <div className="pt-8 border-t border-black/10 flex justify-between items-end">
                <div>
                  <p className="text-[10px] font-bold opacity-50 uppercase tracking-widest">Gramos Oro</p>
                  <div className="flex items-center gap-2">
                    {isLoadingBalance && <Loader2 size={14} className="animate-spin" />}
                    <p className="text-3xl font-black">{wallet.isConnected ? wallet.balanceGLDC.toFixed(4) : '0.0000'}g</p>
                  </div>
                </div>
                <div className="bg-black/10 px-4 py-2 rounded-xl text-[9px] font-black tracking-widest border border-black/5">BSC NETWORK</div>
              </div>
            </div>
            <Coins size={220} className="absolute -bottom-12 -right-12 opacity-10 rotate-12 group-hover:rotate-45 transition-transform duration-1000" />
          </div>

          <div className="glass p-10 rounded-[3.5rem] border border-white/5">
            <div className="flex bg-black p-2 rounded-full mb-10 border border-white/10 shadow-inner">
              <button onClick={() => setOrderType('BUY')} className={`flex-1 py-5 rounded-full text-[11px] font-black uppercase transition-all ${orderType === 'BUY' ? 'bg-yellow-500 text-black shadow-xl' : 'text-white/30'}`}>ADQUIRIR</button>
              <button onClick={() => setOrderType('SELL')} className={`flex-1 py-5 rounded-full text-[11px] font-black uppercase transition-all ${orderType === 'SELL' ? 'bg-white text-black shadow-xl' : 'text-white/30'}`}>LIQUIDAR</button>
            </div>
            <div className="space-y-10">
              <div className="space-y-4 text-center">
                <label className="text-[10px] font-black uppercase text-white/20 tracking-[0.3em]">Cantidad en Gramos</label>
                <input 
                  type="number" value={orderAmount} onChange={(e) => setOrderAmount(e.target.value)} placeholder="0.00"
                  className="w-full bg-black/50 border border-white/5 rounded-[2.5rem] py-12 text-6xl font-black text-center outline-none focus:border-yellow-500/50 transition-all placeholder:text-white/5"
                />
              </div>
              <button 
                onClick={() => setShowConfirm(true)}
                disabled={!wallet.isConnected || parseFloat(orderAmount) <= 0 || wrongNetwork || isLoadingBalance}
                className={`w-full py-8 rounded-[2.5rem] font-black uppercase text-[12px] tracking-widest transition-all active:scale-[0.97] flex items-center justify-center gap-3 cursor-pointer ${wallet.isConnected && !wrongNetwork && parseFloat(orderAmount) > 0 ? (orderType === 'BUY' ? 'gold-gradient text-black shadow-2xl hover:scale-[1.02]' : 'bg-white text-black shadow-2xl hover:scale-[1.02]') : 'bg-white/5 text-white/10 cursor-not-allowed'}`}
              >
                {orderType === 'BUY' ? 'GENERAR SOLICITUD' : 'SOLICITAR RETIRO'}
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        </div>
      </main>

      {showConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-3xl bg-black/80">
          <div className="glass w-full max-w-xl p-12 rounded-[4rem] border border-yellow-500/30 relative shadow-2xl">
            <button onClick={() => setShowConfirm(false)} className="absolute top-10 right-10 text-white/20 hover:text-white transition-colors cursor-pointer"><X size={32}/></button>
            <h3 className="text-4xl font-black text-center mb-10 uppercase tracking-tighter">Confirmar Operación</h3>
            <div className="space-y-8">
              <div className="bg-black p-10 rounded-[3rem] border border-white/5 text-center">
                <p className="text-[11px] font-black text-yellow-500 uppercase mb-3 tracking-widest">Valor de Liquidación (USDT)</p>
                <h4 className="text-6xl font-black">${orderDetails.total.toFixed(2)}</h4>
              </div>
              <button onClick={handleOrderSubmit} className="w-full py-8 gold-gradient text-black rounded-[2.5rem] font-black uppercase text-[12px] tracking-widest flex items-center justify-center gap-4 shadow-2xl hover:scale-[1.02]">FINALIZAR Y NOTIFICAR <Send size={20}/></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;

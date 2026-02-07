
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
  ShieldCheck
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
const BSC_RPC = "https://bsc-dataseed.binance.org/";

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
  const [history, setHistory] = useState<PricePoint[]>([]);
  const [analysis, setAnalysis] = useState<string>("Iniciando terminal segura...");
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
    try {
      const eth = (window as any).ethereum;
      let provider;
      if (eth) {
        provider = new BrowserProvider(eth);
      } else {
        provider = new JsonRpcProvider(BSC_RPC);
      }

      const contract = new Contract(GLDC_TOKEN_ADDRESS, MIN_ABI, provider);
      const balance = await contract.balanceOf(address);
      const balFormatted = parseFloat(formatUnits(balance, 18));
      
      console.log(`Balance obtenido para ${address}: ${balFormatted} GLDC`);
      
      setWallet(prev => ({ 
        ...prev, 
        address, 
        isConnected: true, 
        balanceGLDC: balFormatted,
        balanceUSD: balFormatted * gold.gramPrice
      }));
    } catch (e) {
      console.error("Error al leer balance:", e);
      setWallet(prev => ({ ...prev, address, isConnected: true }));
    }
  }, [gold.gramPrice]);

  const fetchMarketData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // PAXGUSDT es un buen proxy para el precio spot del oro
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
      console.error("Market data error:", e); 
    } finally { 
      setIsRefreshing(false); 
    }
  }, [fetchWalletBalance]);

  const connectWallet = async () => {
    const eth = (window as any).ethereum;
    if (!eth) {
      alert("Por favor, instala MetaMask para conectar tu billetera.");
      return;
    }
    
    try {
      const accounts = await eth.request({ method: "eth_requestAccounts" });
      if (accounts && accounts.length > 0) {
        const userAddress = accounts[0];
        console.log("Conectado con dirección:", userAddress);
        
        // Actualizar estado de red
        const chainId = await eth.request({ method: 'eth_chainId' });
        setWrongNetwork(chainId !== '0x38');

        setWallet(prev => ({ ...prev, address: userAddress, isConnected: true }));
        fetchWalletBalance(userAddress);
      }
    } catch (e) { 
      console.error("Error de conexión:", e); 
    }
  };

  const handleOpenAiKey = async () => {
    const aistudio = (window as any).aistudio;
    if (aistudio && typeof aistudio.openSelectKey === 'function') {
      try {
        await aistudio.openSelectKey();
        // Recargar datos para usar la nueva llave
        setTimeout(fetchMarketData, 500);
      } catch (e) {
        console.error("Error al abrir selector de llave:", e);
      }
    } else {
      alert("Para usar el análisis de IA, asegúrate de estar en el entorno de AI Studio y haber seleccionado una API Key.");
    }
  };

  const handleOrderSubmit = () => {
    if (!wallet.address) return;
    const orderId = Math.random().toString(36).substring(7).toUpperCase();
    const subject = `ORDEN GLDC - ${orderType} - ${orderId}`;
    const body = `ID: ${orderId}\nTipo: ${orderType}\nCantidad: ${orderAmount}g\nTotal: $${orderDetails.total.toFixed(2)}\nWallet: ${wallet.address}`;
    window.open(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
    setShowConfirm(false);
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
          fetchWalletBalance(userAddress);
          
          eth.request({ method: 'eth_chainId' }).then((chainId: string) => {
            setWrongNetwork(chainId !== '0x38');
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
      
      eth.on('chainChanged', (chainId: string) => {
        setWrongNetwork(chainId !== '0x38');
        window.location.reload();
      });
    }
    
    const interval = setInterval(fetchMarketData, 60000);
    return () => clearInterval(interval);
  }, [fetchMarketData, fetchWalletBalance]);

  return (
    <div className="min-h-screen pb-12 transition-all duration-500">
      {wrongNetwork && wallet.isConnected && (
        <div className="bg-red-600 text-white px-6 py-4 flex flex-wrap items-center justify-center gap-4 text-xs font-black sticky top-0 z-[100] border-b border-red-500/50 shadow-2xl">
          <AlertCircle size={20} className="animate-pulse" />
          <span>ATENCIÓN: ESTÁS EN LA RED INCORRECTA. POR FAVOR, CAMBIA A BINANCE SMART CHAIN</span>
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
            onClick={handleOpenAiKey}
            className="ia-button-glow flex items-center gap-2 px-5 py-2.5 bg-yellow-500/10 hover:bg-yellow-500/20 rounded-full text-[10px] font-black uppercase transition-all"
          >
            <Key size={14} className="text-yellow-500" /> <span className="hidden xs:inline">CONFIGURAR IA</span>
          </button>
          <button 
            onClick={connectWallet}
            className={`px-6 py-2.5 rounded-full text-[11px] font-black uppercase flex items-center gap-2 transition-all cursor-pointer shadow-lg active:scale-95 ${wallet.isConnected && wallet.address ? 'bg-white/5 border border-white/10 text-white' : 'gold-gradient text-black hover:scale-105'}`}
          >
            <Wallet size={16} /> 
            {wallet.isConnected && wallet.address 
              ? `${wallet.address.slice(0,6)}...${wallet.address.slice(-4)}` 
              : 'CONECTAR BILLETERA'}
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-10 mt-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass p-8 rounded-[2.5rem] relative overflow-hidden">
              <p className="text-[10px] font-black uppercase text-white/30 tracking-widest mb-2">Precio Internacional (PAXG)</p>
              <div className="flex items-end gap-3">
                <h2 className="text-5xl font-black tracking-tighter">${gold.spotPrice.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
                <span className="mb-2 text-green-500 font-bold text-sm">+{gold.change24h}%</span>
              </div>
            </div>
            <div className="glass p-8 rounded-[2.5rem] border-2 border-yellow-500/30 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10"><ShieldCheck size={40} className="text-yellow-500" /></div>
              <p className="text-[10px] font-black uppercase text-yellow-500 tracking-widest mb-2">Precio GLDC (1 Gramo de Oro)</p>
              <h2 className="text-5xl font-black tracking-tighter gold-text">${gold.gramPrice.toFixed(2)}</h2>
            </div>
          </div>

          <div className="glass p-8 rounded-[3rem]">
            <div className="flex justify-between items-center mb-10">
              <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-white/40 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></div> Monitor de Reservas
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

          <div className="bg-yellow-500/5 border border-yellow-500/10 p-10 rounded-[3rem] flex flex-col md:flex-row items-center md:items-start gap-8">
            <div className="w-16 h-16 gold-gradient rounded-2xl flex items-center justify-center shrink-0 shadow-lg"><Info className="text-black" size={32} /></div>
            <div className="space-y-2">
               <p className="text-[10px] font-black uppercase text-yellow-500/50 tracking-widest">Análisis de Mercado IA</p>
               <p className="text-xl font-medium italic text-white/90 leading-tight">"{analysis}"</p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-8">
          <div className="gold-gradient p-10 rounded-[3.5rem] text-black shadow-2xl relative overflow-hidden group">
            <div className="relative z-10">
              <p className="text-[11px] font-black uppercase opacity-60 mb-3 tracking-widest">Balance Total Estimado</p>
              <h3 className="text-6xl font-black tracking-tighter mb-10 leading-none">
                {wallet.isConnected ? `$${currentBalanceUSD.toLocaleString(undefined, {minimumFractionDigits: 2})}` : '$0.00'}
              </h3>
              <div className="pt-8 border-t border-black/10 flex justify-between items-end">
                <div>
                  <p className="text-[10px] font-bold opacity-50 uppercase">Tus Tokens GLDC</p>
                  <p className="text-3xl font-black">{wallet.isConnected ? wallet.balanceGLDC.toFixed(4) : '0.0000'}g</p>
                </div>
                <div className="bg-black/10 px-4 py-2 rounded-xl text-[9px] font-black tracking-widest border border-black/5">RED BSC</div>
              </div>
            </div>
            <Coins size={220} className="absolute -bottom-12 -right-12 opacity-10 rotate-12 group-hover:rotate-45 transition-transform duration-1000" />
          </div>

          <div className="glass p-10 rounded-[3.5rem] border border-white/5">
            <div className="flex bg-black p-2 rounded-full mb-10 border border-white/10 shadow-inner">
              <button onClick={() => setOrderType('BUY')} className={`flex-1 py-5 rounded-full text-[11px] font-black uppercase transition-all ${orderType === 'BUY' ? 'bg-yellow-500 text-black shadow-xl' : 'text-white/30'}`}>COMPRAR</button>
              <button onClick={() => setOrderType('SELL')} className={`flex-1 py-5 rounded-full text-[11px] font-black uppercase transition-all ${orderType === 'SELL' ? 'bg-white text-black shadow-xl' : 'text-white/30'}`}>VENDER</button>
            </div>
            <div className="space-y-10">
              <div className="space-y-4 text-center">
                <label className="text-[10px] font-black uppercase text-white/20 tracking-[0.3em]">Gramos a transaccionar</label>
                <input 
                  type="number" value={orderAmount} onChange={(e) => setOrderAmount(e.target.value)} placeholder="0.00"
                  className="w-full bg-black/50 border border-white/5 rounded-[2.5rem] py-12 text-6xl font-black text-center outline-none focus:border-yellow-500/50 transition-all placeholder:text-white/5"
                />
              </div>
              <button 
                onClick={() => setShowConfirm(true)}
                disabled={!wallet.isConnected || parseFloat(orderAmount) <= 0 || wrongNetwork}
                className={`w-full py-8 rounded-[2.5rem] font-black uppercase text-[12px] tracking-widest transition-all active:scale-[0.97] flex items-center justify-center gap-3 cursor-pointer ${wallet.isConnected && !wrongNetwork && parseFloat(orderAmount) > 0 ? (orderType === 'BUY' ? 'gold-gradient text-black shadow-2xl hover:scale-[1.02]' : 'bg-white text-black shadow-2xl hover:scale-[1.02]') : 'bg-white/5 text-white/10 cursor-not-allowed'}`}
              >
                {orderType === 'BUY' ? 'SOLICITAR ORO' : 'SOLICITAR LIQUIDEZ'}
                <ChevronRight size={20} />
              </button>
              {!wallet.isConnected && (
                <p className="text-center text-[10px] font-bold text-yellow-500/40 uppercase tracking-widest animate-pulse">Debes conectar tu billetera</p>
              )}
            </div>
          </div>
        </div>
      </main>

      {showConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-3xl bg-black/80 animate-fade-in">
          <div className="glass w-full max-w-xl p-12 rounded-[4rem] border border-yellow-500/30 relative shadow-2xl">
            <button onClick={() => setShowConfirm(false)} className="absolute top-10 right-10 text-white/20 hover:text-white transition-colors cursor-pointer"><X size={32}/></button>
            <h3 className="text-4xl font-black text-center mb-10 uppercase tracking-tighter">Confirmación de Orden</h3>
            <div className="space-y-8">
              <div className="bg-black p-10 rounded-[3rem] border border-white/5 text-center">
                <p className="text-[11px] font-black text-yellow-500 uppercase mb-3 tracking-widest">Total Estimado (USDT)</p>
                <h4 className="text-6xl font-black">${orderDetails.total.toFixed(2)}</h4>
              </div>
              <div className="p-10 bg-yellow-500/5 rounded-[3rem] border border-yellow-500/10 text-center">
                <p className="text-[10px] font-black uppercase text-white/40 mb-4 tracking-widest">Wallet de Destino (BEP20)</p>
                <code className="text-[11px] break-all block font-mono text-white/60 bg-black/40 p-5 rounded-2xl border border-white/5 mb-8">{ADMIN_WALLET}</code>
                <button onClick={() => { navigator.clipboard.writeText(ADMIN_WALLET); alert("Dirección copiada al portapapeles"); }} className="px-8 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase border border-white/5 transition-all cursor-pointer">Copiar Dirección</button>
              </div>
              <button onClick={handleOrderSubmit} className="w-full py-8 gold-gradient text-black rounded-[2.5rem] font-black uppercase text-[12px] tracking-widest flex items-center justify-center gap-4 shadow-2xl cursor-pointer hover:scale-[1.02]">ENVIAR NOTIFICACIÓN <Send size={20}/></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;


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
  TrendingUp
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

const ERC20_ABI = ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"];
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
  const [analysis, setAnalysis] = useState<string>("Sincronizando con la red de Binance Smart Chain...");
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

  // FUNCIÓN CRÍTICA: Búsqueda de balance en segundo plano
  const fetchWalletBalance = useCallback(async (address: string) => {
    if (!address) return;
    setIsLoadingBalance(true);
    
    // Intentar con múltiples nodos por si uno falla o está saturado
    for (const rpc of BSC_NODES) {
      try {
        console.log(`Intentando leer balance desde nodo: ${rpc}`);
        const provider = new JsonRpcProvider(rpc);
        const contract = new Contract(GLDC_TOKEN_ADDRESS, ERC20_ABI, provider);
        
        const [rawBalance, decimals] = await Promise.all([
          contract.balanceOf(address),
          contract.decimals().catch(() => 18) // Por defecto 18 si falla
        ]);

        const balFormatted = parseFloat(formatUnits(rawBalance, decimals));
        console.log(`¡Éxito! Balance GLDC para ${address}: ${balFormatted}`);
        
        setWallet(prev => ({ 
          ...prev, 
          address, 
          isConnected: true, 
          balanceGLDC: balFormatted,
          balanceUSD: balFormatted * gold.gramPrice
        }));
        
        setIsLoadingBalance(false);
        return; // Detener si tuvimos éxito
      } catch (e) {
        console.warn(`Error en nodo ${rpc}:`, e);
      }
    }

    // Si todos los nodos RPC fallan, intentar con MetaMask directamente
    try {
      const eth = (window as any).ethereum;
      if (eth) {
        const browserProvider = new BrowserProvider(eth);
        const contract = new Contract(GLDC_TOKEN_ADDRESS, ERC20_ABI, browserProvider);
        const balance = await contract.balanceOf(address);
        const balFormatted = parseFloat(formatUnits(balance, 18));
        setWallet(prev => ({ ...prev, balanceGLDC: balFormatted }));
      }
    } catch (e) {
      console.error("Fallo total en la lectura de balance:", e);
    } finally {
      setIsLoadingBalance(false);
    }
  }, [gold.gramPrice]);

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

        // Actualizar balance automáticamente cuando cambie el precio del mercado
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
      alert("Por favor, instala MetaMask para gestionar tu reserva GLDC.");
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
      console.error("Error conexión:", e); 
    }
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
            image: 'https://cryptocagua.com/logo.png',
          },
        },
      });
    } catch (e) { console.error(e); }
  };

  const handleOrderSubmit = () => {
    const typeStr = orderType === 'BUY' ? 'COMPRA' : 'VENTA';
    const amount = parseFloat(orderAmount);
    if (isNaN(amount) || amount <= 0) return;

    const subject = `NOTIFICACIÓN ORDEN ${typeStr} - GLDC`;
    const body = `Nueva orden de ${typeStr} por ${amount} gramos de Cryptocagua Gold.\n\nWallet Cliente: ${wallet.address}\nValor Estimado: $${orderDetails.total.toFixed(2)}\n\nPor favor procedan con la validación.`;
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setShowConfirm(false);
    setOrderAmount("");
  };

  // EFECTO DE SEGUNDO PLANO: Polling de balance cada 20 segundos
  useEffect(() => {
    fetchMarketData();
    
    // Simulación de gráfico
    setHistory(Array.from({ length: 24 }, (_, i) => ({
      time: `${i}:00`,
      price: 77.16 + (Math.random() - 0.5) * 1.5
    })));
    
    const eth = (window as any).ethereum;
    if (eth) {
      // Verificar sesión activa
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

      // Escuchar cambios de cuenta
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
    
    // Intervalos de actualización
    const marketInterval = setInterval(fetchMarketData, 60000); // Mercado cada 1 min
    const balanceInterval = setInterval(() => {
      if (wallet.address && !wrongNetwork) {
        console.log("Actualizando balance en segundo plano...");
        fetchWalletBalance(wallet.address);
      }
    }, 20000); // Balance cada 20 segundos

    return () => {
      clearInterval(marketInterval);
      clearInterval(balanceInterval);
    };
  }, [fetchMarketData, fetchWalletBalance, wallet.address, wrongNetwork]);

  return (
    <div className="min-h-screen pb-16 transition-all duration-700">
      {/* Alerta de Red */}
      {wrongNetwork && wallet.isConnected && (
        <div className="bg-red-600/90 backdrop-blur-md text-white px-6 py-4 flex flex-wrap items-center justify-center gap-4 text-xs font-black sticky top-0 z-[100] border-b border-red-500 shadow-2xl">
          <AlertCircle size={20} className="animate-bounce" />
          <span className="uppercase tracking-widest">Atención: Cambia a la red Binance Smart Chain (BSC) para ver tu balance real.</span>
          <button 
            onClick={() => (window as any).ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x38' }] })}
            className="bg-white text-red-600 px-8 py-2 rounded-full font-black uppercase hover:scale-110 active:scale-95 transition-all shadow-xl"
          >
            Sincronizar Red
          </button>
        </div>
      )}

      {/* Navegación */}
      <nav className="glass border-b border-white/5 px-6 sm:px-12 py-6 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-5">
          <div className="w-12 h-12 gold-gradient rounded-2xl flex items-center justify-center shadow-gold transition-transform hover:rotate-12">
            <Coins className="text-black" size={28} />
          </div>
          <div className="hidden md:block">
            <h1 className="font-serif text-3xl font-black tracking-tight leading-none">CRYPTOCAGUA</h1>
            <span className="text-[9px] font-black text-yellow-500 uppercase tracking-[0.5em] ml-1">Digital Gold Standard</span>
          </div>
        </div>

        <div className="flex items-center gap-5">
          <button 
            onClick={connectWallet}
            className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase flex items-center gap-3 transition-all active:scale-95 shadow-2xl ${wallet.isConnected && wallet.address ? 'bg-white/5 border border-white/10 text-white/80' : 'gold-gradient text-black hover:scale-105'}`}
          >
            <Wallet size={18} /> 
            {wallet.isConnected && wallet.address 
              ? `${wallet.address.slice(0,6)}...${wallet.address.slice(-4)}` 
              : 'Conectar Billetera'}
          </button>
        </div>
      </nav>

      {/* Contenido Principal */}
      <main className="max-w-7xl mx-auto px-6 sm:px-12 mt-12 grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* Columna Izquierda: Datos de Mercado */}
        <div className="lg:col-span-8 space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="glass p-10 rounded-[3rem] relative group overflow-hidden border-white/5">
              <div className="flex justify-between items-start mb-4">
                <p className="text-[10px] font-black uppercase text-white/20 tracking-[0.3em]">Referencia Global PAXG</p>
                <TrendingUp size={16} className="text-green-500 opacity-50" />
              </div>
              <div className="flex items-baseline gap-4">
                <h2 className="text-5xl font-black tracking-tighter">${gold.spotPrice.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
                <span className="text-green-500 font-black text-sm">+{gold.change24h}%</span>
              </div>
            </div>
            
            <div className="glass p-10 rounded-[3rem] border-2 border-yellow-500/20 shadow-gold-sm relative overflow-hidden group">
              <div className="absolute -right-8 -top-8 opacity-5 group-hover:rotate-12 transition-transform duration-1000">
                <ShieldCheck size={160} className="text-yellow-500" />
              </div>
              <p className="text-[10px] font-black uppercase text-yellow-500 tracking-[0.3em] mb-4">Valor Gramo GLDC (Oro Físico)</p>
              <h2 className="text-5xl font-black tracking-tighter gold-text">${gold.gramPrice.toFixed(2)}</h2>
            </div>
          </div>

          <div className="glass p-10 rounded-[4rem] relative">
            <div className="flex justify-between items-center mb-12">
              <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30 flex items-center gap-4">
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500 animate-pulse shadow-gold-sm"></div> Índice de Estabilidad
              </h3>
              <button onClick={fetchMarketData} className="p-3 hover:bg-white/5 rounded-2xl transition-all">
                <RefreshCw size={20} className={`${isRefreshing ? 'animate-spin text-yellow-500' : 'text-white/20'}`} />
              </button>
            </div>
            <div className="h-[360px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history}>
                  <defs>
                    <linearGradient id="gld" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#D4AF37" stopOpacity={0.4}/>
                      <stop offset="100%" stopColor="#D4AF37" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="price" stroke="#D4AF37" fill="url(#gld)" strokeWidth={5} />
                  <Tooltip contentStyle={{ background: '#050505', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '20px', color: '#fff' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white/[0.02] border border-white/5 p-12 rounded-[4rem] flex flex-col md:flex-row items-center gap-10">
            <div className="w-20 h-20 gold-gradient rounded-[2rem] flex items-center justify-center shrink-0 shadow-2xl">
              <ShieldCheck className="text-black" size={40} />
            </div>
            <div className="space-y-3">
               <p className="text-[10px] font-black uppercase text-yellow-500/40 tracking-[0.4em]">Respaldo Garantizado</p>
               <p className="text-xl font-medium text-white/80 leading-relaxed italic">"{analysis}"</p>
            </div>
          </div>
        </div>

        {/* Columna Derecha: Balance y Operaciones */}
        <div className="lg:col-span-4 space-y-10">
          <div className="gold-gradient p-12 rounded-[4rem] text-black shadow-gold-lg relative overflow-hidden group">
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-4">
                <p className="text-[11px] font-black uppercase opacity-60 tracking-[0.2em]">Reserva Personal</p>
                {wallet.isConnected && (
                  <button onClick={addTokenToMetaMask} className="p-2.5 bg-black/5 hover:bg-black/15 rounded-2xl transition-all" title="Ver en MetaMask">
                    <PlusCircle size={22} />
                  </button>
                )}
              </div>
              <h3 className="text-6xl font-black tracking-tighter mb-12 leading-none">
                {isLoadingBalance ? (
                  <Loader2 size={48} className="animate-spin opacity-40" />
                ) : (
                  wallet.isConnected ? `$${currentBalanceUSD.toLocaleString(undefined, {minimumFractionDigits: 2})}` : '$0.00'
                )}
              </h3>
              <div className="pt-10 border-t border-black/10 flex justify-between items-end">
                <div>
                  <p className="text-[9px] font-bold opacity-60 uppercase tracking-widest mb-1">Gramos Disponibles</p>
                  <div className="flex items-center gap-3">
                    <p className="text-4xl font-black">{wallet.isConnected ? wallet.balanceGLDC.toFixed(4) : '0.0000'} <span className="text-xl opacity-60">g</span></p>
                  </div>
                </div>
                <div className="bg-black/10 px-5 py-2.5 rounded-2xl text-[9px] font-black tracking-widest border border-black/5 uppercase">BSC Gold</div>
              </div>
            </div>
            <Coins size={280} className="absolute -bottom-16 -right-16 opacity-10 rotate-12 group-hover:rotate-[45deg] transition-transform duration-[2000ms]" />
          </div>

          <div className="glass p-12 rounded-[4rem] border-white/5">
            <div className="flex bg-black/40 p-2.5 rounded-[2rem] mb-12 border border-white/5">
              <button onClick={() => setOrderType('BUY')} className={`flex-1 py-6 rounded-[1.5rem] text-[10px] font-black uppercase transition-all tracking-widest ${orderType === 'BUY' ? 'bg-yellow-500 text-black shadow-gold-sm' : 'text-white/20'}`}>Adquirir</button>
              <button onClick={() => setOrderType('SELL')} className={`flex-1 py-6 rounded-[1.5rem] text-[10px] font-black uppercase transition-all tracking-widest ${orderType === 'SELL' ? 'bg-white text-black shadow-xl' : 'text-white/20'}`}>Liquidar</button>
            </div>
            
            <div className="space-y-12">
              <div className="space-y-5 text-center">
                <label className="text-[10px] font-black uppercase text-white/20 tracking-[0.5em]">Cantidad GLDC</label>
                <div className="relative">
                   <input 
                    type="number" value={orderAmount} onChange={(e) => setOrderAmount(e.target.value)} placeholder="0.00"
                    className="w-full bg-black/60 border border-white/5 rounded-[3rem] py-16 text-7xl font-black text-center outline-none focus:border-yellow-500/40 transition-all placeholder:text-white/5"
                  />
                  <span className="absolute bottom-6 right-1/2 translate-x-1/2 text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">Gramos de Oro Puro</span>
                </div>
              </div>

              <button 
                onClick={() => setShowConfirm(true)}
                disabled={!wallet.isConnected || parseFloat(orderAmount) <= 0 || wrongNetwork || isLoadingBalance}
                className={`w-full py-10 rounded-[3rem] font-black uppercase text-[12px] tracking-[0.3em] transition-all active:scale-[0.96] flex items-center justify-center gap-4 shadow-2xl ${wallet.isConnected && !wrongNetwork && parseFloat(orderAmount) > 0 ? (orderType === 'BUY' ? 'gold-gradient text-black hover:scale-[1.03]' : 'bg-white text-black hover:scale-[1.03]') : 'bg-white/5 text-white/10 cursor-not-allowed'}`}
              >
                {orderType === 'BUY' ? 'Generar Reserva' : 'Solicitar Canje'}
                <ChevronRight size={24} />
              </button>
              
              {!wallet.isConnected && (
                <p className="text-center text-[10px] font-black text-yellow-500/40 uppercase tracking-[0.3em] animate-pulse">Debes conectar tu wallet para operar</p>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Modal de Confirmación */}
      {showConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 backdrop-blur-3xl bg-black/80 animate-in fade-in duration-300">
          <div className="glass w-full max-w-2xl p-16 rounded-[5rem] border border-yellow-500/20 relative shadow-gold-lg">
            <button onClick={() => setShowConfirm(false)} className="absolute top-12 right-12 text-white/20 hover:text-white transition-all cursor-pointer"><X size={40}/></button>
            <h3 className="text-5xl font-black text-center mb-12 uppercase tracking-tighter">Procesar Orden</h3>
            <div className="space-y-10">
              <div className="bg-black/60 p-12 rounded-[3.5rem] border border-white/5 text-center">
                <p className="text-[11px] font-black text-yellow-500 uppercase mb-4 tracking-[0.4em]">Total estimado a liquidar</p>
                <h4 className="text-7xl font-black">${orderDetails.total.toLocaleString(undefined, {minimumFractionDigits: 2})} <span className="text-2xl opacity-30">USDT</span></h4>
              </div>
              
              <div className="p-10 bg-yellow-500/5 rounded-[3rem] border border-yellow-500/10 text-center">
                <p className="text-[10px] font-black uppercase text-white/40 mb-5 tracking-[0.3em]">Cuenta de Depósito (Red BSC)</p>
                <code className="text-xs break-all block font-mono text-yellow-500/80 bg-black/50 p-6 rounded-3xl border border-white/5 mb-10 select-all">{ADMIN_WALLET}</code>
                <button onClick={() => { navigator.clipboard.writeText(ADMIN_WALLET); alert("Dirección copiada a la papelera"); }} className="px-10 py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-[10px] font-black uppercase border border-white/5 transition-all tracking-widest">Copiar Dirección</button>
              </div>

              <button onClick={handleOrderSubmit} className="w-full py-10 gold-gradient text-black rounded-[3rem] font-black uppercase text-[12px] tracking-[0.3em] flex items-center justify-center gap-5 shadow-2xl hover:scale-[1.03] transition-transform">Confirmar Operación <Send size={24}/></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;

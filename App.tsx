
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { BrowserProvider, formatUnits } from 'ethers';
import { 
  TrendingUp, 
  Wallet, 
  Coins, 
  ArrowUpRight, 
  ShieldCheck, 
  RefreshCw, 
  Info,
  Key,
  ChevronRight,
  Send,
  X,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { GoldState, WalletState, PricePoint } from './types';
import { 
  TROY_OUNCE_TO_GRAMS, 
  GLDC_TOKEN_ADDRESS, 
  BSCSCAN_API_KEY, 
  FEE_RATE, 
  ADMIN_WALLET, 
  SUPPORT_EMAIL 
} from './constants';
import { getMarketAnalysis } from './services/aiService';

const App: React.FC = () => {
  // --- Estados Principales ---
  const [gold, setGold] = useState<GoldState>({ spotPrice: 2400, gramPrice: 77.16, change24h: 0.45, loading: true });
  const [wallet, setWallet] = useState<WalletState>({ address: null, balanceGLDC: 0, balanceUSD: 0, isConnected: false });
  const [history, setHistory] = useState<PricePoint[]>([]);
  const [analysis, setAnalysis] = useState<string>("Analizando mercados...");
  const [orderAmount, setOrderAmount] = useState<string>("");
  const [orderType, setOrderType] = useState<'BUY' | 'SELL'>('BUY');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSyncingBalance, setIsSyncingBalance] = useState(false);
  const [wrongNetwork, setWrongNetwork] = useState(false);

  // --- Cálculos Dinámicos ---
  const currentBalanceUSD = useMemo(() => {
    return wallet.balanceGLDC * gold.gramPrice;
  }, [wallet.balanceGLDC, gold.gramPrice]);

  const orderDetails = useMemo(() => {
    const qty = parseFloat(orderAmount) || 0;
    const subtotal = qty * gold.gramPrice;
    const fee = subtotal * FEE_RATE;
    const total = orderType === 'BUY' ? subtotal + fee : subtotal - fee;
    return { qty, subtotal, fee, total };
  }, [orderAmount, gold.gramPrice, orderType]);

  // --- Verificación de Red ---
  const checkNetwork = async () => {
    const eth = (window as any).ethereum;
    if (!eth) return;
    try {
      const chainId = await eth.request({ method: 'eth_chainId' });
      setWrongNetwork(chainId !== '0x38'); // BSC Mainnet
    } catch (e) {
      console.error("Network check error", e);
    }
  };

  const switchNetwork = async () => {
    const eth = (window as any).ethereum;
    try {
      await eth.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x38' }],
      });
      setWrongNetwork(false);
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        try {
          await eth.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x38',
              chainName: 'Binance Smart Chain',
              nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
              rpcUrls: ['https://bsc-dataseed.binance.org/'],
              blockExplorerUrls: ['https://bscscan.com/'],
            }],
          });
        } catch (addError) {
          console.error(addError);
        }
      }
    }
  };

  // --- Lógica de Cartera ---
  const fetchWalletBalance = useCallback(async (address: string) => {
    if (!address) return;
    setIsSyncingBalance(true);
    try {
      const url = `https://api.bscscan.com/api?module=account&action=tokenbalance&contractaddress=${GLDC_TOKEN_ADDRESS}&address=${address}&tag=latest&apikey=${BSCSCAN_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === '1' && data.result) {
        const bal = parseFloat(formatUnits(data.result, 18));
        setWallet(prev => ({ 
          ...prev, 
          address, 
          isConnected: true, 
          balanceGLDC: bal 
        }));
      }
    } catch (e) {
      console.error("Balance error:", e);
    } finally {
      setIsSyncingBalance(false);
    }
  }, []);

  const fetchMarketData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=PAXGUSDT');
      const data = await res.json();
      if (data?.price) {
        const spot = parseFloat(data.price);
        const gram = spot / TROY_OUNCE_TO_GRAMS;
        setGold(prev => ({ ...prev, spotPrice: spot, gramPrice: gram, loading: false }));
        
        // AI Insight
        getMarketAnalysis(gram).then(setAnalysis);

        if (wallet.address) {
          fetchWalletBalance(wallet.address);
        }
      }
    } catch (e) {
      console.error("Market error:", e);
    } finally {
      setIsRefreshing(false);
    }
  }, [wallet.address, fetchWalletBalance]);

  const connectWallet = async () => {
    const eth = (window as any).ethereum;
    if (!eth) return alert("Instala MetaMask");
    try {
      const provider = new BrowserProvider(eth);
      const accounts = await provider.send("eth_requestAccounts", []);
      if (accounts[0]) {
        await checkNetwork();
        fetchWalletBalance(accounts[0]);
      }
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchMarketData();
    setHistory(Array.from({ length: 20 }, (_, i) => ({
      time: `${i}:00`,
      price: gold.gramPrice + (Math.random() - 0.5) * 2
    })));
    
    const eth = (window as any).ethereum;
    if (eth) {
      eth.on('accountsChanged', (accounts: string[]) => {
        if (accounts.length > 0) fetchWalletBalance(accounts[0]);
        else setWallet({ address: null, balanceGLDC: 0, balanceUSD: 0, isConnected: false });
      });
      eth.on('chainChanged', () => window.location.reload());
    }

    const interval = setInterval(fetchMarketData, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleOrderSubmit = () => {
    const orderId = Math.random().toString(36).substring(7).toUpperCase();
    const subject = `ORDEN GLDC - ${orderType} - ${orderId}`;
    const body = `Nueva solicitud GLDC:\nID: ${orderId}\nTipo: ${orderType}\nCantidad: ${orderAmount}g\nTotal: $${orderDetails.total.toFixed(2)} USD\nWallet: ${wallet.address}`;
    window.open(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
    setShowConfirm(false);
  };

  return (
    <div className="min-h-screen pb-12 selection:bg-yellow-500/30">
      {/* Network Alert */}
      {wrongNetwork && wallet.isConnected && (
        <div className="bg-red-500 text-white px-6 py-2 flex items-center justify-center gap-3 text-[10px] font-bold uppercase tracking-widest animate-pulse sticky top-0 z-[60]">
          <AlertCircle size={14} /> Red Incorrecta
          <button onClick={switchNetwork} className="underline decoration-white underline-offset-4">Cambiar a BSC</button>
        </div>
      )}

      {/* Header */}
      <nav className={`sticky ${wrongNetwork ? 'top-8' : 'top-0'} z-50 glass border-b border-white/5 px-6 py-4 flex justify-between items-center transition-all`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 gold-gradient rounded-xl flex items-center justify-center shadow-lg">
            <Coins className="text-black" size={24} strokeWidth={2.5} />
          </div>
          <div className="hidden sm:block">
            <h1 className="font-serif text-xl font-black tracking-tight leading-none">CRYPTOCAGUA</h1>
            <span className="text-[10px] font-bold text-yellow-500 uppercase tracking-[0.4em]">Gold Reserve</span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button 
            onClick={async () => { 
              if (window.aistudio) {
                await window.aistudio.openSelectKey(); 
                fetchMarketData();
              }
            }}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-white/5 hover:bg-white/10 rounded-full border border-white/10 text-[10px] font-bold uppercase transition-all"
          >
            <Key size={14} className="text-yellow-500" /> <span className="hidden xs:inline">IA Key</span>
          </button>
          
          <button 
            onClick={connectWallet}
            className={`px-4 sm:px-5 py-2.5 rounded-full text-[10px] sm:text-[11px] font-black uppercase flex items-center gap-2 transition-all ${wallet.isConnected ? 'bg-white/5 border border-white/10' : 'gold-gradient text-black shadow-xl shadow-yellow-500/10'}`}
          >
            {wallet.isConnected ? (
              <><div className={`w-2 h-2 rounded-full ${wrongNetwork ? 'bg-red-500' : 'bg-green-500'}`} /> {wallet.address?.slice(0,4)}...{wallet.address?.slice(-4)}</>
            ) : (
              <><Wallet size={14} /> <span className="hidden xs:inline">Conectar</span></>
            )}
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 mt-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass p-8 rounded-[2rem] relative overflow-hidden group transition-all hover:bg-white/[0.05]">
              <p className="text-[10px] font-black uppercase text-white/30 tracking-widest mb-1">Precio Onza (Spot)</p>
              <div className="flex items-end gap-3">
                <h2 className="text-4xl xs:text-5xl font-black tracking-tighter">${gold.spotPrice.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
                <span className="mb-2 text-green-500 font-bold text-sm flex items-center gap-1"><ArrowUpRight size={14}/> {gold.change24h}%</span>
              </div>
            </div>

            <div className="glass p-8 rounded-[2rem] border-2 border-yellow-500/20 shadow-2xl relative overflow-hidden">
              <p className="text-[10px] font-black uppercase text-yellow-500 tracking-widest mb-1">Valor GLDC / 1 Gramo</p>
              <h2 className="text-4xl xs:text-5xl font-black tracking-tighter gold-text">${gold.gramPrice.toFixed(2)}</h2>
              <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-white/20 uppercase">
                <ShieldCheck size={14} className="text-yellow-500"/> Respaldo 100% Físico
              </div>
            </div>
          </div>

          <div className="glass p-8 rounded-[2.5rem] relative">
            <div className="flex justify-between items-center mb-10">
              <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-white/20 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" /> Monitor de Mercado
              </h3>
              <button onClick={fetchMarketData} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                <RefreshCw size={16} className={`${isRefreshing ? 'animate-spin' : ''} text-white/20`} />
              </button>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history}>
                  <defs>
                    <linearGradient id="goldFlow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#D4AF37" stopOpacity={0.4}/>
                      <stop offset="100%" stopColor="#D4AF37" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Tooltip contentStyle={{ background: '#111', border: '1px solid #333', borderRadius: '12px' }} />
                  <Area type="monotone" dataKey="price" stroke="#D4AF37" strokeWidth={3} fill="url(#goldFlow)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-yellow-500/5 border border-yellow-500/10 p-8 sm:p-10 rounded-[2.5rem] flex flex-col sm:flex-row items-start gap-6 sm:gap-8">
            <div className="w-14 h-14 gold-gradient rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-yellow-500/10">
              <Info className="text-black" size={28} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-yellow-500/50 mb-1 tracking-widest">Análisis de Reserva (IA)</p>
              <p className="text-lg sm:text-xl font-medium italic text-white/90 leading-tight">"{analysis}"</p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-8">
          <div className="gold-gradient p-8 sm:p-10 rounded-[3rem] text-black shadow-2xl relative overflow-hidden transition-transform hover:scale-[1.01]">
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-2">
                <p className="text-[11px] font-black uppercase opacity-40 tracking-widest">Patrimonio Oro</p>
                {isSyncingBalance && <Loader2 size={16} className="animate-spin opacity-40" />}
              </div>
              <h3 className="text-5xl sm:text-6xl font-black tracking-tighter mb-8 leading-none">
                {wallet.isConnected ? `$${currentBalanceUSD.toLocaleString(undefined, {minimumFractionDigits: 2})}` : '$---'}
              </h3>
              
              <div className="pt-8 border-t border-black/10 flex justify-between items-end">
                <div>
                  <p className="text-[10px] font-bold uppercase opacity-40">Balance GLDC</p>
                  <p className="text-3xl font-black">{wallet.isConnected ? wallet.balanceGLDC.toFixed(4) : '0.0000'}g</p>
                </div>
                <div className="bg-black/10 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase border border-black/5">Red BSC</div>
              </div>
            </div>
            <Coins size={200} className="absolute -bottom-10 -right-10 opacity-10 rotate-12" />
          </div>

          <div className="glass p-8 sm:p-10 rounded-[3rem] border border-white/5">
            <div className="flex bg-black p-2 rounded-[2rem] mb-10 border border-white/5">
              <button onClick={() => setOrderType('BUY')} className={`flex-1 py-4 rounded-3xl text-[10px] font-black uppercase transition-all ${orderType === 'BUY' ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' : 'text-white/30 hover:text-white'}`}>Comprar</button>
              <button onClick={() => setOrderType('SELL')} className={`flex-1 py-4 rounded-3xl text-[10px] font-black uppercase transition-all ${orderType === 'SELL' ? 'bg-white text-black shadow-lg shadow-white/20' : 'text-white/30 hover:text-white'}`}>Vender</button>
            </div>

            <div className="space-y-8 text-center">
              <div>
                <label className="text-[10px] font-black uppercase text-white/20 mb-4 block tracking-widest">Gramos GLDC</label>
                <div className="relative">
                  <input 
                    type="number"
                    value={orderAmount}
                    onChange={(e) => setOrderAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-black/50 border border-white/5 rounded-3xl py-10 text-5xl sm:text-6xl font-black text-center outline-none focus:border-yellow-500/50 transition-all placeholder:text-white/5"
                  />
                  <span className="absolute bottom-4 right-8 text-[10px] font-black text-white/20 uppercase">Gramas</span>
                </div>
              </div>

              {orderDetails.qty > 0 && (
                <div className="bg-white/5 p-6 rounded-3xl border border-white/5 space-y-3 text-left animate-fade-in">
                  <div className="flex justify-between text-[10px] font-bold uppercase text-white/40"><span>Subtotal</span><span>${orderDetails.subtotal.toFixed(2)}</span></div>
                  <div className="flex justify-between text-[10px] font-bold uppercase text-white/40"><span>Gestión (0.75%)</span><span className="text-red-400">-${orderDetails.fee.toFixed(2)}</span></div>
                  <div className="pt-4 border-t border-white/5 flex justify-between items-center"><span className="text-yellow-500 text-[10px] font-black uppercase tracking-widest">Total</span><span className="text-3xl font-black">${orderDetails.total.toFixed(2)}</span></div>
                </div>
              )}

              <button 
                onClick={() => setShowConfirm(true)}
                disabled={!wallet.isConnected || orderDetails.qty <= 0 || wrongNetwork}
                className={`w-full py-7 rounded-[2rem] font-black uppercase text-[11px] tracking-widest flex items-center justify-center gap-3 transition-all active:scale-[0.98] ${wallet.isConnected && orderDetails.qty > 0 && !wrongNetwork ? (orderType === 'BUY' ? 'gold-gradient text-black shadow-xl shadow-yellow-500/10' : 'bg-white text-black shadow-xl shadow-white/10') : 'bg-white/5 text-white/10 cursor-not-allowed'}`}
              >
                {orderType === 'BUY' ? 'Solicitar Compra' : 'Solicitar Venta'}
                <ChevronRight size={18} />
              </button>
              
              {!wallet.isConnected && (
                <p className="text-[9px] font-bold uppercase text-white/20 tracking-wider">Conecta tu wallet para operar</p>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-3xl bg-black/80 animate-fade-in">
          <div className="glass w-full max-w-lg p-10 sm:p-12 rounded-[3.5rem] border border-yellow-500/30 relative shadow-2xl">
            <button onClick={() => setShowConfirm(false)} className="absolute top-10 right-10 text-white/20 hover:text-white transition-colors"><X size={32}/></button>
            <h3 className="text-3xl font-black text-center mb-10 uppercase tracking-tighter">Confirmar Orden</h3>
            <div className="space-y-8">
              <div className="bg-black p-8 rounded-[2.5rem] border border-white/5 text-center">
                <p className="text-[10px] font-black text-yellow-500 uppercase mb-2 tracking-widest">Total Operación</p>
                <h4 className="text-5xl font-black">${orderDetails.total.toFixed(2)}</h4>
              </div>
              <div className="p-8 bg-yellow-500/5 rounded-[2.5rem] border border-yellow-500/10">
                <p className="text-[10px] font-black uppercase text-white/40 mb-2 tracking-widest">Wallet de Recaudación (USDT BEP20)</p>
                <code className="text-[11px] break-all block font-mono text-white/60 bg-black/40 p-4 rounded-xl mb-6 border border-white/5">{ADMIN_WALLET}</code>
                <button onClick={() => { navigator.clipboard.writeText(ADMIN_WALLET); alert("Dirección Copiada"); }} className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl text-[10px] font-bold uppercase transition-all">Copiar Dirección</button>
              </div>
              <button onClick={handleOrderSubmit} className="w-full py-7 gold-gradient text-black rounded-[2rem] font-black uppercase text-[11px] tracking-widest flex items-center justify-center gap-3 shadow-xl">Notificar al Soporte <Send size={18}/></button>
              <p className="text-center text-[9px] font-bold uppercase text-white/20">La operación se procesará tras confirmar el pago</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;

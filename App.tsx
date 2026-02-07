
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
  const [gold, setGold] = useState<GoldState>({ spotPrice: 2400, gramPrice: 77.16, change24h: 0.45, loading: true });
  const [wallet, setWallet] = useState<WalletState>({ address: null, balanceGLDC: 0, balanceUSD: 0, isConnected: false });
  const [history, setHistory] = useState<PricePoint[]>([]);
  const [analysis, setAnalysis] = useState<string>("Sincronizando con mercados...");
  const [orderAmount, setOrderAmount] = useState<string>("");
  const [orderType, setOrderType] = useState<'BUY' | 'SELL'>('BUY');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSyncingBalance, setIsSyncingBalance] = useState(false);
  const [wrongNetwork, setWrongNetwork] = useState(false);

  const currentBalanceUSD = useMemo(() => wallet.balanceGLDC * gold.gramPrice, [wallet.balanceGLDC, gold.gramPrice]);

  const orderDetails = useMemo(() => {
    const qty = parseFloat(orderAmount) || 0;
    const subtotal = qty * gold.gramPrice;
    const fee = subtotal * FEE_RATE;
    const total = orderType === 'BUY' ? subtotal + fee : subtotal - fee;
    return { qty, subtotal, fee, total };
  }, [orderAmount, gold.gramPrice, orderType]);

  const checkNetwork = async () => {
    const eth = (window as any).ethereum;
    if (!eth) return;
    try {
      const chainId = await eth.request({ method: 'eth_chainId' });
      setWrongNetwork(chainId !== '0x38');
    } catch (e) {
      console.error("Network error", e);
    }
  };

  const switchNetwork = async () => {
    const eth = (window as any).ethereum;
    try {
      await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x38' }] });
      setWrongNetwork(false);
    } catch (e: any) {
      if (e.code === 4902) {
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
      }
    }
  };

  const fetchWalletBalance = useCallback(async (address: string) => {
    if (!address) return;
    setIsSyncingBalance(true);
    try {
      const url = `https://api.bscscan.com/api?module=account&action=tokenbalance&contractaddress=${GLDC_TOKEN_ADDRESS}&address=${address}&tag=latest&apikey=${BSCSCAN_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.status === '1' && data.result) {
        const bal = parseFloat(formatUnits(data.result, 18));
        setWallet(prev => ({ ...prev, address, isConnected: true, balanceGLDC: bal }));
      }
    } catch (e) {
      console.error("Balance fetch error", e);
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
        getMarketAnalysis(gram).then(setAnalysis);
        if (wallet.address) fetchWalletBalance(wallet.address);
      }
    } catch (e) { console.error(e); } finally { setIsRefreshing(false); }
  }, [wallet.address, fetchWalletBalance]);

  const connectWallet = async () => {
    const eth = (window as any).ethereum;
    if (!eth) return alert("Por favor, usa MetaMask.");
    try {
      const accounts = await eth.request({ method: "eth_requestAccounts" });
      if (accounts[0]) {
        await checkNetwork();
        fetchWalletBalance(accounts[0]);
      }
    } catch (e) { console.error(e); }
  };

  const handleOrderSubmit = () => {
    if (!wallet.address) return;
    const orderId = Math.random().toString(36).substring(7).toUpperCase();
    const subject = `ORDEN GLDC - ${orderType} - ${orderId}`;
    const body = `Nueva solicitud GLDC:\nID: ${orderId}\nTipo: ${orderType}\nCantidad: ${orderAmount}g\nTotal: $${orderDetails.total.toFixed(2)} USD\nWallet: ${wallet.address}`;
    window.open(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
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
      eth.on('accountsChanged', (accs: string[]) => {
        if (accs[0]) fetchWalletBalance(accs[0]);
        else setWallet({ address: null, balanceGLDC: 0, balanceUSD: 0, isConnected: false });
      });
      eth.on('chainChanged', () => window.location.reload());
    }
    const interval = setInterval(fetchMarketData, 60000);
    return () => clearInterval(interval);
  }, [fetchMarketData, fetchWalletBalance]);

  return (
    <div className="min-h-screen pb-12">
      {/* Alerta de Red */}
      {wrongNetwork && wallet.isConnected && (
        <div className="bg-red-600 text-white px-6 py-3 flex items-center justify-center gap-3 text-xs font-bold uppercase tracking-widest sticky top-0 z-[100] animate-pulse">
          <AlertCircle size={16} /> Estás en la red equivocada
          <button onClick={switchNetwork} className="bg-white text-red-600 px-4 py-1.5 rounded-full text-[10px] font-black shadow-lg">CAMBIAR A BSC</button>
        </div>
      )}

      {/* Navegación */}
      <nav className="glass border-b border-white/5 px-4 sm:px-6 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 gold-gradient rounded-xl flex items-center justify-center shadow-lg">
            <Coins className="text-black" size={24} />
          </div>
          <div className="hidden xs:block">
            <h1 className="font-serif text-xl font-black leading-none">CRYPTOCAGUA</h1>
            <span className="text-[9px] font-bold text-yellow-500 uppercase tracking-[0.3em]">Gold Reserve</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* BOTÓN IA KEY - Resaltado para que sea fácil de encontrar */}
          <button 
            onClick={async () => { 
              if (window.aistudio) {
                await window.aistudio.openSelectKey(); 
                fetchMarketData();
              } else {
                alert("La configuración de IA no está disponible en este entorno.");
              }
            }}
            className="ia-button-glow flex items-center gap-2 px-4 py-2.5 bg-yellow-500/10 hover:bg-yellow-500/20 rounded-full text-[10px] font-black uppercase transition-all border border-yellow-500/40"
          >
            <Key size={14} className="text-yellow-500" /> IA KEY
          </button>

          <button 
            onClick={connectWallet}
            className={`px-5 py-2.5 rounded-full text-[10px] sm:text-[11px] font-black uppercase flex items-center gap-2 transition-all ${wallet.isConnected ? 'bg-white/5 border border-white/10' : 'gold-gradient text-black shadow-xl'}`}
          >
            <Wallet size={14} /> {wallet.isConnected ? `${wallet.address?.slice(0,4)}...${wallet.address?.slice(-4)}` : 'CONECTAR'}
          </button>
        </div>
      </nav>

      {/* Contenido Principal */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 mt-8 sm:mt-12 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass p-8 rounded-[2.5rem] border border-white/5 shadow-inner">
              <p className="text-[10px] font-black uppercase text-white/30 tracking-widest mb-1">Mercado (Spot)</p>
              <div className="flex items-end gap-3">
                <h2 className="text-4xl sm:text-5xl font-black tracking-tighter">${gold.spotPrice.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
                <span className="mb-2 text-green-500 font-bold text-xs">+{gold.change24h}%</span>
              </div>
            </div>
            <div className="glass p-8 rounded-[2.5rem] border-2 border-yellow-500/20 shadow-2xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-yellow-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <p className="text-[10px] font-black uppercase text-yellow-500 tracking-widest mb-1">Precio GLDC (1 Gramo)</p>
              <h2 className="text-4xl sm:text-5xl font-black tracking-tighter gold-text">${gold.gramPrice.toFixed(2)}</h2>
            </div>
          </div>

          <div className="glass p-8 rounded-[2.5rem]">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Gráfico de Valor</h3>
              <button onClick={fetchMarketData} className="hover:rotate-180 transition-transform duration-500">
                <RefreshCw size={16} className={`${isRefreshing ? 'animate-spin' : ''} text-white/20`} />
              </button>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history}>
                  <defs>
                    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#D4AF37" stopOpacity={0.4}/>
                      <stop offset="100%" stopColor="#D4AF37" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="price" stroke="#D4AF37" fill="url(#g)" strokeWidth={3} />
                  <Tooltip contentStyle={{ background: '#000', border: 'none', borderRadius: '12px' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-yellow-500/5 border border-yellow-500/10 p-8 rounded-[2.5rem] flex items-start gap-6">
            <div className="p-3 bg-yellow-500/20 rounded-2xl"><Info className="text-yellow-500" size={24} /></div>
            <p className="text-base sm:text-lg font-medium italic text-white/80 leading-relaxed">"{analysis}"</p>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-8">
          <div className="gold-gradient p-10 rounded-[3rem] text-black shadow-2xl relative overflow-hidden group">
            <div className="relative z-10">
              <p className="text-[10px] font-black uppercase opacity-50 mb-2">Mi Patrimonio Oro</p>
              <h3 className="text-5xl font-black tracking-tighter mb-10 leading-none">
                {wallet.isConnected ? `$${currentBalanceUSD.toLocaleString(undefined, {minimumFractionDigits: 2})}` : '$---'}
              </h3>
              <div className="pt-8 border-t border-black/10 flex justify-between items-end">
                <div>
                  <p className="text-[9px] font-bold opacity-40 uppercase">Gramos GLDC</p>
                  <p className="text-3xl font-black">{wallet.isConnected ? wallet.balanceGLDC.toFixed(4) : '0.0000'}g</p>
                </div>
                <div className="bg-black/10 px-3 py-1 rounded text-[8px] font-black tracking-widest">BEP20</div>
              </div>
            </div>
            <Coins size={180} className="absolute -bottom-10 -right-10 opacity-10 rotate-12 group-hover:scale-110 transition-transform duration-700" />
          </div>

          <div className="glass p-10 rounded-[3rem] border border-white/5">
            <div className="flex bg-black p-1.5 rounded-full mb-10 border border-white/10">
              <button onClick={() => setOrderType('BUY')} className={`flex-1 py-4 rounded-full text-[10px] font-black uppercase transition-all ${orderType === 'BUY' ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' : 'text-white/30'}`}>Comprar</button>
              <button onClick={() => setOrderType('SELL')} className={`flex-1 py-4 rounded-full text-[10px] font-black uppercase transition-all ${orderType === 'SELL' ? 'bg-white text-black' : 'text-white/30'}`}>Vender</button>
            </div>
            <div className="space-y-8">
              <div className="space-y-4">
                <label className="text-[9px] font-black uppercase text-white/20 tracking-widest text-center block">Cantidad de Gramos</label>
                <input 
                  type="number" 
                  value={orderAmount} 
                  onChange={(e) => setOrderAmount(e.target.value)} 
                  placeholder="0.00"
                  className="w-full bg-black/50 border border-white/5 rounded-[2rem] py-10 text-5xl font-black text-center outline-none focus:border-yellow-500/50 transition-all"
                />
              </div>
              <button 
                onClick={() => setShowConfirm(true)}
                disabled={!wallet.isConnected || parseFloat(orderAmount) <= 0 || wrongNetwork}
                className={`w-full py-6 rounded-[2rem] font-black uppercase text-[11px] tracking-widest transition-all active:scale-[0.98] ${wallet.isConnected && !wrongNetwork && parseFloat(orderAmount) > 0 ? (orderType === 'BUY' ? 'gold-gradient text-black shadow-xl shadow-yellow-500/10' : 'bg-white text-black') : 'bg-white/5 text-white/10'}`}
              >
                {orderType === 'BUY' ? 'SOLICITAR COMPRA' : 'SOLICITAR VENTA'}
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Modal de Confirmación */}
      {showConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-3xl bg-black/80 animate-fade-in">
          <div className="glass w-full max-w-lg p-10 rounded-[3.5rem] border border-yellow-500/30 relative shadow-2xl">
            <button onClick={() => setShowConfirm(false)} className="absolute top-10 right-10 text-white/20 hover:text-white transition-colors"><X size={28}/></button>
            <h3 className="text-3xl font-black text-center mb-10 uppercase tracking-tighter">Confirmar Operación</h3>
            <div className="space-y-8">
              <div className="bg-black p-8 rounded-[2.5rem] border border-white/5 text-center">
                <p className="text-[10px] font-black text-yellow-500 uppercase mb-2">Total Estimado</p>
                <h4 className="text-5xl font-black">${orderDetails.total.toFixed(2)}</h4>
              </div>
              <div className="p-8 bg-yellow-500/5 rounded-[2.5rem] border border-yellow-500/10 text-center">
                <p className="text-[10px] font-black uppercase text-white/40 mb-3 tracking-widest">Cuenta de Depósito (USDT BEP20)</p>
                <code className="text-[10px] break-all block font-mono text-white/60 bg-black/40 p-4 rounded-xl border border-white/5 mb-6">{ADMIN_WALLET}</code>
                <button onClick={() => { navigator.clipboard.writeText(ADMIN_WALLET); alert("Copiado al portapapeles"); }} className="px-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-bold uppercase border border-white/5">Copiar Dirección</button>
              </div>
              <button onClick={handleOrderSubmit} className="w-full py-7 gold-gradient text-black rounded-[2rem] font-black uppercase text-[11px] tracking-widest flex items-center justify-center gap-3 shadow-xl">NOTIFICAR PAGO <Send size={18}/></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;


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
  History as HistoryIcon,
  Copy,
  CheckCircle2,
  ArrowRightLeft,
  Info
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
  const [copied, setCopied] = useState(false);

  const currentBalanceUSD = useMemo(() => {
    return (wallet.balanceGLDC || 0) * (gold.gramPrice || 77.16);
  }, [wallet.balanceGLDC, gold.gramPrice]);

  const orderDetails = useMemo(() => {
    const amount = parseFloat(orderAmount) || 0;
    const feeInTokens = amount * FEE_RATE;
    const netTokens = amount - feeInTokens;
    const baseValueUSD = amount * gold.gramPrice;
    
    let finalUSDT = 0;
    if (orderType === 'BUY') {
      finalUSDT = baseValueUSD;
    } else {
      finalUSDT = netTokens * gold.gramPrice;
    }
    
    return { 
      amount, 
      feeInTokens, 
      netTokens,
      finalUSDT, 
      gramPrice: gold.gramPrice 
    };
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
          console.warn("MetaMask fallback...");
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
          setWallet(prev => ({ ...prev, address, isConnected: true, balanceGLDC: balFormatted, balanceUSD: balFormatted * gold.gramPrice }));
          if (!isSilent) setIsLoadingBalance(false);
          return;
        } catch (e) { console.warn(e); }
      }
    } catch (e) { console.error(e); } finally { setIsLoadingBalance(false); }
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
        if (wallet.address) fetchWalletBalance(wallet.address, true);
      }
    } catch (e) { console.error(e); } finally { setIsRefreshing(false); }
  }, [fetchWalletBalance, wallet.address]);

  const connectWallet = async () => {
    const eth = (window as any).ethereum;
    if (!eth) return;
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNotify = () => {
    const subject = `ORDEN GLDC: ${orderType} ${orderDetails.amount}g`;
    const body = `DETALLE DE SOLICITUD - CRYPTOCAGUA GOLD
------------------------------------------------
Operación: ${orderType === 'BUY' ? 'ADQUISICIÓN (Compra)' : 'LIQUIDACIÓN (Venta)'}
------------------------------------------------
Monto Solicitado: ${orderDetails.amount} g
Comisión de Red (0.75%): -${orderDetails.feeInTokens.toFixed(6)} g
Monto Neto en Oro: ${orderDetails.netTokens.toFixed(6)} g
------------------------------------------------
Precio de Referencia: $${orderDetails.gramPrice.toFixed(4)} USDT/g
TOTAL EN USDT: $${orderDetails.finalUSDT.toFixed(2)} USDT
------------------------------------------------
Billetera Usuario: ${wallet.address}
Billetera Tesorería: ${TREASURY_WALLET}
------------------------------------------------
${orderType === 'BUY' 
  ? 'Nota: He enviado el pago en USDT por el total. Espero recibir el monto neto en GLDC.' 
  : 'Nota: Deseo liquidar mis tokens GLDC por su valor neto en USDT.'}`;
    
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setShowConfirm(false);
  };

  useEffect(() => {
    fetchMarketData();
    setHistory(Array.from({ length: 24 }, (_, i) => ({
      time: `${i}:00`,
      price: 77.16 + (Math.random() - 0.5) * 2
    })));
  }, [fetchMarketData]);

  return (
    <div className="min-h-screen pb-10 sm:pb-20">
      {wrongNetwork && wallet.isConnected && (
        <div className="bg-red-600 text-white px-4 py-3 flex flex-wrap items-center justify-center gap-2 text-[9px] font-black sticky top-0 z-[100] shadow-2xl">
          <AlertCircle size={14} className="animate-pulse" />
          <span className="tracking-widest uppercase">Red Incorrecta. Cambia a BSC.</span>
          <button 
            onClick={() => (window as any).ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x38' }] })}
            className="bg-white text-red-600 px-3 py-1 rounded-full hover:scale-105 text-[8px]"
          >
            Sincronizar BSC
          </button>
        </div>
      )}

      <nav className="glass border-b border-white/5 px-4 sm:px-12 py-4 sm:py-6 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-3 sm:gap-4 cursor-pointer" onClick={() => window.location.reload()}>
          <div className="w-10 h-10 sm:w-12 sm:h-12 gold-gradient rounded-xl sm:rounded-2xl flex items-center justify-center shadow-gold transition-transform hover:scale-110">
            <Coins className="text-black" size={24} />
          </div>
          <div>
            <h1 className="font-serif text-xl sm:text-3xl font-black tracking-tighter leading-none uppercase">Cryptocagua</h1>
            <p className="text-[7px] sm:text-[9px] font-black text-yellow-500/70 uppercase tracking-[0.3em] sm:tracking-[0.5em] mt-0.5 sm:mt-1">Token de Oro Físico</p>
          </div>
        </div>

        <button 
          onClick={connectWallet}
          className={`px-4 sm:px-8 py-2 sm:py-3 rounded-xl sm:rounded-2xl text-[8px] sm:text-[10px] font-black uppercase flex items-center gap-2 transition-all active:scale-95 ${wallet.isConnected && wallet.address ? 'bg-white/5 border border-white/10 text-white/60' : 'gold-gradient text-black shadow-lg hover:shadow-yellow-500/20'}`}
        >
          <Wallet size={16} /> 
          <span className="hidden xs:inline">
            {wallet.isConnected && wallet.address ? `${wallet.address.slice(0,6)}...${wallet.address.slice(-4)}` : 'Wallet'}
          </span>
          {!wallet.isConnected && <span className="xs:hidden">Conectar</span>}
          {wallet.isConnected && wallet.address && <span className="xs:hidden">{wallet.address.slice(-4)}</span>}
        </button>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-12 mt-8 sm:mt-12 grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-10">
        <div className="lg:col-span-8 space-y-6 sm:space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8">
            <div className="glass p-6 sm:p-10 rounded-[2rem] sm:rounded-[3rem] border-white/5 relative group overflow-hidden">
              <p className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest opacity-30 mb-2 sm:mb-4 text-white">Referencia Oro Global (OZ)</p>
              <div className="flex items-baseline gap-3">
                <h2 className="text-3xl sm:text-5xl font-black tracking-tighter truncate">${gold.spotPrice.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
                <span className="text-green-500 font-black text-[10px] sm:text-sm">+{gold.change24h}%</span>
              </div>
            </div>
            <div className="glass p-6 sm:p-10 rounded-[2rem] sm:rounded-[3rem] border-2 border-yellow-500/20 shadow-gold-sm relative overflow-hidden">
              <div className="absolute -right-4 -top-4 sm:-right-6 sm:-top-6 opacity-[0.03] rotate-12"><ShieldCheck size={120} className="sm:size-[180px]" /></div>
              <p className="text-[8px] sm:text-[10px] font-black uppercase text-yellow-500 tracking-[0.2em] sm:tracking-[0.4em] mb-2 sm:mb-4">Gramo GLDC</p>
              <h2 className="text-3xl sm:text-5xl font-black tracking-tighter gold-text">${gold.gramPrice.toFixed(2)}</h2>
            </div>
          </div>

          <div className="glass p-6 sm:p-10 rounded-[2.5rem] sm:rounded-[4rem]">
            <div className="flex justify-between items-center mb-6 sm:mb-12 text-[8px] sm:text-[10px] font-black uppercase tracking-[0.2em] sm:tracking-[0.4em] text-white/30">
              <span className="flex items-center gap-2 sm:gap-3"><div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-yellow-500 rounded-full animate-pulse"></div> Mercado en Vivo</span>
              <button onClick={fetchMarketData} className="p-1.5 sm:p-2 hover:bg-white/5 rounded-lg sm:rounded-xl transition-all"><RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''}/></button>
            </div>
            <div className="h-[250px] sm:h-[380px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history}>
                  <defs><linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#D4AF37" stopOpacity={0.4}/><stop offset="100%" stopColor="#D4AF37" stopOpacity={0}/></linearGradient></defs>
                  <Area type="monotone" dataKey="price" stroke="#D4AF37" fill="url(#gold)" strokeWidth={3} />
                  <Tooltip contentStyle={{ background: '#0a0a0a', border: '1px solid #333', borderRadius: '15px', fontSize: '10px' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-yellow-500/[0.03] border border-yellow-500/10 p-6 sm:p-10 rounded-[2.5rem] sm:rounded-[4rem] flex flex-col md:flex-row items-center gap-4 sm:gap-8">
            <HistoryIcon className="text-yellow-500 shrink-0 hidden md:block" size={40} />
            <p className="text-sm sm:text-lg font-medium text-white/60 italic leading-relaxed text-center md:text-left">"{analysis}"</p>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6 sm:space-y-10">
          <div className="gold-gradient p-8 sm:p-12 rounded-[3rem] sm:rounded-[4.5rem] text-black shadow-gold-lg relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-4">
                <p className="text-[9px] sm:text-[11px] font-black uppercase opacity-60 tracking-widest">Reserva GLDC</p>
                {wallet.isConnected && <button className="p-1.5 bg-black/5 hover:bg-black/15 rounded-xl transition-all"><PlusCircle size={18} /></button>}
              </div>
              <h3 className="text-4xl sm:text-6xl font-black tracking-tighter mb-8 sm:mb-12 truncate">
                {isLoadingBalance ? <Loader2 size={30} className="animate-spin opacity-40" /> : (wallet.isConnected ? `$${currentBalanceUSD.toLocaleString(undefined, {minimumFractionDigits: 2})}` : '$0.00')}
              </h3>
              <div className="pt-6 sm:pt-10 border-t border-black/10">
                <p className="text-[8px] font-bold opacity-60 uppercase mb-1 sm:mb-2">Balance en Gramos</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl sm:text-4xl font-black truncate">{wallet.isConnected ? wallet.balanceGLDC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : '0.00'}</p>
                  <span className="text-sm sm:text-xl font-bold opacity-40 uppercase">g</span>
                </div>
              </div>
            </div>
          </div>

          <div className="glass p-8 sm:p-12 rounded-[3rem] sm:rounded-[4.5rem] border-white/5 space-y-8 sm:space-y-12">
            <div className="flex bg-black/40 p-1.5 rounded-2xl sm:rounded-3xl border border-white/5">
              <button onClick={() => setOrderType('BUY')} className={`flex-1 py-3 sm:py-6 rounded-xl sm:rounded-2xl text-[8px] sm:text-[10px] font-black uppercase tracking-widest transition-all ${orderType === 'BUY' ? 'bg-yellow-500 text-black shadow-gold-sm' : 'text-white/20'}`}>Adquirir</button>
              <button onClick={() => setOrderType('SELL')} className={`flex-1 py-3 sm:py-6 rounded-xl sm:rounded-2xl text-[8px] sm:text-[10px] font-black uppercase tracking-widest transition-all ${orderType === 'SELL' ? 'bg-white text-black shadow-xl' : 'text-white/20'}`}>Liquidar</button>
            </div>
            
            <div className="text-center space-y-4 sm:space-y-6">
              <label className="text-[8px] sm:text-[10px] font-black uppercase text-white/20 tracking-[0.3em] sm:tracking-[0.5em]">Gramos a transar</label>
              <input 
                type="number" 
                value={orderAmount} 
                onChange={(e) => setOrderAmount(e.target.value)} 
                placeholder="0.00" 
                className="w-full bg-black/60 border border-white/5 rounded-[2rem] sm:rounded-[3rem] py-8 sm:py-14 text-4xl sm:text-6xl lg:text-7xl font-black text-center outline-none focus:border-yellow-500/40 transition-all placeholder:text-white/5 px-4" 
              />
            </div>

            <button 
              onClick={() => setShowConfirm(true)}
              disabled={!wallet.isConnected || !orderAmount || parseFloat(orderAmount) <= 0 || wrongNetwork || isLoadingBalance}
              className={`w-full py-6 sm:py-10 rounded-[2rem] sm:rounded-[3rem] font-black uppercase text-[10px] sm:text-[12px] tracking-[0.2em] sm:tracking-[0.3em] transition-all active:scale-[0.96] flex items-center justify-center gap-2 sm:gap-4 shadow-2xl ${wallet.isConnected && !wrongNetwork && orderAmount && parseFloat(orderAmount) > 0 ? (orderType === 'BUY' ? 'gold-gradient text-black hover:scale-[1.03]' : 'bg-white text-black hover:scale-[1.03]') : 'bg-white/5 text-white/10 cursor-not-allowed'}`}
            >
              {orderType === 'BUY' ? 'Crear Reserva' : 'Canjear Oro'}
              <ChevronRight size={18} className="sm:size-6" />
            </button>
          </div>
        </div>
      </main>

      {showConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 backdrop-blur-3xl bg-black/95">
          <div className="glass w-full max-w-2xl p-6 sm:p-16 rounded-[2.5rem] sm:rounded-[5rem] border border-yellow-500/20 relative shadow-gold-lg animate-in fade-in zoom-in duration-300 max-h-[90vh] overflow-y-auto">
            <button onClick={() => setShowConfirm(false)} className="absolute top-6 right-6 sm:top-12 sm:right-12 text-white/20 hover:text-white transition-all"><X size={24} className="sm:size-8"/></button>
            
            <div className="text-center mb-6 sm:mb-8 mt-4 sm:mt-0">
              <h3 className="text-2xl sm:text-4xl font-black uppercase tracking-tighter mb-1 sm:mb-2 leading-tight">Resumen de {orderType === 'BUY' ? 'Adquisición' : 'Liquidación'}</h3>
              <p className="text-[7px] sm:text-[10px] font-bold text-yellow-500/50 uppercase tracking-[0.2em] sm:tracking-[0.4em]">Cálculo neto de reserva física</p>
            </div>

            <div className="space-y-4 sm:space-y-6">
              <div className="bg-black/60 rounded-[2rem] sm:rounded-[3rem] border border-white/5 overflow-hidden">
                <div className="p-5 sm:p-8 border-b border-white/5">
                  <div className="flex justify-between items-center text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-white/20 mb-4 sm:mb-6">
                    <span>Gramos</span>
                    <span>Peso Oro</span>
                  </div>
                  
                  <div className="space-y-3 sm:space-y-5">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <Coins size={14} className="text-white/40 hidden xs:block" />
                        <span className="text-[10px] sm:text-sm font-medium text-white/60">Solicitado</span>
                      </div>
                      <span className="text-sm sm:text-lg font-bold">{orderDetails.amount.toFixed(4)} g</span>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-white/5">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <ArrowRightLeft size={14} className="text-yellow-500/60 hidden xs:block" />
                        <div>
                          <span className="text-[10px] sm:text-sm font-medium text-yellow-500/80 block leading-none">Comisión GLDC</span>
                          <span className="text-[7px] sm:text-[9px] text-yellow-500/30 uppercase font-black tracking-wider">(0.75%)</span>
                        </div>
                      </div>
                      <span className="text-sm sm:text-lg font-bold text-yellow-500">-{orderDetails.feeInTokens.toFixed(6)} g</span>
                    </div>

                    <div className="flex justify-between items-center p-3 sm:p-4 bg-white/5 rounded-xl sm:rounded-2xl border border-white/5">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <ShieldCheck size={14} className="text-green-500/60 hidden xs:block" />
                        <span className="text-[8px] sm:text-xs font-black uppercase tracking-widest text-white/40">
                          Neto
                        </span>
                      </div>
                      <span className="text-base sm:text-xl font-black text-white">{orderDetails.netTokens.toFixed(6)} g</span>
                    </div>
                  </div>
                </div>
                
                <div className="p-6 sm:p-8 bg-yellow-500/5 text-center">
                  <p className="text-[8px] sm:text-[10px] font-black text-yellow-500/60 uppercase mb-1 sm:mb-2 tracking-[0.2em] sm:tracking-[0.3em]">
                    {orderType === 'BUY' ? 'USDT a Transferir' : 'USDT a Recibir'}
                  </p>
                  <h4 className="text-3xl sm:text-6xl font-black tracking-tighter text-white truncate px-2">
                    ${orderDetails.finalUSDT.toLocaleString(undefined, {minimumFractionDigits: 2})} <span className="text-sm sm:text-xl opacity-20">USDT</span>
                  </h4>
                </div>
              </div>

              <div className="space-y-2 sm:space-y-4">
                <div className="flex justify-between items-center px-2 sm:px-4">
                  <p className="text-[8px] sm:text-[10px] font-black text-white/20 uppercase tracking-[0.2em] sm:tracking-[0.3em]">Billetera de Tesorería</p>
                  <div className="flex items-center gap-1 text-[7px] sm:text-[9px] text-yellow-500/60 font-black uppercase"><Info size={8}/><span className="hidden xs:inline">Verificada</span></div>
                </div>
                <div className="bg-black/80 p-3 sm:p-5 rounded-2xl sm:rounded-3xl border border-white/10 flex items-center justify-between gap-3 group hover:border-yellow-500/30 transition-all cursor-pointer shadow-inner" onClick={() => copyToClipboard(TREASURY_WALLET)}>
                  <code className="text-[8px] sm:text-xs font-mono text-white/60 break-all select-all flex-1 leading-tight">{TREASURY_WALLET}</code>
                  <div className="shrink-0 p-2 sm:p-3 bg-white/5 rounded-lg sm:rounded-xl group-hover:bg-yellow-500 transition-all group-hover:text-black">
                    {copied ? <CheckCircle2 size={14} className="sm:size-4" /> : <Copy size={14} className="sm:size-4" />}
                  </div>
                </div>
              </div>

              <div className="pt-2 sm:pt-4">
                <button 
                  onClick={handleNotify} 
                  className="w-full py-6 sm:py-10 gold-gradient text-black rounded-[1.5rem] sm:rounded-[3rem] font-black uppercase text-[10px] sm:text-[13px] tracking-[0.2em] sm:tracking-[0.3em] flex items-center justify-center gap-3 sm:gap-5 shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  Confirmar <span className="hidden xs:inline">Notificación</span> <Send size={18} className="sm:size-6"/>
                </button>
                <p className="text-[7px] sm:text-[9px] text-center text-white/20 font-black uppercase tracking-[0.1em] sm:tracking-[0.2em] mt-4 sm:mt-6 leading-relaxed max-w-[200px] sm:max-w-xs mx-auto">
                  La comisión se aplica sobre el peso en oro por gestión de custodia física.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;

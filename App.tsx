
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
  Info,
  Hash,
  User,
  ExternalLink,
  Calculator,
  HelpCircle,
  BookOpen,
  ArrowRight,
  Shield,
  TrendingUp,
  Globe,
  Zap
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
  
  const [orderAmount, setOrderAmount] = useState<string>("");
  const [orderType, setOrderType] = useState<'BUY' | 'SELL'>('BUY');
  const [txId, setTxId] = useState("");
  const [isDifferentWallet, setIsDifferentWallet] = useState(false);
  const [externalAddress, setExternalAddress] = useState("");
  
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [history, setHistory] = useState<PricePoint[]>([]);
  const [analysis, setAnalysis] = useState("Conectando con la reserva de oro física...");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [wrongNetwork, setWrongNetwork] = useState(false);
  const [copied, setCopied] = useState(false);

  const currentBalanceUSD = useMemo(() => {
    return (wallet.balanceGLDC || 0) * (gold.gramPrice || 77.16);
  }, [wallet.balanceGLDC, gold.gramPrice]);

  const orderDetails = useMemo(() => {
    const amount = parseFloat(orderAmount) || 0;
    const feeInTokens = amount * FEE_RATE;
    const netTokens = amount - feeInTokens;
    
    const finalUSDT = orderType === 'BUY' 
      ? amount * gold.gramPrice 
      : netTokens * gold.gramPrice;
    
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
        } catch (e) { console.warn("Balance fetch error:", e); }
      }
      for (const rpc of BSC_NODES) {
        try {
          const provider = new JsonRpcProvider(rpc);
          const contract = new Contract(GLDC_TOKEN_ADDRESS, ERC20_ABI, provider);
          const rawBalance = await contract.balanceOf(address);
          const balFormatted = parseFloat(formatUnits(rawBalance, 18));
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
    const walletToUse = isDifferentWallet ? externalAddress : wallet.address;
    const subject = `ORDEN GLDC (BSC): ${orderType} ${orderDetails.amount}g - HASH: ${txId.slice(0, 8)}`;
    const body = `DETALLE DE SOLICITUD - CRYPTOCAGUA GOLD (BSC NETWORK)
------------------------------------------------
Operación: ${orderType === 'BUY' ? 'ADQUISICIÓN (Compra)' : 'LIQUIDACIÓN (Venta)'}
Red: Binance Smart Chain (BEP-20)
Hash de Transacción (TxID): ${txId}
------------------------------------------------
Monto en Transacción: ${orderDetails.amount} ${orderType === 'BUY' ? 'USDT (BEP-20)' : 'GLDC (BEP-20)'}
Comisión Aplicada (0.75%): -${orderDetails.feeInTokens.toFixed(6)} g (Deducida en Oro)
Monto Neto Final: ${orderDetails.netTokens.toFixed(6)} g
------------------------------------------------
Precio de Referencia: $${orderDetails.gramPrice.toFixed(4)} USDT/g
TOTAL OPERACIÓN: $${orderDetails.finalUSDT.toFixed(2)} USDT
------------------------------------------------
Billetera del Usuario: ${wallet.address}
Billetera Destino/Origen Fondos: ${walletToUse}
Billetera Tesorería Cryptocagua: ${TREASURY_WALLET}
------------------------------------------------
${orderType === 'BUY' 
  ? `Nota: He enviado ${orderDetails.finalUSDT.toFixed(2)} USDT por la red BSC. Solicito el envío de mis tokens GLDC (neto tras comisión) a mi billetera.` 
  : `Nota: He enviado ${orderDetails.amount} tokens GLDC por la red BSC. Solicito la liquidación de ${orderDetails.netTokens.toFixed(6)} g en USDT ($${orderDetails.finalUSDT.toFixed(2)}).`}`;
    
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

  const isFormValid = useMemo(() => {
    const hasTx = txId.length > 20;
    const hasAddress = isDifferentWallet ? (externalAddress.startsWith("0x") && externalAddress.length === 42) : true;
    return hasTx && hasAddress;
  }, [txId, isDifferentWallet, externalAddress]);

  return (
    <div className="min-h-screen pb-10 sm:pb-20">
      {wrongNetwork && wallet.isConnected && (
        <div className="bg-red-600 text-white px-4 py-3 flex flex-wrap items-center justify-center gap-2 text-[9px] font-black sticky top-0 z-[100] shadow-2xl text-center">
          <AlertCircle size={14} className="animate-pulse" />
          <span className="tracking-widest uppercase">Red Incorrecta. Cambia a Binance Smart Chain (BSC) para operar.</span>
          <button onClick={() => (window as any).ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x38' }] })} className="bg-white text-red-600 px-3 py-1 rounded-full hover:scale-105 text-[8px] font-bold">Cambiar a BSC</button>
        </div>
      )}

      <nav className="glass border-b border-white/5 px-4 sm:px-12 py-4 sm:py-6 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-3 sm:gap-4 cursor-pointer" onClick={() => window.location.reload()}>
          <div className="w-10 h-10 sm:w-12 sm:h-12 gold-gradient rounded-xl sm:rounded-2xl flex items-center justify-center shadow-gold transition-transform hover:scale-110">
            <Coins className="text-black" size={24} />
          </div>
          <div className="hidden sm:block">
            <h1 className="font-serif text-xl sm:text-3xl font-black tracking-tighter leading-none uppercase">Cryptocagua</h1>
            <p className="text-[7px] sm:text-[9px] font-black text-yellow-500/70 uppercase tracking-[0.3em] sm:tracking-[0.5em] mt-0.5 sm:mt-1">Token de Oro Físico</p>
          </div>
        </div>

        <div className="flex items-center gap-4 sm:gap-6">
          <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-full">
            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(234,179,8,0.8)]"></div>
            <span className="text-[9px] font-black uppercase text-yellow-500 tracking-widest">Network: BSC (BEP-20)</span>
          </div>

          <button onClick={connectWallet} className={`px-4 sm:px-8 py-2 sm:py-3 rounded-xl sm:rounded-2xl text-[8px] sm:text-[10px] font-black uppercase flex items-center gap-2 transition-all active:scale-95 ${wallet.isConnected && wallet.address ? 'bg-white/5 border border-white/10 text-white/60' : 'gold-gradient text-black shadow-lg hover:shadow-yellow-500/20'}`}>
            <Wallet size={16} /> 
            <span>{wallet.isConnected && wallet.address ? `${wallet.address.slice(0,6)}...${wallet.address.slice(-4)}` : 'Conectar Wallet'}</span>
          </button>
        </div>
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
              <p className="text-[8px] sm:text-[10px] font-black uppercase text-yellow-500 tracking-[0.2em] sm:tracking-[0.4em] mb-2 sm:mb-4">Gramo GLDC (Spot)</p>
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
        </div>

        <div className="lg:col-span-4 space-y-6 sm:space-y-10">
          <div className="gold-gradient p-8 sm:p-12 rounded-[3rem] sm:rounded-[4.5rem] text-black shadow-gold-lg relative overflow-hidden transition-all hover:scale-[1.01]">
            <div className="absolute top-4 right-4 bg-black/20 px-3 py-1 rounded-full text-[7px] font-black uppercase tracking-widest border border-black/5">BSC Network</div>
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-4">
                <p className="text-[9px] sm:text-[11px] font-black uppercase opacity-60 tracking-widest">Reserva GLDC</p>
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

          <div className="glass p-8 sm:p-12 rounded-[3rem] sm:rounded-[4.5rem] border-white/5 space-y-8 relative">
            <div className="flex bg-black/40 p-1.5 rounded-2xl sm:rounded-3xl border border-white/5">
              <button onClick={() => { setOrderType('BUY'); setOrderAmount(""); }} className={`flex-1 py-3 sm:py-6 rounded-xl sm:rounded-2xl text-[8px] sm:text-[10px] font-black uppercase tracking-widest transition-all ${orderType === 'BUY' ? 'bg-yellow-500 text-black shadow-gold-sm' : 'text-white/20'}`}>Adquirir</button>
              <button onClick={() => { setOrderType('SELL'); setOrderAmount(""); }} className={`flex-1 py-3 sm:py-6 rounded-xl sm:rounded-2xl text-[8px] sm:text-[10px] font-black uppercase tracking-widest transition-all ${orderType === 'SELL' ? 'bg-white text-black shadow-xl' : 'text-white/20'}`}>Liquidar</button>
            </div>
            
            <div className="text-center space-y-4">
              <label className="text-[8px] sm:text-[10px] font-black uppercase text-white/20 tracking-[0.3em] sm:tracking-[0.5em]">Gramos a {orderType === 'BUY' ? 'comprar' : 'vender'}</label>
              <input type="number" value={orderAmount} onChange={(e) => setOrderAmount(e.target.value)} placeholder="0.00" className="w-full bg-black/60 border border-white/5 rounded-[2rem] sm:rounded-[3rem] py-8 sm:py-12 text-4xl sm:text-6xl font-black text-center outline-none focus:border-yellow-500/40 transition-all placeholder:text-white/5 px-4" />
            </div>

            {parseFloat(orderAmount) > 0 && (
              <div className="bg-white/[0.02] border border-white/5 p-6 rounded-3xl space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-white/40">
                  <span className="flex items-center gap-2"><Calculator size={12}/> Resumen (RED BSC)</span>
                  <span className="text-yellow-500 font-bold">BEP-20</span>
                </div>
                
                <div className="space-y-2.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-white/30 uppercase text-[9px] font-bold">Monto Base:</span>
                    <span className="text-white font-black">{parseFloat(orderAmount).toFixed(4)} g</span>
                  </div>
                  <div className="flex justify-between text-[11px] font-bold border-y border-white/5 py-2">
                    <span className="text-yellow-500/60 uppercase text-[9px]">Comisión (0.75%):</span>
                    <span className="text-yellow-500">-{orderDetails.feeInTokens.toFixed(6)} g</span>
                  </div>
                  <div className="flex justify-between text-[13px] font-black pt-1">
                    <span className="text-white/50 uppercase text-[9px] tracking-widest">Resultado Final:</span>
                    <span className="gold-text">{orderDetails.netTokens.toFixed(4)} g</span>
                  </div>
                </div>
              </div>
            )}

            <button onClick={() => setShowConfirm(true)} disabled={!wallet.isConnected || !orderAmount || parseFloat(orderAmount) <= 0 || wrongNetwork || isLoadingBalance} className={`w-full py-6 sm:py-10 rounded-[2rem] sm:rounded-[3rem] font-black uppercase text-[10px] sm:text-[12px] tracking-[0.2em] sm:tracking-[0.3em] transition-all active:scale-[0.96] flex items-center justify-center gap-2 sm:gap-4 shadow-2xl ${wallet.isConnected && !wrongNetwork && orderAmount && parseFloat(orderAmount) > 0 ? (orderType === 'BUY' ? 'gold-gradient text-black hover:scale-[1.03]' : 'bg-white text-black hover:scale-[1.03]') : 'bg-white/5 text-white/10 cursor-not-allowed'}`}>
              {orderType === 'BUY' ? 'Iniciar Adquisición' : 'Iniciar Liquidación'}
              <ChevronRight size={18} className="sm:size-6" />
            </button>
          </div>
        </div>
      </main>

      {showConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 backdrop-blur-3xl bg-black/95 overflow-hidden">
          <div className="glass w-full max-w-2xl p-6 sm:p-10 rounded-[2.5rem] sm:rounded-[4rem] border border-yellow-500/20 relative shadow-gold-lg animate-in fade-in zoom-in duration-300 max-h-[95vh] overflow-y-auto">
            <button onClick={() => setShowConfirm(false)} className="absolute top-6 right-6 sm:top-10 sm:right-10 text-white/20 hover:text-white transition-all"><X size={24} className="sm:size-8"/></button>
            
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-yellow-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-yellow-500/20 shadow-inner">
                <Zap className="text-yellow-500 fill-yellow-500/20" size={32} />
              </div>
              <h3 className="text-xl sm:text-3xl font-black uppercase tracking-tighter mb-1">
                Operación en Red BSC
              </h3>
              <p className="text-[7px] font-black text-yellow-500 uppercase tracking-[0.2em] mb-4">Protocolo BEP-20 Verificado</p>
              <button 
                onClick={() => setShowTutorial(!showTutorial)} 
                className="px-6 py-2 bg-white/5 hover:bg-white/10 rounded-full text-[8px] font-black text-white uppercase flex items-center gap-2 mx-auto transition-all border border-white/5"
              >
                <BookOpen size={12}/> {showTutorial ? 'Ocultar Tutorial' : '¿Cómo transferir en BSC?'}
              </button>
            </div>

            {showTutorial && (
              <div className="bg-yellow-500/[0.03] border border-yellow-500/10 rounded-3xl p-6 mb-8 space-y-6 animate-in slide-in-from-top-4 duration-500">
                <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                  <div className="p-2 bg-yellow-500 rounded-lg text-black"><Globe size={16}/></div>
                  <h4 className="text-[10px] font-black uppercase tracking-widest">Guía Crítica: Red BEP-20</h4>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-3 p-4 bg-black/60 rounded-2xl border border-white/5 relative group">
                    <span className="absolute -top-2 -left-2 w-6 h-6 bg-yellow-500 text-black rounded-full flex items-center justify-center text-[10px] font-black">1</span>
                    <p className="text-[8px] font-bold text-white/50 leading-relaxed uppercase">
                      Selecciona la red <span className="text-yellow-500">BNB Smart Chain (BEP20)</span> en tu billetera.
                    </p>
                  </div>
                  <div className="space-y-3 p-4 bg-black/60 rounded-2xl border border-white/5 relative group">
                    <span className="absolute -top-2 -left-2 w-6 h-6 bg-yellow-500 text-black rounded-full flex items-center justify-center text-[10px] font-black">2</span>
                    <p className="text-[8px] font-bold text-white/50 leading-relaxed uppercase">
                      Envía los {orderType === 'BUY' ? `USDT` : `GLDC`} a la dirección de tesorería indicada.
                    </p>
                  </div>
                  <div className="space-y-3 p-4 bg-black/60 rounded-2xl border border-white/5 relative group">
                    <span className="absolute -top-2 -left-2 w-6 h-6 bg-yellow-500 text-black rounded-full flex items-center justify-center text-[10px] font-black">3</span>
                    <p className="text-[8px] font-bold text-white/50 leading-relaxed uppercase">
                      Pega el <span className="text-white">Transaction Hash</span> para validar la llegada.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 bg-red-500/10 rounded-xl border border-red-500/20">
                  <AlertCircle size={14} className="text-red-500 shrink-0" />
                  <p className="text-[7px] font-black text-red-500 uppercase tracking-wider">No envíes fondos por Ethereum (ERC20) o Tron (TRC20). Solo BSC es compatible.</p>
                </div>
              </div>
            )}

            <div className="space-y-6">
              <div className="bg-white/5 rounded-[2rem] border border-white/5 p-6 sm:p-8 space-y-6">
                <div className="grid grid-cols-2 gap-y-4">
                  <div>
                    <p className="text-[8px] font-black text-white/20 uppercase mb-1 tracking-widest">Base de Operación</p>
                    <p className="text-xl font-bold text-white">{orderDetails.amount} <span className="text-[10px] opacity-40">g</span></p>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] font-black text-white/20 uppercase mb-1 tracking-widest">Fee Custodia (0.75%)</p>
                    <p className="text-xl font-bold text-yellow-500">-{orderDetails.feeInTokens.toFixed(6)} <span className="text-[10px] opacity-40">g</span></p>
                  </div>
                  <div className="col-span-2 border-t border-white/5 pt-4 flex justify-between items-center">
                    <div>
                      <p className="text-[8px] font-black text-white/20 uppercase mb-1 tracking-widest">Reserva Neta GLDC</p>
                      <p className="text-2xl font-black gold-text">{orderDetails.netTokens.toFixed(6)} g</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[8px] font-black text-white/20 uppercase mb-1 tracking-widest">Monto Liquidación</p>
                      <p className="text-2xl font-black text-white">${orderDetails.finalUSDT.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-yellow-500 p-5 rounded-2xl shadow-[0_0_20px_rgba(234,179,8,0.3)]">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-black font-black text-[8px] uppercase tracking-widest">Instrucción de Envío Obligatoria:</span>
                    <span className="text-black/60 font-black text-[7px] uppercase tracking-widest">RED BSC ONLY</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-black font-bold text-xs uppercase tracking-widest">Enviar exactamente:</span>
                    <span className="text-black font-black text-xl">
                      {orderType === 'BUY' ? `$${orderDetails.finalUSDT.toFixed(2)} USDT` : `${orderDetails.amount} GLDC`}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center px-4">
                  <p className="text-[8px] font-black text-white/20 uppercase tracking-widest">Billetera Tesorería (BSC BEP-20)</p>
                </div>
                <div className="bg-black/60 p-4 rounded-2xl border border-white/10 flex items-center justify-between gap-3 group hover:border-yellow-500/30 transition-all cursor-pointer shadow-inner" onClick={() => copyToClipboard(TREASURY_WALLET)}>
                  <code className="text-[9px] sm:text-xs font-mono text-white/40 break-all flex-1 leading-tight">{TREASURY_WALLET}</code>
                  <div className="shrink-0 p-2 bg-white/5 rounded-lg group-hover:bg-yellow-500 transition-all group-hover:text-black shadow-lg">
                    {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[8px] font-black text-white/40 uppercase px-4"><Hash size={10}/> Hash TxID (Binance Smart Chain)</label>
                  <input 
                    type="text" 
                    value={txId} 
                    onChange={(e) => setTxId(e.target.value)} 
                    placeholder="Pega el Hash de la BSC aquí..." 
                    className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 px-6 text-xs sm:text-sm font-mono text-yellow-500 outline-none focus:border-yellow-500/40 transition-all"
                  />
                </div>

                <div className="space-y-3">
                  <p className="flex items-center gap-2 text-[8px] font-black text-white/40 uppercase px-4"><User size={10}/> Billetera de Recepción (BSC)</p>
                  <div className="flex gap-2 p-1 bg-black/40 rounded-2xl border border-white/5">
                    <button onClick={() => setIsDifferentWallet(false)} className={`flex-1 py-3 rounded-xl text-[8px] font-black uppercase transition-all ${!isDifferentWallet ? 'bg-white/10 text-white shadow-lg' : 'text-white/20 hover:text-white/40'}`}>Conectada</button>
                    <button onClick={() => setIsDifferentWallet(true)} className={`flex-1 py-3 rounded-xl text-[8px] font-black uppercase transition-all ${isDifferentWallet ? 'bg-white/10 text-white shadow-lg' : 'text-white/20 hover:text-white/40'}`}>Otra (BSC)</button>
                  </div>
                  
                  {isDifferentWallet && (
                    <div className="animate-in slide-in-from-top-2 duration-300">
                      <input 
                        type="text" 
                        value={externalAddress} 
                        onChange={(e) => setExternalAddress(e.target.value)} 
                        placeholder="0x... (Debe ser red BSC)" 
                        className="w-full bg-black/40 border border-yellow-500/10 rounded-2xl py-4 px-6 text-xs sm:text-sm font-mono text-white outline-none focus:border-yellow-500/40 transition-all"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 space-y-4">
                <button 
                  onClick={handleNotify} 
                  disabled={!isFormValid}
                  className={`w-full py-6 rounded-[2rem] font-black uppercase text-[10px] sm:text-[12px] tracking-[0.2em] flex items-center justify-center gap-4 shadow-2xl transition-all ${isFormValid ? 'gold-gradient text-black hover:scale-[1.02] active:scale-[0.98]' : 'bg-white/5 text-white/10 cursor-not-allowed'}`}
                >
                  Confirmar y Notificar BSC <Send size={20}/>
                </button>
                <div className="flex items-center justify-center gap-4 py-2 opacity-30 grayscale hover:grayscale-0 transition-all">
                   <div className="flex items-center gap-1 text-[8px] font-black uppercase tracking-widest text-white">
                      <Zap size={10} className="text-yellow-500" /> Powered by Binance Smart Chain
                   </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;

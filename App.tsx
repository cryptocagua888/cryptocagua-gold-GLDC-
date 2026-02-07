
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
  Loader2
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
  const [analysis, setAnalysis] = useState<string>("Sincronizando con mercados globales...");
  const [orderAmount, setOrderAmount] = useState<string>("");
  const [orderType, setOrderType] = useState<'BUY' | 'SELL'>('BUY');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSyncingBalance, setIsSyncingBalance] = useState(false);

  // --- Cálculos Dinámicos ---
  // Calculamos el valor en USD dinámicamente para que siempre refleje el precio actual del gramo
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

  // --- Lógica de Cartera ---
  const fetchWalletBalance = useCallback(async (address: string) => {
    if (!address) return;
    setIsSyncingBalance(true);
    try {
      // Usamos el endpoint de BscScan para balances de tokens BEP-20
      const url = `https://api.bscscan.com/api?module=account&action=tokenbalance&contractaddress=${GLDC_TOKEN_ADDRESS}&address=${address}&tag=latest&apikey=${BSCSCAN_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === '1') {
        // La mayoría de los tokens en BSC usan 18 decimales
        const bal = parseFloat(formatUnits(data.result, 18));
        setWallet(prev => ({ 
          ...prev, 
          address, 
          isConnected: true, 
          balanceGLDC: bal,
          // balanceUSD se calculará vía useMemo
        }));
      }
    } catch (e) {
      console.error("Error al obtener balance de BscScan:", e);
    } finally {
      setIsSyncingBalance(false);
    }
  }, []);

  // --- Lógica de Mercado ---
  const fetchMarketData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=PAXGUSDT');
      const data = await res.json();
      if (data?.price) {
        const spot = parseFloat(data.price);
        const gram = spot / TROY_OUNCE_TO_GRAMS;
        setGold(prev => ({ ...prev, spotPrice: spot, gramPrice: gram, loading: false }));
        
        // IA Analysis
        const aiText = await getMarketAnalysis(gram);
        setAnalysis(aiText);

        // Si hay una wallet conectada, actualizamos su balance también
        if (wallet.address) {
          fetchWalletBalance(wallet.address);
        }
      }
    } catch (e) {
      console.error("Error al obtener precio del mercado:", e);
    } finally {
      setIsRefreshing(false);
    }
  }, [wallet.address, fetchWalletBalance]);

  const connectWallet = async () => {
    const eth = (window as any).ethereum;
    if (!eth) return alert("Por favor, instala MetaMask para conectar tu cartera.");
    try {
      const provider = new BrowserProvider(eth);
      const accounts = await provider.send("eth_requestAccounts", []);
      if (accounts[0]) {
        await fetchWalletBalance(accounts[0]);
      }
    } catch (e) { 
      console.error("Error al conectar wallet:", e); 
    }
  };

  useEffect(() => {
    fetchMarketData();
    // Generar datos de gráfico ficticios para estética inicial
    setHistory(Array.from({ length: 20 }, (_, i) => ({
      time: `${i}:00`,
      price: gold.gramPrice + (Math.random() - 0.5) * 2
    })));
    const interval = setInterval(fetchMarketData, 60000);
    return () => clearInterval(interval);
  }, []); // El efecto inicial solo corre una vez

  const handleOrderSubmit = () => {
    const orderId = Math.random().toString(36).substring(7).toUpperCase();
    const subject = `ORDEN GLDC - ${orderType} - ${orderId}`;
    const body = `Nueva solicitud de operación GLDC:\n\nID: ${orderId}\nTipo: ${orderType}\nCantidad: ${orderAmount} gramos\nTotal: $${orderDetails.total.toFixed(2)} USD\nWallet: ${wallet.address}\n\nPor favor, contactar con el soporte para finalizar el proceso de transferencia.`;
    window.open(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
    setShowConfirm(false);
    setOrderAmount("");
  };

  return (
    <div className="min-h-screen pb-12 selection:bg-yellow-500/30">
      {/* Header */}
      <nav className="sticky top-0 z-50 glass border-b border-white/5 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 gold-gradient rounded-xl flex items-center justify-center shadow-lg shadow-yellow-500/20">
            <Coins className="text-black" size={24} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="font-serif text-xl font-black tracking-tight leading-none">CRYPTOCAGUA</h1>
            <span className="text-[10px] font-bold text-yellow-500 uppercase tracking-[0.4em]">Gold Reserve</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={async () => { await (window as any).aistudio?.openSelectKey(); fetchMarketData(); }}
            className="hidden md:flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-full border border-white/10 text-[10px] font-bold uppercase transition-all"
          >
            <Key size={14} className="text-yellow-500" /> IA Key
          </button>
          
          <button 
            onClick={connectWallet}
            className={`px-5 py-2.5 rounded-full text-[11px] font-black uppercase tracking-wider flex items-center gap-2 transition-all ${wallet.isConnected ? 'bg-white/5 border border-white/10' : 'gold-gradient text-black shadow-xl shadow-yellow-500/10 active:scale-95'}`}
          >
            {wallet.isConnected ? (
              <><div className="w-2 h-2 rounded-full bg-green-500" /> {wallet.address?.slice(0,6)}...{wallet.address?.slice(-4)}</>
            ) : (
              <><Wallet size={14} /> Conectar Cartera</>
            )}
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 mt-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Columna Izquierda: Mercado e IA */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* Hero Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass p-8 rounded-[2rem] relative overflow-hidden group">
              <p className="text-[10px] font-black uppercase text-white/30 tracking-widest mb-1">Precio Onza (Spot)</p>
              <div className="flex items-end gap-3">
                <h2 className="text-5xl font-black tracking-tighter">${gold.spotPrice.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
                <span className="mb-2 text-green-500 font-bold text-sm flex items-center gap-1"><ArrowUpRight size={14}/> {gold.change24h}%</span>
              </div>
              <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                <TrendingUp size={120} />
              </div>
            </div>

            <div className="glass p-8 rounded-[2rem] border-2 border-yellow-500/20 shadow-2xl shadow-yellow-500/5">
              <p className="text-[10px] font-black uppercase text-yellow-500 tracking-widest mb-1">Valor GLDC / 1 Gramo</p>
              <h2 className="text-5xl font-black tracking-tighter gold-text">${gold.gramPrice.toFixed(2)}</h2>
              <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-white/20 uppercase tracking-tighter">
                <ShieldCheck size={14} className="text-yellow-500"/> Auditado • Respaldo Físico 1:1
              </div>
            </div>
          </div>

          {/* Chart Container */}
          <div className="glass p-8 rounded-[2.5rem] relative">
            <div className="flex justify-between items-center mb-10">
              <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-white/20 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" /> Desempeño Histórico 24H
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

          {/* AI Insights Card */}
          <div className="bg-yellow-500/5 border border-yellow-500/10 p-10 rounded-[2.5rem] flex items-start gap-8 group">
            <div className="w-14 h-14 gold-gradient rounded-2xl flex items-center justify-center shrink-0 shadow-lg group-hover:scale-105 transition-transform">
              <Info className="text-black" size={28} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-yellow-500/50 tracking-widest mb-1">Análisis de Mercado (Gemini AI)</p>
              <p className="text-xl font-medium italic text-white/90 leading-snug">"{analysis}"</p>
            </div>
          </div>

        </div>

        {/* Columna Derecha: Cartera y Operaciones */}
        <div className="lg:col-span-4 space-y-8">
          
          {/* Balance Card */}
          <div className="gold-gradient p-10 rounded-[3rem] text-black shadow-2xl shadow-yellow-500/10 relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-2">
                <p className="text-[11px] font-black uppercase opacity-40 tracking-widest">Tu Patrimonio Oro</p>
                {isSyncingBalance && <Loader2 size={16} className="animate-spin opacity-40" />}
              </div>
              <h3 className="text-6xl font-black tracking-tighter mb-8">${currentBalanceUSD.toLocaleString(undefined, {minimumFractionDigits: 2})}</h3>
              
              <div className="pt-8 border-t border-black/10 flex justify-between items-end">
                <div>
                  <p className="text-[10px] font-bold uppercase opacity-40">Monto GLDC</p>
                  <p className="text-3xl font-black">{wallet.balanceGLDC.toFixed(4)}g</p>
                </div>
                <div className="bg-black/10 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase border border-black/5">BSC Network</div>
              </div>
            </div>
            <Coins size={200} className="absolute -bottom-10 -right-10 opacity-10 rotate-12" />
          </div>

          {/* Action Terminal */}
          <div className="glass p-10 rounded-[3rem] border border-white/5">
            <div className="flex bg-black p-2 rounded-[2rem] mb-10">
              <button 
                onClick={() => setOrderType('BUY')}
                className={`flex-1 py-4 rounded-3xl text-[10px] font-black uppercase tracking-widest transition-all ${orderType === 'BUY' ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' : 'text-white/30 hover:text-white'}`}
              >
                Comprar
              </button>
              <button 
                onClick={() => setOrderType('SELL')}
                className={`flex-1 py-4 rounded-3xl text-[10px] font-black uppercase tracking-widest transition-all ${orderType === 'SELL' ? 'bg-white text-black shadow-lg shadow-white/20' : 'text-white/30 hover:text-white'}`}
              >
                Vender
              </button>
            </div>

            <div className="space-y-8 text-center">
              <div>
                <label className="text-[10px] font-black uppercase text-white/20 tracking-[0.3em] mb-4 block">Cantidad de Gramos (GLDC)</label>
                <div className="relative">
                  <input 
                    type="number"
                    value={orderAmount}
                    onChange={(e) => setOrderAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-black/50 border border-white/5 rounded-3xl py-10 text-6xl font-black text-center outline-none focus:border-yellow-500/50 transition-all placeholder:text-white/5"
                  />
                </div>
              </div>

              {orderDetails.qty > 0 && (
                <div className="bg-white/5 p-6 rounded-3xl border border-white/5 space-y-3 animate-fade-in text-left">
                  <div className="flex justify-between text-[10px] font-bold uppercase text-white/40">
                    <span>Subtotal</span>
                    <span>${orderDetails.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-bold uppercase text-white/40">
                    <span>Comisión Gestión (0.75%)</span>
                    <span className="text-red-400">-${orderDetails.fee.toFixed(2)}</span>
                  </div>
                  <div className="pt-4 border-t border-white/5 flex justify-between items-center">
                    <span className="text-yellow-500 text-[10px] font-black uppercase tracking-widest">Total Estimado</span>
                    <span className="text-3xl font-black tracking-tight">${orderDetails.total.toFixed(2)}</span>
                  </div>
                </div>
              )}

              <button 
                onClick={() => setShowConfirm(true)}
                disabled={!wallet.isConnected || orderDetails.qty <= 0}
                className={`w-full py-7 rounded-[2rem] font-black uppercase text-[11px] tracking-widest flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-2xl ${wallet.isConnected && orderDetails.qty > 0 ? (orderType === 'BUY' ? 'gold-gradient text-black' : 'bg-white text-black') : 'bg-white/5 text-white/10 cursor-not-allowed'}`}
              >
                {orderType === 'BUY' ? 'Solicitar Adquisición' : 'Solicitar Liquidación'}
                <ChevronRight size={18} />
              </button>

              {!wallet.isConnected && (
                <p className="text-[9px] font-bold uppercase text-white/20 tracking-wider">Conecta tu wallet para habilitar operaciones</p>
              )}
            </div>
          </div>

        </div>
      </main>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-3xl bg-black/80 animate-fade-in">
          <div className="glass w-full max-w-lg p-12 rounded-[3.5rem] border border-yellow-500/30 relative shadow-2xl shadow-yellow-500/5">
            <button onClick={() => setShowConfirm(false)} className="absolute top-10 right-10 text-white/20 hover:text-white"><X size={32}/></button>
            
            <h3 className="text-3xl font-black text-center mb-10 uppercase tracking-tighter">Confirmar Operación</h3>
            
            <div className="space-y-8">
              <div className="bg-black p-8 rounded-[2.5rem] border border-white/5 text-center">
                <p className="text-[10px] font-black text-yellow-500 uppercase tracking-widest mb-2">Total a Transferir</p>
                <h4 className="text-5xl font-black">${orderDetails.total.toFixed(2)}</h4>
                <p className="mt-4 text-[11px] font-bold text-white/30 uppercase tracking-tighter">Monto en USDT (Red BEP-20)</p>
              </div>

              <div className="p-8 bg-yellow-500/5 rounded-[2.5rem] border border-yellow-500/10">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-black uppercase text-white/40">Destinatario</span>
                  <span className="text-[10px] font-black text-yellow-500 uppercase">Cryptocagua Treasury</span>
                </div>
                <code className="text-[11px] break-all block font-mono text-white/60 bg-black/40 p-4 rounded-xl border border-white/5 mb-6">{ADMIN_WALLET}</code>
                <button 
                  onClick={() => { navigator.clipboard.writeText(ADMIN_WALLET); alert("Dirección copiada"); }}
                  className="w-full py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-[10px] font-bold uppercase transition-all"
                >
                  Copiar Dirección de Tesorería
                </button>
              </div>

              <button 
                onClick={handleOrderSubmit}
                className="w-full py-7 gold-gradient text-black rounded-[2rem] font-black uppercase text-[11px] tracking-[0.2em] flex items-center justify-center gap-3 shadow-xl"
              >
                Notificar Envío al Soporte <Send size={18}/>
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="max-w-7xl mx-auto px-6 mt-20 py-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-10 opacity-30 grayscale hover:grayscale-0 transition-all duration-700">
        <div className="flex items-center gap-4">
          <Coins size={24} className="text-yellow-500" />
          <p className="text-[11px] font-black uppercase tracking-[0.3em]">Cryptocagua Gold Reserve v2.0</p>
        </div>
        <div className="flex gap-10">
          <span className="text-[10px] font-bold uppercase tracking-widest">Contrato Auditado</span>
          <span className="text-[10px] font-bold uppercase tracking-widest">Respaldo Real</span>
          <span className="text-[10px] font-bold uppercase tracking-widest">OTC 24/7</span>
        </div>
      </footer>
    </div>
  );
};

export default App;


export interface GoldPriceData {
  paxgPrice: number; // Price per Troy Ounce
  gldcPrice: number; // Price per Gram
  lastUpdate: Date;
}

export interface WalletState {
  address: string | null;
  balanceGLDC: number;
  balanceUSD: number;
  isConnected: boolean;
}

export interface Transaction {
  id: string;
  type: 'BUY' | 'SELL';
  amountGLDC: number;
  subtotalUSD: number;
  feeUSD: number;
  totalUSD: number;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  date: Date;
}

export interface PricePoint {
  time: string;
  value: number;
}


export interface GoldState {
  spotPrice: number; // Precio por onza
  gramPrice: number; // Precio por gramo (GLDC)
  change24h: number;
  loading: boolean;
}

export interface WalletState {
  address: string | null;
  balanceGLDC: number;
  balanceUSD: number;
  isConnected: boolean;
}

export interface PricePoint {
  time: string;
  price: number;
}

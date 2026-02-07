
/**
 * Constantes de Configuración para Cryptocagua Gold (GLDC)
 * IMPORTANTE: Para que las variables sean visibles en el navegador (Vercel/Vite),
 * deben tener el prefijo VITE_ en la configuración de entorno de Vercel.
 */

// Factor de conversión: Una onza troy equivale a estos gramos
export const TROY_OUNCE_TO_GRAMS = 31.1034768;

// Dirección del contrato inteligente de tu token GLDC en BSC
export const GLDC_TOKEN_ADDRESS = '0x5287178Ad5812Ac7161a8169483d96159A684DF8';

// API Key de BscScan para consultas de red
export const BSCSCAN_API_KEY = '58BXDNDG6E6VMHSJJ6MQT4YES7J1F8AFUT';

// Comisión por operación (0.75%)
export const FEE_RATE = 0.0075;

/**
 * CONFIGURACIÓN DE SEGURIDAD
 * Vite requiere acceso ESTÁTICO a las variables (import.meta.env.VITE_...)
 * para poder reemplazarlas durante el proceso de build.
 */

// Billetera principal donde se reciben los pagos de los usuarios
export const TREASURY_WALLET = 
  // Fix: Replace import.meta.env with process.env to resolve TypeScript error 'Property env does not exist on type ImportMeta'
  process.env.VITE_TREASURY_WALLET || 
  '0x0000000000000000000000000000000000000000';

// Billetera secundaria de administración
export const ADMIN_WALLET = 
  // Fix: Replace import.meta.env with process.env to resolve TypeScript error 'Property env does not exist on type ImportMeta'
  process.env.VITE_ADMIN_WALLET || 
  '0x0000000000000000000000000000000000000000';

// Correo de notificaciones
export const SUPPORT_EMAIL = 
  // Fix: Replace import.meta.env with process.env to resolve TypeScript error 'Property env does not exist on type ImportMeta'
  process.env.VITE_SUPPORT_EMAIL || 
  'soporte@cryptocagua.com';

/**
 * Constantes de Configuración para Cryptocagua Gold (GLDC)
 * Se utilizan variables de entorno para mayor seguridad y facilidad de configuración.
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
 * CONFIGURACIÓN DE SEGURIDAD (Vercel/Environment Variables)
 * TREASURY_WALLET: Billetera donde se reciben los depósitos.
 * SUPPORT_EMAIL: Correo donde se reciben las notificaciones de compra/venta.
 */
export const TREASURY_WALLET = process.env.TREASURY_WALLET || '0x0000000000000000000000000000000000000000';
export const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'soporte@cryptocagua.com';

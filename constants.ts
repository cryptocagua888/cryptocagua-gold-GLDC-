
/**
 * Constantes de Configuración para Cryptocagua Gold (GLDC)
 * 
 * NOTA PARA EL DESARROLLADOR:
 * Si las variables no aparecen en Vercel, asegúrate de:
 * 1. Haberlas nombrado exactamente: VITE_TREASURY_WALLET y VITE_ADMIN_WALLET
 * 2. Haber hecho un "Redeploy" (Desplegar de nuevo) después de guardarlas.
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
 * LÓGICA DE DETECCIÓN DE VARIABLES DE ENTORNO
 * Buscamos en todas las fuentes posibles donde Vercel o Vite podrían inyectar la billetera.
 */

// @ts-ignore
const getVariable = (key: string): string | undefined => {
  try {
    // 1. Intento con estándar de Vite (reemplazo estático en build time)
    // @ts-ignore
    const viteVal = (import.meta as any).env?.[`VITE_${key}`];
    if (viteVal) return viteVal;

    // 2. Intento con process.env (estándar de Vercel/Node)
    // @ts-ignore
    const procVal = (typeof process !== 'undefined' && process.env) ? 
      (process.env[`VITE_${key}`] || process.env[key]) : undefined;
    if (procVal) return procVal;

    // 3. Intento en el objeto window (algunas plataformas lo inyectan aquí)
    // @ts-ignore
    const winVal = (window as any).process?.env?.[`VITE_${key}`] || (window as any).process?.env?.[key];
    if (winVal) return winVal;
  } catch (e) {
    console.warn(`Error leyendo variable ${key}:`, e);
  }
  return undefined;
};

// Billetera principal donde se reciben los pagos de los usuarios
export const TREASURY_WALLET = 
  getVariable('TREASURY_WALLET') || 
  '0x0000000000000000000000000000000000000000';

// Billetera secundaria de administración
export const ADMIN_WALLET = 
  getVariable('ADMIN_WALLET') || 
  '0x0000000000000000000000000000000000000000';

// Correo de notificaciones
export const SUPPORT_EMAIL = 
  getVariable('SUPPORT_EMAIL') || 
  'soporte@cryptocagua.com';

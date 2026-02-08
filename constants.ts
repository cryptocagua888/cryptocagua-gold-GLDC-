
/**
 * Constantes de Configuración para Cryptocagua Gold (GLDC)
 */

export const TROY_OUNCE_TO_GRAMS = 31.1034768;
export const GLDC_TOKEN_ADDRESS = '0x5287178Ad5812Ac7161a8169483d96159A684DF8';
export const BSCSCAN_API_KEY = '58BXDNDG6E6VMHSJJ6MQT4YES7J1F8AFUT';
export const FEE_RATE = 0.0075;

// @ts-ignore
const getVariable = (key: string): string | undefined => {
  try {
    // Intentar con prefijo VITE_ y sin él en todas las fuentes
    const sources = [
      // @ts-ignore
      (import.meta as any).env,
      // @ts-ignore
      (typeof process !== 'undefined' ? process.env : {}),
      // @ts-ignore
      (window as any).process?.env,
      (window as any)
    ];

    for (const source of sources) {
      if (!source) continue;
      const val = source[`VITE_${key}`] || source[key];
      if (val && typeof val === 'string') return val;
    }
  } catch (e) {
    console.warn(`Error leyendo variable ${key}:`, e);
  }
  return undefined;
};

export const TREASURY_WALLET = getVariable('TREASURY_WALLET') || '0x0000000000000000000000000000000000000000';
export const ADMIN_WALLET = getVariable('ADMIN_WALLET') || '0x0000000000000000000000000000000000000000';
export const SUPPORT_EMAIL = getVariable('SUPPORT_EMAIL') || 'soporte@cryptocagua.com';

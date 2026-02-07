
import { GoogleGenAI } from "@google/genai";

export const getMarketAnalysis = async (price: number) => {
  try {
    // IMPORTANTE: Creamos la instancia justo antes de la llamada para asegurar la API KEY más reciente
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analiza por qué el oro físico tokenizado GLDC es la mejor reserva de valor a $${price.toFixed(2)}/gramo. Sé breve (máximo 15 palabras), profesional y sofisticado.`,
      config: { temperature: 0.7 }
    });

    return response.text?.trim() || "GLDC: Respaldo en oro real con la máxima liquidez digital.";
  } catch (error: any) {
    console.warn("AI Service Warning:", error?.message);
    if (error?.status === 429 || error?.message?.includes("429")) {
      return "Análisis Técnico: El oro consolida su posición como el activo refugio definitivo ante la inflación global.";
    }
    return "Cryptocagua Gold: Máxima seguridad patrimonial con respaldo tangible e inmediato.";
  }
};

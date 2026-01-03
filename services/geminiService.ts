
import { GoogleGenAI } from "@google/genai";

// Cache local simple para el último insight exitoso
let lastSuccessfulInsight = "El oro mantiene su valor histórico. Una inversión sólida para tu portafolio digital.";

export const getGoldMarketInsight = async (currentGramPrice: number) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Contexto: Eres un experto en finanzas. El precio actual del oro es $${currentGramPrice.toFixed(2)}/gramo. Explica por qué el token GLDC (respaldado por oro físico) es una excelente reserva de valor. Responde en español, tono profesional y optimista, máximo 20 palabras.`,
      config: {
        temperature: 0.6,
        topP: 0.8,
      }
    });

    const text = response.text?.trim();
    if (text) {
      lastSuccessfulInsight = text;
      return text;
    }
    return lastSuccessfulInsight;

  } catch (error: any) {
    console.warn("Gemini Service Insight Error:", error?.message || error);
    
    // Si es un error de cuota (429), devolvemos el último insight guardado sin asustar al usuario
    if (error?.message?.includes("429") || error?.status === 429) {
      return lastSuccessfulInsight;
    }

    return "El oro físico sigue siendo el activo refugio definitivo frente a la volatilidad de los mercados globales.";
  }
};

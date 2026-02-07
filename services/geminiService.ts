
import { GoogleGenAI } from "@google/genai";

let lastSuccessfulInsight = "El oro físico tokenizado ofrece una seguridad y liquidez inigualables en la era digital.";

export const getGoldMarketInsight = async (currentGramPrice: number) => {
  try {
    // IMPORTANTE: Crear la instancia justo antes del uso para capturar la API Key actualizada
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Eres un analista financiero. El precio del oro es $${currentGramPrice.toFixed(2)}/gramo. Comenta brevemente por qué el token GLDC respaldado por oro físico es superior a una moneda fiat en este momento. Máximo 18 palabras, español profesional.`,
      config: {
        temperature: 0.7,
        topP: 0.9,
      }
    });

    const text = response.text?.trim();
    if (text) {
      lastSuccessfulInsight = text;
      return text;
    }
    return lastSuccessfulInsight;

  } catch (error: any) {
    console.error("Gemini Error:", error?.message || error);
    
    // Propagamos el error de cuota para que la UI invite a poner una clave propia
    if (error?.message?.includes("429") || error?.status === 429) {
      throw new Error("429: RESOURCE_EXHAUSTED - Cuota de API excedida.");
    }

    return lastSuccessfulInsight;
  }
};

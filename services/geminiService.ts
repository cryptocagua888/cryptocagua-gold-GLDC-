
import { GoogleGenAI } from "@google/genai";

// Analysis function for gold market insights using Gemini
export const getGoldMarketInsight = async (currentGramPrice: number) => {
  try {
    // Initializing with process.env.API_KEY as per guidelines
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analiza brevemente el mercado del oro actual. Precio actual: $${currentGramPrice.toFixed(2)}/gramo. Explica por qué el token GLDC es ideal contra la inflación. Responde en español, máximo 3 líneas.`,
      config: {
        temperature: 0.7,
      }
    });

    return response.text || "Análisis de mercado estable para el oro.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "El oro mantiene su valor histórico. Una inversión sólida para tu portafolio digital.";
  }
};

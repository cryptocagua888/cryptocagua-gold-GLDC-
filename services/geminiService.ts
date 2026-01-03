
import { GoogleGenAI } from "@google/genai";

const getSafeApiKey = () => {
  try {
    return (typeof process !== 'undefined' && process.env) ? process.env.API_KEY : undefined;
  } catch {
    return undefined;
  }
};

export const getGoldMarketInsight = async (currentGramPrice: number) => {
  const apiKey = getSafeApiKey();
  
  if (!apiKey || apiKey === "undefined") {
    console.warn("API_KEY no detectada.");
    return "El oro es el refugio seguro por excelencia. GLDC te permite poseer oro físico con la liquidez de un token digital.";
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analiza brevemente el mercado del oro actual. Precio actual: $${currentGramPrice.toFixed(2)}/gramo. Explica por qué el token GLDC es ideal contra la inflación. Responde en español, máximo 3 líneas.`,
      config: {
        temperature: 0.7,
        maxOutputTokens: 200,
      }
    });

    return response.text || "Análisis de mercado estable para el oro.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "El oro mantiene su valor histórico. Una inversión sólida para tu portafolio digital.";
  }
};


import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getGoldMarketInsight = async (currentGramPrice: number) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analiza brevemente el mercado del oro actual considerando que el precio por gramo es de $${currentGramPrice.toFixed(2)}. Explica por qué el token GLDC (Cryptocagua Gold) es una buena reserva de valor frente a la inflación. Responde en español y de forma profesional para un inversionista.`,
      config: {
        temperature: 0.7,
        // When setting maxOutputTokens, include a thinkingBudget to reserve tokens for final generation
        maxOutputTokens: 500,
        thinkingConfig: { thinkingBudget: 100 },
      }
    });

    return response.text;
  } catch (error) {
    console.error("Error fetching Gemini insights:", error);
    return "No se pudo obtener el análisis en este momento. El oro sigue siendo una de las reservas más estables históricamente.";
  }
};


import { GoogleGenAI } from "@google/genai";

export const getMarketAnalysis = async (price: number) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analiza brevemente (15 palabras máximo) el valor del oro físico a $${price.toFixed(2)} USD/gramo como refugio patrimonial. Usa un tono institucional y sofisticado.`,
      config: { temperature: 0.5 }
    });
    return response.text?.trim() || "El oro físico tokenizado ofrece la máxima seguridad patrimonial en el ecosistema digital.";
  } catch (error: any) {
    console.error("AI Error:", error);
    if (error?.status === 429 || error?.message?.includes("429")) {
      return "Análisis técnico: El oro mantiene su canal alcista histórico, consolidándose como el activo de reserva definitivo.";
    }
    return "Cryptocagua Gold: Respaldo físico real, liquidez digital inmediata.";
  }
};

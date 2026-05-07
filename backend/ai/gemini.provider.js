import { GoogleGenAI } from '@google/genai';

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash-lite';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

function joinMessages(messages) {
  return messages.map(m => `${m.role}: ${m.content}`).join('\n');
}

export async function callGemini(messages) {
  const prompt = joinMessages(messages);
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt
  });

  return response.text;
}

// Función para streaming con Gemini
export async function streamGemini(messages, onChunk) {
  const prompt = joinMessages(messages);
  const response = await ai.models.generateContentStream({
    model: GEMINI_MODEL,
    contents: prompt
  });

  let finalText = '';
  for await (const chunk of response) {
    const chunkText = chunk.text;
    if (chunkText) {
      finalText += chunkText;
      if (onChunk) onChunk(chunkText);
    }
  }

  return finalText;
}


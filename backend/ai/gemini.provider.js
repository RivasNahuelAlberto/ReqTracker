import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Función para chat simple con Gemini
export async function callGemini(messages) {
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash"  // Modelo gratuito disponible
  });

  // Concatenamos mensajes al estilo Chat
  const prompt = messages.map(m => `${m.role}: ${m.content}`).join("\n");

  const result = await model.generateContent(prompt);

  return result.response.text();
}

// Función para streaming con Gemini
export async function streamGemini(messages, onChunk) {
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash"
  });

  const prompt = messages.map(m => `${m.role}: ${m.content}`).join("\n");

  const result = await model.generateContentStream(prompt);

  for await (const chunk of result.stream) {
    const chunkText = chunk.text();
    if (onChunk) onChunk(chunkText);
  }

  return result.response.text();
}

// Función con tools (function calling) - para agentes
export async function callGeminiWithTools(messages, tools) {
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    tools: tools.map(tool => ({
      functionDeclarations: [tool]
    }))
  });

  const chat = model.startChat({
    history: messages.slice(0, -1).map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }]
    }))
  });

  const result = await chat.sendMessage(messages[messages.length - 1].content);

  return {
    content: result.response.text(),
    functionCalls: result.response.functionCalls()
  };
}
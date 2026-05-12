import OpenAI from 'openai';

const apiKey = process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY;
const baseURL = process.env.OPENAI_API_KEY
  ? 'https://api.openai.com/v1'
  : process.env.OPENROUTER_API_BASE_URL || 'https://openrouter.ai/api/v1';

function createOpenAIClient() {
  if (!apiKey) {
    throw new Error('OpenAI o OpenRouter API key es requerida para generar embeddings.');
  }
  return new OpenAI({ apiKey, baseURL });
}

export async function generateEmbedding(text) {
  try {
    if (!text || !text.toString().trim()) {
      return [];
    }
    const openai = createOpenAIClient();
    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text.toString().trim(),
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

/**
 * Genera embedding para un símbolo basado en su nombre, notion e impact
 */
export async function generateSymbolEmbedding(symbol) {
  try {
    const textParts = [
      symbol.name || '',
      symbol.notion || '',
      symbol.impact || ''
    ].filter(part => part.toString().trim());
    
    if (textParts.length === 0) {
      return [];
    }
    
    const combinedText = textParts.join(' ');
    return await generateEmbedding(combinedText);
  } catch (error) {
    console.error('Error generating symbol embedding:', error);
    throw error;
  }
}

/**
 * Genera embedding para un requisito basado en su nombre y descripción
 */
export async function generateRequirementEmbedding(requirement) {
  try {
    const textParts = [
      requirement.name || '',
      requirement.description || '',
      requirement.basis || ''
    ].filter(part => part.toString().trim());
    
    if (textParts.length === 0) {
      return [];
    }
    
    const combinedText = textParts.join(' ');
    return await generateEmbedding(combinedText);
  } catch (error) {
    console.error('Error generating requirement embedding:', error);
    throw error;
  }
}

export function cosineSimilarity(vecA, vecB) {
  if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length === 0 || vecB.length === 0) {
    return 0;
  }
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const normA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const normB = Math.sqrt(vecB.reduce((sum, a) => sum + a * a, 0));
  return normA === 0 || normB === 0 ? 0 : dotProduct / (normA * normB);
}
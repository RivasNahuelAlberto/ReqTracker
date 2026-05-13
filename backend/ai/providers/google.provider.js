import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const PROVIDER_MODELS = {
  google: [
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-2.0-flash'
  ]
};

// Convert OpenAI-style tools to Gemini format
function convertToolsToGemini(tools) {
  console.log('Converting tools to Gemini format, input:', JSON.stringify(tools, null, 2));
  if (!tools || !Array.isArray(tools)) {
    console.log('No tools to convert');
    return undefined;
  }

  const functionDeclarations = tools.map(tool => {
    // Handle both OpenAI format and legacy format
    if (tool.type === 'function') {
      return {
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters
      };
    }
    // Handle legacy format (direct name/description/parameters)
    return {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    };
  });

  const result = {
    functionDeclarations
  };
  console.log('Converted tools result:', JSON.stringify(result, null, 2));
  return result;
}

// Convert OpenAI-style messages to Gemini format
function convertMessagesToGemini(messages) {
  console.log('Converting messages to Gemini format, input:', JSON.stringify(messages, null, 2));
  const result = messages.map(message => {
    const geminiMessage = {
      role: message.role,
      parts: []
    };

    if (message.content) {
      if (typeof message.content === 'string') {
        geminiMessage.parts.push({
          text: message.content
        });
      } else if (Array.isArray(message.content)) {
        // Handle array content (mixed text/images)
        message.content.forEach(content => {
          if (content.type === 'text') {
            geminiMessage.parts.push({
              text: content.text
            });
          }
          // Add other content types as needed
        });
      }
    }

    // Handle tool calls
    if (message.tool_calls) {
      geminiMessage.parts.push({
        functionCall: {
          name: message.tool_calls[0].function.name,
          args: JSON.parse(message.tool_calls[0].function.arguments || '{}')
        }
      });
    }

    // Handle tool results
    if (message.role === 'tool') {
      geminiMessage.role = 'user';
      geminiMessage.parts.push({
        functionResponse: {
          name: message.name,
          response: JSON.parse(message.content || '{}')
        }
      });
    }

    return geminiMessage;
  });
  console.log('Converted messages result:', JSON.stringify(result, null, 2));
  return result;
}

export async function generate({ model, prompt, context = {} }) {
  if (!PROVIDER_MODELS.google.includes(model)) {
    throw new Error(`Model ${model} is invalid for Google provider. Valid models: ${PROVIDER_MODELS.google.join(', ')}`);
  }

  const generativeModel = genAI.getGenerativeModel({ model });

  const result = await generativeModel.generateContent(prompt);
  const response = result.response;
  const text = response.text();

  return text;
}

export async function generateWithTools({ model, messages, tools, context = {} }) {
  console.log('GOOGLE PROVIDER CALLED with model:', model, 'tools length:', tools?.length);
  if (!PROVIDER_MODELS.google.includes(model)) {
    throw new Error(`Model ${model} is invalid for Google provider. Valid models: ${PROVIDER_MODELS.google.join(', ')}`);
  }

  console.log('Google provider - original tools:', JSON.stringify(tools, null, 2));
  const geminiTools = convertToolsToGemini(tools);
  console.log('Google provider - converted tools:', JSON.stringify(geminiTools, null, 2));
  const geminiMessages = convertMessagesToGemini(messages);
  console.log('Google provider - converted messages:', JSON.stringify(geminiMessages, null, 2));

  const generativeModel = genAI.getGenerativeModel({
    model,
    tools: geminiTools ? [geminiTools] : undefined
  });

  const result = await generativeModel.generateContent({
    contents: geminiMessages
  });

  return result;
}
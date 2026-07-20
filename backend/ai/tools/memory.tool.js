import { saveMemory as persistMemory } from '../memory.service.js';

export async function saveMemory({ userId, projectId, type, content, source = 'agent' }) {
  return await persistMemory({ userId, projectId, type, content, source });
}

import axios from 'axios';

const rawApiBase = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api';
const normalizedApiBase = rawApiBase.replace(/\/+$/, '').replace(/\/api$/i, '');

const api = axios.create({
  baseURL: `${normalizedApiBase}/api`
});

// Interceptor para agregar token JWT
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth functions
export const register = (username, email, password, projectHash = null) => {
  const payload = { username, email, password };
  if (projectHash) {
    payload.projectHash = projectHash;
  }
  return api.post('/auth/register', payload).then((res) => res.data);
};
export const login = (username, password) => api.post('/auth/login', { username, password }).then((res) => res.data);
export const verifyToken = () => api.get('/auth/verify').then((res) => res.data);

// AI functions
export const streamAIChat = (messages) => api.post('/ai/chat/stream', { messages }).then((res) => res.data);

export const fetchProjects = () => api.get('/projects').then((res) => res.data);
export const createProject = (name, seedSymbols, adminUsername, adminPassword) => api.post('/projects', { name, seedSymbols, adminUsername, adminPassword }).then((res) => res.data);
export const createProjectFromJson = (projectData) => api.post('/projects/import', projectData).then((res) => res.data);
export const setProjectSecurity = (projectId, securityCode) => api.put(`/projects/${projectId}/security`, { securityCode }).then((res) => res.data);
export const deleteProject = (projectId, securityCode) => api.delete(`/projects/${projectId}`, { data: { securityCode } }).then((res) => res.data);
export const fetchProject = (projectId) => api.get(`/projects/${projectId}`).then((res) => res.data);
export const fetchProjectExport = (projectId) => api.get(`/projects/${projectId}/export`).then((res) => res.data);
export const fetchProjectCode = (projectId) => api.get(`/projects/${projectId}/code`).then((res) => res.data);
export const fetchProjectUsers = (projectId) => api.get(`/projects/${projectId}/users`).then((res) => res.data);
export const fetchProjectNotificationsCount = (projectId) => api.get(`/projects/${projectId}/notifications/count`).then((res) => res.data);
export const fetchProjectNotifications = (projectId) => api.get(`/projects/${projectId}/notifications`).then((res) => res.data);
export const fetchSymbols = (projectId) => api.get(`/projects/${projectId}/symbols`).then((res) => res.data);
export const createSymbol = (projectId, symbol) => api.post(`/projects/${projectId}/symbols`, symbol).then((res) => res.data);
export const importSymbols = (projectId, symbols) => api.post(`/projects/${projectId}/symbols/import`, { symbols }).then((res) => res.data);
export const updateSymbol = (projectId, symbolId, updates) => api.put(`/projects/${projectId}/symbols/${symbolId}`, updates).then((res) => res.data);
export const deleteSymbol = (projectId, symbolId) => api.delete(`/projects/${projectId}/symbols/${symbolId}`).then((res) => res.data);
export const createResolveNote = (projectId, text) => api.post(`/projects/${projectId}/resolve-notes`, { text }).then((res) => res.data);
export const updateResolveNote = (projectId, noteId, text) => api.put(`/projects/${projectId}/resolve-notes/${noteId}`, { text }).then((res) => res.data);
export const resolveNote = (projectId, noteId) => api.patch(`/projects/${projectId}/resolve-notes/${noteId}/resolve`).then((res) => res.data);
export const deleteResolveNote = (projectId, noteId) => api.delete(`/projects/${projectId}/resolve-notes/${noteId}`).then((res) => res.data);
export const createScenario = (projectId, scenario) => api.post(`/projects/${projectId}/scenarios`, scenario).then((res) => res.data);
export const updateScenario = (projectId, scenarioId, updates) => api.put(`/projects/${projectId}/scenarios/${scenarioId}`, updates).then((res) => res.data);
export const deleteScenario = (projectId, scenarioId) => api.delete(`/projects/${projectId}/scenarios/${scenarioId}`).then((res) => res.data);
export const updateAbout = (projectId, aboutData) => api.patch(`/projects/${projectId}/about`, aboutData).then((res) => res.data);
export const lockItem = (projectId, lockData) => api.patch(`/projects/${projectId}/locks`, lockData).then((res) => res.data);
export const unlockItem = (projectId, unlockData) => api.delete(`/projects/${projectId}/locks`, { data: unlockData }).then((res) => res.data);
export const createTask = (projectId, taskData) => api.post(`/projects/${projectId}/tasks`, taskData).then((res) => res.data);
export const updateTask = (projectId, taskId, updates) => api.put(`/projects/${projectId}/tasks/${taskId}`, updates).then((res) => res.data);
export const deleteTask = (projectId, taskId) => api.delete(`/projects/${projectId}/tasks/${taskId}`).then((res) => res.data);
export const createInspection = (projectId, inspectionData) => api.post(`/projects/${projectId}/inspections`, inspectionData).then((res) => res.data);
export const updateInspection = (projectId, inspectionId, updates) => api.put(`/projects/${projectId}/inspections/${inspectionId}`, updates).then((res) => res.data);
export const deleteInspection = (projectId, inspectionId) => api.delete(`/projects/${projectId}/inspections/${inspectionId}`).then((res) => res.data);

// Role management functions
export const getUsers = () => api.get('/auth/users').then((res) => res.data);
export const assignRole = (username, role, projectId = null) => api.put('/auth/assign-role', { username, role, projectId }).then((res) => res.data);
export const removeUserProjectRole = (username, projectId) => api.delete('/auth/project-role', { data: { username, projectId } }).then((res) => res.data);
export const createUserInProject = (username, email, password, role, projectId) => api.post('/auth/create-user', { username, email, password, role, projectId }).then((res) => res.data);
export const createRequirement = (projectId, requirementData) => api.post(`/projects/${projectId}/requirements`, requirementData).then((res) => res.data);
export const updateRequirement = (projectId, requirementId, updates) => api.put(`/projects/${projectId}/requirements/${requirementId}`, updates).then((res) => res.data);
export const deleteRequirement = (projectId, requirementId) => api.delete(`/projects/${projectId}/requirements/${requirementId}`).then((res) => res.data);
export const createDocument = (projectId, documentData) => api.post(`/projects/${projectId}/documents`, documentData).then((res) => res.data);
export const updateDocument = (projectId, documentId, updates) => api.put(`/projects/${projectId}/documents/${documentId}`, updates).then((res) => res.data);
export const deleteDocument = (projectId, documentId) => api.delete(`/projects/${projectId}/documents/${documentId}`).then((res) => res.data);
export const generateProjectGraph = (projectId, threshold = 0.65) => api.post(`/projects/${projectId}/generate-graph`, { threshold }).then((res) => res.data);
export const regenerateProjectEmbeddings = (projectId, options = {}) => api.post(`/projects/${projectId}/regenerate-embeddings`, options).then((res) => res.data);
export const getRecommendations = (projectId, contextText, activeEntityId) => api.post('/ai/recommendations', { projectId, contextText, activeEntityId }).then((res) => res.data);
export const analyzeProjectHealth = (projectId) => api.post('/ai/health/analyze', { projectId }).then((res) => res.data);
export const fetchHealthIssues = (projectId) => api.get(`/ai/health/issues/${projectId}`).then((res) => res.data);
export const runAgent = (projectId, goal) => api.post('/ai/agent/run', { projectId, goal }).then((res) => res.data);

// Analytics functions
export const compareEntities = (entity1, entity2, projectId = null) => api.post('/analytics/compare-entities', { entity1Name: entity1, entity2Name: entity2, projectId }).then((res) => res.data);
export const analyzeText = (text, analysisType = 'entities', projectId = null) => api.post('/analytics/analyze-text', { text, analysis_type: analysisType, projectId }).then((res) => res.data);
export const generateEmbeddings = (texts, projectId = null) => api.post('/analytics/generate-embeddings', { texts, projectId }).then((res) => res.data);
export const compareRequirements = (requirement1, requirement2, projectId = null) => api.post('/analytics/compare-requirements', { requirement1, requirement2, projectId }).then((res) => res.data);
export const getAnalyticsHealth = () => api.get('/analytics/health').then((res) => res.data);
export const getAnalyticsInfo = () => api.get('/analytics/info').then((res) => res.data);
export const getAnalyticsHistory = (params = {}) => api.get('/analytics/history', { params }).then((res) => res.data);
export const getAnalyticsStats = () => api.get('/analytics/stats').then((res) => res.data);
export const cleanAnalyticsCache = () => api.post('/analytics/clean-cache').then((res) => res.data);

// Advanced AI/ML Analytics endpoints
export const qualityScore = (text, projectId = null) => api.post('/analytics/quality', { text, projectId }).then((res) => res.data);
export const similarityScore = (text1, text2, thresholdDuplicate = 0.85, projectId = null) => api.post('/analytics/similarity', { text1, text2, threshold_duplicate: thresholdDuplicate, projectId }).then((res) => res.data);
export const getRecommendations = (text, kNeighbors = 5, projectId = null) => api.post('/analytics/recommendation', { text, k_neighbors: kNeighbors, projectId }).then((res) => res.data);
export const predictImpact = (text, projectId = null) => api.post('/analytics/impact', { text, projectId }).then((res) => res.data);
export const checkConsistency = (requirements, projectId = null) => api.post('/analytics/consistency', { requirements, projectId }).then((res) => res.data);

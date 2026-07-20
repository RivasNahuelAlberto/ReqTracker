import axios from 'axios';

const rawApiBase = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api';
const normalizedApiBase = rawApiBase.replace(/\/+$/, '').replace(/\/api$/i, '');

const api = axios.create({
  baseURL: `${normalizedApiBase}/api`
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const login = (username: string, password: string) =>
  api.post('/auth/login', { username, password }).then((res) => res.data);

export const register = (username: string, email: string, password: string, projectHash: string | null = null) => {
  const payload: Record<string, unknown> = { username, email, password };
  if (projectHash) {
    payload.projectHash = projectHash;
  }
  return api.post('/auth/register', payload).then((res) => res.data);
};

export const verifyToken = () => api.get('/auth/verify').then((res) => res.data);

export const fetchProjects = () => api.get('/projects').then((res) => res.data);
export const createProject = (name: string, seedSymbols: Array<{name:string; type:string}>, adminUsername: string, adminPassword: string) =>
  api.post('/projects', { name, seedSymbols, adminUsername, adminPassword }).then((res) => res.data);
export const createProjectFromJson = (projectData: unknown) => api.post('/projects/import', projectData).then((res) => res.data);
export const setProjectSecurity = (projectId: string, securityCode: string) => api.put(`/projects/${projectId}/security`, { securityCode }).then((res) => res.data);
export const deleteProject = (projectId: string, securityCode: string) => api.delete(`/projects/${projectId}`, { data: { securityCode } }).then((res) => res.data);
export const fetchProjectCode = (projectId: string) => api.get(`/projects/${projectId}/code`).then((res) => res.data);
export const fetchProject = (projectId: string) => api.get(`/projects/${projectId}`).then((res) => res.data);
export const fetchProjectUsers = (projectId: string) => api.get(`/projects/${projectId}/users`).then((res) => res.data);
export const fetchProjectNotificationsCount = (projectId: string) => api.get(`/projects/${projectId}/notifications/count`).then((res) => res.data);
export const fetchProjectNotifications = (projectId: string) => api.get(`/projects/${projectId}/notifications`).then((res) => res.data);
export const fetchResolveNotes = (projectId: string) => api.get(`/projects/${projectId}/resolve-notes`).then((res) => res.data);
export const fetchSymbols = (projectId: string) => api.get(`/projects/${projectId}/symbols`).then((res) => res.data);
export const createSymbol = (projectId: string, symbol: Record<string, unknown>) => api.post(`/projects/${projectId}/symbols`, symbol).then((res) => res.data);
export const updateSymbol = (projectId: string, symbolId: string, updates: Record<string, unknown>) => api.put(`/projects/${projectId}/symbols/${symbolId}`, updates).then((res) => res.data);
export const deleteSymbol = (projectId: string, symbolId: string) => api.delete(`/projects/${projectId}/symbols/${symbolId}`).then((res) => res.data);
export const importSymbols = (projectId: string, symbols: unknown[]) => api.post(`/projects/${projectId}/symbols/import`, { symbols }).then((res) => res.data);
export const createScenario = (projectId: string, scenario: Record<string, unknown>) => api.post(`/projects/${projectId}/scenarios`, scenario).then((res) => res.data);
export const updateScenario = (projectId: string, scenarioId: string, updates: Record<string, unknown>) => api.put(`/projects/${projectId}/scenarios/${scenarioId}`, updates).then((res) => res.data);
export const deleteScenario = (projectId: string, scenarioId: string) => api.delete(`/projects/${projectId}/scenarios/${scenarioId}`).then((res) => res.data);
export const updateAbout = (projectId: string, aboutData: Record<string, unknown>) => api.patch(`/projects/${projectId}/about`, aboutData).then((res) => res.data);
export const createRequirement = (projectId: string, requirementData: Record<string, unknown>) => api.post(`/projects/${projectId}/requirements`, requirementData).then((res) => res.data);
export const updateRequirement = (projectId: string, requirementId: string, updates: Record<string, unknown>) => api.put(`/projects/${projectId}/requirements/${requirementId}`, updates).then((res) => res.data);
export const deleteRequirement = (projectId: string, requirementId: string) => api.delete(`/projects/${projectId}/requirements/${requirementId}`).then((res) => res.data);
export const createDocument = (projectId: string, documentData: Record<string, unknown>) => api.post(`/projects/${projectId}/documents`, documentData).then((res) => res.data);
export const updateDocument = (projectId: string, documentId: string, updates: Record<string, unknown>) => api.put(`/projects/${projectId}/documents/${documentId}`, updates).then((res) => res.data);
export const deleteDocument = (projectId: string, documentId: string) => api.delete(`/projects/${projectId}/documents/${documentId}`).then((res) => res.data);
export const createTask = (projectId: string, taskData: Record<string, unknown>) => api.post(`/projects/${projectId}/tasks`, taskData).then((res) => res.data);
export const updateTask = (projectId: string, taskId: string, updates: Record<string, unknown>) => api.put(`/projects/${projectId}/tasks/${taskId}`, updates).then((res) => res.data);
export const deleteTask = (projectId: string, taskId: string) => api.delete(`/projects/${projectId}/tasks/${taskId}`).then((res) => res.data);
export const createInspection = (projectId: string, inspectionData: Record<string, unknown>) => api.post(`/projects/${projectId}/inspections`, inspectionData).then((res) => res.data);
export const updateInspection = (projectId: string, inspectionId: string, updates: Record<string, unknown>) => api.put(`/projects/${projectId}/inspections/${inspectionId}`, updates).then((res) => res.data);
export const deleteInspection = (projectId: string, inspectionId: string) => api.delete(`/projects/${projectId}/inspections/${inspectionId}`).then((res) => res.data);
export const getUsers = () => api.get('/auth/users').then((res) => res.data);
export const assignRole = (username: string, role: string, projectId: string | null = null) => api.put('/auth/assign-role', { username, role, projectId }).then((res) => res.data);
export const removeUserProjectRole = (username: string, projectId: string) => api.delete('/auth/project-role', { data: { username, projectId } }).then((res) => res.data);
export const createUserInProject = (username: string, email: string, password: string, role: string, projectId: string) => api.post('/auth/create-user', { username, email, password, role, projectId }).then((res) => res.data);
export const streamAIChat = (messages: unknown[]) => api.post('/ai/chat/stream', { messages }).then((res) => res.data);
export const analyzeProjectHealth = (projectId: string) => api.post('/ai/health/analyze', { projectId }).then((res) => res.data);
export const fetchHealthIssues = (projectId: string) => api.get(`/ai/health/issues/${projectId}`).then((res) => res.data);
export const runAgent = (projectId: string, goal: string) => api.post('/ai/agent/run', { projectId, goal }).then((res) => res.data);
export const getAnalyticsDashboard = (projectId: string, params = {}) => api.get(`/analytics/dashboard/${projectId}`, { params }).then((res) => res.data);
export const getAnalyticsGraph = (projectId: string, params = {}) => api.get(`/analytics/graph/${projectId}`, { params }).then((res) => res.data);
export const getAnalyticsRisk = (projectId: string, params = {}) => api.get(`/analytics/risk/${projectId}`, { params }).then((res) => res.data);
export const getRecommendations = (projectId: string, contextText = '', activeEntityId = '') => api.post('/ai/recommendations', { projectId, contextText, activeEntityId }).then((res) => res.data);
export const createResolveNote = (projectId: string, text: string) => api.post(`/projects/${projectId}/resolve-notes`, { text }).then((res) => res.data);
export const updateResolveNote = (projectId: string, noteId: string, text: string) => api.put(`/projects/${projectId}/resolve-notes/${noteId}`, { text }).then((res) => res.data);
export const resolveResolveNote = (projectId: string, noteId: string) => api.patch(`/projects/${projectId}/resolve-notes/${noteId}/resolve`).then((res) => res.data);
export const deleteResolveNote = (projectId: string, noteId: string) => api.delete(`/projects/${projectId}/resolve-notes/${noteId}`).then((res) => res.data);
export const getAnalyticsSemantic = (projectId: string, params = {}) => api.get(`/analytics/semantic/${projectId}`, { params }).then((res) => res.data);

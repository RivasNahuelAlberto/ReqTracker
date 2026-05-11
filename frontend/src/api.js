import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || 'http://localhost:4000/api'
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
export const fetchSymbols = (projectId) => api.get(`/projects/${projectId}/symbols`).then((res) => res.data);
export const createSymbol = (projectId, symbol) => api.post(`/projects/${projectId}/symbols`, symbol).then((res) => res.data);
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

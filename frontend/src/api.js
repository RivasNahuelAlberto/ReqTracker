import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || 'http://localhost:4000/api'
});

export const fetchProjects = () => api.get('/projects').then((res) => res.data);
export const createProject = (name, seedSymbols, securityCode) => api.post('/projects', { name, seedSymbols, securityCode }).then((res) => res.data);
export const setProjectSecurity = (projectId, securityCode) => api.put(`/projects/${projectId}/security`, { securityCode }).then((res) => res.data);
export const deleteProject = (projectId, securityCode) => api.delete(`/projects/${projectId}`, { data: { securityCode } }).then((res) => res.data);
export const fetchProject = (projectId) => api.get(`/projects/${projectId}`).then((res) => res.data);
export const fetchSymbols = (projectId) => api.get(`/projects/${projectId}/symbols`).then((res) => res.data);
export const createSymbol = (projectId, symbol) => api.post(`/projects/${projectId}/symbols`, symbol).then((res) => res.data);
export const updateSymbol = (projectId, symbolId, updates) => api.put(`/projects/${projectId}/symbols/${symbolId}`, updates).then((res) => res.data);
export const deleteSymbol = (projectId, symbolId) => api.delete(`/projects/${projectId}/symbols/${symbolId}`).then((res) => res.data);

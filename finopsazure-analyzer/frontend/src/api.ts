import axios from 'axios';
import type {
  AnalysisRun,
  AnalysisSummary,
  ChatMessage,
  ChatResponse,
  Connection,
  ConnectionCreate,
  ValidationResult,
} from './types';

// Empty base => same-origin; nginx proxies /api to the backend in the container.
const baseURL = import.meta.env.VITE_API_BASE_URL || '';

export const http = axios.create({ baseURL, timeout: 120000 });

export const api = {
  health: () => http.get('/api/health').then((r) => r.data),
  version: () => http.get('/api/version').then((r) => r.data),

  // Connections
  listConnections: () => http.get<Connection[]>('/api/config/connections').then((r) => r.data),
  createConnection: (payload: ConnectionCreate) =>
    http.post<Connection>('/api/config/connections', payload).then((r) => r.data),
  updateConnection: (id: string, payload: Partial<ConnectionCreate>) =>
    http.put<Connection>(`/api/config/connections/${id}`, payload).then((r) => r.data),
  deleteConnection: (id: string) => http.delete(`/api/config/connections/${id}`),
  rotateSecret: (id: string, clientSecret: string) =>
    http.post<Connection>(`/api/config/connections/${id}/rotate-secret`, { clientSecret }).then((r) => r.data),
  validateConnection: (id: string) =>
    http.post<ValidationResult>(`/api/config/connections/${id}/validate`).then((r) => r.data),

  // Analysis
  runAnalysis: (payload: { connectionId: string; subscriptionIds?: string[]; dateFrom?: string; dateTo?: string }) =>
    http.post<AnalysisRun>('/api/analysis/run', payload).then((r) => r.data),
  listRuns: () => http.get<AnalysisRun[]>('/api/analysis/runs').then((r) => r.data),
  getRun: (id: string) => http.get<AnalysisRun>(`/api/analysis/runs/${id}`).then((r) => r.data),
  getSummary: (id: string) => http.get<AnalysisSummary>(`/api/analysis/runs/${id}/summary`).then((r) => r.data),
  getCosts: (id: string) => http.get(`/api/analysis/runs/${id}/costs`).then((r) => r.data),
  getResources: (id: string) => http.get(`/api/analysis/runs/${id}/resources`).then((r) => r.data),
  getRecommendations: (id: string) => http.get(`/api/analysis/runs/${id}/recommendations`).then((r) => r.data),
  getAiSummary: (id: string) => http.get(`/api/analysis/runs/${id}/ai-summary`).then((r) => r.data),

  // Chat
  chat: (payload: { connectionId: string; message: string; history: ChatMessage[] }) =>
    http.post<ChatResponse>('/api/chat', payload).then((r) => r.data),
};

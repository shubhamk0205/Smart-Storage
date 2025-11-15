import axios from 'axios';
import type { StagingFile, MediaAsset, Dataset, JsonProfile, Job, DetectionResult, MediaMetadata } from '../types';

// Base URL will be set dynamically from settings context
const getBaseURL = () => {
  const saved = localStorage.getItem('appSettings');
  if (saved) {
    const settings = JSON.parse(saved);
    return settings.apiBaseUrl || import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
  }
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
};

const api = axios.create({
  baseURL: getBaseURL(),
});

// Update base URL when settings change
export const updateApiBaseURL = (url: string) => {
  api.defaults.baseURL = url;
};

// Upload
export const uploadFile = async (file: File, datasetName?: string, autoProcess: boolean = true): Promise<StagingFile> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('autoProcess', String(autoProcess)); // Always send autoProcess (default: true)
  if (datasetName) {
    formData.append('datasetName', datasetName);
  }
  const response = await api.post('/ingest/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

// Staging
export const getStagingFiles = async (): Promise<StagingFile[]> => {
  const response = await api.get('/ingest/staging');
  return response.data;
};

export const detectAndClassify = async (stagingId: string): Promise<DetectionResult> => {
  const response = await api.post(`/ingest/detect/${stagingId}`);
  return response.data;
};

export const deleteStagingFile = async (stagingId: string): Promise<void> => {
  await api.delete(`/ingest/staging/${stagingId}`);
};

// Media Processing
export const processMedia = async (stagingId: string, destinationKey?: string): Promise<MediaAsset> => {
  const response = await api.post(`/ingest/process-media/${stagingId}`, { destinationKey });
  return response.data;
};

// JSON Processing
export const processJson = async (stagingId: string, datasetName?: string): Promise<{ dataset: Dataset; profile: JsonProfile }> => {
  const response = await api.post(`/ingest/process-json/${stagingId}`, { datasetName });
  return response.data;
};

export const getJsonProfile = async (stagingId: string): Promise<JsonProfile> => {
  const response = await api.get(`/ingest/json-profile/${stagingId}`);
  return response.data;
};

// Datasets
export const getDatasets = async (backend?: string): Promise<Dataset[]> => {
  const params = backend ? { backend } : {};
  const response = await api.get('/datasets', { params });
  return response.data;
};

export const getDataset = async (name: string): Promise<Dataset> => {
  const response = await api.get(`/datasets/${name}`);
  return response.data;
};

// Retrieval
export const retrieve = async (params: {
  dataset: string;
  entity: string;
  filter?: Record<string, any>;
  fields?: string[];
  include?: Record<string, any>;
  limit?: number;
  offset?: number;
}): Promise<any[]> => {
  const response = await api.post('/retrieve', params);
  return response.data;
};

// Media
export const getMediaAssets = async (params?: {
  mime_type?: string;
  original_filename?: string;
  sha256?: string;
  date_from?: string;
  date_to?: string;
}): Promise<MediaAsset[]> => {
  const response = await api.get('/media', { params });
  return response.data;
};

export const getMediaAsset = async (id: string): Promise<MediaAsset> => {
  const response = await api.get(`/media/${id}`);
  return response.data;
};

// Logs & Jobs
export const getJobs = async (): Promise<Job[]> => {
  const response = await api.get('/jobs');
  return response.data;
};

export const getJob = async (id: string): Promise<Job> => {
  const response = await api.get(`/jobs/${id}`);
  return response.data;
};

export const retryJob = async (id: string): Promise<Job> => {
  const response = await api.post(`/jobs/${id}/retry`);
  return response.data;
};

// Settings
export const getHealth = async (): Promise<{ status: string; postgres?: boolean; mongo?: boolean }> => {
  const response = await api.get('/health');
  return response.data;
};

export default api;


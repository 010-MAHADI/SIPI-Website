// API utility functions with environment-based configuration

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://54.169.101.239/api';

export const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
  };

  const token = localStorage.getItem('token');
  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  const config: RequestInit = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, config);
    return response;
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
};

export const apiGet = (endpoint: string) => apiRequest(endpoint, { method: 'GET' });
export const apiPost = (endpoint: string, data: any) => 
  apiRequest(endpoint, { method: 'POST', body: JSON.stringify(data) });
export const apiPut = (endpoint: string, data: any) => 
  apiRequest(endpoint, { method: 'PUT', body: JSON.stringify(data) });
export const apiDelete = (endpoint: string) => apiRequest(endpoint, { method: 'DELETE' });

export { API_BASE_URL };
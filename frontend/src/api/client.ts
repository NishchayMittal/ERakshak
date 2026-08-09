import axios from 'axios';

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';
export const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 45000,
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
    return Promise.reject(error);
  }
);

export const isMockMode = () => USE_MOCKS;
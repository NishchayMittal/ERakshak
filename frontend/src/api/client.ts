import axios from 'axios';

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';
const BASE_URL = import.meta.env.VITE_API_BASE_URL;

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
});

export const isMockMode = () => USE_MOCKS;
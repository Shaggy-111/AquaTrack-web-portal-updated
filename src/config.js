// src/config.js
const ENVIRONMENT = import.meta.env.MODE || 'development';

export const API_BASE_URL =
  ENVIRONMENT === 'production'
    ? 'https://aquatrack-backend.fly.dev'  // ✅ Production backend
    : 'http://localhost:8000';              // ✅ Local backend

export const APP_ENV = ENVIRONMENT;

console.log(`🔧 Running in ${ENVIRONMENT} mode — API Base URL: ${API_BASE_URL}`);

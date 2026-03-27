// API Configuration
// Uses VITE_API_BASE_URL environment variable (set in frontend/.env or docker build arg)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export default API_BASE_URL;

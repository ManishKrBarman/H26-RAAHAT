// API Configuration
// Uses VITE_API_BASE_URL environment variable, defaults to localhost:3000
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export default API_BASE_URL;

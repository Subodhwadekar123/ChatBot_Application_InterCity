/**
 * API Base URL Resolver
 * Handles custom runtime URL (localStorage), VITE_API_URL, and local dev proxy (/api/v1).
 */

export const getApiBaseUrl = (): string => {
  // 1. Check runtime localStorage override (useful for live Vercel deployments)
  const customUrl = typeof window !== 'undefined' ? localStorage.getItem('custom_api_url') : null;
  if (customUrl && customUrl.trim() !== '') {
    const clean = customUrl.trim().replace(/\/+$/, '');
    return clean.endsWith('/api/v1') ? clean : `${clean}/api/v1`;
  }

  // 2. Check build-time environment variable
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && envUrl.trim() !== '') {
    const clean = envUrl.trim().replace(/\/+$/, '');
    return clean.endsWith('/api/v1') ? clean : `${clean}/api/v1`;
  }

  // 3. If running in browser on a production domain (like Vercel), fallback to deployed backend
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return 'https://datamind-backend-tmql.onrender.com/api/v1';
    }
  }

  // 4. Local development proxy
  return '/api/v1';
};

export const setCustomApiUrl = (url: string | null): void => {
  if (!url || url.trim() === '') {
    localStorage.removeItem('custom_api_url');
  } else {
    localStorage.setItem('custom_api_url', url.trim());
  }
};


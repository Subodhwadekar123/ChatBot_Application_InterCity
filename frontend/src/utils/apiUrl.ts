/**
 * API Base URL Resolver
 * Handles custom runtime URL (localStorage), VITE_API_URL, and local dev proxy (/api/v1).
 */

export const getApiBaseUrl = (): string => {
  // 1. Check runtime localStorage override (useful for live Vercel deployments)
  const customUrl = typeof window !== 'undefined' ? localStorage.getItem('custom_api_url') : null;
  const targetUrl = (customUrl && customUrl.trim() !== '') ? customUrl : import.meta.env.VITE_API_URL;

  if (!targetUrl || targetUrl.trim() === '') {
    return '/api/v1';
  }
  const clean = targetUrl.trim().replace(/\/+$/, '');
  if (!clean.endsWith('/api/v1')) {
    return `${clean}/api/v1`;
  }
  return clean;
};

export const setCustomApiUrl = (url: string | null): void => {
  if (!url || url.trim() === '') {
    localStorage.removeItem('custom_api_url');
  } else {
    localStorage.setItem('custom_api_url', url.trim());
  }
};


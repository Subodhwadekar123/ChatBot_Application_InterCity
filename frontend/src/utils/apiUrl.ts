/**
 * API Base URL Resolver
 * Handles local dev proxy (/api/v1) and custom VITE_API_URL values reliably.
 */

export const getApiBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (!envUrl || envUrl.trim() === '') {
    return '/api/v1';
  }
  const clean = envUrl.trim().replace(/\/+$/, '');
  if (!clean.endsWith('/api/v1')) {
    return `${clean}/api/v1`;
  }
  return clean;
};

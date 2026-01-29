// Simple auth utilities for Silcon Ambiental
// Uses cookie-based session management

const AUTH_COOKIE_NAME = 'silcon_auth';
const AUTH_SECRET = 'silcon_authenticated_2024';

export function setAuthCookie(): void {
  if (typeof window !== 'undefined') {
    // Set cookie that expires in 24 hours
    const expires = new Date();
    expires.setTime(expires.getTime() + 24 * 60 * 60 * 1000);
    document.cookie = `${AUTH_COOKIE_NAME}=${AUTH_SECRET}; expires=${expires.toUTCString()}; path=/; SameSite=Strict`;
  }
}

export function removeAuthCookie(): void {
  if (typeof window !== 'undefined') {
    document.cookie = `${AUTH_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
  }
}

export function isAuthenticated(): boolean {
  if (typeof window !== 'undefined') {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === AUTH_COOKIE_NAME && value === AUTH_SECRET) {
        return true;
      }
    }
  }
  return false;
}

export function getAuthCookieFromRequest(cookieHeader: string | null): boolean {
  if (!cookieHeader) return false;
  const cookies = cookieHeader.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === AUTH_COOKIE_NAME && value === AUTH_SECRET) {
      return true;
    }
  }
  return false;
}

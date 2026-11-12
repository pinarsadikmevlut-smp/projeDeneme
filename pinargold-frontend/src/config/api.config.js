// VITE_ variables are PUBLIC build-time configuration. Never put secrets here.
const base = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
export const apiConfig = Object.freeze({
  baseUrl: base,
  wsUrl: import.meta.env.VITE_WS_URL || '',
  timeoutMs: Number(import.meta.env.VITE_API_TIMEOUT_MS || 10000),
  marketMode: import.meta.env.VITE_MARKET_MODE || 'simulation'
});

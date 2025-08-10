import axios from 'axios'

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: {
    'Authorization': `${process.env.NEXT_PUBLIC_API_KEY}`,
    'Content-Type': 'application/json',
  },
  withCredentials: true // opcional, se o backend usar cookies de sessão
})
api.interceptors.response.use(
  r => r,
  err => {
    const s = err?.response?.status;
    const d = err?.response?.data;
    console.error('[API ERROR]', err?.config?.method?.toUpperCase(), err?.config?.url, s, d);
    return Promise.reject(err);
  }
);
import axios from 'axios'

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: {
    'x-api-key': `${process.env.NEXT_PUBLIC_API_KEY}`,
    'Content-Type': 'application/json',
  },
  withCredentials: true
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
import axios from 'axios'

// Autenticação é por cookie httpOnly (withCredentials), não por API key.
//
// O header 'x-api-key' foi removido: variáveis NEXT_PUBLIC_* são inlinadas no bundle
// no build, então a chave ficava legível no JS servido a qualquer visitante. Era a
// mesma chave que o backend valida em checkApiKey, o que deixava rotas de sistema
// alcançáveis por anônimos. Nenhuma página do dashboard consome rota protegida por
// API key — todas usam o cookie de sessão.
export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: {
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
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

// Rotas que rodam sem sessão. Um 401 nelas significa "credencial errada",
// não "sessão expirada" — a própria tela trata o erro.
const PUBLIC_AUTH_ROUTES = [
  '/auth/login',
  '/auth/logout',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/first-access/change-password',
]

// Página de login. O query param `expired` faz duas coisas: a tela mostra o aviso
// "sessão expirada" e o middleware não manda o usuário de volta pro /dashboard
// mesmo que o cookie `token` (já inválido) ainda esteja no browser.
export const LOGIN_PATH = '/'
export const SESSION_EXPIRED_QUERY = 'expired'

let redirecting = false

/**
 * Sessão expirada/inválida: limpa o cookie no backend (best effort) e manda pro login.
 * Idempotente — várias requisições falhando ao mesmo tempo geram um único redirect.
 * Usar também nos lugares que fazem `fetch` puro fora da instância axios.
 */
export function handleUnauthorized() {
  if (typeof window === 'undefined' || redirecting) return
  redirecting = true

  const target = `${LOGIN_PATH}?${SESSION_EXPIRED_QUERY}=1`
  const go = () => window.location.assign(target)

  // axios "cru" para não passar pelo interceptor abaixo e recursar.
  axios
    .post(`${process.env.NEXT_PUBLIC_API_URL}/auth/logout`, null, { withCredentials: true })
    .catch(() => undefined)
    .finally(go)
}

function isPublicAuthRoute(url?: string) {
  if (!url) return false
  return PUBLIC_AUTH_ROUTES.some(route => url.startsWith(route))
}

api.interceptors.response.use(
  r => r,
  err => {
    const s = err?.response?.status;
    const d = err?.response?.data;
    console.error('[API ERROR]', err?.config?.method?.toUpperCase(), err?.config?.url, s, d);

    // JWT expirou (vale 1h) ou cookie sumiu: o backend responde 401 em qualquer
    // rota protegida. Sem isso o usuário ficava na tela com ações falhando em silêncio.
    if (s === 401 && !isPublicAuthRoute(err?.config?.url)) {
      handleUnauthorized()
    }

    return Promise.reject(err);
  }
);

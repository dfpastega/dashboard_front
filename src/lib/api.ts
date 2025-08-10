import axios from 'axios'

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: {
    'Authorization': `${process.env.NEXT_PUBLIC_API_KEY}`,
    'Content-Type': 'application/json',
  },
  withCredentials: true // opcional, se o backend usar cookies de sessão
})

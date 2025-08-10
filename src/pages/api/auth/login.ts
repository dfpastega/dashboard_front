// src/pages/api/auth/login.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import axios from 'axios'
import cookie from 'cookie'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const response = await axios.post(
      `${process.env.NEXT_PUBLIC_API_URL}/auth/login`,
      req.body,
      {
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    )

    const { token } = response.data

    // Armazena o JWT em um cookie httpOnly
    res.setHeader('Set-Cookie', cookie.serialize('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24, // 1 dia
      path: '/',
      sameSite: 'lax'
    }))

    return res.status(200).json({ success: true })
  } catch (err: any) {
    return res.status(401).json({ error: 'Credenciais inválidas' })
  }
}

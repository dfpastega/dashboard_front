// src/app/layout.tsx
import './globals.css'
import { Inter } from 'next/font/google'
import { cn } from '@/lib/utils'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Dashboard Storm',
  description: 'Sistema STORM',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' }, // pega do /public
    ],
    shortcut: ['/favicon.ico'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className="dark">
      <body className={cn(inter.className, 'bg-background text-foreground')}>
        {children}
      </body>
    </html>
  )
}

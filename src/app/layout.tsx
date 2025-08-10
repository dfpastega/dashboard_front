// src/app/layout.tsx
import './globals.css'
import { Inter } from 'next/font/google'
import { cn } from '@/lib/utils'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Dashboard Storm',
  description: 'Sistema com login e dashboard embedado do Metabase',
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

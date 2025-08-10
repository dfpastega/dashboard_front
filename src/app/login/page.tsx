// src/app/login/page.tsx
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardContent className="space-y-4 mt-4">
          <h1 className="text-xl font-bold">Login</h1>
          <Button className="w-full">Entrar com Google</Button>
        </CardContent>
      </Card>
    </main>
  )
}

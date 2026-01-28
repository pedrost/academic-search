import Link from 'next/link'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-8">
              <Link href="/admin" className="text-xl font-bold">
                Painel Administrativo
              </Link>
              <div className="flex gap-4">
                <Link
                  href="/admin"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Dashboard
                </Link>
                <Link
                  href="/admin/browser"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Browser
                </Link>
              </div>
            </div>
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
              ← Voltar à busca
            </Link>
          </div>
        </div>
      </nav>
      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>
  )
}

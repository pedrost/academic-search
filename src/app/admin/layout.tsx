import Link from 'next/link'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen">
      <nav className="border-b border-white/5 bg-[#13141c]">
        <div className="container mx-auto px-4">
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center gap-8">
              <Link href="/admin" className="text-base font-bold text-gray-200 font-mono">
                admin
              </Link>
              <div className="flex gap-4">
                <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
                  Dashboard
                </Link>
                <Link href="/admin/workers" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
                  Workers
                </Link>
                <Link href="/admin/browser" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
                  Browser
                </Link>
              </div>
            </div>
            <Link href="/" className="text-sm text-gray-600 hover:text-gray-400 transition-colors">
              ← busca
            </Link>
          </div>
        </div>
      </nav>
      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>
  )
}

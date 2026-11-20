import './globals.css'
import './admin/admin.css'
import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Eazyloan', description: 'Simple, responsible loan applications.' }
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body>{children}</body></html> }

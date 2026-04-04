import type { Metadata } from 'next'
import './globals.css'
import ChatWidget from '@/components/chat/ChatWidget'

export const metadata: Metadata = {
  title: 'Lipno Hideaway',
  description: 'Lipno',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs">
      <body>
        {children}
        <ChatWidget />
      </body>
    </html>
  )
}
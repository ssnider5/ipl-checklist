import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'IPL Checklist',
  description: 'Demo IPL plan execution',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="app-bg min-h-screen">{children}</body>
    </html>
  );
}

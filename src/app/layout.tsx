import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from 'react-hot-toast';
import Navigation from '@/components/Navigation';

export const metadata: Metadata = {
  title: 'Innago PO Outreach',
  description: 'Property Owner Outreach Automation System',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#F8F9FB]">
        <div className="flex h-screen overflow-hidden">
          <Navigation />
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
        <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
      </body>
    </html>
  );
}

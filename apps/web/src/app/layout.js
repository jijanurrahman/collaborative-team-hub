import { Inter } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from 'next-themes';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata = {
  title: { default: 'Team Hub', template: '%s | Team Hub' },
  description: 'Collaborative Team Hub — manage goals, announcements, and action items in real time.',
  keywords: ['team', 'collaboration', 'goals', 'project management'],
};

export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: '500',
              },
              success: { style: { background: '#22c55e', color: '#fff' } },
              error: { style: { background: '#ef4444', color: '#fff' } },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}

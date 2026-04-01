import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Wysa for Teams',
  description: 'Performance infrastructure for your team',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Shotclock Platform',
  description: 'Sports Scoreboard & Display Management System',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MeetMate Admin',
  description: 'MeetMate 관리자 패널',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

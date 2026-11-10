import type { Metadata } from 'next';
import { Barlow, Barlow_Condensed, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

const body = Barlow({ variable: '--f-body', subsets: ['latin'], weight: ['400', '500', '600', '700'] });
const display = Barlow_Condensed({ variable: '--f-display', subsets: ['latin'], weight: ['500', '600', '700'] });
const mono = IBM_Plex_Mono({ variable: '--f-mono', subsets: ['latin'], weight: ['400', '500'] });

export const metadata: Metadata = {
  title: 'FleetAudit',
  description: 'Driver qualification file compliance for motor carriers',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}

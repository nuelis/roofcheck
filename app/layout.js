import './globals.css';
import { Barlow_Condensed, Public_Sans } from 'next/font/google';

const display = Barlow_Condensed({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-display' });
const body = Public_Sans({ subsets: ['latin'], variable: '--font-body' });

export const metadata = {
  title: 'RoofCheck: find what the carrier left off',
  description: 'Upload an insurance roofing estimate. See the missing line items and get a supplement letter draft.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}

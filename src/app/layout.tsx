import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Fonts are bundled in the repo (variable-weight, Latin subset, SIL Open Font
// License) so builds never depend on fetching from Google Fonts.
const montserrat = localFont({
  src: "./fonts/montserrat-latin-wght-normal.woff2",
  variable: "--font-montserrat",
  display: "swap",
  weight: "100 900",
});

const openSans = localFont({
  src: "./fonts/open-sans-latin-wght-normal.woff2",
  variable: "--font-opensans",
  display: "swap",
  weight: "300 800",
});

export const metadata: Metadata = {
  title: "NZCC Portal",
  description: "New Zealand College of Chiropractic — Applicant Portal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${montserrat.variable} ${openSans.variable} h-full`}>
      <body className="h-full antialiased">{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import { Figtree, Fraunces } from "next/font/google";
import { currentUser, readLocale } from "@/lib/session";
import "./globals.css";

const sans = Figtree({ subsets: ["latin"], variable: "--font-sans" });
const serif = Fraunces({ subsets: ["latin"], variable: "--font-serif" });

export const metadata: Metadata = {
  title: { default: "Rent Right", template: "%s · Rent Right" },
  description: "Free records and general legal information for Los Angeles and San Diego renters. Not a law firm.",
  applicationName: "Rent Right",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  const locale = user?.locale || (await readLocale());
  return (
    <html lang={locale}>
      <body data-lite={user?.lowBandwidth ? "1" : "0"} className={`${sans.variable} ${serif.variable} font-sans antialiased`}>
        <a className="skip" href="#main">Skip to content</a>
        {children}
      </body>
    </html>
  );
}

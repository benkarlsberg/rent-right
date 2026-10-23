import type { Metadata, Viewport } from "next";
import { Figtree, Fraunces } from "next/font/google";
import { SHARE_DESCRIPTION, SHARE_IMAGE, SHARE_IMAGE_ALT, SHARE_TITLE, SHARE_URL } from "@/lib/share-meta";
import { currentUser, readLocale } from "@/lib/session";
import "./globals.css";

const sans = Figtree({ subsets: ["latin"], variable: "--font-sans" });
const serif = Fraunces({ subsets: ["latin"], variable: "--font-serif" });

export const metadata: Metadata = {
  metadataBase: new URL(SHARE_URL),
  title: { default: "Rent Right", template: "%s · Rent Right" },
  description: SHARE_DESCRIPTION,
  applicationName: "Rent Right",
  alternates: { canonical: SHARE_URL },
  openGraph: {
    title: SHARE_TITLE,
    description: SHARE_DESCRIPTION,
    type: "website",
    url: SHARE_URL,
    siteName: "Rent Right",
    images: [{ url: SHARE_IMAGE, width: 1200, height: 630, alt: SHARE_IMAGE_ALT }],
  },
  twitter: {
    card: "summary_large_image",
    title: SHARE_TITLE,
    description: SHARE_DESCRIPTION,
    images: [SHARE_IMAGE],
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico?v=2", sizes: "any" },
      { url: "/favicon-32x32.png?v=2", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png?v=2", sizes: "16x16", type: "image/png" },
      { url: "/favicon.svg?v=2", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png?v=3", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0B5C6E",
  colorScheme: "light",
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

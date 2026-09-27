import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sahi — is this actually a good price?",
  description: "Check an online price against its own history before you buy. Sahi shows what you'll pay, what the product typically sells for, and how much history backs every claim.",
  manifest: "/manifest.json",
  keywords: ["price history India", "price tracker", "Amazon price history", "Flipkart price history", "lowest price"],
  openGraph: {
    title: "Sahi — is this actually a good price?",
    description: "What you'll pay, what it typically sells for, and the price history behind it.",
    type: "website",
    locale: "en_IN",
  },
  twitter: {
    card: "summary",
    title: "Sahi — is this actually a good price?",
    description: "What you'll pay, what it typically sells for, and the price history behind it.",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Sahi",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#FBFBFA",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png"/>
      </head>
      <body>
        {children}
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js').catch(function(){});
            });
          }
        `}}/>
      </body>
    </html>
  );
}

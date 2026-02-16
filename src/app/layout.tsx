import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WattsWay | AI-Powered Tesla Trip Planner",
  description:
    "Plan your Tesla road trip with optimal Supercharger stops, real-time charging estimates, and an AI copilot powered by Grok to find food, fun, and hidden gems along your route.",
  keywords: [
    "Tesla",
    "trip planner",
    "EV route planner",
    "Supercharger",
    "road trip",
    "electric vehicle",
    "charging stops",
    "Tesla Model 3",
    "Tesla Model Y",
    "Tesla Model S",
    "Tesla Model X",
    "Cybertruck",
    "WattsWay",
  ],
  authors: [{ name: "WattsWay", url: "https://x.com/wattwayai" }],
  creator: "WattsWay",
  metadataBase: new URL("https://wattsway.com"),
  openGraph: {
    type: "website",
    title: "WattsWay | AI-Powered Tesla Trip Planner",
    description:
      "Plan your Tesla road trip with optimal Supercharger stops and an AI copilot powered by Grok to find food, fun, and hidden gems along your route.",
    siteName: "WattsWay",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "WattsWay — AI-Powered Tesla Trip Planner" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@wattwayai",
    creator: "@wattwayai",
    title: "WattsWay | AI-Powered Tesla Trip Planner",
    description:
      "Plan your Tesla road trip with optimal Supercharger stops and an AI copilot powered by Grok.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: [
      { url: "/logo-dark.svg", media: "(prefers-color-scheme: dark)" },
      { url: "/logo-light.svg", media: "(prefers-color-scheme: light)" },
    ],
    apple: "/logo-dark.svg",
  },
  applicationName: "WattsWay",
  appleWebApp: {
    capable: true,
    title: "WattsWay",
    statusBarStyle: "black-translucent",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#09090b" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { Chakra_Petch, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

/** Technical display face for labels, breadcrumb and headings. */
const display = Chakra_Petch({
  variable: "--font-aurora-display",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

/** Tabular monospace for the clock + date readouts (no width jitter). */
const mono = IBM_Plex_Mono({
  variable: "--font-aurora-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Aurora — Real-Time 3D World",
  description:
    "An interactive, cinematic 3D globe. Drill from world to country, region and city while a live world clock tracks local time in every place you visit.",
  applicationName: "Aurora",
  authors: [{ name: "Aurora" }],
  keywords: ["3D globe", "world clock", "timezones", "interactive map", "WebGL"],
};

export const viewport: Viewport = {
  themeColor: "#04060d",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${mono.variable} antialiased`}
    >
      <body>{children}</body>
    </html>
  );
}

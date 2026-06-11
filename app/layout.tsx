import type { Metadata, Viewport } from "next";
import { Pridi } from "next/font/google";
import { SharedStoreSync } from "@/components/SharedStoreSync";
import "./globals.css";

const pridi = Pridi({
  subsets: ["thai", "latin"],
  weight: "500",
  display: "swap",
  variable: "--font-pridi",
});

export const metadata: Metadata = {
  title: "Gacha Pop",
  description: "เว็บกาชาปอง kawaii pixel pastel",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body className={pridi.variable}>
        <SharedStoreSync />
        {children}
      </body>
    </html>
  );
}

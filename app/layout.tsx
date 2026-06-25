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
  metadataBase: new URL("https://www.gachapop-th.xyz"),
  title: {
    default: "Gacha Pop",
    template: "%s | Gacha Pop",
  },
  icons: {
    icon: [
      { url: "/navbar-logo.png", type: "image/png" },
      { url: "/logo.png", type: "image/png" },
    ],
    apple: [{ url: "/navbar-logo.png", type: "image/png" }],
  },
  openGraph: {
    title: "Gacha Pop",
    description: "ลุ้นรับไอเทมสุดพิเศษจาก Gacha Pop",
    url: "https://www.gachapop-th.xyz",
    siteName: "Gacha Pop",
    images: [
      {
        url: "/og-cover.png",
        width: 1663,
        height: 939,
        alt: "Gacha Pop promotion",
      },
    ],
    locale: "th_TH",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Gacha Pop",
    description: "ลุ้นรับไอเทมสุดพิเศษจาก Gacha Pop",
    images: ["/og-cover.png"],
  },
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

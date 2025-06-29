import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AuthProvider from "@/components/SessionProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "RAJA Brawijaya - Panel Panitia",
  description: "Panel Panitia RAJA Brawijaya",
  // memastikan viewport disertakan untuk perangkat mobile
  viewport: "width=device-width, initial-scale=1",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className="h-full">
      <body
        className={`${inter.className} h-full bg-gray-50 overflow-x-hidden`}
      >
        <AuthProvider>
          {/* Tidak perlu div #__next (Next.js sudah membuatnya),
              cukup wrapper relative agar z-index anak bisa dipakai */}
          <div className="relative min-h-screen">{children}</div>
        </AuthProvider>
      </body>
    </html>
  );
}

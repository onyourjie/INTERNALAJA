import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AuthProvider from "@/components/SessionProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "RAJA Brawijaya - Panel Panitia",
  description: "Panel Panitia RAJA Brawijaya",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className="h-full">
      <body className={`${inter.className} h-full bg-gray-50 overflow-x-hidden`}>
        <AuthProvider>
          <div id="__next" className="relative h-full">
            {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
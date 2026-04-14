import "./globals.css";
import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Forge",
  description: "ML Experimentation & Agent Operations Platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={GeistMono.variable}>
      <body className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 ml-64 min-w-0 overflow-x-hidden">
          <div className="max-w-content mx-auto px-8 py-8 page-enter">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}

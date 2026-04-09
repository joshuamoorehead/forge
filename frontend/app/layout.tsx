import "./globals.css";
import type { Metadata } from "next";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Forge",
  description: "ML Experimentation & Agent Operations Platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 ml-60 p-8 min-w-0 overflow-x-hidden">
          {children}
        </main>
      </body>
    </html>
  );
}

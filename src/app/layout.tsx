import type { Metadata } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import { Shell } from "@/components/Shell";
import { Toaster } from "@/components/Toaster";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Kak — Indonesian Tutor",
  description: "A patient Indonesian tutor that adapts to you.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${jakarta.variable} ${fraunces.variable}`}>
      <body className="min-h-screen font-sans">
        <Shell>{children}</Shell>
        <Toaster />
      </body>
    </html>
  );
}

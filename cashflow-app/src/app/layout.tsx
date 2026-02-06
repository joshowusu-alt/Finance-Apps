import "./globals.css";
import "../styles/velanovo.css";
import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google"; // The Elite Fonts
import BottomNav from "@/components/BottomNav";
import ReviewAccessLink from "@/components/ReviewAccessLink";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import ToastContainer from "@/components/Toast";
import ThemeInitializer from "@/components/ThemeInitializer";
import AIAssistant from "@/components/AIAssistant";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Velanovo",
  description: "Private Wealth & Cashflow",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="transition-colors duration-200">
      <body className={`${playfair.variable} ${inter.variable} min-h-screen font-sans bg-white dark:bg-slate-900 transition-colors duration-200`}>
        <ThemeInitializer />
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <div className="app-watermark" aria-hidden="true" />
        {/* Page content */}
        <ErrorBoundary>
          <div id="main-content" tabIndex={-1} className="relative z-10 min-h-screen pb-24">
            {children}
          </div>
        </ErrorBoundary>

        {/* Persistent bottom navigation */}
        <BottomNav />
        <ReviewAccessLink />
        <AIAssistant />
        <ToastContainer />
      </body>
    </html>
  );
}

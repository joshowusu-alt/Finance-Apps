import "./globals.css";
import "../styles/velanovo.css";
import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import BottomNav from "@/components/BottomNav";
import ReviewAccessLink from "@/components/ReviewAccessLink";
import MainSyncLink from "@/components/MainSyncLink";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import ToastContainer from "@/components/Toast";
import ThemeInitializer from "@/components/ThemeInitializer";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Velanovo",
  description: "Cashflow planner with insights",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="transition-colors duration-200">
      <body className={`${manrope.variable} min-h-screen bg-white dark:bg-slate-900 transition-colors duration-200`}>
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
        <MainSyncLink />
        <ToastContainer />
      </body>
    </html>
  );
}

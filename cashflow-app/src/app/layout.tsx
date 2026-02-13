import "./globals.css";
import "../styles/velanovo.css";
import type { Metadata, Viewport } from "next";
import { Playfair_Display, Inter } from "next/font/google"; // The Elite Fonts
import BottomNav from "@/components/BottomNav";
import ReviewAccessLink from "@/components/ReviewAccessLink";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import ToastContainer from "@/components/Toast";
import ThemeInitializer from "@/components/ThemeInitializer";
import BrandInitializer from "@/components/BrandInitializer";
import AIAssistant from "@/components/AIAssistant";
import { ConfirmProvider } from "@/components/ConfirmDialog";
import { AuthProvider } from "@/contexts/AuthContext";
import CloudSync from "@/components/CloudSync";
import AppWatermark from "@/components/AppWatermark";
import InstallPrompt from "@/components/InstallPrompt";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";

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
  manifest: "/manifest.json",
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="transition-colors duration-200">
      <body className={`${playfair.variable} ${inter.variable} min-h-screen font-sans bg-white dark:bg-slate-900 transition-colors duration-200`}>
        <AuthProvider>
          <ConfirmProvider>
          <CloudSync />
          <ThemeInitializer />
          <BrandInitializer />
          <a href="#main-content" className="skip-link">
            Skip to content
          </a>
          <AppWatermark />
          <ServiceWorkerRegistrar />
          {/* Page content */}
          <ErrorBoundary>
            <div id="main-content" tabIndex={-1} className="relative z-10 min-h-screen pb-24">
              {children}
            </div>
          </ErrorBoundary>

          {/* Persistent bottom navigation */}
          <BottomNav />
          <InstallPrompt />
          <ReviewAccessLink />
          <AIAssistant />
          <ToastContainer />
          </ConfirmProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

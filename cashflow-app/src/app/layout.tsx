import "./globals.css";
import "../styles/velanovo.css";
import type { Metadata, Viewport } from "next";
import { Playfair_Display, Inter } from "next/font/google";
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
import OfflineOutboxBadge from "@/components/OfflineOutboxBadge";
import AppWatermark from "@/components/AppWatermark";
import InstallPrompt from "@/components/InstallPrompt";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";
import NotificationScheduler from "@/components/NotificationScheduler";
import SplashScreen from "@/components/SplashScreen";
import QuickAddFAB from "@/components/QuickAddFAB";
import CommandPalette from "@/components/CommandPalette";
import PullToRefresh from "@/components/PullToRefresh";
import SwipeBack from "@/components/SwipeBack";
import BiometricLock from "@/components/BiometricLock";
import UpdateBanner from "@/components/UpdateBanner";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  weight: ["500", "600"],
  display: "swap",
});

const jakarta = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: { template: "%s · Velanovo", default: "Velanovo" },
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
    <html lang="en" className="transition-colors duration-200" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var scope=localStorage.getItem("cashflow_scope_v1");var key=scope&&scope.trim()&&scope!=="default"?"velanovo-theme::"+scope:"velanovo-theme";var t=localStorage.getItem(key)||localStorage.getItem("velanovo-theme");if(!t&&window.matchMedia&&window.matchMedia("(prefers-color-scheme:dark)").matches)t="dark";if(t==="dark"){document.documentElement.classList.add("dark");document.documentElement.setAttribute("data-theme","dark")}else{document.documentElement.setAttribute("data-theme","light")}}catch(e){}})();`,
          }}
        />
      </head>
      <body className={`${playfair.variable} ${jakarta.variable} min-h-screen font-sans transition-colors duration-200 overflow-x-hidden`} style={{ background: "var(--vn-bg)", color: "var(--vn-text)" }}>
        <SplashScreen />
        <AuthProvider>
          <ConfirmProvider>
            <CloudSync />
            <UpdateBanner />
            <OfflineOutboxBadge />
            <ThemeInitializer />
            <BrandInitializer />
            <a href="#main-content" className="skip-link">
              Skip to content
            </a>
            <AppWatermark />
            <ServiceWorkerRegistrar />
            <NotificationScheduler />
            <noscript>
              <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontFamily: 'sans-serif' }}>
                <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>JavaScript Required</h1>
                <p>Velanovo requires JavaScript to run. Please enable it in your browser settings.</p>
              </div>
            </noscript>
            {/* Page content */}
            <ErrorBoundary>
              <div id="main-content" tabIndex={-1} className="relative z-10 min-h-screen pb-28 w-full max-w-full overflow-x-hidden">
                {children}
              </div>
            </ErrorBoundary>

            {/* Persistent bottom navigation */}
            <BiometricLock />
            <CommandPalette />
            <PullToRefresh />
            <SwipeBack />
            <QuickAddFAB />
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

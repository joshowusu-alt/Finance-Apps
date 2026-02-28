import "./globals.css";
import "../styles/velanovo.css";
import type { Metadata, Viewport } from "next";
import { Playfair_Display, Plus_Jakarta_Sans } from "next/font/google";
import BottomNav from "@/components/BottomNav";
import ReviewAccessLink from "@/components/ReviewAccessLink";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import ToastContainer from "@/components/Toast";
import ThemeInitializer from "@/components/ThemeInitializer";
import BrandInitializer from "@/components/BrandInitializer";
import { ConfirmProvider } from "@/components/ConfirmDialog";
import { AuthProvider } from "@/contexts/AuthContext";
import CloudSync from "@/components/CloudSync";
import OfflineOutboxBadge from "@/components/OfflineOutboxBadge";
import AppWatermark from "@/components/AppWatermark";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";
import UpdateBanner from "@/components/UpdateBanner";
// Browser-only overlay components (lazy, ssr: false) — see ClientOverlays.tsx
import ClientOverlays from "@/components/ClientOverlays";
import { PostHogProvider } from "@/components/PostHogProvider";
import { PageTransition } from "@/components/PageTransition";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  weight: ["500", "600"],
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
  appleWebApp: {
    capable: true,
    title: "Velanovo",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#0D1117",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="transition-colors duration-200" suppressHydrationWarning style={{ background: "#0D1117" }}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{
var d=document.documentElement;
d.style.background="#0D1117";
var s=document.createElement("style");s.id="vn-bg-init";s.textContent="html,body{background:#0D1117}";document.head.appendChild(s);
var scope=localStorage.getItem("cashflow_scope_v1");var key=scope&&scope.trim()&&scope!=="default"?"velanovo-theme::"+scope:"velanovo-theme";var t=localStorage.getItem(key)||localStorage.getItem("velanovo-theme");if(!t&&window.matchMedia&&window.matchMedia("(prefers-color-scheme:dark)").matches)t="dark";
if(t==="dark"){d.classList.add("dark");d.setAttribute("data-theme","dark");}
else if(t==="light"){d.style.background="#F6F5F2";s.textContent="html,body{background:#F6F5F2}";d.setAttribute("data-theme","light");}
else{d.classList.add("dark");d.setAttribute("data-theme","dark");}
}catch(e){}})();`,
          }}
        />
      </head>
      <body className={`${playfair.variable} ${jakarta.variable} min-h-screen font-sans transition-colors duration-200 overflow-x-hidden`} style={{ background: "var(--vn-bg, #0D1117)", color: "var(--vn-text)" }}>
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <PostHogProvider>
        <AuthProvider>
          <ConfirmProvider>
            <CloudSync />
            <UpdateBanner />
            <OfflineOutboxBadge />
            <ThemeInitializer />
            <BrandInitializer />
            <AppWatermark />
            <ServiceWorkerRegistrar />
            <noscript>
              <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontFamily: 'sans-serif' }}>
                <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>JavaScript Required</h1>
                <p>Velanovo requires JavaScript to run. Please enable it in your browser settings.</p>
              </div>
            </noscript>
            {/* Page content */}
            <ErrorBoundary>
              <div id="main-content" tabIndex={-1} className="relative z-10 min-h-screen pb-28 w-full max-w-full overflow-x-hidden">
                <PageTransition>{children}</PageTransition>
              </div>
            </ErrorBoundary>

            {/* Persistent bottom navigation */}
            <BottomNav />
            <ReviewAccessLink />
            <ToastContainer />
            {/* Browser-only overlays — lazy loaded, ssr: false (WebAuthn, Notifications, etc.) */}
            <ClientOverlays />
          </ConfirmProvider>
        </AuthProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}

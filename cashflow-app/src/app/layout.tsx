import "./globals.css";
import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import BottomNav from "@/components/BottomNav";
import ReviewAccessLink from "@/components/ReviewAccessLink";
import MainSyncLink from "@/components/MainSyncLink";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Vero",
  description: "Cashflow planner with insights",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} min-h-screen`}>
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <div className="app-watermark" aria-hidden="true" />
        {/* Page content */}
        <div id="main-content" tabIndex={-1} className="relative z-10 min-h-screen pb-24">
          {children}
        </div>

        {/* Persistent bottom navigation */}
        <BottomNav />
        <ReviewAccessLink />
        <MainSyncLink />
      </body>
    </html>
  );
}

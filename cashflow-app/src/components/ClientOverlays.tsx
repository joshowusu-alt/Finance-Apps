"use client";
/**
 * ClientOverlays — browser-only overlay components loaded lazily.
 *
 * This Client Component exists solely so that `next/dynamic` with `ssr: false`
 * can be used (it is forbidden in Server Components like layout.tsx). All
 * components here use browser APIs (localStorage, WebAuthn, ServiceWorker,
 * Notification, etc.) and must not run on the server.
 */
import dynamic from "next/dynamic";

const AIAssistant = dynamic(() => import("@/components/AIAssistant"), { ssr: false, loading: () => null });
const InstallPrompt = dynamic(() => import("@/components/InstallPrompt"), { ssr: false, loading: () => null });
const NotificationScheduler = dynamic(() => import("@/components/NotificationScheduler"), { ssr: false, loading: () => null });
const SplashScreen = dynamic(() => import("@/components/SplashScreen"), { ssr: false, loading: () => null });
const QuickAddFAB = dynamic(() => import("@/components/QuickAddFAB"), { ssr: false, loading: () => null });
const CommandPalette = dynamic(() => import("@/components/CommandPalette"), { ssr: false, loading: () => null });
const PullToRefresh = dynamic(() => import("@/components/PullToRefresh"), { ssr: false, loading: () => null });
const SwipeBack = dynamic(() => import("@/components/SwipeBack"), { ssr: false, loading: () => null });
const BiometricLock = dynamic(() => import("@/components/BiometricLock"), { ssr: false, loading: () => null });

export default function ClientOverlays() {
  return (
    <>
      <SplashScreen />
      <NotificationScheduler />
      <BiometricLock />
      <CommandPalette />
      <PullToRefresh />
      <SwipeBack />
      <QuickAddFAB />
      <InstallPrompt />
      <AIAssistant />
    </>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AIAssistant() {
    const pathname = usePathname();

    // Hide the floating button on the coach page itself
    if (pathname === "/coach") return null;

    return (
        <Link
            href="/coach"
            className="fixed bottom-24 right-4 z-50 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center bg-linear-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 transition-all duration-300"
            aria-label="Open Financial Coach"
        >
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
        </Link>
    );
}

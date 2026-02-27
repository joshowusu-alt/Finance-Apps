"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { track } from "@/lib/analytics";

export default function AIAssistant() {
    const pathname = usePathname();

    // Hide the floating button on the coach page itself
    if (pathname === "/coach") return null;

    return (
        <Link
            href="/coach"
            aria-label="Open Financial Coach"
            onClick={() => track("ai_chat_opened")}
            style={{
                position: "fixed",
                bottom: "9.5rem",
                right: "1rem",
                zIndex: 50,
                width: 52,
                height: 52,
                borderRadius: "50%",
                background: "var(--surface-elevated, #141C26)",
                border: "1px solid rgba(197, 160, 70, 0.25)",
                boxShadow: "0 8px 24px rgba(0, 0, 0, 0.18)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "box-shadow 200ms cubic-bezier(0.4, 0, 0.2, 1), border-color 200ms cubic-bezier(0.4, 0, 0.2, 1)",
            }}
            onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = "0 12px 32px rgba(0, 0, 0, 0.28)";
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(197, 160, 70, 0.5)";
            }}
            onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 24px rgba(0, 0, 0, 0.18)";
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(197, 160, 70, 0.25)";
            }}
        >
            {/* Gold chat icon */}
            <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#C5A046"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
        </Link>
    );
}

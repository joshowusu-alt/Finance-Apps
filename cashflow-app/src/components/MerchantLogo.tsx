"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { COMMON_MERCHANTS } from "@/lib/categorization";

type Props = {
    merchantName: string;
    size?: "sm" | "md" | "lg";
    className?: string;
};

// Generate consistent color from string
function stringToColor(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }

    // Generate HSL color with good saturation and lightness
    const h = Math.abs(hash) % 360;
    const s = 65 + (Math.abs(hash) % 20); // 65-85%
    const l = 45 + (Math.abs(hash) % 15);  // 45-60%

    return `hsl(${h}, ${s}%, ${l}%)`;
}

// Get initials from merchant name
function getInitials(name: string): string {
    const words = name.trim().split(/\s+/);
    if (words.length === 0) return "?";
    if (words.length === 1) {
        return words[0].slice(0, 2).toUpperCase();
    }
    return (words[0][0] + words[1][0]).toUpperCase();
}

// Normalize merchant name to find domain
function normalizeMerchantName(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .trim();
}

// Try to find domain for merchant
function getMerchantDomain(merchantName: string): string | null {
    const normalized = normalizeMerchantName(merchantName);

    // Check exact matches first
    for (const [key, value] of Object.entries(COMMON_MERCHANTS)) {
        if (normalized.includes(key) || key.includes(normalized)) {
            return value.domain;
        }
    }

    // Try to construct domain from merchant name
    const cleanName = normalized.replace(/ltd|limited|uk|co|plc|inc/g, "");
    if (cleanName.length >= 3) {
        // Common domain patterns
        return `${cleanName}.com`;
    }

    return null;
}

// Size configurations
const SIZES = {
    sm: { dimension: 28, fontSize: 11 },
    md: { dimension: 36, fontSize: 13 },
    lg: { dimension: 48, fontSize: 16 },
};

export function MerchantLogo({ merchantName, size = "md", className = "" }: Props) {
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [hasError, setHasError] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const { dimension, fontSize } = SIZES[size];
    const initials = useMemo(() => getInitials(merchantName), [merchantName]);
    const bgColor = useMemo(() => stringToColor(merchantName), [merchantName]);

    useEffect(() => {
        const domain = getMerchantDomain(merchantName);

        if (!domain) {
            setIsLoading(false);
            setHasError(true);
            return;
        }

        // Use Clearbit Logo API (free, no key needed)
        const clearbitUrl = `https://logo.clearbit.com/${domain}`;

        // Preload image to check if it exists
        const img = new Image();
        img.onload = () => {
            setLogoUrl(clearbitUrl);
            setHasError(false);
            setIsLoading(false);
        };
        img.onerror = () => {
            setHasError(true);
            setIsLoading(false);
        };
        img.src = clearbitUrl;

        return () => {
            img.onload = null;
            img.onerror = null;
        };
    }, [merchantName]);

    // Loading skeleton
    if (isLoading) {
        return (
            <div
                className={`animate-pulse rounded-full ${className}`}
                style={{
                    width: dimension,
                    height: dimension,
                    backgroundColor: "var(--vn-border, #e5e7eb)",
                }}
            />
        );
    }

    // Logo available
    if (logoUrl && !hasError) {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`overflow-hidden rounded-full ${className}`}
                style={{
                    width: dimension,
                    height: dimension,
                    backgroundColor: "white",
                    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                }}
            >
                <img
                    src={logoUrl}
                    alt={merchantName}
                    className="h-full w-full object-contain p-1"
                    onError={() => setHasError(true)}
                />
            </motion.div>
        );
    }

    // Fallback to initials
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`flex items-center justify-center rounded-full font-semibold text-white ${className}`}
            style={{
                width: dimension,
                height: dimension,
                backgroundColor: bgColor,
                fontSize,
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
            }}
            title={merchantName}
        >
            {initials}
        </motion.div>
    );
}

/**
 * Inline logo for use in text/lists (no animation)
 */
export function MerchantLogoInline({
    merchantName,
    size = "sm",
}: {
    merchantName: string;
    size?: "sm" | "md";
}) {
    return (
        <span className="inline-flex items-center">
            <MerchantLogo merchantName={merchantName} size={size} />
        </span>
    );
}

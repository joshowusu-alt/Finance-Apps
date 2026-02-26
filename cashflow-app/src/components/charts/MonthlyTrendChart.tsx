"use client";

import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from "recharts";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import {
    chartColors,
    formatCurrency,
    formatCompactCurrency,
    getTextColor,
    getMutedColor,
    getGridColor,
    chartConfig,
} from "@/lib/chartConfig";

export type MonthlyDataPoint = {
    month: string; // e.g., "Jan", "Feb"
    income: number;
    spending: number;
    savings?: number;
};

type Props = {
    data: MonthlyDataPoint[];
    height?: number;
    showIncome?: boolean;
    showSavings?: boolean;
    showGrid?: boolean;
};

export function MonthlyTrendChart({
    data,
    height = 300,
    showIncome = true,
    showSavings = false,
    showGrid = true,
}: Props) {
    const [isDark, setIsDark] = useState(() => typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "dark");

    useEffect(() => {
        const observer = new MutationObserver(() => {
            const darkMode = document.documentElement.getAttribute("data-theme") === "dark";
            setIsDark(darkMode);
        });

        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["data-theme"],
        });

        return () => observer.disconnect();
    }, []);

    const textColor = getTextColor(isDark);
    const mutedColor = getMutedColor(isDark);
    const gridColor = getGridColor(isDark);

    // Gradient IDs
    const incomeGradientId = "incomeGradient";
    const spendingGradientId = "spendingGradient";
    const savingsGradientId = "savingsGradient";

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
        >
            <ResponsiveContainer width="100%" height={height}>
                <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                        {/* Income gradient */}
                        <linearGradient id={incomeGradientId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={chartColors.success} stopOpacity={0.4} />
                            <stop offset="100%" stopColor={chartColors.success} stopOpacity={0.05} />
                        </linearGradient>
                        {/* Spending gradient */}
                        <linearGradient id={spendingGradientId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={chartColors.error} stopOpacity={0.4} />
                            <stop offset="100%" stopColor={chartColors.error} stopOpacity={0.05} />
                        </linearGradient>
                        {/* Savings gradient */}
                        <linearGradient id={savingsGradientId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={chartColors.primary} stopOpacity={0.4} />
                            <stop offset="100%" stopColor={chartColors.primary} stopOpacity={0.05} />
                        </linearGradient>
                    </defs>

                    {showGrid && (
                        <CartesianGrid
                            strokeDasharray="3 3"
                            stroke={gridColor}
                            vertical={false}
                            opacity={0.5}
                        />
                    )}

                    <XAxis
                        dataKey="month"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: mutedColor, fontSize: 12 }}
                        dy={10}
                    />

                    <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: mutedColor, fontSize: 12 }}
                        tickFormatter={(value) => formatCompactCurrency(value)}
                        width={50}
                    />

                    <Tooltip
                        contentStyle={{
                            backgroundColor: isDark ? "#27272a" : "#ffffff",
                            border: `1px solid ${gridColor}`,
                            borderRadius: "12px",
                            color: textColor,
                            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12)",
                            padding: "12px 16px",
                        }}
                        formatter={(value, name) => [
                            typeof value === "number" ? formatCurrency(value) : "",
                            typeof name === "string" ? name.charAt(0).toUpperCase() + name.slice(1) : "",
                        ]}
                        labelStyle={{ fontWeight: 600, marginBottom: 8, color: textColor }}
                        cursor={{ stroke: mutedColor, strokeWidth: 1, strokeDasharray: "4 4" }}
                    />

                    <Legend
                        verticalAlign="top"
                        align="right"
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ paddingBottom: 16 }}
                        formatter={(value) => (
                            <span style={{ color: textColor, fontSize: 12, marginLeft: 4 }}>
                                {value.charAt(0).toUpperCase() + value.slice(1)}
                            </span>
                        )}
                    />

                    {showIncome && (
                        <Area
                            type="monotone"
                            dataKey="income"
                            stroke={chartColors.success}
                            strokeWidth={2.5}
                            fill={`url(#${incomeGradientId})`}
                            animationDuration={chartConfig.animationDuration}
                            animationEasing={chartConfig.animationEasing}
                            dot={false}
                            activeDot={{
                                r: 6,
                                stroke: chartColors.success,
                                strokeWidth: 2,
                                fill: isDark ? "#18181b" : "#ffffff",
                            }}
                        />
                    )}

                    <Area
                        type="monotone"
                        dataKey="spending"
                        stroke={chartColors.error}
                        strokeWidth={2.5}
                        fill={`url(#${spendingGradientId})`}
                        animationDuration={chartConfig.animationDuration}
                        animationEasing={chartConfig.animationEasing}
                        dot={false}
                        activeDot={{
                            r: 6,
                            stroke: chartColors.error,
                            strokeWidth: 2,
                            fill: isDark ? "#18181b" : "#ffffff",
                        }}
                    />

                    {showSavings && (
                        <Area
                            type="monotone"
                            dataKey="savings"
                            stroke={chartColors.primary}
                            strokeWidth={2.5}
                            fill={`url(#${savingsGradientId})`}
                            animationDuration={chartConfig.animationDuration}
                            animationEasing={chartConfig.animationEasing}
                            dot={false}
                            activeDot={{
                                r: 6,
                                stroke: chartColors.primary,
                                strokeWidth: 2,
                                fill: isDark ? "#18181b" : "#ffffff",
                            }}
                        />
                    )}
                </AreaChart>
            </ResponsiveContainer>
        </motion.div>
    );
}

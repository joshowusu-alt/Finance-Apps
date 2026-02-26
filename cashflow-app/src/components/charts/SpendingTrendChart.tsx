"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { chartColors, formatCurrency, formatCompactCurrency, getTextColor, getMutedColor, getGridColor, chartConfig } from "@/lib/chartConfig";
import { useEffect, useState } from "react";

export type SpendingDataPoint = {
  date: string;
  spending: number;
  income?: number;
};

type Props = {
  data: SpendingDataPoint[];
  showIncome?: boolean;
  height?: number;
};

export function SpendingTrendChart({ data, showIncome = false, height = 300 }: Props) {
  const [isDark, setIsDark] = useState(() => typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "dark");
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 640);

  useEffect(() => {
    // Check for mobile
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", checkMobile);

    // Listen for theme changes
    const observer = new MutationObserver(() => {
      const darkMode = document.documentElement.getAttribute("data-theme") === "dark";
      setIsDark(darkMode);
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", checkMobile);
    };
  }, []);

  // Mobile-optimized margins
  const margins = isMobile
    ? { top: 5, right: 10, left: 0, bottom: 5 }
    : chartConfig.margin;

  return (
    <ResponsiveContainer width="100%" height={isMobile ? Math.min(height - 60, 220) : height}>
      <LineChart data={data} margin={margins}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={getGridColor(isDark)}
          opacity={0.3}
        />
        <XAxis
          dataKey="date"
          stroke={getMutedColor(isDark)}
          style={{ fontSize: isMobile ? 10 : 12 }}
          tickLine={false}
          angle={isMobile ? -45 : 0}
          textAnchor={isMobile ? "end" : "middle"}
          height={isMobile ? 50 : 30}
          interval={isMobile ? 1 : 0}
        />
        <YAxis
          stroke={getMutedColor(isDark)}
          style={{ fontSize: isMobile ? 10 : 12 }}
          tickLine={false}
          tickFormatter={(value) => formatCompactCurrency(value)}
          width={isMobile ? 35 : 50}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: isDark ? "#27272a" : "#ffffff",
            border: `1px solid ${getGridColor(isDark)}`,
            borderRadius: "12px",
            color: getTextColor(isDark),
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
            fontSize: isMobile ? "12px" : "14px",
          }}
          formatter={(value) => value !== undefined ? [formatCurrency(Number(value)), ""] : ["", ""]}
          labelStyle={{ color: getMutedColor(isDark), marginBottom: 4 }}
        />
        <Legend
          wrapperStyle={{
            paddingTop: isMobile ? 8 : 16,
            fontSize: isMobile ? "11px" : "12px",
          }}
          iconType="circle"
          iconSize={isMobile ? 8 : 10}
        />
        <Line
          type="monotone"
          dataKey="spending"
          stroke={chartColors.error}
          strokeWidth={isMobile ? 1.5 : 2}
          dot={isMobile ? false : { fill: chartColors.error, strokeWidth: 0, r: 4 }}
          activeDot={{ r: isMobile ? 4 : 6 }}
          name="Spending"
          animationDuration={chartConfig.animationDuration}
          animationEasing={chartConfig.animationEasing}
        />
        {showIncome && (
          <Line
            type="monotone"
            dataKey="income"
            stroke={chartColors.success}
            strokeWidth={isMobile ? 1.5 : 2}
            dot={isMobile ? false : { fill: chartColors.success, strokeWidth: 0, r: 4 }}
            activeDot={{ r: isMobile ? 4 : 6 }}
            name="Income"
            animationDuration={chartConfig.animationDuration}
            animationEasing={chartConfig.animationEasing}
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}


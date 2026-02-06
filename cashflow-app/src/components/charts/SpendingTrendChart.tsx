"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { chartColors, formatCurrency, getTextColor, getMutedColor, getGridColor, chartConfig } from "@/lib/chartConfig";
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
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Check if dark mode
    const isDarkMode = document.documentElement.getAttribute("data-theme") === "dark";
    setIsDark(isDarkMode);

    // Listen for theme changes
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

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={chartConfig.margin}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={getGridColor(isDark)}
          opacity={0.3}
        />
        <XAxis
          dataKey="date"
          stroke={getMutedColor(isDark)}
          style={{ fontSize: 12 }}
          tickLine={false}
        />
        <YAxis
          stroke={getMutedColor(isDark)}
          style={{ fontSize: 12 }}
          tickLine={false}
          tickFormatter={(value) => `£${value >= 1000 ? `${value / 1000}k` : value}`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: isDark ? "#27272a" : "#ffffff",
            border: `1px solid ${getGridColor(isDark)}`,
            borderRadius: "12px",
            color: getTextColor(isDark),
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
          }}
          formatter={(value: number | undefined) => value !== undefined ? [formatCurrency(value), ""] : ["", ""]}
          labelStyle={{ color: getMutedColor(isDark), marginBottom: 4 }}
        />
        <Legend
          wrapperStyle={{ paddingTop: 16 }}
          iconType="circle"
        />
        <Line
          type="monotone"
          dataKey="spending"
          stroke={chartColors.error}
          strokeWidth={2}
          dot={{ fill: chartColors.error, strokeWidth: 0, r: 4 }}
          activeDot={{ r: 6 }}
          name="Spending"
          animationDuration={chartConfig.animationDuration}
          animationEasing={chartConfig.animationEasing}
        />
        {showIncome && (
          <Line
            type="monotone"
            dataKey="income"
            stroke={chartColors.success}
            strokeWidth={2}
            dot={{ fill: chartColors.success, strokeWidth: 0, r: 4 }}
            activeDot={{ r: 6 }}
            name="Income"
            animationDuration={chartConfig.animationDuration}
            animationEasing={chartConfig.animationEasing}
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}

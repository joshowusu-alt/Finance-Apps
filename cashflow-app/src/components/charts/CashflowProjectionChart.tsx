"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { chartColors, formatCurrency, getTextColor, getMutedColor, getGridColor, chartConfig } from "@/lib/chartConfig";
import { useEffect, useState } from "react";

export type CashflowDataPoint = {
  date: string;
  balance: number;
  projected?: number;
};

type Props = {
  data: CashflowDataPoint[];
  showProjection?: boolean;
  height?: number;
  lowBalanceThreshold?: number;
};

export function CashflowProjectionChart({
  data,
  showProjection = true,
  height = 300,
  lowBalanceThreshold = 0,
}: Props) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const isDarkMode = document.documentElement.getAttribute("data-theme") === "dark";
    setIsDark(isDarkMode);

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
      <AreaChart data={data} margin={chartConfig.margin}>
        <defs>
          <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={chartColors.primary} stopOpacity={0.3} />
            <stop offset="95%" stopColor={chartColors.primary} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorProjected" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={chartColors.secondary} stopOpacity={0.2} />
            <stop offset="95%" stopColor={chartColors.secondary} stopOpacity={0} />
          </linearGradient>
        </defs>
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
        <ReferenceLine
          y={lowBalanceThreshold}
          stroke={chartColors.warning}
          strokeDasharray="3 3"
          label={{
            value: "Min Balance",
            position: "top",
            fill: chartColors.warning,
            fontSize: 10,
            dy: -10,
          }}
        />
        <Area
          type="monotone"
          dataKey="balance"
          stroke={chartColors.primary}
          strokeWidth={2}
          fillOpacity={1}
          fill="url(#colorBalance)"
          name="Current Balance"
          animationDuration={chartConfig.animationDuration}
          animationEasing={chartConfig.animationEasing}
        />
        {showProjection && (
          <Area
            type="monotone"
            dataKey="projected"
            stroke={chartColors.secondary}
            strokeWidth={2}
            strokeDasharray="5 5"
            fillOpacity={1}
            fill="url(#colorProjected)"
            name="Projected"
            animationDuration={chartConfig.animationDuration}
            animationEasing={chartConfig.animationEasing}
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
}

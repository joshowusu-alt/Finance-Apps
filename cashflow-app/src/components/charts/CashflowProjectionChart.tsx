"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { chartColors, formatCurrency, formatCompactCurrency, getTextColor, getMutedColor, getGridColor, chartConfig } from "@/lib/chartConfig";
import { useMemo, useId } from "react";
import { motion } from "framer-motion";
import { useDarkMode } from "@/hooks/useDarkMode";

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
  const isDark = useDarkMode();
  const uid = useId();

  // Derive Y-axis domain and threshold visibility from the actual data
  const { yDomain, showThreshold } = useMemo(() => {
    if (!data.length) return { yDomain: undefined, showThreshold: false };

    const allBalances = data.flatMap((d) =>
      [d.balance, d.projected].filter((v): v is number => v !== undefined)
    );
    const minBal = Math.min(...allBalances);
    const maxBal = Math.max(...allBalances);
    const padding = (maxBal - minBal) * 0.12 || Math.abs(maxBal) * 0.1 || 100;

    // Only show the threshold line when the budget data is actually
    // approaching it — defined as the min balance sitting within 1.5×
    // the threshold value. If all balances are comfortably above it the
    // line adds no useful information.
    const relevant =
      lowBalanceThreshold > 0 && minBal <= lowBalanceThreshold * 1.5;

    const yMin = relevant
      ? Math.min(minBal, lowBalanceThreshold) - padding
      : minBal - padding;

    return {
      yDomain: [Math.floor(yMin), Math.ceil(maxBal + padding)] as [number, number],
      showThreshold: relevant,
    };
  }, [data, lowBalanceThreshold]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.45, delay: 0.1 }}>
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={chartConfig.margin}>
        <defs>
          <linearGradient id={`colorBalance-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={chartColors.primary} stopOpacity={0.3} />
            <stop offset="95%" stopColor={chartColors.primary} stopOpacity={0.04} />
          </linearGradient>
          <linearGradient id={`colorProjected-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={chartColors.secondary} stopOpacity={0.2} />
            <stop offset="95%" stopColor={chartColors.secondary} stopOpacity={0.04} />
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
          tickFormatter={(value) => formatCompactCurrency(value)}
          domain={yDomain}
          allowDataOverflow={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: isDark ? "#27272a" : "#ffffff",
            border: `1px solid ${getGridColor(isDark)}`,
            borderRadius: "12px",
            color: getTextColor(isDark),
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
          }}
          formatter={(value: number | undefined, name?: string) =>
            value !== undefined ? [formatCurrency(value), name ?? ""] : ["", ""]
          }
          labelFormatter={(label) => {
            try {
              return new Date(String(label) + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
            } catch { return String(label); }
          }}
          labelStyle={{ color: getMutedColor(isDark), marginBottom: 4 }}
        />
        {showThreshold && (
          <ReferenceLine
            y={lowBalanceThreshold}
            stroke={chartColors.warning}
            strokeDasharray="3 3"
            label={{
              value: "Min Balance",
              position: "insideTopRight",
              fill: chartColors.warning,
              fontSize: 10,
            }}
          />
        )}
        <Area
          type="monotone"
          dataKey="balance"
          stroke={chartColors.primary}
          strokeWidth={2}
          fillOpacity={1}
          fill={`url(#colorBalance-${uid})`}
          name="Budget (Planned)"
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
            fill={`url(#colorProjected-${uid})`}
            name="Actuals (Recorded)"
            connectNulls={false}
            animationDuration={chartConfig.animationDuration}
            animationEasing={chartConfig.animationEasing}
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
    </motion.div>
  );
}

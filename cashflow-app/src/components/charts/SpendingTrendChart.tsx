"use client";

import { useId } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { motion } from "framer-motion";
import { chartColors, formatCompactCurrency, getTextColor, getMutedColor, getGridColor, chartConfig } from "@/lib/chartConfig";
import { formatMoney } from "@/lib/currency";
import { useDarkMode } from "@/hooks/useDarkMode";
import { useIsMobile } from "@/hooks/useIsMobile";

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
  const isDark = useDarkMode();
  const isMobile = useIsMobile();
  const uid = useId();
  const spendGradId = `spendGrad-${uid}`;
  const incomeGradId = `incomeGrad-${uid}`;

  const spendColor = chartColors.error;
  const incomeColor = chartColors.success;

  // Mobile-optimized margins
  const margins = isMobile
    ? { top: 5, right: 10, left: 0, bottom: 5 }
    : chartConfig.margin;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
    <ResponsiveContainer width="100%" height={isMobile ? Math.min(height - 60, 220) : height}>
      <AreaChart data={data} margin={margins}>
        <defs>
          <linearGradient id={spendGradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={spendColor} stopOpacity={0.18} />
            <stop offset="95%" stopColor={spendColor} stopOpacity={0.02} />
          </linearGradient>
          {showIncome && (
            <linearGradient id={incomeGradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={incomeColor} stopOpacity={0.15} />
              <stop offset="95%" stopColor={incomeColor} stopOpacity={0.02} />
            </linearGradient>
          )}
        </defs>
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
          formatter={(value) => value !== undefined ? [formatMoney(Number(value)), ""] : ["", ""]}
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
        <Area
          type="monotone"
          dataKey="spending"
          stroke={spendColor}
          strokeWidth={2.5}
          fill={`url(#${spendGradId})`}
          dot={false}
          activeDot={{ r: 5, strokeWidth: 2, fill: isDark ? "#18181b" : "#fff", stroke: spendColor }}
          name="Spending"
          animationDuration={chartConfig.animationDuration}
          animationEasing={chartConfig.animationEasing}
        />
        {showIncome && (
          <Area
            type="monotone"
            dataKey="income"
            stroke={incomeColor}
            strokeWidth={2.5}
            fill={`url(#${incomeGradId})`}
            dot={false}
            activeDot={{ r: 5, strokeWidth: 2, fill: isDark ? "#18181b" : "#fff", stroke: incomeColor }}
            name="Income"
            animationDuration={chartConfig.animationDuration}
            animationEasing={chartConfig.animationEasing}
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
    </motion.div>
  );
}


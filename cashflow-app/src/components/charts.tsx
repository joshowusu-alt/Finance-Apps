"use client";

/**
 * charts.tsx — Recharts wrappers styled with vn- design tokens.
 *
 * Exports:
 *   CategoryBreakdownChart  — horizontal bar chart, click-to-drilldown
 *   SpendingTrendChart      — income bars + spending area across periods
 */

import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Area,
  CartesianGrid,
} from "recharts";
import { formatMoney } from "@/lib/currency";
import type { CategoryData, SpendingDataPoint } from "@/lib/insightsSnapshot";

const PALETTE = [
  "#6366f1",
  "#22d3ee",
  "#f59e0b",
  "#10b981",
  "#f43f5e",
  "#8b5cf6",
  "#ec4899",
  "#84cc16",
];

const tooltipStyle = {
  background: "var(--vn-surface)",
  border: "1px solid var(--vn-border)",
  borderRadius: 10,
  fontSize: 12,
  color: "var(--vn-text)",
  boxShadow: "0 4px 16px rgba(0,0,0,.10)",
};

// ---------------------------------------------------------------------------
// Category Breakdown Chart
// ---------------------------------------------------------------------------

export function CategoryBreakdownChart({
  data,
  height = 280,
  onCategoryClick,
}: {
  data: CategoryData[];
  height?: number;
  onCategoryClick?: (name: string) => void;
}) {
  const chartData = data.map((d, i) => ({
    ...d,
    fill: PALETTE[i % PALETTE.length],
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        layout="vertical"
        data={chartData}
        margin={{ top: 0, right: 24, left: 4, bottom: 0 }}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onClick={(payload: any) => {
          const name = payload?.activePayload?.[0]?.payload?.name as string | undefined;
          if (onCategoryClick && name) onCategoryClick(name);
        }}
        style={{ cursor: onCategoryClick ? "pointer" : "default" }}
      >
        <XAxis
          type="number"
          tickFormatter={(v: number) => formatMoney(v)}
          tick={{ fontSize: 11, fill: "var(--vn-muted)" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={84}
          tick={{ fontSize: 12, fill: "var(--vn-text)" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(value: number | undefined) => [formatMoney(value ?? 0), "Spend"]}
          contentStyle={tooltipStyle}
          cursor={{ fill: "rgba(100,100,100,.07)" }}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive animationDuration={600}>
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------------------
// Spending Trend Chart
// ---------------------------------------------------------------------------

export function SpendingTrendChart({
  data,
  showIncome = false,
  height = 280,
}: {
  data: SpendingDataPoint[];
  showIncome?: boolean;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--vn-border)" strokeOpacity={0.6} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: "var(--vn-muted)" }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tickFormatter={(v: number) => formatMoney(v)}
          tick={{ fontSize: 10, fill: "var(--vn-muted)" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(value: number | undefined, name: string) => [formatMoney(value ?? 0), name]}
          contentStyle={tooltipStyle}
        />
        {showIncome && (
          <Bar
            dataKey="income"
            name="Income"
            fill="#10b981"
            fillOpacity={0.55}
            radius={[3, 3, 0, 0]}
            isAnimationActive
            animationDuration={600}
          />
        )}
        <Area
          type="monotone"
          dataKey="spending"
          name="Spending"
          stroke="#f43f5e"
          fill="#f43f5e"
          fillOpacity={0.1}
          strokeWidth={2}
          dot={{ r: 3, fill: "#f43f5e", strokeWidth: 0 }}
          activeDot={{ r: 5 }}
          isAnimationActive
          animationDuration={600}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

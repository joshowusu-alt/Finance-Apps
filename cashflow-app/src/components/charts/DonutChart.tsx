"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, Sector } from "recharts";
import { motion } from "framer-motion";
import { useState, useCallback, useId } from "react";
import { chartColors, getCategoryColor, getTextColor, getGridColor } from "@/lib/chartConfig";
import { formatMoney } from "@/lib/currency";
import { useDarkMode } from "@/hooks/useDarkMode";

export type DonutDataPoint = {
  name: string;
  value: number;
  color?: string;
};

type Props = {
  data: DonutDataPoint[];
  height?: number;
  showLegend?: boolean;
  onCategoryClick?: (category: string) => void;
  centerLabel?: string;
  centerValue?: string;
};

// Custom active shape for hover effect
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const renderActiveShape = (props: any) => {
  const {
    cx, cy, innerRadius, outerRadius, startAngle, endAngle,
    fill
  } = props;

  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius - 4}
        outerRadius={outerRadius + 8}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        style={{
          filter: "drop-shadow(0 4px 12px rgba(0, 0, 0, 0.15))",
          transition: "all 0.3s ease-out",
        }}
      />
      <Sector
        cx={cx}
        cy={cy}
        startAngle={startAngle}
        endAngle={endAngle}
        innerRadius={outerRadius + 12}
        outerRadius={outerRadius + 16}
        fill={fill}
        opacity={0.3}
      />
    </g>
  );
};

export function DonutChart({
  data,
  height = 320,
  showLegend = true,
  onCategoryClick,
  centerLabel,
  centerValue,
}: Props) {
  const isDark = useDarkMode();
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);
  const uid = useId();

  const onPieEnter = useCallback((_: unknown, index: number) => {
    setActiveIndex(index);
  }, []);

  const onPieLeave = useCallback(() => {
    setActiveIndex(undefined);
  }, []);

  // Assign colors to categories
  const dataWithColors = data.map((item, index) => ({
    ...item,
    color: item.color || getCategoryColor(item.name) || chartColors[`chart${(index % 8) + 1}` as keyof typeof chartColors],
  }));

  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (!data.length || total === 0) {
    return (
      <div className="flex items-center justify-center text-(--vn-muted) text-sm" style={{ height }}>
        No data for this period
      </div>
    );
  }

  // Custom legend with click functionality
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderCustomLegend = (props: any) => {
    const { payload } = props;
    if (!payload) return null;
    return (
      <div className="flex flex-wrap justify-center gap-3 pt-4">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {payload.map((entry: any, index: number) => {
          const percent = total > 0 ? ((entry.payload.value / total) * 100).toFixed(1) : 0;
          return (
            <motion.button
              key={`legend-${index}`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onCategoryClick?.(entry.value)}
              className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-all"
              style={{
                backgroundColor: activeIndex === index
                  ? `${entry.color}20`
                  : isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                border: `1px solid ${activeIndex === index ? entry.color : "transparent"}`,
                color: getTextColor(isDark),
              }}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(undefined)}
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span>{entry.value}</span>
              <span style={{ color: isDark ? "#a1a1aa" : "#71717a" }}>{percent}%</span>
            </motion.button>
          );
        })}
      </div>
    );
  };

  return (
    <figure role="img" aria-labelledby={`donut-chart-${uid}`}>
      <figcaption id={`donut-chart-${uid}`} className="sr-only">
        Category breakdown donut chart showing spending distribution
      </figcaption>
    <motion.div
      role="presentation"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="relative"
    >
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={dataWithColors}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={2}
            dataKey="value"
            onMouseEnter={onPieEnter}
            onMouseLeave={onPieLeave}
            onClick={(_, index) => onCategoryClick?.(dataWithColors[index].name)}
            animationDuration={600}
            animationEasing="ease-out"
            style={{ cursor: onCategoryClick ? "pointer" : "default" }}
            {...{ activeIndex, activeShape: renderActiveShape }}
          >
            {dataWithColors.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color as string}
                stroke="var(--vn-bg)"
                strokeWidth={2}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: isDark ? "#27272a" : "#ffffff",
              border: `1px solid ${getGridColor(isDark)}`,
              borderRadius: "12px",
              color: getTextColor(isDark),
              boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12)",
              padding: "12px 16px",
            }}
            formatter={(value, name) => {
              const pct = total > 0 ? ((Number(value) / total) * 100).toFixed(1) : "0";
              return [`${formatMoney(Number(value))}  (${pct}%)`, name];
            }}
            labelStyle={{ fontWeight: 600, marginBottom: 4 }}
          />
          {showLegend && (
            <Legend
              content={renderCustomLegend}
              verticalAlign="bottom"
            />
          )}
        </PieChart>
      </ResponsiveContainer>

      {/* Center label */}
      {(centerLabel || centerValue) && (
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center text-center"
          style={{ marginTop: showLegend ? "-20px" : "0" }}
        >
          {centerValue && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-2xl font-bold"
              style={{ color: getTextColor(isDark) }}
            >
              {centerValue}
            </motion.div>
          )}
          {centerLabel && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-xs uppercase tracking-wide"
              style={{ color: isDark ? "#a1a1aa" : "#71717a" }}
            >
              {centerLabel}
            </motion.div>
          )}
        </div>
      )}
    </motion.div>
    </figure>
  );
}

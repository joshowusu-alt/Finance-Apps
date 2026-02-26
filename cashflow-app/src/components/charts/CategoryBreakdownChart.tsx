"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { chartColors, formatCurrency, getCategoryColor, getTextColor, getGridColor } from "@/lib/chartConfig";
import { useEffect, useState } from "react";

export type CategoryData = {
  name: string;
  value: number;
  color?: string;
};

type Props = {
  data: CategoryData[];
  height?: number;
  onCategoryClick?: (name: string) => void;
};

export function CategoryBreakdownChart({ data, height = 300, onCategoryClick }: Props) {
  const [isDark, setIsDark] = useState(() => typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "dark");
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 640);

  useEffect(() => {
    // Check for mobile
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", checkMobile);

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

  // Assign colors to categories
  const dataWithColors = data.map((item) => ({
    ...item,
    color: item.color || getCategoryColor(item.name),
  }));

  const total = data.reduce((sum, d) => sum + d.value, 0);

  // Mobile: smaller radius, donut style for clean look
  // Desktop: larger radius with inline labels
  const outerRadius = isMobile ? 55 : 80;
  const innerRadius = isMobile ? 28 : 0;

  return (
    <ResponsiveContainer width="100%" height={isMobile ? Math.min(height - 80, 200) : height}>
      <PieChart>
        <Pie
          data={dataWithColors}
          cx="50%"
          cy="45%"
          labelLine={!isMobile}
          label={isMobile ? false : (entry) => {
            const percent = ((entry.value / total) * 100).toFixed(0);
            return `${entry.name} ${percent}%`;
          }}
          outerRadius={outerRadius}
          innerRadius={innerRadius}
          fill={chartColors.primary}
          dataKey="value"
          animationDuration={400}
          animationEasing="ease-out"
          paddingAngle={isMobile ? 2 : 0}
          style={{ cursor: onCategoryClick ? "pointer" : "default" }}
        >
          {dataWithColors.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.color}
              style={{ cursor: onCategoryClick ? "pointer" : "default" }}
              onClick={() => onCategoryClick?.(entry.name)}
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: isDark ? "#27272a" : "#ffffff",
            border: `1px solid ${getGridColor(isDark)}`,
            borderRadius: "12px",
            color: getTextColor(isDark),
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
            fontSize: isMobile ? "12px" : "14px",
          }}
          formatter={(value) => value !== undefined ? formatCurrency(Number(value)) : ""}
        />
        <Legend
          wrapperStyle={{
            paddingTop: isMobile ? 8 : 16,
            fontSize: isMobile ? "11px" : "12px",
            maxWidth: "100%",
            overflow: "hidden",
            lineHeight: "1.6",
          }}
          iconType="circle"
          iconSize={isMobile ? 8 : 10}
          layout={isMobile ? "horizontal" : "horizontal"}
          align="center"
          verticalAlign="bottom"
          content={({ payload }) => (
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "6px 12px", paddingTop: isMobile ? 8 : 16 }}>
              {(payload ?? []).map((entry) => (
                <button
                  key={entry.value}
                  onClick={() => onCategoryClick?.(entry.value as string)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    background: "none",
                    border: "none",
                    cursor: onCategoryClick ? "pointer" : "default",
                    padding: "2px 4px",
                    borderRadius: 6,
                    fontSize: isMobile ? 11 : 12,
                    color: getTextColor(isDark),
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  <span style={{ display: "inline-block", width: isMobile ? 8 : 10, height: isMobile ? 8 : 10, borderRadius: "50%", backgroundColor: entry.color as string, flexShrink: 0 }} />
                  <span style={{ maxWidth: isMobile ? 80 : 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.value}</span>
                </button>
              ))}
            </div>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}


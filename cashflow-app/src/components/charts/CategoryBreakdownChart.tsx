"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { chartColors, formatCurrency, getCategoryColor, getTextColor, getMutedColor, getGridColor } from "@/lib/chartConfig";
import { useEffect, useState } from "react";

export type CategoryData = {
  name: string;
  value: number;
  color?: string;
};

type Props = {
  data: CategoryData[];
  height?: number;
};

export function CategoryBreakdownChart({ data, height = 300 }: Props) {
  const [isDark, setIsDark] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const isDarkMode = document.documentElement.getAttribute("data-theme") === "dark";
    setIsDark(isDarkMode);

    // Check for mobile
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
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

  // Mobile: smaller radius, no inline labels
  // Desktop: larger radius with labels
  const outerRadius = isMobile ? 60 : 80;
  const innerRadius = isMobile ? 30 : 0; // Donut on mobile for cleaner look

  return (
    <ResponsiveContainer width="100%" height={isMobile ? height - 40 : height}>
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
        >
          {dataWithColors.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
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
          }}
          iconType="circle"
          iconSize={isMobile ? 8 : 10}
          layout={isMobile ? "horizontal" : "horizontal"}
          align="center"
          verticalAlign="bottom"
        />
      </PieChart>
    </ResponsiveContainer>
  );
}


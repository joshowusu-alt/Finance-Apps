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

  // Assign colors to categories
  const dataWithColors = data.map((item) => ({
    ...item,
    color: item.color || getCategoryColor(item.name),
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={dataWithColors}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={(entry) => {
            const percent = ((entry.value / data.reduce((sum, d) => sum + d.value, 0)) * 100).toFixed(0);
            return `${entry.name} ${percent}%`;
          }}
          outerRadius={80}
          fill={chartColors.primary}
          dataKey="value"
          animationDuration={400}
          animationEasing="ease-out"
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
          }}
          formatter={(value: number | undefined) => value !== undefined ? formatCurrency(value) : ""}
        />
        <Legend
          wrapperStyle={{ paddingTop: 16 }}
          iconType="circle"
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

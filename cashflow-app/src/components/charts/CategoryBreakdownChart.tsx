"use client";

import { DonutChart } from "./DonutChart";

export type CategoryData = {
  name: string;
  value: number;
  color?: string;
};

export function CategoryBreakdownChart({
  data,
  height,
  onCategoryClick,
}: {
  data: Array<{ name: string; value: number; color?: string }>;
  height?: number;
  onCategoryClick?: (name: string) => void;
}) {
  return (
    <DonutChart
      data={data}
      height={height ?? 300}
      onCategoryClick={onCategoryClick}
      showLegend
    />
  );
}


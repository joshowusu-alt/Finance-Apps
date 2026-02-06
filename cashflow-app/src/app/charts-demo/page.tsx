"use client";

import { SpendingTrendChart, CategoryBreakdownChart, CashflowProjectionChart } from "@/components/charts";
import type { SpendingDataPoint, CategoryData, CashflowDataPoint } from "@/components/charts";
import ThemeToggle from "@/components/ThemeToggle";

// Sample data for demonstration
const spendingData: SpendingDataPoint[] = [
  { date: "Jan", spending: 2400, income: 3200 },
  { date: "Feb", spending: 2100, income: 3200 },
  { date: "Mar", spending: 2800, income: 3500 },
  { date: "Apr", spending: 2600, income: 3200 },
  { date: "May", spending: 3100, income: 3800 },
  { date: "Jun", spending: 2900, income: 3200 },
];

const categoryData: CategoryData[] = [
  { name: "Groceries", value: 450 },
  { name: "Rent", value: 1200 },
  { name: "Transport", value: 200 },
  { name: "Entertainment", value: 150 },
  { name: "Utilities", value: 180 },
  { name: "Dining", value: 220 },
];

const cashflowData: CashflowDataPoint[] = [
  { date: "Week 1", balance: 2500, projected: 2600 },
  { date: "Week 2", balance: 2200, projected: 2300 },
  { date: "Week 3", balance: 1800, projected: 1900 },
  { date: "Week 4", balance: 2100, projected: 2200 },
  { date: "Week 5", balance: 2400, projected: 2500 },
  { date: "Week 6", balance: 2800, projected: 2900 },
];

export default function ChartsDemoPage() {
  return (
    <div className="min-h-screen p-6 md:p-8" style={{ background: "var(--vn-bg)" }}>
      {/* Theme Toggle */}
      <div style={{ position: "fixed", top: 20, right: 20, zIndex: 1000 }}>
        <ThemeToggle />
      </div>

      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--vn-text)" }}>
          Charts & Visualizations
        </h1>
        <p style={{ color: "var(--vn-muted)" }}>
          Interactive charts with Gen Z Velanovo theme
        </p>
      </div>

      {/* Charts Grid */}
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Spending Trend */}
        <div className="vn-card p-6">
          <h2 className="text-xl font-bold mb-4" style={{ color: "var(--vn-text)" }}>
            Spending Trend
          </h2>
          <p className="text-sm mb-6" style={{ color: "var(--vn-muted)" }}>
            Track your monthly spending and income over time
          </p>
          <SpendingTrendChart data={spendingData} showIncome={true} height={350} />
        </div>

        {/* Two Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Category Breakdown */}
          <div className="vn-card p-6">
            <h2 className="text-xl font-bold mb-4" style={{ color: "var(--vn-text)" }}>
              Category Breakdown
            </h2>
            <p className="text-sm mb-6" style={{ color: "var(--vn-muted)" }}>
              Where your money goes
            </p>
            <CategoryBreakdownChart data={categoryData} height={350} />
          </div>

          {/* Cashflow Projection */}
          <div className="vn-card p-6">
            <h2 className="text-xl font-bold mb-4" style={{ color: "var(--vn-text)" }}>
              Cashflow Projection
            </h2>
            <p className="text-sm mb-6" style={{ color: "var(--vn-muted)" }}>
              Balance forecast with low balance alerts
            </p>
            <CashflowProjectionChart
              data={cashflowData}
              showProjection={true}
              height={350}
              lowBalanceThreshold={1500}
            />
          </div>
        </div>

        {/* Features */}
        <div className="vn-card p-6">
          <h2 className="text-xl font-bold mb-4" style={{ color: "var(--vn-text)" }}>
            Chart Features
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2" style={{ color: "var(--vn-text)" }}>
                <span className="vn-badge vn-badge-primary">Theme-Aware</span>
              </h3>
              <p className="text-sm" style={{ color: "var(--vn-muted)" }}>
                Automatically adapts to light/dark mode with Gen Z color palette
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2" style={{ color: "var(--vn-text)" }}>
                <span className="vn-badge vn-badge-success">Responsive</span>
              </h3>
              <p className="text-sm" style={{ color: "var(--vn-muted)" }}>
                Works perfectly on mobile, tablet, and desktop screens
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2" style={{ color: "var(--vn-text)" }}>
                <span className="vn-badge vn-badge-warning">Interactive</span>
              </h3>
              <p className="text-sm" style={{ color: "var(--vn-muted)" }}>
                Hover tooltips show detailed information with smooth animations
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2" style={{ color: "var(--vn-text)" }}>
                <span className="vn-badge vn-badge-error">Accessible</span>
              </h3>
              <p className="text-sm" style={{ color: "var(--vn-muted)" }}>
                WCAG compliant colors and proper contrast ratios
              </p>
            </div>
          </div>
        </div>

        {/* Usage Instructions */}
        <div className="vn-card p-6">
          <h2 className="text-xl font-bold mb-4" style={{ color: "var(--vn-text)" }}>
            How to Use
          </h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2" style={{ color: "var(--vn-text)" }}>
                Import Charts
              </h3>
              <pre className="bg-zinc-900 text-zinc-100 p-4 rounded-lg overflow-x-auto text-sm">
{`import {
  SpendingTrendChart,
  CategoryBreakdownChart,
  CashflowProjectionChart
} from "@/components/charts";`}
              </pre>
            </div>
            <div>
              <h3 className="font-semibold mb-2" style={{ color: "var(--vn-text)" }}>
                Example Usage
              </h3>
              <pre className="bg-zinc-900 text-zinc-100 p-4 rounded-lg overflow-x-auto text-sm">
{`<SpendingTrendChart
  data={yourData}
  showIncome={true}
  height={350}
/>`}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

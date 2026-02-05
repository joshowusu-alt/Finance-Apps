# Premium Component Usage Examples

Complete guide to using the new premium components in your app.

---

## 🎨 Card Components

### Basic Card
```tsx
import { Card } from '@/components/Card';

<Card>
  <h3>My Content</h3>
  <p>Card content goes here</p>
</Card>
```

### Card with Header
```tsx
import { Card, CardHeader } from '@/components/Card';

<Card>
  <CardHeader
    title="Dashboard Overview"
    subtitle="Your financial summary"
    icon={
      <svg className="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    }
    action={
      <Button variant="ghost" size="sm">View All</Button>
    }
  />
  <div className="space-y-4">
    {/* Card content */}
  </div>
</Card>
```

### Stat Card (Dashboard Metrics)
```tsx
import { StatCard } from '@/components/Card';

<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
  <StatCard
    label="Total Balance"
    value="£5,432.50"
    change="+12.5%"
    trend="up"
    icon={
      <div className="w-12 h-12 rounded-full bg-success-soft flex items-center justify-center">
        <svg className="w-6 h-6 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      </div>
    }
    delay={0}
  />

  <StatCard
    label="This Month"
    value="£1,234.00"
    change="-3.2%"
    trend="down"
    icon={
      <div className="w-12 h-12 rounded-full bg-error-soft flex items-center justify-center">
        <svg className="w-6 h-6 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
        </svg>
      </div>
    }
    delay={0.1}
  />
</div>
```

### Progress Card
```tsx
import { ProgressCard } from '@/components/Card';

<div className="grid gap-4 sm:grid-cols-2">
  <ProgressCard
    label="Spending Budget"
    current={850}
    total={1000}
    percentage={85}
    color="blue"
    delay={0}
  />

  <ProgressCard
    label="Savings Goal"
    current={450}
    total={500}
    percentage={90}
    color="green"
    delay={0.1}
  />

  <ProgressCard
    label="Budget Remaining"
    current={150}
    total={1000}
    percentage={15}
    color="red"
    delay={0.2}
  />
</div>
```

### Alert Card
```tsx
import { AlertCard } from '@/components/Card';

<AlertCard
  type="warning"
  title="Low Balance Alert"
  message="Your account balance is below £500. Consider reviewing your spending."
  action={
    <Button variant="secondary" size="sm">
      Review Spending
    </Button>
  }
  onDismiss={() => console.log('Dismissed')}
  delay={0}
/>

<AlertCard
  type="success"
  title="Budget Goal Reached!"
  message="Congratulations! You've saved £500 this month."
  delay={0.1}
/>

<AlertCard
  type="info"
  title="New Feature Available"
  message="Check out our new bill tracking feature to stay on top of payments."
  action={
    <Button variant="primary" size="sm">Learn More</Button>
  }
  delay={0.2}
/>
```

---

## 🔘 Button Components

### Primary Actions
```tsx
import { Button } from '@/components/Button';

<Button variant="primary" onClick={() => handleSave()}>
  Save Changes
</Button>

<Button
  variant="primary"
  loading={isLoading}
  icon={
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  }
>
  Add Transaction
</Button>
```

### Button Variants
```tsx
<div className="flex gap-3">
  <Button variant="primary">Primary</Button>
  <Button variant="secondary">Secondary</Button>
  <Button variant="ghost">Ghost</Button>
  <Button variant="danger">Delete</Button>
</div>
```

### Button Sizes
```tsx
<div className="flex items-center gap-3">
  <Button size="sm">Small</Button>
  <Button size="md">Medium</Button>
  <Button size="lg">Large</Button>
</div>
```

### Icon Buttons
```tsx
import { IconButton } from '@/components/Button';

<IconButton
  icon={
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  }
  label="Add new item"
  variant="primary"
/>

<IconButton
  icon={
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  }
  label="Delete"
  variant="danger"
/>
```

### Button with Loading State
```tsx
const [loading, setLoading] = useState(false);

<Button
  loading={loading}
  onClick={async () => {
    setLoading(true);
    await saveData();
    setLoading(false);
  }}
>
  Save
</Button>
```

---

## 📭 Empty State Components

### Basic Empty State
```tsx
import EmptyState from '@/components/EmptyState';

<EmptyState
  icon="📊"
  title="No Transactions Yet"
  description="Start tracking your finances by adding your first transaction."
  action={{
    label: "Add Transaction",
    onClick: () => router.push('/transactions/new')
  }}
  secondaryAction={{
    label: "Import from Bank",
    onClick: () => setShowImport(true)
  }}
/>
```

### Specialized Empty States
```tsx
import { NoDataEmptyState, NoResultsEmptyState, ErrorEmptyState } from '@/components/EmptyState';

// No data
<NoDataEmptyState onImport={() => setShowImport(true)} />

// No search results
<NoResultsEmptyState onReset={() => clearFilters()} />

// Error state
<ErrorEmptyState onRetry={() => fetchData()} />
```

### Custom Illustration
```tsx
<EmptyState
  illustration={
    <svg className="w-32 h-32 text-(--text-tertiary)" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  }
  title="No Documents"
  description="Upload or create your first document to get started."
  action={{
    label: "Upload Document",
    onClick: () => handleUpload()
  }}
/>
```

---

## 💀 Skeleton Loading States

### Basic Usage
```tsx
import Skeleton, { TransactionSkeleton, CardSkeleton, DashboardSkeleton } from '@/components/Skeleton';

// Loading state for a page
{loading ? <DashboardSkeleton /> : <Dashboard />}

// Loading state for a list
{loading ? (
  <div className="space-y-3">
    {[...Array(5)].map((_, i) => (
      <TransactionSkeleton key={i} />
    ))}
  </div>
) : (
  <TransactionList />
)}

// Loading state for cards
{loading ? (
  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
    <CardSkeleton />
    <CardSkeleton />
    <CardSkeleton />
  </div>
) : (
  <CardGrid />
)}
```

### Custom Skeleton
```tsx
<div className="card-premium p-6">
  <div className="flex items-center gap-3 mb-4">
    <Skeleton className="h-12 w-12 rounded-full" />
    <div className="flex-1">
      <Skeleton className="h-4 w-32 mb-2" />
      <Skeleton className="h-3 w-24" />
    </div>
  </div>
  <Skeleton className="h-24 w-full" />
</div>
```

---

## 🔔 Toast Notifications

### Basic Usage
```tsx
import { toast } from '@/components/Toast';

// Success toast
toast.success("Changes saved successfully!");

// Error toast
toast.error("Failed to save changes");

// Warning toast
toast.warning("Please review your budget");

// Info toast
toast.info("New update available");

// Custom duration
toast.success("Saved!", 2000);
```

### In Form Submission
```tsx
const handleSubmit = async (data) => {
  try {
    await saveTransaction(data);
    toast.success("Transaction added successfully!");
    router.push('/transactions');
  } catch (error) {
    toast.error("Failed to add transaction. Please try again.");
  }
};
```

### With Actions
```tsx
// The toast will auto-dismiss, but users can also dismiss manually
toast.info("New features are available. Check them out!", 5000);
```

---

## 🎯 Complete Page Example

### Dashboard Page with Premium Components
```tsx
"use client";

import { useState } from 'react';
import { Card, CardHeader, StatCard, ProgressCard, AlertCard } from '@/components/Card';
import { Button, IconButton } from '@/components/Button';
import EmptyState from '@/components/EmptyState';
import { DashboardSkeleton } from '@/components/Skeleton';
import { toast } from '@/components/Toast';

export default function DashboardPage() {
  const [loading, setLoading] = useState(false);
  const hasData = true;

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (!hasData) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <EmptyState
          icon="💰"
          title="Welcome to Your Dashboard"
          description="Get started by adding your first transaction or connecting your bank account."
          action={{
            label: "Add Transaction",
            onClick: () => toast.info("Opening transaction form...")
          }}
          secondaryAction={{
            label: "Connect Bank",
            onClick: () => toast.info("Opening bank connection...")
          }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-(--text-primary)">Dashboard</h1>
          <p className="text-(--text-secondary) mt-1">Welcome back, here's your overview</p>
        </div>
        <Button
          variant="primary"
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          }
          onClick={() => toast.success("Adding transaction...")}
        >
          Add Transaction
        </Button>
      </div>

      {/* Alerts */}
      <AlertCard
        type="warning"
        title="Budget Alert"
        message="You've spent 85% of your monthly budget with 10 days remaining."
        action={
          <Button variant="secondary" size="sm">
            Review Budget
          </Button>
        }
        onDismiss={() => toast.info("Alert dismissed")}
      />

      {/* Stats Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Balance"
          value="£5,432.50"
          change="+12.5%"
          trend="up"
          delay={0}
        />
        <StatCard
          label="Income (MTD)"
          value="£3,200.00"
          change="+8.2%"
          trend="up"
          delay={0.1}
        />
        <StatCard
          label="Expenses (MTD)"
          value="£2,150.00"
          change="-5.1%"
          trend="down"
          delay={0.2}
        />
        <StatCard
          label="Savings"
          value="£1,050.00"
          change="+15.3%"
          trend="up"
          delay={0.3}
        />
      </div>

      {/* Progress Cards */}
      <Card>
        <CardHeader
          title="Budget Overview"
          subtitle="Your spending this month"
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <ProgressCard
            label="Groceries"
            current={350}
            total={400}
            percentage={87.5}
            color="blue"
          />
          <ProgressCard
            label="Transportation"
            current={120}
            total={150}
            percentage={80}
            color="green"
          />
        </div>
      </Card>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Recent Transactions"
            action={
              <Button variant="ghost" size="sm">View All</Button>
            }
          />
          {/* Transaction list */}
        </Card>

        <Card>
          <CardHeader
            title="Quick Actions"
          />
          <div className="space-y-3">
            <Button fullWidth variant="primary">
              Add Transaction
            </Button>
            <Button fullWidth variant="secondary">
              View Reports
            </Button>
            <Button fullWidth variant="ghost">
              Export Data
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
```

---

## 🎨 Styling Tips

### Using Design Tokens
```tsx
// Colors
<div className="text-(--text-primary)">Primary text</div>
<div className="text-(--text-secondary)">Secondary text</div>
<div className="text-accent">Accent color</div>
<div className="bg-success-soft text-success">Success badge</div>

// Surfaces
<div className="bg-surface-elevated">Elevated surface</div>
<div className="bg-(--surface-soft)">Soft surface</div>

// Borders
<div className="border border-(--border)">Default border</div>
<div className="border border-(--border-hover)">Hover border</div>
```

### Utility Classes
```tsx
// Cards
<div className="card-premium p-6">Premium card</div>

// Buttons
<button className="button-premium">Primary button</button>
<button className="button-secondary">Secondary button</button>

// Inputs
<input className="input-premium" placeholder="Enter value" />

// Badges
<span className="badge-success">Success</span>
<span className="badge-error">Error</span>
<span className="badge-warning">Warning</span>
<span className="badge-info">Info</span>
```

---

## 🚀 Best Practices

1. **Always use loading states** - Never leave users wondering
```tsx
{loading ? <Skeleton /> : <Content />}
```

2. **Provide feedback** - Use toasts for user actions
```tsx
toast.success("Saved!");
```

3. **Handle empty states** - Guide users when there's no data
```tsx
{data.length === 0 ? <EmptyState /> : <DataList />}
```

4. **Stagger animations** - Use delays for better perceived performance
```tsx
<StatCard delay={0} />
<StatCard delay={0.1} />
<StatCard delay={0.2} />
```

5. **Use semantic colors** - Leverage the design token system
```tsx
<div className="text-success">Positive change</div>
<div className="text-error">Negative change</div>
```

---

## 📱 Responsive Design

All components are responsive by default. Use Tailwind breakpoints:

```tsx
<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
  <StatCard />
  <StatCard />
  <StatCard />
  <StatCard />
</div>
```

---

**Ready to build premium experiences! 🎉**

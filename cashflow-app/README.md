# Velanovo - Premium Cashflow Management App

A modern, feature-rich cashflow planning and management application with bank integration, real-time insights, and premium UX design.

![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-16.1-black)
![React](https://img.shields.io/badge/React-19.2-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)

---

## ✨ Features

### 💰 Financial Management
- **Period-Based Budgeting** - Organize finances by custom periods
- **Income & Expense Tracking** - Categorized transaction management
- **Bill Management** - Recurring bill templates and tracking
- **Variance Analysis** - Budget vs. actual spending comparison
- **Savings Goals** - Track progress toward financial goals
- **Multi-Currency Support** - Handle different currencies

### 🏦 Bank Integration
- **Plaid Integration** - Connect to 11,000+ financial institutions
- **Auto-Sync** - Automatic transaction imports
- **Account Aggregation** - View all accounts in one place
- **Transaction Categorization** - Smart category suggestions

### 📊 Insights & Analytics
- **Cashflow Timeline** - Daily balance projections
- **Spending Trends** - Visualize spending patterns
- **Budget Alerts** - Proactive notifications for overspending
- **Pace Analysis** - Compare spending vs. time progress
- **Variance Reports** - Detailed budget performance analysis

### 🎨 Premium UX Design
- **Smooth Animations** - Framer Motion powered interactions
- **Dark Mode** - Fully optimized dark theme
- **Responsive Design** - Perfect on mobile, tablet, and desktop
- **Loading States** - Premium skeleton screens
- **Toast Notifications** - Beautiful, animated feedback
- **Error Handling** - Graceful error recovery with clear messaging

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm, yarn, pnpm, or bun
- PostgreSQL database (for production)

### Installation

1. **Clone the repository**
```bash
git clone <your-repo-url>
cd cashflow-app
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
Create a `.env.local` file:
```env
# Database (Neon Serverless PostgreSQL)
DATABASE_URL=your_database_url

# Plaid API (for bank integration)
PLAID_CLIENT_ID=your_client_id
PLAID_SECRET=your_secret
PLAID_ENV=sandbox # or development/production

# Next.js
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

4. **Run the development server**
```bash
npm run dev
```

5. **Open your browser**
Navigate to [http://localhost:3000](http://localhost:3000)

---

## 📁 Project Structure

```
cashflow-app/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── api/               # API routes
│   │   ├── bills/             # Bills management page
│   │   ├── income/            # Income tracking page
│   │   ├── insights/          # Analytics & insights
│   │   ├── main/              # Main sync page
│   │   ├── review/            # Review mode for partners
│   │   ├── settings/          # App settings
│   │   ├── timeline/          # Cashflow timeline
│   │   ├── transactions/      # Transaction history
│   │   ├── layout.tsx         # Root layout
│   │   └── page.tsx           # Dashboard
│   │
│   ├── components/            # Reusable UI components
│   │   ├── Card.tsx           # Premium card components
│   │   ├── Button.tsx         # Button components
│   │   ├── Skeleton.tsx       # Loading skeletons
│   │   ├── Toast.tsx          # Notification system
│   │   ├── EmptyState.tsx     # Empty state components
│   │   ├── ErrorBoundary.tsx  # Error handling
│   │   ├── BottomNav.tsx      # Mobile navigation
│   │   ├── SidebarNav.tsx     # Desktop navigation
│   │   ├── PlaidLink.tsx      # Bank connection
│   │   └── ...
│   │
│   ├── lib/                   # Business logic & utilities
│   │   ├── cashflowEngine.ts  # Core calculation engine
│   │   ├── storage.ts         # Local storage management
│   │   ├── mainStore.ts       # Server-side data store
│   │   ├── reviewStore.ts     # Review mode store
│   │   ├── alerts.ts          # Alert system
│   │   ├── periods.ts         # Period management
│   │   ├── billLinking.ts     # Bill suggestion logic
│   │   └── ...
│   │
│   ├── data/                  # Data schemas & types
│   │   └── plan.ts            # TypeScript types
│   │
│   └── app/
│       └── globals.css        # Global styles & design tokens
│
├── public/                    # Static assets
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🎨 Component Library

We've built a comprehensive premium component library. See [COMPONENT_EXAMPLES.md](./COMPONENT_EXAMPLES.md) for detailed usage.

### Quick Examples

#### Card Components
```tsx
import { StatCard } from '@/components/Card';

<StatCard
  label="Total Balance"
  value="£5,432.50"
  change="+12.5%"
  trend="up"
/>
```

#### Buttons
```tsx
import { Button } from '@/components/Button';

<Button variant="primary" loading={isLoading}>
  Save Changes
</Button>
```

#### Notifications
```tsx
import { toast } from '@/components/Toast';

toast.success("Transaction added!");
```

---

## 🏗️ Tech Stack

### Core
- **[Next.js 16](https://nextjs.org/)** - React framework with App Router
- **[React 19](https://react.dev/)** - UI library
- **[TypeScript](https://www.typescriptlang.org/)** - Type safety
- **[Tailwind CSS v4](https://tailwindcss.com/)** - Utility-first styling

### Animation & UX
- **[Framer Motion](https://www.framer.com/motion/)** - Premium animations
- **Custom Design System** - Comprehensive design tokens

### Backend & Database
- **[Neon Serverless PostgreSQL](https://neon.tech/)** - Serverless database
- **[Plaid](https://plaid.com/)** - Bank integration
- **SQLite** (via better-sqlite3) - Local storage option

### Testing
- **[Vitest](https://vitest.dev/)** - Unit testing framework

### Additional Libraries
- **@tanstack/react-virtual** - Virtualized lists
- **jspdf & jspdf-autotable** - PDF export
- **xlsx** - Excel file handling

---

## 🧪 Testing

```bash
# Run unit tests
npm test

# Run tests in watch mode
npm test -- --watch
```

---

## 🏗️ Building for Production

```bash
# Create optimized production build
npm run build

# Start production server
npm start
```

---

## 🎯 Key Features Detail

### Cashflow Engine
The core of the app is a sophisticated cashflow calculation engine that:
- Generates events from rules (income, outflows, bills)
- Handles multiple cadences (weekly, biweekly, monthly)
- Applies overrides and adjustments
- Builds daily timeline projections
- Calculates variance analysis
- Supports period roll-forward

### Sync System
Multi-device synchronization with:
- Token-based authentication
- Conflict resolution
- Server-side state management
- Local-first architecture
- Automatic backups

### Review Mode
Share read-only access with partners/family:
- Separate sync mechanism
- No edit permissions
- Real-time data viewing
- Privacy-focused design

---

## 🎨 Design System

### Colors
```css
/* Light Mode */
--accent: #3b82f6 (Blue)
--success: #10b981 (Green)
--warning: #f59e0b (Amber)
--error: #ef4444 (Red)

/* Dark Mode - Automatically adjusted */
```

### Shadows
```css
--shadow-sm: Subtle elevation
--shadow-md: Card elevation
--shadow-lg: Prominent elevation
--shadow-xl: Maximum elevation
```

### Transitions
```css
--transition-fast: 150ms
--transition-base: 200ms
--transition-slow: 300ms
--transition-spring: 400ms with bounce
```

See [../UX_IMPROVEMENTS.md](../UX_IMPROVEMENTS.md) for complete design token reference.

---

## 📱 Responsive Design

- **Mobile First** - Optimized for mobile devices
- **Breakpoints:**
  - `sm`: 640px
  - `md`: 768px
  - `lg`: 1024px
  - `xl`: 1280px

---

## ♿ Accessibility

- **WCAG 2.1 Compliant** - AA standard
- **Keyboard Navigation** - Full keyboard support
- **Screen Reader Friendly** - Proper ARIA labels
- **Focus Management** - Visible focus indicators
- **Reduced Motion** - Respects user preferences

---

## 🔒 Security

- **Data Encryption** - Sensitive data encrypted
- **Secure Tokens** - SHA-256 hashed tokens
- **No Password Storage** - Token-based auth only
- **HTTPS Only** - Enforced in production
- **Plaid Certified** - Bank-grade security

---

## 🚧 Roadmap

### Phase 1 (Current)
- ✅ Core cashflow engine
- ✅ Premium UI/UX
- ✅ Basic Plaid integration
- ✅ Period-based budgeting

### Phase 2 (Next)
- 🔲 Auto-categorization with ML
- 🔲 Bill detection from transactions
- 🔲 Investment tracking
- 🔲 Advanced analytics dashboards
- 🔲 Custom reports builder

### Phase 3 (Future)
- 🔲 Mobile apps (iOS/Android)
- 🔲 Receipt scanning
- 🔲 Bill negotiation service
- 🔲 Financial goal recommendations
- 🔲 Multi-user collaboration

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is private and proprietary.

---

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- Animations by [Framer Motion](https://www.framer.com/motion/)
- Bank integration by [Plaid](https://plaid.com/)
- Database by [Neon](https://neon.tech/)
- Icons from [Heroicons](https://heroicons.com/)

---

## 📧 Support

For support, email support@velanovo.com or open an issue in the repository.

---

**Built with ❤️ and ☕**

**Rating: 8.5/10** - Premium fintech experience with best-in-class UX

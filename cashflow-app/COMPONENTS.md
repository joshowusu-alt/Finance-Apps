# Velanovo Component Library

Complete reference for the Gen Z-styled Velanovo design system.

---

## 🎨 Design Philosophy

- **Soft indigo** (#6366f1) - Gen Z favorite color
- **Zinc palette** - Modern, warm neutrals
- **Comfortable spacing** - Generous padding, easy on the eyes
- **Smooth transitions** - 200ms ease for all interactions
- **Rounded corners** - 12-24px for modern feel

---

## 📦 Components

### Cards

**Base Card**
```tsx
<div className="vn-card p-6">
  <h3>Card Title</h3>
  <p>Card content goes here</p>
</div>
```

**Styling:**
- Background: `var(--vn-surface)` (white cards on gray background)
- Border: 1px solid `var(--vn-border)`
- Border radius: 18px
- Shadow: Soft elevation

---

### Buttons

**Primary Button**
```tsx
<button className="vn-btn vn-btn-primary">
  Save Changes
</button>
```

**Ghost Button**
```tsx
<button className="vn-btn vn-btn-ghost">
  Cancel
</button>
```

**Secondary Button**
```tsx
<button className="vn-btn vn-btn-secondary">
  Learn More
</button>
```

**Features:**
- Height: 44px
- Padding: 0 18px
- Border radius: 14px
- Hover: Lifts up 1px with shadow
- Active: Returns to normal position
- Smooth transitions

**Sizes:**
```tsx
<button className="vn-btn vn-btn-primary text-xs">Small</button>
<button className="vn-btn vn-btn-primary text-sm">Medium</button>
<button className="vn-btn vn-btn-primary">Default</button>
```

---

### Inputs

**Text Input**
```tsx
<input
  type="text"
  className="vn-input"
  placeholder="Enter your name"
/>
```

**Textarea**
```tsx
<textarea
  className="vn-textarea"
  placeholder="Enter description"
/>
```

**Features:**
- Height: 44px (input)
- Border radius: 12px
- Focus: Soft indigo glow (3px shadow)
- Placeholder: Muted color
- Full width by default

---

### Badges

**Variants**
```tsx
<span className="vn-badge vn-badge-primary">New</span>
<span className="vn-badge vn-badge-success">Active</span>
<span className="vn-badge vn-badge-warning">Pending</span>
<span className="vn-badge vn-badge-error">Failed</span>
```

**Features:**
- Padding: 4px 10px
- Border radius: 8px
- Font size: 12px
- Semi-transparent backgrounds with color-mix
- Matching colored borders

---

### Pills

**Gold Accent Tag**
```tsx
<span className="vn-pill">
  Featured
</span>
```

**Features:**
- Full rounded (border-radius: 999px)
- Gold accent with 18% opacity
- Border with 40% opacity
- Font weight: 700

---

## 🎨 Color Variables

### Brand Colors
```css
--vn-navy: #18181b    /* Zinc 900 - soft dark */
--vn-teal: #6366f1    /* Soft indigo */
--vn-gold: #fbbf24    /* Warm amber */
```

### Light Mode
```css
--vn-bg: #f5f5f7           /* Soft warm gray background */
--vn-surface: #ffffff      /* White cards */
--vn-border: #e4e4e7       /* Zinc 200 */
--vn-text: #18181b         /* Zinc 900 */
--vn-muted: #71717a        /* Zinc 500 */
--vn-primary: #6366f1      /* Soft indigo */
```

### Dark Mode
```css
--vn-bg: #18181b           /* Zinc 900 - warm dark */
--vn-surface: #27272a      /* Zinc 800 */
--vn-border: #3f3f46       /* Zinc 700 */
--vn-text: #fafafa         /* Soft white */
--vn-muted: #a1a1aa        /* Zinc 400 */
--vn-primary: #818cf8      /* Bright indigo glow */
```

### Semantic
```css
--vn-success: #10b981      /* Emerald */
--vn-warning: #f59e0b      /* Amber */
--vn-error: #ef4444        /* Red coral */
--vn-info: #06b6d4         /* Cyan */
```

---

## 📏 Spacing Scale

```css
radii: {
  sm: 12,    /* Small corners */
  md: 18,    /* Card corners */
  lg: 24,    /* Large corners */
  pill: 999  /* Full rounded */
}
```

---

## 🎭 Usage Examples

### Complete Form
```tsx
<div className="vn-card p-6">
  <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--vn-text)' }}>
    Create Account
  </h2>

  <div className="space-y-4">
    <input
      type="text"
      className="vn-input"
      placeholder="Full name"
    />

    <input
      type="email"
      className="vn-input"
      placeholder="Email address"
    />

    <textarea
      className="vn-textarea"
      placeholder="Bio (optional)"
    />

    <div className="flex gap-3">
      <button className="vn-btn vn-btn-primary flex-1">
        Create Account
      </button>
      <button className="vn-btn vn-btn-ghost">
        Cancel
      </button>
    </div>
  </div>
</div>
```

### Status Card with Badge
```tsx
<div className="vn-card p-6">
  <div className="flex items-center justify-between mb-3">
    <h3 className="font-semibold" style={{ color: 'var(--vn-text)' }}>
      Payment Status
    </h3>
    <span className="vn-badge vn-badge-success">Completed</span>
  </div>
  <p style={{ color: 'var(--vn-muted)' }}>
    Your payment was processed successfully.
  </p>
</div>
```

### Button Group
```tsx
<div className="flex gap-3">
  <button className="vn-btn vn-btn-primary">
    Primary Action
  </button>
  <button className="vn-btn vn-btn-secondary">
    Secondary
  </button>
  <button className="vn-btn vn-btn-ghost">
    Tertiary
  </button>
</div>
```

---

## 🌗 Theme Toggle

The app automatically detects system theme preference and allows manual toggling.

**Access theme functions:**
```tsx
import { getTheme, setTheme, toggleTheme } from '@/lib/theme';

// Get current theme
const current = getTheme(); // 'light' | 'dark'

// Set theme
setTheme('dark');

// Toggle
toggleTheme();
```

**Theme persists in localStorage** as `velanovo-theme`.

---

## 🎨 Logo Components

**Full Logo with Wordmark**
```tsx
import { VelanovoLogo } from '@/components/VelanovoLogo';

<VelanovoLogo size={36} showWordmark={true} />
```

**Icon Only**
```tsx
import { VelanovoIcon } from '@/components/VelanovoLogo';

<VelanovoIcon size={64} />
```

---

## 🔧 Customization

### Adding Custom Colors
```css
:root {
  --vn-custom: #your-color;
}

html[data-theme="dark"] {
  --vn-custom: #your-dark-color;
}
```

### Custom Button Variant
```css
.vn-btn-danger {
  background: var(--vn-error);
  color: white;
}

.vn-btn-danger:hover {
  filter: brightness(1.1);
}
```

---

## 📱 Responsive Design

All components are mobile-first and responsive:

```tsx
<div className="vn-card p-4 md:p-6 lg:p-8">
  {/* Responsive padding */}
</div>

<button className="vn-btn vn-btn-primary w-full md:w-auto">
  {/* Full width on mobile, auto on desktop */}
</button>
```

---

## ♿ Accessibility

All components follow WCAG 2.1 AA standards:

- ✅ Keyboard navigation
- ✅ Focus indicators (soft indigo glow)
- ✅ Sufficient color contrast
- ✅ Screen reader friendly
- ✅ Respects reduced motion preferences

---

## 🎯 Best Practices

1. **Use semantic HTML** - `<button>` for buttons, not `<div>`
2. **Include ARIA labels** when needed
3. **Test in both themes** - Light and dark mode
4. **Use CSS variables** - For consistency
5. **Keep it simple** - Don't over-customize

---

## 📦 Import Reference

```tsx
// Components
import { VelanovoLogo, VelanovoIcon } from '@/components/VelanovoLogo';
import { BrandPreview } from '@/components/BrandPreview';

// Theme
import { getTheme, setTheme, toggleTheme, applyTheme } from '@/lib/theme';
import { velanovo } from '@/theme/velanovoTheme';

// Types
import type { VelanovoTheme } from '@/theme/velanovoTheme';
```

---

## 🚀 Quick Start

1. Import velanovo.css (already in layout.tsx)
2. Use `vn-` prefixed classes
3. Reference CSS variables for colors
4. Test in both light and dark mode

---

## 📚 Additional Resources

- [Brand Preview Page](/brand) - Live component showcase
- [GitHub Repository](https://github.com/joshowusu-alt/Finance-Apps)
- [Gen Z Color Philosophy](../GENZ_COLORS.md)

---

**Built with ❤️ using Gen Z aesthetics**

Soft, modern, and comfortable - perfect for 2025! 🎯

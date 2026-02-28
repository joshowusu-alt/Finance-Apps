"use client";

import { VelanovoLogo, VelanovoIcon } from "./VelanovoLogo";

export function BrandPreview() {
  return (
    <div style={{ padding: 40, maxWidth: 1200, margin: "0 auto" }}>
      <h1
        style={{
          fontSize: 32,
          fontWeight: 800,
          marginBottom: 32,
          color: "var(--vn-text)",
        }}
      >
        Velanovo Brand Kit
      </h1>

      {/* Logo Showcase */}
      <section style={{ marginBottom: 48 }}>
        <h2
          style={{
            fontSize: 20,
            fontWeight: 700,
            marginBottom: 16,
            color: "var(--vn-text)",
          }}
        >
          Logo Variants
        </h2>
        <div
          style={{
            display: "grid",
            gap: 24,
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          }}
        >
          <div className="vn-card" style={{ padding: 24 }}>
            <VelanovoLogo size={48} showWordmark={true} />
          </div>
          <div className="vn-card" style={{ padding: 24 }}>
            <VelanovoLogo size={36} showWordmark={false} />
          </div>
          <div className="vn-card" style={{ padding: 24 }}>
            <VelanovoIcon size={64} />
          </div>
        </div>
      </section>

      {/* Colors */}
      <section style={{ marginBottom: 48 }}>
        <h2
          style={{
            fontSize: 20,
            fontWeight: 700,
            marginBottom: 16,
            color: "var(--vn-text)",
          }}
        >
          Brand Colors
        </h2>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {[
            { name: "Navy", color: "var(--vn-navy)" },
            { name: "Teal", color: "var(--vn-teal)" },
            { name: "Gold", color: "var(--vn-gold)" },
            { name: "Mist", color: "var(--vn-mist)" },
            { name: "Background", color: "var(--vn-bg)" },
            { name: "Surface", color: "var(--vn-surface)" },
          ].map((item) => (
            <div key={item.name} style={{ textAlign: "center" }}>
              <div
                style={{
                  width: 100,
                  height: 100,
                  borderRadius: 18,
                  background: item.color,
                  marginBottom: 8,
                  border: "1px solid var(--vn-border)",
                }}
              />
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--vn-text)",
                }}
              >
                {item.name}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--vn-muted)",
                  fontFamily: "monospace",
                }}
              >
                {item.color}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Buttons */}
      <section style={{ marginBottom: 48 }}>
        <h2
          style={{
            fontSize: 20,
            fontWeight: 700,
            marginBottom: 16,
            color: "var(--vn-text)",
          }}
        >
          Buttons
        </h2>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button className="vn-btn vn-btn-primary">Primary Button</button>
          <button className="vn-btn vn-btn-ghost">Ghost Button</button>
        </div>
      </section>

      {/* Cards */}
      <section>
        <h2
          style={{
            fontSize: 20,
            fontWeight: 700,
            marginBottom: 16,
            color: "var(--vn-text)",
          }}
        >
          Card Component
        </h2>
        <div className="vn-card" style={{ padding: 24, maxWidth: 500 }}>
          <h3
            style={{
              fontSize: 18,
              fontWeight: 700,
              marginBottom: 8,
              color: "var(--vn-text)",
            }}
          >
            Example Card
          </h3>
          <p style={{ color: "var(--vn-muted)", lineHeight: 1.6 }}>
            This is a Velanovo brand card component with rounded corners,
            subtle shadows, and consistent spacing. The design is clean,
            modern, and professional.
          </p>
        </div>
      </section>
    </div>
  );
}

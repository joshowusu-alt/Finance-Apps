"use client";

import { useState } from "react";
import { BUILT_IN_CATEGORIES, type BuiltInCategory, type CustomCategory } from "@/data/plan";

const BUILT_IN_LABELS: Record<BuiltInCategory, { label: string; emoji: string; description: string }> = {
  income:    { label: "Income",    emoji: "💰", description: "Salary, freelance, side income" },
  bill:      { label: "Bills",     emoji: "📋", description: "Rent, utilities, subscriptions" },
  giving:    { label: "Giving",    emoji: "🤝", description: "Donations, gifts, charity" },
  savings:   { label: "Savings",   emoji: "🏦", description: "Emergency fund, investments" },
  allowance: { label: "Allowance", emoji: "🎯", description: "Personal spending, entertainment" },
  buffer:    { label: "Buffer",    emoji: "🛡️", description: "Unexpected expenses" },
  other:     { label: "Other",     emoji: "📦", description: "Miscellaneous" },
};

interface CategoryManagerProps {
  customCategories: CustomCategory[];
  onChange: (categories: CustomCategory[]) => void;
}

export default function CategoryManager({ customCategories, onChange }: CategoryManagerProps) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newParent, setNewParent] = useState<BuiltInCategory>("other");
  const [newEmoji, setNewEmoji] = useState("");

  function handleAdd() {
    if (!newName.trim()) return;
    const cat: CustomCategory = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      icon: newEmoji.trim() || undefined,
      parentCategory: newParent,
    };
    onChange([...customCategories, cat]);
    setNewName("");
    setNewEmoji("");
    setAdding(false);
  }

  function handleDelete(id: string) {
    onChange(customCategories.filter((c) => c.id !== id));
  }

  return (
    <div className="space-y-4">
      {/* Built-in categories */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-(--vn-muted) mb-2">Built-in categories</div>
        <div className="space-y-1">
          {BUILT_IN_CATEGORIES.map((cat) => {
            const info = BUILT_IN_LABELS[cat];
            const subs = customCategories.filter((c) => c.parentCategory === cat);
            return (
              <div key={cat} className="vn-card px-3 py-2">
                <div className="flex items-center gap-2">
                  <span>{info.emoji}</span>
                  <span className="text-sm font-medium text-(--vn-text)">{info.label}</span>
                  <span className="text-xs text-(--vn-muted) flex-1">{info.description}</span>
                </div>
                {subs.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5 pl-6">
                    {subs.map((sub) => (
                      <div
                        key={sub.id}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                        style={{ background: "color-mix(in srgb, var(--vn-gold) 10%, transparent)", color: "var(--vn-text)" }}
                      >
                        {sub.icon && <span>{sub.icon}</span>}
                        <span>{sub.name}</span>
                        <button
                          onClick={() => handleDelete(sub.id)}
                          className="ml-0.5 opacity-50 hover:opacity-100"
                          aria-label={`Delete ${sub.name}`}
                        >×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Add custom category */}
      {adding ? (
        <div className="vn-card p-3 space-y-2">
          <div className="text-xs font-semibold text-(--vn-text)">New custom category</div>
          <div className="flex gap-2">
            <input
              className="vn-input text-sm flex-1"
              placeholder="Category name (e.g. Groceries)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={50}
              autoFocus
            />
            <input
              className="vn-input text-sm w-16 text-center"
              placeholder="😀"
              value={newEmoji}
              onChange={(e) => setNewEmoji(e.target.value)}
              maxLength={4}
            />
          </div>
          <div className="flex gap-2 items-center">
            <label className="text-xs text-(--vn-muted) shrink-0">Under:</label>
            <select
              className="vn-input text-xs flex-1"
              value={newParent}
              onChange={(e) => setNewParent(e.target.value as BuiltInCategory)}
            >
              {BUILT_IN_CATEGORIES.map((c) => (
                <option key={c} value={c}>{BUILT_IN_LABELS[c].label}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} className="vn-btn vn-btn-primary text-xs px-3 py-1.5" disabled={!newName.trim()}>
              Add
            </button>
            <button onClick={() => setAdding(false)} className="vn-btn vn-btn-ghost text-xs px-3 py-1.5">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="vn-btn vn-btn-ghost text-sm w-full"
        >
          + Add custom category
        </button>
      )}
    </div>
  );
}

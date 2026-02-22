"use client";

import { useState } from "react";
import { loadPlan, savePlan } from "@/lib/storage";
import { formatMoney } from "@/lib/currency";
import SidebarNav from "@/components/SidebarNav";
import type { Plan, SavingsGoal, OutflowRule, Transaction } from "@/data/plan";
import { getPeriod } from "@/lib/cashflowEngine";
import { useConfirm } from "@/components/ConfirmDialog";
import { toast } from "@/components/Toast";
import { FormError } from "@/components/FormError";

function generateId() {
    return Math.random().toString(36).substring(2, 15);
}

const GOAL_COLORS = [
    "#C5A046", // gold
    "#5DA9E9", // desaturated blue
    "#2F7A55", // success green
    "#4FAF7B", // soft emerald
    "#9E4E4E", // risk/earth red
    "#AAB2BD", // neutral grey
];

const GOAL_ICONS = ["🎯", "✈️", "🏠", "🚗", "💍", "🎓", "🏥", "🎁", "💰", "🌴"];

/** Returns the label suffix used to link an OutflowRule to a goal */
function goalRuleLabel(goalName: string, goalId: string) {
    return `${goalName} [goal-${goalId}]`;
}

function GoalCard({ goal, onUpdate, onDelete, linkedRule, onToggleAutoSave, transactions }: {
    goal: SavingsGoal;
    onUpdate: (goal: SavingsGoal) => void;
    onDelete: (id: string) => void;
    linkedRule: OutflowRule | null;
    onToggleAutoSave: (goal: SavingsGoal, enable: boolean, monthlyAmount: number) => void;
    transactions: Transaction[];
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [addAmount, setAddAmount] = useState("");

    // Edit form state
    const [editName, setEditName] = useState(goal.name);
    const [editTarget, setEditTarget] = useState(String(goal.targetAmount));
    const [editCurrent, setEditCurrent] = useState(String(goal.currentAmount));
    const [editDate, setEditDate] = useState(goal.targetDate || "");
    const [editIcon, setEditIcon] = useState(goal.icon || "🎯");
    const [editColor, setEditColor] = useState(goal.color || GOAL_COLORS[0]);

    // Linked transactions (from transfer transactions with this goalId)
    const linkedTxns = transactions.filter((t) => t.goalId === goal.id);
    const linkedAmount = linkedTxns.reduce((sum, t) => sum + t.amount, 0);
    const totalSaved = goal.currentAmount + linkedAmount;

    const progress = goal.targetAmount > 0 ? Math.min(100, (totalSaved / goal.targetAmount) * 100) : 0;
    const remaining = goal.targetAmount - totalSaved;
    const isComplete = totalSaved >= goal.targetAmount;

    const handleAddAmount = () => {
        const amount = parseFloat(addAmount);
        if (!isNaN(amount) && amount > 0) {
            onUpdate({ ...goal, currentAmount: goal.currentAmount + amount });
            setAddAmount("");
        }
    };

    const [errors, setErrors] = useState<Record<string, string>>({});

    const validate = () => {
        const newErrors: Record<string, string> = {};
        if (!editName.trim()) newErrors.name = "Name is required";

        const target = parseFloat(editTarget);
        if (isNaN(target) || target <= 0) newErrors.target = "Target must be greater than 0";

        const current = parseFloat(editCurrent);
        if (isNaN(current) || current < 0) newErrors.current = "Cannot be negative";

        if (editDate && new Date(editDate) < new Date(new Date().setHours(0, 0, 0, 0))) {
            newErrors.date = "Target date cannot be in the past";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSaveEdit = () => {
        if (!validate()) return;

        onUpdate({
            ...goal,
            name: editName,
            targetAmount: parseFloat(editTarget),
            currentAmount: parseFloat(editCurrent) || 0,
            targetDate: editDate || undefined,
            icon: editIcon,
            color: editColor,
        });
        setIsEditing(false);
        setErrors({});
    };

    const handleCancelEdit = () => {
        setEditName(goal.name);
        setEditTarget(String(goal.targetAmount));
        setEditCurrent(String(goal.currentAmount));
        setEditDate(goal.targetDate || "");
        setEditIcon(goal.icon || "🎯");
        setEditColor(goal.color || GOAL_COLORS[0]);
        setIsEditing(false);
    };

    const daysUntilTarget = goal.targetDate
        ? Math.max(0, Math.ceil((new Date(goal.targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : null;

    const weeklyNeeded = daysUntilTarget && daysUntilTarget > 0 && remaining > 0
        ? remaining / (daysUntilTarget / 7)
        : null;

    const monthsUntilTarget = daysUntilTarget && daysUntilTarget > 0 ? daysUntilTarget / 30 : null;
    const monthlySuggested = monthsUntilTarget && remaining > 0 ? Math.ceil(remaining / monthsUntilTarget) : null;

    // Edit mode UI
    if (isEditing) {
        return (
            <div className="vn-card p-5 space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-[var(--vn-text)]">Edit Goal</h3>
                    <button
                        onClick={handleCancelEdit}
                        className="text-[var(--vn-muted)] hover:text-[var(--vn-text)] h-10 w-10 flex items-center justify-center rounded-full"
                    >
                        ✕
                    </button>
                </div>

                <div>
                    <label className="block text-xs font-medium text-[var(--vn-muted)] mb-1">Name</label>
                    <input
                        type="text"
                        value={editName}
                        onChange={(e) => {
                            setEditName(e.target.value);
                            if (errors.name) setErrors({ ...errors, name: "" });
                        }}
                        className={`w-full px-3 py-2 text-sm rounded-lg border bg-[var(--vn-surface)] ${errors.name ? "border-red-500 ring-1 ring-red-500" : "border-[var(--vn-border)]"
                            }`}
                    />
                    <FormError message={errors.name} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-medium text-[var(--vn-muted)] mb-1">Target</label>
                        <input
                            type="number"
                            value={editTarget}
                            onChange={(e) => {
                                setEditTarget(e.target.value);
                                if (errors.target) setErrors({ ...errors, target: "" });
                            }}
                            className={`w-full px-3 py-2 text-sm rounded-lg border bg-[var(--vn-surface)] ${errors.target ? "border-red-500 ring-1 ring-red-500" : "border-[var(--vn-border)]"
                                }`}
                        />
                        <FormError message={errors.target} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-[var(--vn-muted)] mb-1">Current</label>
                        <input
                            type="number"
                            value={editCurrent === "0" ? "" : editCurrent}
                            onChange={(e) => {
                                setEditCurrent(e.target.value);
                                if (errors.current) setErrors({ ...errors, current: "" });
                            }}
                            className={`w-full px-3 py-2 text-sm rounded-lg border bg-[var(--vn-surface)] ${errors.current ? "border-red-500 ring-1 ring-red-500" : "border-[var(--vn-border)]"
                                }`}
                        />
                        <FormError message={errors.current} />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-medium text-[var(--vn-muted)] mb-1">Target Date</label>
                    <input
                        type="date"
                        value={editDate}
                        onChange={(e) => {
                            setEditDate(e.target.value);
                            if (errors.date) setErrors({ ...errors, date: "" });
                        }}
                        className={`w-full px-3 py-2 text-sm rounded-lg border bg-[var(--vn-surface)] ${errors.date ? "border-red-500 ring-1 ring-red-500" : "border-[var(--vn-border)]"
                            }`}
                    />
                    <FormError message={errors.date} />
                </div>

                <div>
                    <label className="block text-xs font-medium text-[var(--vn-muted)] mb-1">Icon</label>
                    <div className="flex gap-1 flex-wrap">
                        {GOAL_ICONS.map((icon) => (
                            <button
                                key={icon}
                                type="button"
                                onClick={() => setEditIcon(icon)}
                                className={`w-11 h-11 sm:w-8 sm:h-8 rounded text-xl sm:text-lg flex items-center justify-center ${editIcon === icon ? "bg-[var(--gold-soft)] ring-2 ring-[var(--vn-gold)]" : "bg-[var(--vn-bg)] hover:bg-[var(--vn-surface)]"
                                    }`}
                            >
                                {icon}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-medium text-[var(--vn-muted)] mb-1">Color</label>
                    <div className="flex gap-2">
                        {GOAL_COLORS.map((color) => (
                            <button
                                key={color}
                                type="button"
                                onClick={() => setEditColor(color)}
                                className={`w-9 h-9 sm:w-6 sm:h-6 rounded-full ${editColor === color ? "ring-2 ring-offset-2 ring-slate-400" : ""}`}
                                style={{ backgroundColor: color }}
                            />
                        ))}
                    </div>
                </div>

                <div className="flex gap-2 pt-2">
                    <button
                        onClick={handleCancelEdit}
                        className="flex-1 px-3 py-2 text-sm font-medium text-[var(--vn-muted)] bg-[var(--vn-bg)] hover:bg-[var(--vn-surface)] rounded-lg border border-[var(--vn-border)]"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSaveEdit}
                        className="flex-1 px-3 py-2 text-sm font-medium text-white rounded-lg"
                        style={{ background: "linear-gradient(135deg, #a8731a, #d4a843)" }}
                    >
                        Save
                    </button>
                </div>
            </div>
        );
    }

    // Normal view
    return (
        <div className="vn-card p-5">
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <span className="text-2xl">{goal.icon || "🎯"}</span>
                    <div>
                        <h3 className="font-semibold text-slate-800 dark:text-white">{goal.name}</h3>
                        <p className="text-sm text-[var(--vn-muted)]">
                            {isComplete ? "🎉 Goal reached!" : `${formatMoney(remaining)} to go`}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setIsEditing(true)}
                        className="text-[var(--vn-muted)] hover:text-[var(--vn-gold)] text-sm h-10 w-10 flex items-center justify-center rounded-full"
                        title="Edit goal"
                    >
                        ✏️
                    </button>
                    <button
                        onClick={() => onDelete(goal.id)}
                        className="text-[var(--vn-muted)] hover:text-red-500 text-sm h-10 w-10 flex items-center justify-center rounded-full"
                        title="Delete goal"
                    >
                        ✕
                    </button>
                </div>
            </div>

            {/* Progress bar */}
            <div className="relative h-3 bg-[var(--vn-border)] rounded-full overflow-hidden mb-3">
                <div
                    className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                    style={{
                        width: `${progress}%`,
                        backgroundColor: goal.color || GOAL_COLORS[0]
                    }}
                />
            </div>

            <div className="flex items-center justify-between text-sm mb-4">
                <span className="font-medium text-[var(--vn-text)]">
                    {formatMoney(totalSaved)} / {formatMoney(goal.targetAmount)}
                </span>
                <span className="text-[var(--vn-muted)]">{Math.round(progress)}%</span>
            </div>

            {/* Target date info */}
            {daysUntilTarget !== null && !isComplete && (
                <div className="text-xs text-[var(--vn-muted)] mb-4 p-2 bg-[var(--vn-bg)] rounded-lg">
                    {daysUntilTarget > 0 ? (
                        <>
                            📅 {daysUntilTarget} days until target
                            {weeklyNeeded && <span className="block mt-1">💡 Save {formatMoney(weeklyNeeded)}/week to reach it</span>}
                        </>
                    ) : (
                        "⏰ Target date passed"
                    )}
                </div>
            )}

            {/* Monthly auto-save toggle */}
            {!isComplete && monthlySuggested !== null && (
                <div className={`flex items-center justify-between gap-3 p-3 rounded-lg mb-3 ${
                    linkedRule ? "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800" : "bg-[var(--vn-bg)] border border-[var(--vn-border)]"
                }`}>
                    <div>
                        <div className="text-xs font-semibold text-[var(--vn-text)]">
                            {linkedRule ? "✅ Monthly auto-save active" : "💡 Monthly auto-save"}
                        </div>
                        <div className="text-xs text-[var(--vn-muted)] mt-0.5">
                            {formatMoney(monthlySuggested)}/month added to your cashflow plan
                        </div>
                    </div>
                    <button
                        onClick={() => onToggleAutoSave(goal, !linkedRule, monthlySuggested)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                            linkedRule ? "bg-emerald-500" : "bg-[var(--vn-border)]"
                        }`}
                        role="switch"
                        aria-checked={!!linkedRule}
                    >
                        <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-xs transition-transform ${
                            linkedRule ? "translate-x-5" : "translate-x-0"
                        }`} />
                    </button>
                </div>
            )}

            {/* Linked transactions */}
            {linkedTxns.length > 0 && (
                <div className="mb-3 rounded-lg border border-[var(--vn-border)] overflow-hidden">
                    <div className="px-3 py-2 bg-[var(--vn-bg)] text-xs font-semibold text-[var(--vn-muted)] flex items-center gap-1">
                        🔗 Linked transfers ({linkedTxns.length})
                        {linkedAmount > 0 && (
                            <span className="ml-auto text-emerald-600 dark:text-emerald-400">
                                +{formatMoney(linkedAmount)}
                            </span>
                        )}
                    </div>
                    <div className="divide-y divide-[var(--vn-border)] max-h-40 overflow-y-auto">
                        {linkedTxns.map((t) => (
                            <div key={t.id} className="px-3 py-2 flex items-center justify-between text-xs">
                                <div className="min-w-0">
                                    <p className="font-medium text-[var(--vn-text)] truncate">{t.label}</p>
                                    <p className="text-[var(--vn-muted)]">{t.date}</p>
                                </div>
                                <span className="ml-3 shrink-0 font-semibold text-emerald-600 dark:text-emerald-400">
                                    +{formatMoney(t.amount)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Add to goal */}
            {!isComplete && (
                <div className="flex gap-2">
                    <input
                        type="number"
                        placeholder="Add amount..."
                        value={addAmount}
                        onChange={(e) => setAddAmount(e.target.value)}
                        className="flex-1 px-3 py-2 text-sm rounded-lg border border-[var(--vn-border)] bg-[var(--vn-surface)] text-[var(--vn-text)]"
                        onKeyDown={(e) => e.key === "Enter" && handleAddAmount()}
                    />
                    <button
                        onClick={handleAddAmount}
                        className="px-4 py-2 text-sm font-medium text-white rounded-lg"
                        style={{ backgroundColor: goal.color || GOAL_COLORS[0] }}
                    >
                        Add
                    </button>
                </div>
            )}
        </div>
    );
}


function NewGoalForm({ onSave, onCancel }: {
    onSave: (goal: Omit<SavingsGoal, "id" | "createdAt">) => void;
    onCancel: () => void;
}) {
    const [name, setName] = useState("");
    const [targetAmount, setTargetAmount] = useState("");
    const [currentAmount, setCurrentAmount] = useState("");
    const [targetDate, setTargetDate] = useState("");
    const [selectedColor, setSelectedColor] = useState(GOAL_COLORS[0]);
    const [selectedIcon, setSelectedIcon] = useState("🎯");
    const [errors, setErrors] = useState<Record<string, string>>({});

    const validate = () => {
        const newErrors: Record<string, string> = {};
        if (!name.trim()) newErrors.name = "Name is required";

        const target = parseFloat(targetAmount);
        if (isNaN(target) || target <= 0) newErrors.target = "Target amount must be greater than 0";

        const current = parseFloat(currentAmount);
        if (!isNaN(current) && current < 0) newErrors.current = "Cannot be negative";

        if (parseFloat(currentAmount) > parseFloat(targetAmount)) {
            newErrors.current = "Saved amount cannot exceed target";
        }

        if (targetDate && new Date(targetDate) < new Date(new Date().setHours(0, 0, 0, 0))) {
            newErrors.date = "Target date cannot be in the past";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;

        onSave({
            name,
            targetAmount: parseFloat(targetAmount),
            currentAmount: parseFloat(currentAmount) || 0,
            targetDate: targetDate || undefined,
            color: selectedColor,
            icon: selectedIcon,
        });
    };

    return (
        <form onSubmit={handleSubmit} className="vn-card p-6 space-y-4">
            <h3 className="font-semibold text-lg text-[var(--vn-text)]">Create New Goal</h3>

            <div>
                <label className="block text-sm font-medium text-[var(--vn-muted)] mb-1">Goal Name</label>
                <input
                    type="text"
                    placeholder="e.g., Holiday Fund, Emergency Fund"
                    value={name}
                    onChange={(e) => {
                        setName(e.target.value);
                        if (errors.name) setErrors({ ...errors, name: "" });
                    }}
                    className={`w-full px-3 py-2 rounded-lg border bg-[var(--vn-surface)] text-[var(--vn-text)] ${errors.name ? "border-red-500 ring-1 ring-red-500" : "border-[var(--vn-border)]"
                        }`}
                />
                <FormError message={errors.name} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-[var(--vn-muted)] mb-1">Target Amount</label>
                    <input
                        type="number"
                        placeholder="1500"
                        value={targetAmount}
                        onChange={(e) => {
                            setTargetAmount(e.target.value);
                            if (errors.target) setErrors({ ...errors, target: "" });
                        }}
                        className={`w-full px-3 py-2 rounded-lg border bg-[var(--vn-surface)] text-[var(--vn-text)] ${errors.target ? "border-red-500 ring-1 ring-red-500" : "border-[var(--vn-border)]"
                            }`}
                    />
                    <FormError message={errors.target} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-[var(--vn-muted)] mb-1">Already Saved</label>
                    <input
                        type="number"
                        placeholder="0"
                        value={currentAmount}
                        onChange={(e) => {
                            setCurrentAmount(e.target.value);
                            if (errors.current) setErrors({ ...errors, current: "" });
                        }}
                        className={`w-full px-3 py-2 rounded-lg border bg-[var(--vn-surface)] text-[var(--vn-text)] ${errors.current ? "border-red-500 ring-1 ring-red-500" : "border-[var(--vn-border)]"
                            }`}
                    />
                    <FormError message={errors.current} />
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-[var(--vn-muted)] mb-1">Target Date (optional)</label>
                <input
                    type="date"
                    value={targetDate}
                    onChange={(e) => {
                        setTargetDate(e.target.value);
                        if (errors.date) setErrors({ ...errors, date: "" });
                    }}
                    className={`w-full px-3 py-2 rounded-lg border bg-[var(--vn-surface)] text-[var(--vn-text)] ${errors.date ? "border-red-500 ring-1 ring-red-500" : "border-[var(--vn-border)]"
                        }`}
                />
                <FormError message={errors.date} />
            </div>

            <div>
                <label className="block text-sm font-medium text-[var(--vn-muted)] mb-2">Icon</label>
                <div className="flex gap-2 flex-wrap">
                    {GOAL_ICONS.map((icon) => (
                        <button
                            key={icon}
                            type="button"
                            onClick={() => setSelectedIcon(icon)}
                            className={`w-11 h-11 sm:w-10 sm:h-10 rounded-lg text-2xl sm:text-xl flex items-center justify-center transition-all ${selectedIcon === icon
                                ? "bg-[var(--gold-soft)] ring-2 ring-[var(--vn-gold)]"
                                : "bg-[var(--vn-bg)] hover:bg-[var(--vn-surface)]"
                                }`}
                        >
                            {icon}
                        </button>
                    ))}
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-[var(--vn-muted)] mb-2">Color</label>
                <div className="flex gap-2">
                    {GOAL_COLORS.map((color) => (
                        <button
                            key={color}
                            type="button"
                            onClick={() => setSelectedColor(color)}
                            className={`w-9 h-9 sm:w-8 sm:h-8 rounded-full transition-all ${selectedColor === color ? "ring-2 ring-offset-2 ring-slate-400" : ""
                                }`}
                            style={{ backgroundColor: color }}
                        />
                    ))}
                </div>
            </div>

            <div className="flex gap-3 pt-2">
                <button
                    type="button"
                    onClick={onCancel}
                    className="flex-1 px-4 py-2 text-sm font-medium text-[var(--vn-muted)] bg-[var(--vn-bg)] hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    className="flex-1 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors"
                    style={{ background: "var(--gold)", color: "#ffffff" }}
                >
                    Create Goal
                </button>
            </div>
        </form>
    );
}

export default function GoalsPage() {
    const [plan, setPlan] = useState(() => loadPlan());
    const [showNewGoalForm, setShowNewGoalForm] = useState(false);
    const { confirm } = useConfirm();

    const period = getPeriod(plan, plan.setup.selectedPeriodId);
    const goals = plan.savingsGoals || [];

    const totalSaved = goals.reduce((sum, g) => sum + g.currentAmount, 0);
    const totalTarget = goals.reduce((sum, g) => sum + g.targetAmount, 0);

    const handleCreateGoal = (goalData: Omit<SavingsGoal, "id" | "createdAt">) => {
        const newGoal: SavingsGoal = {
            ...goalData,
            id: generateId(),
            createdAt: new Date().toISOString(),
        };
        const updatedPlan = {
            ...plan,
            savingsGoals: [...goals, newGoal],
        };
        savePlan(updatedPlan);
        setPlan(updatedPlan);
        setShowNewGoalForm(false);
        toast.success(`Goal "${goalData.name}" created!`);
    };

    const handleUpdateGoal = (updatedGoal: SavingsGoal) => {
        const updatedGoals = goals.map(g => g.id === updatedGoal.id ? updatedGoal : g);
        const updatedPlan = { ...plan, savingsGoals: updatedGoals };
        savePlan(updatedPlan);
        setPlan(updatedPlan);
        toast.success("Goal updated!");
    };

    const handleToggleAutoSave = (goal: SavingsGoal, enable: boolean, monthlyAmount: number) => {
        const label = goalRuleLabel(goal.name, goal.id);
        const existingRule = (plan.outflowRules || []).find(r => r.label === label);

        let updatedRules: OutflowRule[];
        if (enable && !existingRule) {
            const today = new Date();
            const seedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
            const newRule: OutflowRule = {
                id: generateId(),
                label,
                amount: monthlyAmount,
                cadence: "monthly",
                seedDate,
                category: "savings",
                enabled: true,
            };
            updatedRules = [...(plan.outflowRules || []), newRule];
            toast.success(`Auto-save of ${formatMoney(monthlyAmount)}/month added to your plan!`);
        } else if (!enable && existingRule) {
            updatedRules = (plan.outflowRules || []).filter(r => r.id !== existingRule.id);
            toast.success("Auto-save removed from plan");
        } else {
            return;
        }

        const updatedPlan = { ...plan, outflowRules: updatedRules };
        savePlan(updatedPlan);
        setPlan(updatedPlan);
    };

    const handleDeleteGoal = async (id: string) => {
        const goal = goals.find(g => g.id === id);
        const confirmed = await confirm({
            title: "Delete Goal?",
            message: `Are you sure you want to delete "${goal?.name || "this goal"}"? This action cannot be undone.`,
            confirmText: "Delete",
            confirmStyle: "danger",
        });

        if (confirmed) {
            const updatedGoals = goals.filter(g => g.id !== id);
            const updatedPlan = { ...plan, savingsGoals: updatedGoals };
            savePlan(updatedPlan);
            setPlan(updatedPlan);
            toast.success("Goal deleted");
        }
    };

    return (
        <main className="min-h-screen">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 pb-40 pt-5">
                <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
                    <SidebarNav periodLabel={period.label} periodStart={period.start} periodEnd={period.end} />

                    <section className="space-y-6">
                        <header className="vn-masthead">
                            <div className="text-xs uppercase tracking-widest font-semibold text-white/50">Goals</div>
                            <h1 className="text-2xl font-bold text-white/90" style={{ fontFamily: "var(--font-playfair, serif)" }}>Savings Goals</h1>
                            <p className="mt-2 text-sm text-white/55">
                                Track progress towards your savings targets
                            </p>
                        </header>

                        {/* Summary */}
                        {goals.length > 0 && (
                            <div className="vn-card p-5">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                                    <div>
                                        <p className="text-xl sm:text-2xl font-semibold tabular-nums" style={{ color: "var(--gold)" }}>{goals.length}</p>
                                        <p className="text-xs text-[var(--vn-muted)]">Active Goals</p>
                                    </div>
                                    <div>
                                        <p className="text-xl sm:text-2xl font-bold text-emerald-600">{formatMoney(totalSaved)}</p>
                                        <p className="text-xs text-[var(--vn-muted)]">Total Saved</p>
                                    </div>
                                    <div>
                                        <p className="text-xl sm:text-2xl font-bold text-[var(--vn-muted)]">{formatMoney(totalTarget)}</p>
                                        <p className="text-xs text-[var(--vn-muted)]">Total Target</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Goals grid */}
                        <div className="grid gap-4 md:grid-cols-2">
                            {goals.map(goal => {
                                const linkedRule = (plan.outflowRules || []).find(
                                    r => r.label === goalRuleLabel(goal.name, goal.id)
                                ) ?? null;
                                return (
                                    <GoalCard
                                        key={goal.id}
                                        goal={goal}
                                        onUpdate={handleUpdateGoal}
                                        onDelete={handleDeleteGoal}
                                        linkedRule={linkedRule}
                                        onToggleAutoSave={handleToggleAutoSave}
                                        transactions={plan.transactions || []}
                                    />
                                );
                            })}
                        </div>

                        {/* Empty state or new goal form */}
                        {showNewGoalForm ? (
                            <NewGoalForm
                                onSave={handleCreateGoal}
                                onCancel={() => setShowNewGoalForm(false)}
                            />
                        ) : (
                            <button
                                onClick={() => setShowNewGoalForm(true)}
                                className="w-full p-6 border-2 border-dashed rounded-2xl transition-colors"
                                style={{ borderColor: "var(--border-hover)", color: "var(--text-tertiary)" }}
                            >
                                <span className="text-2xl block mb-1">+</span>
                                <span className="text-sm font-medium">Add New Goal</span>
                            </button>
                        )}

                        {goals.length === 0 && !showNewGoalForm && (
                            <div className="vn-card p-8 text-center">
                                <p className="text-3xl mb-3">🎯</p>
                                <p className="text-[var(--vn-muted)] text-sm">
                                    No savings goals yet. Create one to start tracking your progress!
                                </p>
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </main>
    );
}

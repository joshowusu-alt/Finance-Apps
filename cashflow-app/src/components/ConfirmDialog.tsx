"use client";

import { useState, createContext, useContext, ReactNode, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ConfirmDialogOptions {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    confirmStyle?: "danger" | "primary";
}

interface ConfirmContextType {
    confirm: (options: ConfirmDialogOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | null>(null);

export function useConfirm() {
    const context = useContext(ConfirmContext);
    if (!context) {
        throw new Error("useConfirm must be used within a ConfirmProvider");
    }
    return context;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
    const [dialog, setDialog] = useState<ConfirmDialogOptions | null>(null);
    const [resolvePromise, setResolvePromise] = useState<((value: boolean) => void) | null>(null);

    const confirm = useCallback((options: ConfirmDialogOptions): Promise<boolean> => {
        return new Promise((resolve) => {
            setDialog(options);
            setResolvePromise(() => resolve);
        });
    }, []);

    const handleConfirm = () => {
        resolvePromise?.(true);
        setDialog(null);
        setResolvePromise(null);
    };

    const handleCancel = () => {
        resolvePromise?.(false);
        setDialog(null);
        setResolvePromise(null);
    };

    return (
        <ConfirmContext.Provider value={{ confirm }}>
            {children}

            <AnimatePresence>
                {dialog && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                            onClick={handleCancel}
                        />

                        {/* Dialog */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            transition={{ type: "spring", stiffness: 300, damping: 25 }}
                            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm"
                        >
                            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 mx-4">
                                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                                    {dialog.title}
                                </h3>
                                <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                                    {dialog.message}
                                </p>

                                <div className="flex gap-3">
                                    <button
                                        onClick={handleCancel}
                                        className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-colors"
                                    >
                                        {dialog.cancelText || "Cancel"}
                                    </button>
                                    <button
                                        onClick={handleConfirm}
                                        className={`flex-1 px-4 py-2.5 text-sm font-medium text-white rounded-xl transition-colors ${dialog.confirmStyle === "danger"
                                                ? "bg-red-500 hover:bg-red-600"
                                                : "bg-[var(--gold)] hover:opacity-90"
                                            }`}
                                    >
                                        {dialog.confirmText || "Confirm"}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </ConfirmContext.Provider>
    );
}

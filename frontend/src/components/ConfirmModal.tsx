"use client";
import { motion, AnimatePresence } from "framer-motion";
import { X, AlertTriangle } from "lucide-react";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  isOpen,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  destructive = false,
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      onCancel();
    }
  };

  return (
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            onClick={onCancel}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -20 }}
            transition={{ type: "spring", stiffness: 280, damping: 28 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div
              tabIndex={0}
              onKeyDown={handleKeyDown}
              className="w-full max-w-lg rounded-3xl bg-card border border-border shadow-xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3 p-6 border-b border-border/50">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-red-500/10 text-red-500 p-2">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-foreground">{title}</h2>
                    <p className="text-sm text-muted-foreground mt-1">{description}</p>
                  </div>
                </div>
                <button
                  onClick={onCancel}
                  className="p-2 rounded-full text-muted-foreground hover:bg-muted transition-colors"
                  aria-label="Close confirmation dialog"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex justify-end gap-3 p-6 bg-background/80">
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={isLoading}
                  className="px-5 py-2 rounded-xl border border-border text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                >
                  {cancelText}
                </button>
                <button
                  type="button"
                  onClick={onConfirm}
                  disabled={isLoading}
                  className={`px-5 py-2 rounded-xl text-white transition-colors disabled:opacity-50 ${destructive ? "bg-red-500 hover:bg-red-600" : "bg-primary hover:bg-primary/90"}`}
                >
                  {isLoading ? "Processing..." : confirmText}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}

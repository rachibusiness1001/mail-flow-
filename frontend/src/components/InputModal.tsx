"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

interface InputModalProps {
  isOpen: boolean;
  title: string;
  placeholder: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
  isLoading?: boolean;
  validate?: (value: string) => string | null;
}

export function InputModal({
  isOpen,
  title,
  placeholder,
  onConfirm,
  onCancel,
  isLoading = false,
  validate,
}: InputModalProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const validateValue = (nextValue: string) => {
    if (!validate) {
      return null;
    }
    return validate(nextValue);
  };

  const handleConfirm = () => {
    const trimmed = value.trim();
    const validationError = validateValue(trimmed);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (trimmed) {
      onConfirm(trimmed);
      setValue("");
      setError(null);
    }
  };

  const handleCancel = () => {
    setValue("");
    setError(null);
    onCancel();
  };

  const handleBlur = () => {
    const trimmed = value.trim();
    const validationError = validateValue(trimmed);
    setError(validationError);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleConfirm();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleCancel}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md"
          >
            <div className="bg-card border border-border rounded-2xl shadow-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-foreground">{title}</h2>
                <button
                  onClick={handleCancel}
                  className="p-1 hover:bg-muted rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              <input
                type="text"
                value={value}
                onChange={(e) => {
                  const nextValue = e.target.value;
                  setValue(nextValue);
                  if (error) {
                    setError(validateValue(nextValue.trim()));
                  }
                }}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                autoFocus
                disabled={isLoading}
                className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all disabled:opacity-50"
              />
              {error ? (
                <p className="mt-2 text-xs text-red-500">{error}</p>
              ) : null}

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleCancel}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-border text-foreground hover:bg-muted transition-colors disabled:opacity-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={isLoading || !value.trim()}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50 font-medium"
                >
                  {isLoading ? "Creating..." : "Create"}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

"use client";
import { motion } from "framer-motion";
import { Upload, ChevronRight, X } from "lucide-react";
import Link from "next/link";

type AddLeadsModalProps = {
  campaignId: number;
  campaignName: string;
  pendingLaunch?: boolean;
  onClose?: () => void;
};

export default function AddLeadsModal({ campaignId, campaignName, pendingLaunch, onClose }: AddLeadsModalProps) {
  const uploadUrl = `/leads/upload?campaign_id=${campaignId}${pendingLaunch ? "&launch=1" : ""}`;
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-card border border-border rounded-2xl shadow-xl max-w-md w-full space-y-6 p-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-extrabold text-foreground">Add Leads</h2>
          {onClose && (
            <button 
              onClick={onClose}
              className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="space-y-3">
          <p className="text-muted-foreground">
            Great! Your campaign <span className="font-bold text-foreground">"{campaignName}"</span> is ready.
          </p>
          <p className="text-muted-foreground">
            Would you like to add leads now? You can import contacts from a CSV file.
          </p>
        </div>

        {/* Icon */}
        <div className="flex justify-center py-4">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
            <Upload className="w-8 h-8 text-primary" />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 bg-muted hover:bg-muted/80 text-foreground px-4 py-2.5 rounded-xl font-bold transition-colors"
          >
            Skip for Now
          </button>
          <Link 
            href={uploadUrl}
            className="flex-1 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95"
          >
            {pendingLaunch ? "Add Leads & Launch" : "Add Leads"}
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </motion.div>
    </motion.div>
  );
}

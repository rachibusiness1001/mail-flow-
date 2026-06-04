"use client";
import { Lock, ChevronRight } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

export default function LeadsLock() {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="h-[calc(100vh-64px)] flex items-center justify-center px-4"
    >
      <div className="text-center space-y-6 max-w-md">
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center">
            <Lock className="w-10 h-10 text-primary" />
          </div>
        </div>
        
        <div>
          <h1 className="text-3xl font-extrabold text-foreground mb-2">
            Leads Locked
          </h1>
          <p className="text-muted-foreground text-lg">
            You need to create a campaign first before you can add leads. Campaigns organize your email outreach and lead management.
          </p>
        </div>

        <div className="bg-muted/50 border border-border p-4 rounded-xl text-sm space-y-2">
          <p className="text-foreground font-semibold">To get started:</p>
          <ol className="text-left space-y-2 text-muted-foreground">
            <li>1. Create a new campaign</li>
            <li>2. Import leads to that campaign</li>
            <li>3. Configure email sequences</li>
            <li>4. Launch your campaign!</li>
          </ol>
        </div>

        <Link 
          href="/campaigns/create"
          className="bg-primary hover:bg-primary/90 text-white px-8 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95 w-full"
        >
          Create First Campaign
          <ChevronRight className="w-5 h-5" />
        </Link>
      </div>
    </motion.div>
  );
}

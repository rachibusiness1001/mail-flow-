"use client";
import { motion } from "framer-motion";
import { File, Download, Trash2, Eye, MoreHorizontal, Calendar, CheckCircle2, AlertCircle } from "lucide-react";
import { useState } from "react";
import api from "@/lib/api";
import ConfirmModal from "@/components/ConfirmModal";

type Upload = {
  id: number;
  filename: string;
  total: number;
  invalid: number;
  valid: number;
  uploaded_at: string;
  campaign_id: number | null;
  campaign: string;
};

type LeadsFilesListProps = {
  uploads: Upload[];
  onUploadDeleted?: (uploadId: number) => void;
  onExport?: (uploadId: number) => void;
};

export default function LeadsFilesList({ uploads, onUploadDeleted, onExport }: LeadsFilesListProps) {
  const [deleting, setDeleting] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const handleDelete = (uploadId: number) => {
    setConfirmDeleteId(uploadId);
  };

  const handleConfirmDelete = async () => {
    if (confirmDeleteId === null) return;

    try {
      setDeleting(confirmDeleteId);
      await api.delete(`/leads/uploads/${confirmDeleteId}`);
      onUploadDeleted?.(confirmDeleteId);
    } catch (error) {
      console.error("Failed to delete upload", error);
      alert("Failed to delete upload");
    } finally {
      setDeleting(null);
      setConfirmDeleteId(null);
    }
  };

  const handleExport = (uploadId: number) => {
    onExport?.(uploadId);
  };

  if (uploads.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <File className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="text-lg font-semibold">No files uploaded yet</p>
        <p className="text-sm">Import your first lead file to get started</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {uploads.map((upload, idx) => (
          <motion.div 
            key={upload.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="bg-card border border-border rounded-2xl p-4 hover:border-primary/50 hover:shadow-md transition-all group"
          >
            <div className="flex items-center gap-4">
              {/* File Icon */}
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <File className="w-6 h-6 text-primary" />
              </div>

              {/* File Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-foreground truncate">{upload.filename}</h3>
                  <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-1 rounded-full whitespace-nowrap">
                    {upload.campaign}
                  </span>
                </div>
                
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    {upload.valid} valid
                  </span>
                  {upload.invalid > 0 && (
                    <span className="flex items-center gap-1">
                      <AlertCircle className="w-4 h-4 text-yellow-500" />
                      {upload.invalid} invalid
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {upload.uploaded_at}
                  </span>
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold bg-green-500/10 text-green-500 px-3 py-1.5 rounded-lg whitespace-nowrap">
                  ✅ Imported
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => handleExport(upload.id)}
                  className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                  title="Export leads"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => handleDelete(upload.id)}
                  disabled={deleting === upload.id}
                  className="p-2 hover:bg-red-500/10 rounded-lg text-muted-foreground hover:text-red-500 transition-colors disabled:opacity-50"
                  title="Delete"
                >
                  {deleting === upload.id ? (
                    <div className="w-4 h-4 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
      <ConfirmModal
        isOpen={confirmDeleteId !== null}
        title="Delete Uploaded File"
        description="Are you sure you want to delete this file? All associated leads will be removed."
        confirmText="Delete"
        cancelText="Cancel"
        destructive
        isLoading={deleting !== null}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </>
  );
}

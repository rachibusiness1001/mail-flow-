"use client";
import { useEffect, useState } from "react";

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    if (typeof window !== "undefined") {
      setIsOffline(!navigator.onLine);
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      }
    };
  }, []);

  if (!isOffline) {
    return null;
  }

  return (
    <div className="sticky top-0 z-50 bg-yellow-500 text-black text-sm font-semibold text-center py-2 shadow-md">
      You are offline. Changes will sync when you're back online.
    </div>
  );
}

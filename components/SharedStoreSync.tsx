"use client";

import { useEffect } from "react";
import { ensureMockDatabase, syncSharedStoreFromServer } from "@/data/mockDb";

const SHARED_STORE_POLL_MS = 15000;

export function SharedStoreSync() {
  useEffect(() => {
    let isMounted = true;
    let inFlight = false;
    let databaseReady = false;

    async function syncSharedStore(force = false) {
      if (!isMounted || inFlight) return;
      inFlight = true;

      try {
        if (!databaseReady) {
          await ensureMockDatabase({ notifySync: true });
          databaseReady = true;
          return;
        }
        await syncSharedStoreFromServer({ notify: true, force });
      } finally {
        inFlight = false;
      }
    }

    void syncSharedStore(true);

    const timer = window.setInterval(() => {
      void syncSharedStore(false);
    }, SHARED_STORE_POLL_MS);

    const handleFocus = () => void syncSharedStore(true);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void syncSharedStore(true);
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMounted = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return null;
}

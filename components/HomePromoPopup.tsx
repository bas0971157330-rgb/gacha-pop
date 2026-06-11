"use client";

import { useEffect, useState } from "react";
import { PromoPopup } from "@/components/PromoPopup";
import { fetchCatalogSnapshot } from "@/data/catalogSync";
import {
  ensureMockDatabase,
  getPopupAds,
  savePopupAds,
  type PopupAdRecord,
} from "@/data/mockDb";

export function HomePromoPopup() {
  const [popupAds, setPopupAds] = useState<PopupAdRecord[]>([]);

  useEffect(() => {
    let isMounted = true;

    async function syncPopupAds() {
      await ensureMockDatabase();
      const remoteCatalog = await fetchCatalogSnapshot();
      const nextAds = remoteCatalog?.popupAds ?? getPopupAds();

      if (remoteCatalog) {
        savePopupAds(remoteCatalog.popupAds, false, false);
      }

      if (isMounted) {
        setPopupAds(nextAds);
      }
    }

    syncPopupAds();
    window.addEventListener("storage", syncPopupAds);
    window.addEventListener("gacha-popup-ads-updated", syncPopupAds);

    return () => {
      isMounted = false;
      window.removeEventListener("storage", syncPopupAds);
      window.removeEventListener("gacha-popup-ads-updated", syncPopupAds);
    };
  }, []);

  return <PromoPopup ads={popupAds} />;
}

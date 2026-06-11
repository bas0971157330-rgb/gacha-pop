"use client";

import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { UrlImage } from "@/components/UrlImage";
import type { PopupAdRecord } from "@/data/mockDb";

const POPUP_DISMISS_KEY = "gacha_popup_ad_dismissed_until";

type PromoPopupProps = {
  ads: PopupAdRecord[];
};

function dismissUntil(hours: number) {
  return Date.now() + Math.max(1, hours) * 60 * 60 * 1000;
}

export function PromoPopup({ ads }: PromoPopupProps) {
  const popupAds = useMemo(
    () => ads.filter((ad) => ad.isActive && ad.placement === "popup" && ad.image.trim()),
    [ads],
  );
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [hideTemporarily, setHideTemporarily] = useState(false);
  const activeAd = popupAds[activeIndex] ?? popupAds[0];

  useEffect(() => {
    if (popupAds.length === 0) {
      setIsOpen(false);
      return;
    }

    const dismissedUntil = Number(window.localStorage.getItem(POPUP_DISMISS_KEY) ?? 0);
    setActiveIndex(0);
    setHideTemporarily(false);
    setIsOpen(Date.now() > dismissedUntil);
  }, [popupAds]);

  useEffect(() => {
    if (!isOpen || popupAds.length <= 1) return;

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % popupAds.length);
    }, 5200);

    return () => window.clearInterval(timer);
  }, [isOpen, popupAds.length]);

  function closePopup() {
    if (hideTemporarily && activeAd) {
      window.localStorage.setItem(POPUP_DISMISS_KEY, String(dismissUntil(activeAd.dismissHours ?? 1)));
    }

    setIsOpen(false);
  }

  if (!isOpen || !activeAd) return null;

  return (
    <div className="promo-popup-backdrop" role="dialog" aria-modal="true" aria-label={activeAd.title} onClick={closePopup}>
      <div className="promo-popup-stage" onClick={(event) => event.stopPropagation()}>
        <div className="promo-popup-card">
          <UrlImage
            src={activeAd.image}
            alt={activeAd.title || "Gacha Pop promotion"}
            width={640}
            height={640}
            className="promo-popup-image"
            fallbackSrc="/promo-banner.png"
          />
          <label className="promo-popup-checkbox">
            <input
              type="checkbox"
              checked={hideTemporarily}
              onChange={(event) => setHideTemporarily(event.target.checked)}
            />
            <span>ไม่แสดงอีกเป็นเวลา 1 ชั่วโมง</span>
          </label>
        </div>

        {popupAds.length > 1 && (
          <div className="promo-popup-dots" aria-hidden="true">
            {popupAds.map((ad, index) => (
              <button
                key={ad.id}
                type="button"
                className={index === activeIndex ? "is-active" : ""}
                onClick={() => setActiveIndex(index)}
                aria-label={`ดูโฆษณาที่ ${index + 1}`}
              />
            ))}
          </div>
        )}

        <button type="button" className="promo-popup-close" onClick={closePopup} aria-label="ปิดโฆษณา">
          <X size={28} strokeWidth={3} />
        </button>
      </div>
    </div>
  );
}

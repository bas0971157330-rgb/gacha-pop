"use client";

import { Clock3, Flame, Heart, Pin, Sparkles, Zap } from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";
import type { GachaItem } from "@/data/gacha";
import { GachaMachine } from "@/components/GachaMachine";
import { UrlImage } from "@/components/UrlImage";
import { getBestDiscountCoupon, getDiscountedCoinPrice, type CouponRecord } from "@/data/coupons";

type GachaCardProps = {
  item: GachaItem;
  isFavorite?: boolean;
  onFavoriteToggle?: (itemId: string) => void;
  onSelect: (item: GachaItem) => void;
};

const cornerBadges = {
  popular: { label: "ยอดนิยม", icon: Flame, className: "gacha-corner-badge-popular" },
  new: { label: "มาใหม่", icon: Sparkles, className: "gacha-corner-badge-new" },
  ending: { label: "ใกล้หมด", icon: Zap, className: "gacha-corner-badge-ending" },
};

function sameStringList(first: readonly string[] | undefined, second: readonly string[] | undefined) {
  const firstList = first ?? [];
  const secondList = second ?? [];
  if (firstList.length !== secondList.length) return false;
  return firstList.every((value, index) => value === secondList[index]);
}

function areGachaCardsEqual(previous: GachaCardProps, next: GachaCardProps) {
  const previousItem = previous.item;
  const nextItem = next.item;

  return (
    previous.isFavorite === next.isFavorite &&
    previous.onFavoriteToggle === next.onFavoriteToggle &&
    previous.onSelect === next.onSelect &&
    previousItem.id === nextItem.id &&
    previousItem.name === nextItem.name &&
    previousItem.subtitle === nextItem.subtitle &&
    previousItem.price === nextItem.price &&
    previousItem.remaining === nextItem.remaining &&
    previousItem.category === nextItem.category &&
    previousItem.type === nextItem.type &&
    previousItem.status === nextItem.status &&
    previousItem.badge === nextItem.badge &&
    previousItem.theme === nextItem.theme &&
    previousItem.mascot === nextItem.mascot &&
    previousItem.coverImage === nextItem.coverImage &&
    previousItem.pinned === nextItem.pinned &&
    previousItem.discountDisabled === nextItem.discountDisabled &&
    previousItem.popular === nextItem.popular &&
    previousItem.isNew === nextItem.isNew &&
    previousItem.limited === nextItem.limited &&
    sameStringList(previousItem.badges, nextItem.badges) &&
    sameStringList(previousItem.images, nextItem.images)
  );
}

function GachaCardComponent({ item, isFavorite = false, onFavoriteToggle, onSelect }: GachaCardProps) {
  const soldOut = item.remaining <= 0 || item.status === "closed";
  const isSaleProduct = item.type === "sale";
  const [discountCoupon, setDiscountCoupon] = useState<CouponRecord | null>(null);
  const discountedPrice = useMemo(
    () => getDiscountedCoinPrice(item.price, discountCoupon, item.discountDisabled),
    [discountCoupon, item.discountDisabled, item.price],
  );
  const hasDiscount = Boolean(discountCoupon && !item.discountDisabled && discountedPrice < item.price);

  useEffect(() => {
    const refreshDiscount = () => setDiscountCoupon(getBestDiscountCoupon());
    refreshDiscount();
    window.addEventListener("gacha-coupons-updated", refreshDiscount);
    window.addEventListener("gacha-auth-updated", refreshDiscount);
    return () => {
      window.removeEventListener("gacha-coupons-updated", refreshDiscount);
      window.removeEventListener("gacha-auth-updated", refreshDiscount);
    };
  }, []);

  return (
    <article className={`gacha-card group${soldOut ? " gacha-card-sold-out" : ""}`}>
      <button
        type="button"
        className={`gacha-card-heart${isFavorite ? " is-favorite" : ""}`}
        aria-label={`เพิ่ม ${item.name} ในรายการโปรด`}
        aria-pressed={isFavorite}
        onClick={(event) => {
          event.stopPropagation();
          onFavoriteToggle?.(item.id);
        }}
      >
        <Heart size={18} fill={isFavorite ? "currentColor" : "none"} />
      </button>

      {soldOut && <span className="gacha-sold-out-badge">Sold out</span>}

      <button
        type="button"
        disabled={soldOut}
        className="gacha-card-select"
        aria-label={`ดูรายละเอียด ${item.name}`}
        onClick={() => {
          if (!soldOut) onSelect(item);
        }}
      >
        <div className="gacha-card-media">
          <div className="gacha-card-corner-badges" aria-label="สถานะสินค้า">
            {item.pinned && (
              <span className="gacha-corner-badge gacha-corner-badge-pinned">
                <Pin size={11} fill="currentColor" />
                ปักหมุด
              </span>
            )}
            {(item.badges ?? []).map((badge) => {
              const BadgeIcon = cornerBadges[badge].icon;

              return (
                <span key={badge} className={`gacha-corner-badge ${cornerBadges[badge].className}`}>
                  <BadgeIcon size={11} fill="currentColor" />
                  {cornerBadges[badge].label}
                </span>
              );
            })}
          </div>

          {item.coverImage ? (
            <UrlImage src={item.coverImage} alt={`${item.name} cover`} className="gacha-card-cover" />
          ) : (
            <>
              <div className="absolute left-8 top-14 text-2xl text-pink-300">✦</div>
              <div className="absolute right-10 top-24 text-xl text-sky-300">✧</div>
              <GachaMachine color={item.theme} compact />
              <div className="absolute bottom-7 left-5 rounded-3xl bg-white/80 px-3 py-1 text-xs font-black text-violet-600 shadow-sm">
                {item.mascot}
              </div>
            </>
          )}
        </div>

        <div className="gacha-card-body">
          <h3 className="gacha-card-title" title={item.name}>
            {item.name}
          </h3>
          <p className="gacha-card-subtitle">{item.subtitle}</p>
          <p className="gacha-card-price">
            <span className="coin-badge gacha-card-coin">C</span>
            <span className="gacha-card-price-value">{discountedPrice}</span>
            {hasDiscount && <del>{item.price}</del>}
            {isSaleProduct ? "Coin" : "Coin / ครั้ง"}
          </p>
          {hasDiscount && <span className="gacha-card-discount-badge">ลด {discountCoupon?.discountPercent}%</span>}
          <div className="gacha-card-stock">
            <Clock3 size={14} />
            {soldOut ? "สินค้าหมดแล้ว" : `เหลือ ${item.remaining} ${isSaleProduct ? "ชิ้น" : "ลูก"}`}
          </div>
        </div>
      </button>
    </article>
  );
}

export const GachaCard = memo(GachaCardComponent, areGachaCardsEqual);

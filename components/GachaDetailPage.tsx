"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, Clock3, Dice5, Gift, Heart, History, ShoppingBag, Sparkles, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { UrlImage } from "@/components/UrlImage";
import { fetchCatalogSnapshot } from "@/data/catalogSync";
import { addRewardToInventory } from "@/data/inventory";
import { gachas, type GachaItem } from "@/data/gacha";
import {
  ensureMockDatabase,
  getCurrentUser,
  getProducts,
  getRollHistory,
  getSafeUsers,
  saveProducts,
  purchaseSaleProduct,
  type ProductRecord,
  type RollHistory,
} from "@/data/mockDb";
import { getCoinBalance } from "@/data/wallet";
import { rollRewards, type RollReward } from "@/data/rewards";
import { getBestDiscountCoupon, getDiscountedCoinPrice, type CouponRecord } from "@/data/coupons";

type GachaDetailPageProps = {
  gachaId: string;
  initialGacha?: GachaItem;
};

function toGachaItem(product: ProductRecord, fallback?: GachaItem): GachaItem {
  const seed = fallback ?? gachas.find((item) => item.id === product.id);
  return {
    id: product.id,
    name: product.name,
    subtitle: product.type === "random" ? "Random Collection" : "สินค้า",
    price: product.priceCoin,
    remaining: product.stock,
    category: product.categoryId,
    type: product.type,
    description: product.description,
    dropItems: product.dropItems,
    status: product.status,
    badge: seed?.badge,
    discountDisabled: product.discountDisabled,
    theme: seed?.theme ?? "purple",
    mascot: seed?.mascot ?? product.name,
    coverImage: product.image,
    images: product.images,
    popular: seed?.popular,
    isNew: seed?.isNew,
    limited: seed?.limited,
  };
}

function getDropRewards(item: GachaItem): RollReward[] {
  const dropItems = item.dropItems ?? [];
  if (dropItems.length === 0) return rollRewards;

  const total = dropItems.reduce((sum, drop) => sum + Math.max(1, Number(drop.quantity)), 0);
  return dropItems.map((drop) => ({
    id: drop.id,
    name: drop.name,
    image: drop.image,
    stars: 3,
    chance: total > 0 ? (Math.max(1, Number(drop.quantity)) / total) * 100 : 0,
  }));
}

type DetailRollHistory = RollHistory & {
  displayName: string;
};

function maskRollDisplayName(value: string) {
  const normalized = value.trim();
  if (!normalized) return "Player";
  return `${normalized.slice(0, 3)}***`;
}

function getDetailRollHistory(machineName: string, fallbackId: string): DetailRollHistory[] {
  const userNames = new Map(getSafeUsers().map((user) => [user.id, user.username]));

  return getRollHistory()
    .filter((entry) => entry.machineName === machineName || entry.machineName === fallbackId)
    .slice(0, 10)
    .map((entry) => ({
      ...entry,
      displayName: maskRollDisplayName(userNames.get(entry.userId) ?? entry.userId),
    }));
}

export function GachaDetailPage({ gachaId, initialGacha }: GachaDetailPageProps) {
  const router = useRouter();
  const [isFavorite, setIsFavorite] = useState(false);
  const [currentGacha, setCurrentGacha] = useState<GachaItem>(
    initialGacha ?? {
      id: gachaId,
      name: "กำลังโหลดสินค้า",
      subtitle: "สินค้า",
      price: 0,
      remaining: 0,
      category: "gachapon",
      theme: "purple",
      mascot: "Gacha Pop",
      coverImage: "/hero-machine.png",
      status: "closed",
    },
  );
  const [coins, setCoins] = useState(0);
  const [message, setMessage] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"sale" | "roll" | null>(null);
  const [discountCoupon, setDiscountCoupon] = useState<CouponRecord | null>(null);
  const [recentRolls, setRecentRolls] = useState<DetailRollHistory[]>([]);
  const isSaleProduct = currentGacha.type === "sale";
  const soldOut = currentGacha.remaining <= 0 || currentGacha.status === "closed";
  const discountedPrice = useMemo(
    () => getDiscountedCoinPrice(currentGacha.price, discountCoupon, currentGacha.discountDisabled),
    [currentGacha.discountDisabled, currentGacha.price, discountCoupon],
  );
  const hasDiscount = Boolean(discountCoupon && !currentGacha.discountDisabled && discountedPrice < currentGacha.price);
  const notEnoughCoins = isLoggedIn && coins < discountedPrice;
  const actionDisabled = soldOut || notEnoughCoins;

  useEffect(() => {
    let isMounted = true;

    async function syncProduct() {
      await ensureMockDatabase();
      const remoteCatalog = await fetchCatalogSnapshot();
      if (remoteCatalog) {
        saveProducts(remoteCatalog.products, false, false);
      }
      const product = (remoteCatalog?.products ?? getProducts()).find((item) => item.id === gachaId);
      if (!isMounted) return;
      setIsLoggedIn(Boolean(getCurrentUser()));
      setCoins(getCoinBalance());
      if (product) {
        const nextGacha = toGachaItem(product, initialGacha);
        setCurrentGacha(nextGacha);
        setRecentRolls(getDetailRollHistory(nextGacha.name, gachaId));
      } else {
        setRecentRolls(getDetailRollHistory(initialGacha?.name ?? gachaId, gachaId));
      }
      setDiscountCoupon(getBestDiscountCoupon());
    }

    const rollError = window.sessionStorage.getItem("gachaRollError");
    if (rollError) {
      setMessage(rollError);
      window.sessionStorage.removeItem("gachaRollError");
    }

    syncProduct();
    window.addEventListener("gacha-products-updated", syncProduct);
    window.addEventListener("gacha-wallet-updated", syncProduct);
    window.addEventListener("gacha-auth-updated", syncProduct);
    window.addEventListener("gacha-coupons-updated", syncProduct);
    window.addEventListener("gacha-roll-history-updated", syncProduct);
    return () => {
      isMounted = false;
      window.removeEventListener("gacha-products-updated", syncProduct);
      window.removeEventListener("gacha-wallet-updated", syncProduct);
      window.removeEventListener("gacha-auth-updated", syncProduct);
      window.removeEventListener("gacha-coupons-updated", syncProduct);
      window.removeEventListener("gacha-roll-history-updated", syncProduct);
    };
  }, [gachaId, initialGacha]);

  const dropRewards = useMemo(() => getDropRewards(currentGacha), [currentGacha]);
  const galleryImages = useMemo(() => {
    const images = [currentGacha.coverImage, ...(currentGacha.images ?? [])]
      .map((image) => String(image ?? "").trim())
      .filter(Boolean);

    return Array.from(new Set(images)).slice(0, 10);
  }, [currentGacha.coverImage, currentGacha.images]);
  const activeImage = galleryImages[selectedImageIndex] ?? currentGacha.coverImage ?? "/hero-machine.png";

  const actionMessage = useMemo(() => {
    if (!isLoggedIn) return "กรุณาเข้าสู่ระบบก่อนซื้อหรือสุ่มสินค้า";
    if (soldOut) return "สินค้านี้ Sold out แล้ว";
    if (notEnoughCoins) return `Coin ไม่พอ ต้องใช้ ${discountedPrice} Coin`;
    return message;
  }, [discountedPrice, isLoggedIn, message, notEnoughCoins, soldOut]);

  useEffect(() => {
    setSelectedImageIndex((current) => Math.min(current, Math.max(0, galleryImages.length - 1)));
  }, [galleryImages.length]);

  function showPreviousImage() {
    setSelectedImageIndex((current) => (current - 1 + galleryImages.length) % galleryImages.length);
  }

  function showNextImage() {
    setSelectedImageIndex((current) => (current + 1) % galleryImages.length);
  }

  function requestSalePurchase() {
    if (!isLoggedIn) {
      router.push("/login");
      return;
    }

    if (actionDisabled) {
      setMessage(actionMessage);
      return;
    }

    setConfirmAction("sale");
  }

  function requestRoll() {
    if (!isLoggedIn) {
      router.push("/login");
      return;
    }

    if (actionDisabled) {
      setMessage(actionMessage);
      return;
    }

    setConfirmAction("roll");
  }

  function confirmPendingAction() {
    const nextAction = confirmAction;
    setConfirmAction(null);

    if (nextAction === "sale") {
      handleSalePurchase();
      return;
    }

    if (nextAction === "roll") {
      router.push(`/gacha/roll?machine=${currentGacha.id}`);
    }
  }

  async function handleSalePurchase() {
    if (!isSaleProduct) return;

    if (!isLoggedIn) {
      router.push("/login");
      return;
    }

    if (actionDisabled) {
      setMessage(actionMessage);
      return;
    }

    try {
      const purchase = await purchaseSaleProduct(currentGacha.id);
      addRewardToInventory({
        id: purchase.product.id,
        name: purchase.product.name,
        image: purchase.product.image,
        stars: 3,
        chance: 100,
      });
      setCoins(purchase.nextBalance);
      setCurrentGacha(toGachaItem(purchase.product, initialGacha));
      setMessage("ซื้อสำเร็จ เพิ่มสินค้าเข้ากระเป๋าของฉันแล้ว");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ซื้อสินค้าไม่สำเร็จ");
    }
  }

  const detailDescription = currentGacha.description?.trim();

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6">
      <div className={`detail-shell${isSaleProduct ? " detail-shell-sale" : ""}`}>
        <aside className="detail-actions">
          <Link href="/gacha" className="detail-back-button">
            <ArrowLeft size={24} />
            ย้อนกลับ
          </Link>
        </aside>

        <section className="detail-hero">
          <div className="detail-machine-side">
            <div className="detail-floating-capsule detail-floating-capsule-a" />
            <div className="detail-floating-capsule detail-floating-capsule-b" />
            <div className="detail-floating-capsule detail-floating-capsule-c" />
            <button
              type="button"
              className={`detail-image-button${isSaleProduct ? " is-clickable" : ""}`}
              onClick={() => {
                if (isSaleProduct) setGalleryOpen(true);
              }}
              disabled={!isSaleProduct}
              aria-label="เปิดรูปสินค้า"
            >
              <UrlImage
                src={activeImage}
                alt={currentGacha.name}
                width={764}
                height={938}
                className="detail-machine-image detail-cover-image"
              />
            </button>
            {isSaleProduct && galleryImages.length > 1 && (
              <div className="detail-thumb-row" aria-label="รูปตัวอย่างสินค้า">
                {galleryImages.map((image, index) => (
                  <button
                    key={`${image}-${index}`}
                    type="button"
                    className={`detail-thumb-button${index === selectedImageIndex ? " is-active" : ""}`}
                    onClick={() => setSelectedImageIndex(index)}
                    aria-label={`ดูรูปสินค้า ${index + 1}`}
                  >
                    <UrlImage src={image} alt={`${currentGacha.name} ${index + 1}`} width={110} height={86} />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className={`detail-copy${isSaleProduct ? " detail-copy-sale" : ""}`}>
            <p className="detail-eyebrow">
              <Gift size={20} /> {isSaleProduct ? "สินค้า" : "ตู้กาชาปอง"} <Sparkles size={16} />
            </p>
            <h1 title={currentGacha.name}>{currentGacha.name}</h1>
            <h2>
              <Star size={28} fill="#ffd84e" strokeWidth={0} />
              {isSaleProduct ? "สินค้าพร้อมซื้อ" : "Sleep Collection"}
              <Star size={24} fill="#ff88d3" strokeWidth={0} />
              ✨
            </h2>
            <p className="detail-description">
              {isSaleProduct
                ? "กดซื้อสินค้าได้ทันที ระบบจะหัก Coin และเพิ่มสินค้าเข้ากระเป๋าของคุณอัตโนมัติ"
                : "ลุ้นฟิกเกอร์สุดน่ารักจากคอลเลกชันพิเศษ พร้อมเอฟเฟกต์สุ่มแบบเต็มจอ และหน้าผลลัพธ์สไตล์ Gacha Pop สีม่วงพาสเทล"}
            </p>

            {!isSaleProduct && (
              <div className={`detail-stock-card${soldOut ? " detail-stock-card-sold-out" : ""}`}>
                <div className="gacha-ball ball-1 static !h-10 !w-10" />
                {soldOut ? (
                  <strong>Sold out</strong>
                ) : (
                  <>
                    <span>เหลืออยู่</span>
                    <strong>{currentGacha.remaining}</strong>
                    <span>ลูก</span>
                  </>
                )}
              </div>
            )}

            <div className="detail-roll-card">
              <p>
                <Sparkles size={30} />
                <strong>{discountedPrice}</strong>
                <span className="coin-badge">C</span>
              </p>
              {hasDiscount && <em className="detail-discount-note">ใช้โค้ดลด {discountCoupon?.discountPercent}% จาก {currentGacha.price} Coin</em>}
              <span>{isSaleProduct ? "Coin" : "Coin / ครั้ง"}</span>
              <div className="detail-roll-actions">
                {isSaleProduct ? (
                  <button
                    type="button"
                    className={`detail-roll-button${actionDisabled ? " detail-roll-button-disabled" : ""}`}
                    disabled={actionDisabled}
                    onClick={requestSalePurchase}
                  >
                    <ShoppingBag size={42} fill="white" strokeWidth={1.8} />
                    {soldOut ? "Sold out" : "ซื้อสินค้า"}
                  </button>
                ) : (
                  <button
                    type="button"
                    className={`detail-roll-button${actionDisabled ? " detail-roll-button-disabled" : ""}`}
                    disabled={actionDisabled}
                    onClick={requestRoll}
                  >
                    <Dice5 size={42} fill="white" strokeWidth={1.8} />
                    {soldOut ? "Sold out" : "สุ่มเลย"}
                  </button>
                )}
                <button
                  type="button"
                  className={`detail-favorite-button${isFavorite ? " is-saved" : ""}`}
                  onClick={() => setIsFavorite((current) => !current)}
                  aria-pressed={isFavorite}
                >
                  <Heart size={28} fill={isFavorite ? "#ff4fae" : "none"} strokeWidth={2.4} />
                  <span>{isFavorite ? "บันทึกแล้ว" : "เพิ่มรายการโปรด"}</span>
                </button>
              </div>
              {actionMessage && <p className="detail-roll-message">{actionMessage}</p>}
            </div>
          </div>
        </section>

        {isSaleProduct ? (
          <section className="detail-sale-details">
            <h3>รายละเอียดสินค้า</h3>
            <p>{detailDescription || "ยังไม่มีรายละเอียดสินค้า"}</p>
          </section>
        ) : (
          <section className="detail-bottom-grid">
            <div className="detail-rate-panel">
              <h3>
                อัตราการออก (Drop Rate)
                <span>?</span>
              </h3>
              <div className="detail-reward-window">
                <div className="detail-reward-grid">
                  {[...dropRewards, ...dropRewards].map((reward, index) => (
                    <article key={`${reward.id}-${index}`} className="detail-reward-card" aria-hidden={index >= dropRewards.length}>
                      <div className="detail-stars">★★★</div>
                      <UrlImage src={reward.image} alt={reward.name} width={220} height={180} className="detail-reward-image" />
                      <span className="detail-reward-kind">ของรางวัล</span>
                      <strong>{reward.name}</strong>
                    </article>
                  ))}
                </div>
              </div>
            </div>

            <div className="detail-history-panel">
              <h3>
                <History size={21} />
                ประวัติการสุ่ม
              </h3>
              {recentRolls.length > 0 && (
                <div className="detail-history-list" aria-live="polite">
                  {recentRolls.map((entry) => (
                    <article key={entry.id} className="detail-history-row">
                      <span>{entry.displayName}</span>
                      <strong>สุ่มได้ {entry.rewardName}</strong>
                    </article>
                  ))}
                </div>
              )}
              <div className={`detail-history-empty${recentRolls.length > 0 ? " detail-history-empty-hidden" : ""}`}>
                <Clock3 size={78} />
                <strong>ยังไม่มีประวัติการสุ่ม</strong>
                <span>มาลุ้นเป็นคนแรกกันเถอะ!</span>
              </div>
            </div>
          </section>
        )}
      </div>

      {confirmAction && (
        <div className="detail-confirm-backdrop" role="dialog" aria-modal="true" onClick={() => setConfirmAction(null)}>
          <section className="detail-confirm-modal" onClick={(event) => event.stopPropagation()}>
            <div className="detail-confirm-icon">
              {confirmAction === "sale" ? <ShoppingBag size={38} /> : <Dice5 size={38} />}
            </div>
            <h2>{confirmAction === "sale" ? "ยืนยันซื้อสินค้า" : "ยืนยันสุ่มกาชาปอง"}</h2>
            <p>{confirmAction === "sale" ? "ระบบจะหัก Coin และเพิ่มสินค้าเข้ากระเป๋าทันที" : "ระบบจะหัก Coin แล้วเริ่มอนิเมชันสุ่มรางวัล"}</p>
            <div className="detail-confirm-price">
              <strong>{discountedPrice.toLocaleString("th-TH")} Coin</strong>
              {hasDiscount && <span>ใช้โค้ดลด {discountCoupon?.discountPercent}% จาก {currentGacha.price.toLocaleString("th-TH")} Coin</span>}
            </div>
            <div className="detail-confirm-actions">
              <button type="button" onClick={() => setConfirmAction(null)}>
                ยกเลิก
              </button>
              <button type="button" onClick={confirmPendingAction}>
                ยืนยัน
              </button>
            </div>
          </section>
        </div>
      )}

      {galleryOpen && isSaleProduct && (
        <div className="detail-gallery-modal" role="dialog" aria-modal="true" aria-label="รูปสินค้า" onClick={() => setGalleryOpen(false)}>
          {galleryImages.length > 1 && (
            <button
              type="button"
              className="detail-gallery-nav detail-gallery-prev"
              onClick={(event) => {
                event.stopPropagation();
                showPreviousImage();
              }}
              aria-label="รูปก่อนหน้า"
            >
              <ChevronLeft size={34} />
            </button>
          )}
          <div className="detail-gallery-frame" onClick={(event) => event.stopPropagation()}>
            <UrlImage src={activeImage} alt={currentGacha.name} width={1100} height={900} />
          </div>
          {galleryImages.length > 1 && (
            <button
              type="button"
              className="detail-gallery-nav detail-gallery-next"
              onClick={(event) => {
                event.stopPropagation();
                showNextImage();
              }}
              aria-label="รูปถัดไป"
            >
              <ChevronRight size={34} />
            </button>
          )}
          {galleryImages.length > 1 && (
            <div className="detail-gallery-thumbs" onClick={(event) => event.stopPropagation()}>
              {galleryImages.map((image, index) => (
                <button
                  key={`modal-${image}-${index}`}
                  type="button"
                  className={`detail-gallery-thumb${index === selectedImageIndex ? " is-active" : ""}`}
                  onClick={() => setSelectedImageIndex(index)}
                  aria-label={`เลือกรูป ${index + 1}`}
                >
                  <UrlImage src={image} alt={`${currentGacha.name} ${index + 1}`} width={118} height={86} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}

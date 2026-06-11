"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Home,
  PackageOpen,
  Gamepad2,
  Heart,
  type LucideIcon,
} from "lucide-react";
import { GachaCard } from "@/components/GachaCard";
import { Navbar } from "@/components/Navbar";
import { fetchCatalogSnapshot } from "@/data/catalogSync";
import { gachas, type GachaItem } from "@/data/gacha";
import {
  ensureMockDatabase,
  getPopupAds,
  getProductCategories,
  getProducts,
  savePopupAds,
  saveProductCategories,
  saveProducts,
  type PopupAdRecord,
  type ProductCategoryRecord,
  type ProductRecord,
} from "@/data/mockDb";

const tabs = [
  "ทั้งหมด",
  "ยอดนิยม",
  "มาใหม่",
  "กำลังจะหมด",
] as const;

type Tab = (typeof tabs)[number];
type ProductCategory = string;
const FAVORITES_STORAGE_KEY = "gacha_favorite_products";

function getCategoryIcon(categoryId: string): LucideIcon {
  if (categoryId === "gachapon") return Gamepad2;
  if (categoryId === "figure") return PackageOpen;
  if (categoryId === "plush") return Heart;
  return PackageOpen;
}

function toGachaItem(product: ProductRecord): GachaItem {
  const seed = gachas.find((item) => item.id === product.id);
  const productBadges = product.badges ?? [];
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
    badge: productBadges.includes("new") ? "NEW" : productBadges.includes("popular") ? "HOT" : productBadges.includes("ending") ? "LIMITED" : seed?.badge,
    badges: productBadges,
    pinned: product.pinned,
    discountDisabled: product.discountDisabled,
    theme: seed?.theme ?? "purple",
    mascot: seed?.mascot ?? product.name,
    coverImage: product.image,
    images: product.images,
    popular: productBadges.includes("popular") || seed?.popular,
    isNew: productBadges.includes("new") || seed?.isNew,
    limited: productBadges.includes("ending") || seed?.limited,
  };
}

function sortItems(tab: Tab, category: ProductCategory, sourceItems: GachaItem[]) {
  const filteredItems = category === "all" ? sourceItems : sourceItems.filter((item) => item.category === category);
  const items = [...filteredItems].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));
  if (tab === "ยอดนิยม") return items.filter((item) => item.popular);
  if (tab === "มาใหม่") return items.filter((item) => item.isNew);
  if (tab === "กำลังจะหมด") {
    return items.sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || a.remaining - b.remaining);
  }
  return items;
}

export function GachaMenuPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>("ทั้งหมด");
  const [activeCategory, setActiveCategory] = useState<ProductCategory>("all");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [displayGachas, setDisplayGachas] = useState<GachaItem[]>(gachas);
  const [categories, setCategories] = useState<ProductCategoryRecord[]>([]);
  const [popupAds, setPopupAds] = useState<PopupAdRecord[]>([]);
  const [activeBanner, setActiveBanner] = useState(0);
  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);
  const items = useMemo(() => {
    const sortedItems = sortItems(activeTab, activeCategory, displayGachas);
    return showFavoritesOnly ? sortedItems.filter((item) => favoriteSet.has(item.id)) : sortedItems;
  }, [activeCategory, activeTab, displayGachas, favoriteSet, showFavoritesOnly]);
  const sidebarCategories = useMemo(() => [{ id: "all", label: "ทั้งหมด", createdAt: "" }, ...categories], [categories]);
  const bannerAds = useMemo(() => popupAds.filter((ad) => ad.isActive && (ad.placement ?? "banner") === "banner").slice(0, 5), [popupAds]);
  const bannerImages = bannerAds.length > 0 ? bannerAds : [{ id: "fallback", image: "/promo-banner.png", title: "โปรโมชันหลัก", placement: "banner" as const, dismissHours: 1, isActive: true, createdAt: "" }];
  const categoryCounts = useMemo(
    () =>
      sidebarCategories.reduce<Record<string, number>>((acc, category) => {
        acc[category.id] = category.id === "all" ? displayGachas.length : displayGachas.filter((item) => item.category === category.id).length;
        return acc;
      }, {}),
    [displayGachas, sidebarCategories],
  );

  useEffect(() => {
    try {
      const storedFavorites = JSON.parse(window.localStorage.getItem(FAVORITES_STORAGE_KEY) ?? "[]");
      if (Array.isArray(storedFavorites)) setFavoriteIds(storedFavorites.map(String));
    } catch {
      setFavoriteIds([]);
    }
  }, []);

  useEffect(() => {
    setActiveCategory(searchParams.get("category") || "all");
  }, [searchParams]);

  useEffect(() => {
    if (bannerImages.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveBanner((current) => (current + 1) % bannerImages.length);
    }, 4200);
    return () => window.clearInterval(timer);
  }, [bannerImages.length]);

  useEffect(() => {
    let isMounted = true;

    async function syncProducts() {
      await ensureMockDatabase();
      const remoteCatalog = await fetchCatalogSnapshot();
      const products = remoteCatalog?.products ?? getProducts();
      const nextCategories = remoteCatalog?.categories ?? getProductCategories();
      const nextPopupAds = remoteCatalog?.popupAds ?? getPopupAds();

      if (remoteCatalog) {
        saveProducts(remoteCatalog.products, false, false);
        saveProductCategories(remoteCatalog.categories, false, false);
        savePopupAds(remoteCatalog.popupAds, false, false);
      }

      if (isMounted) {
        setDisplayGachas(products.map(toGachaItem));
        setCategories(nextCategories);
        setPopupAds(nextPopupAds);
      }
    }

    syncProducts();
    window.addEventListener("gacha-products-updated", syncProducts);
    window.addEventListener("gacha-categories-updated", syncProducts);
    window.addEventListener("gacha-popup-ads-updated", syncProducts);
    return () => {
      isMounted = false;
      window.removeEventListener("gacha-products-updated", syncProducts);
      window.removeEventListener("gacha-categories-updated", syncProducts);
      window.removeEventListener("gacha-popup-ads-updated", syncProducts);
    };
  }, []);

  const selectCategory = useCallback((category: ProductCategory) => {
    setActiveCategory(category);
    const nextUrl = category === "all" ? "/gacha" : `/gacha?category=${category}`;
    window.history.replaceState(null, "", nextUrl);
  }, []);

  const toggleFavorite = useCallback((productId: string) => {
    setFavoriteIds((current) => {
      const nextFavorites = current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId];

      window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(nextFavorites));
      return nextFavorites;
    });
  }, []);

  const selectProduct = useCallback(
    (item: GachaItem) => {
      router.push(`/gacha/${item.id}`);
    },
    [router],
  );

  return (
    <>
      <Navbar />
      <main className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6">
        <div className="sparkle-field" />
        <div className="relative z-10 mx-auto grid max-w-7xl gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="sidebar-panel gacha-sidebar-panel">
            <section>
              <h2 className="mb-4 text-xl font-black text-indigo-950">หมวดหมู่</h2>
              <div className="grid gap-2">
                {sidebarCategories.map((category) => {
                  const Icon = category.id === "all" ? Home : getCategoryIcon(category.id);
                  return (
                    <button
                      key={category.label}
                      onClick={() => selectCategory(category.id)}
                      className={`sidebar-item ${activeCategory === category.id ? "sidebar-item-active" : ""}`}
                    >
                      <Icon size={19} />
                      <span>{category.label}</span>
                      <span className="ml-auto">{categoryCounts[category.id] ?? 0}</span>
                    </button>
                  );
                })}
              </div>
            </section>

          </aside>

          <section className="min-w-0">
            <div className="promo-banner">
              <div className="promo-banner-track" style={{ transform: `translateX(-${activeBanner * 100}%)` }}>
                {bannerImages.map((ad) => (
                  <img
                    key={ad.id}
                    src={ad.image || "/promo-banner.png"}
                    alt={ad.title || "Gacha Pop promotion"}
                    className="promo-banner-image"
                    onError={(event) => {
                      event.currentTarget.src = "/promo-banner.png";
                    }}
                  />
                ))}
              </div>
              <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
                {bannerImages.map((ad, dot) => (
                  <span key={ad.id} className={`h-3 w-3 rounded-full ${dot === activeBanner ? "bg-violet-600" : "bg-white"}`} />
                ))}
              </div>
            </div>

            <div className="gacha-filter-bar mt-6 rounded-[28px] bg-white/70 p-3 shadow-[0_12px_40px_rgba(94,57,177,0.12)] backdrop-blur">
              <div className="gacha-filter-scroll scrollbar-hide">
                {tabs.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`filter-pill ${activeTab === tab ? "filter-pill-active" : ""}`}
                  >
                    {tab}
                  </button>
                ))}
                <button
                  type="button"
                  className={`favorite-filter-button${showFavoritesOnly ? " favorite-filter-button-active" : ""}`}
                  onClick={() => setShowFavoritesOnly((current) => !current)}
                  aria-label="รายการโปรด"
                  aria-pressed={showFavoritesOnly}
                >
                  <Heart size={24} fill={showFavoritesOnly ? "currentColor" : "none"} />
                </button>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((item) => (
                <GachaCard
                  key={item.id}
                  item={item}
                  isFavorite={favoriteSet.has(item.id)}
                  onFavoriteToggle={toggleFavorite}
                  onSelect={selectProduct}
                />
              ))}
            </div>
            {items.length === 0 && (
              <div className="mt-6 rounded-[28px] border border-violet-200 bg-white/75 p-8 text-center shadow-[0_12px_40px_rgba(94,57,177,0.12)] backdrop-blur">
                <p className="text-2xl font-black text-indigo-950">ยังไม่มีสินค้าในหมวดนี้</p>
                <p className="mt-2 font-bold text-violet-600">เดี๋ยวค่อยเพิ่มสินค้าใหม่เข้ามาได้เลย</p>
              </div>
            )}
          </section>
        </div>
      </main>
    </>
  );
}

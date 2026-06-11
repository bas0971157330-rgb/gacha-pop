import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { gachas, type ProductBadge, type ProductDropItem, type ProductType } from "@/data/gacha";
import type { PopupAdRecord, ProductCategoryRecord, ProductRecord, ProductStatus } from "@/data/mockDb";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PublicStore = {
  products: ProductRecord[];
  categories: ProductCategoryRecord[];
  popupAds: PopupAdRecord[];
};

const projectStorePath = path.join(process.cwd(), "data", "mock-public-store.json");
const runtimeStorePath = process.env.VERCEL
  ? path.join("/tmp", "gacha-pop-mock-public-store.json")
  : projectStorePath;

function makeId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function defaultCategories(): ProductCategoryRecord[] {
  const now = new Date().toISOString();
  return [
    { id: "gachapon", label: "กาชาปอง", createdAt: now },
    { id: "figure", label: "ฟิกเกอร์/โมเดล", createdAt: now },
    { id: "plush", label: "ตุ๊กตา", createdAt: now },
  ];
}

function normalizeDropItems(items: ProductDropItem[] | undefined): ProductDropItem[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => ({
      id: String(item.id || makeId("drop")),
      name: String(item.name || "").trim(),
      image: String(item.image || "/hero-machine.png").trim(),
      quantity: Math.max(1, Number(item.quantity || 1)),
    }))
    .filter((item) => item.name && item.image);
}

function normalizeProductImages(image?: string, images?: string[]) {
  const primaryImage = String(image || "/hero-machine.png").trim() || "/hero-machine.png";
  const galleryImages = Array.isArray(images) ? images : [];
  const normalizedImages = [primaryImage, ...galleryImages]
    .map((item) => String(item || "").trim())
    .filter(Boolean);

  return Array.from(new Set(normalizedImages)).slice(0, 10);
}

function normalizeProduct(product: Partial<ProductRecord>): ProductRecord {
  const images = normalizeProductImages(product.image, product.images);
  const seed = gachas.find((item) => item.id === product.id);
  const storedBadges = Array.isArray(product.badges)
    ? product.badges.filter((badge): badge is ProductBadge => badge === "popular" || badge === "new" || badge === "ending")
    : [];
  const seedBadges: ProductBadge[] = [
    ...(seed?.popular ? (["popular"] as ProductBadge[]) : []),
    ...(seed?.isNew || seed?.badge === "NEW" ? (["new"] as ProductBadge[]) : []),
    ...(seed?.limited || seed?.badge === "LIMITED" ? (["ending"] as ProductBadge[]) : []),
  ];
  const badges = Array.from(new Set(storedBadges.length > 0 ? storedBadges : seedBadges));

  return {
    id: String(product.id || makeId("product")),
    name: String(product.name || "").trim(),
    image: images[0] || "/hero-machine.png",
    images,
    stock: Math.max(0, Number(product.stock || 0)),
    priceCoin: Math.max(0, Number(product.priceCoin || 0)),
    status: product.status === "closed" ? ("closed" as ProductStatus) : ("open" as ProductStatus),
    type: product.type === "sale" ? ("sale" as ProductType) : ("random" as ProductType),
    categoryId: String(product.categoryId || "gachapon"),
    description: String(product.description || ""),
    badges,
    pinned: Boolean(product.pinned),
    discountDisabled: Boolean(product.discountDisabled),
    dropItems: normalizeDropItems(product.dropItems),
    createdAt: String(product.createdAt || new Date().toISOString()),
  };
}

function normalizeCategories(categories: ProductCategoryRecord[] | undefined): ProductCategoryRecord[] {
  const source = Array.isArray(categories) && categories.length > 0 ? categories : defaultCategories();
  return source.map((category) => ({
    id: String(category.id || makeId("category")),
    label: String(category.label || "หมวดหมู่").trim(),
    createdAt: String(category.createdAt || new Date().toISOString()),
  }));
}

function normalizeAds(ads: PopupAdRecord[] | undefined): PopupAdRecord[] {
  const source = Array.isArray(ads) && ads.length > 0
    ? ads
    : [{ id: "promo_default", image: "/promo-banner.png", title: "โปรโมชันหลัก", placement: "banner" as const, dismissHours: 1, isActive: true, createdAt: new Date().toISOString() }];

  return source.slice(0, 5).map((ad) => ({
    id: String(ad.id || makeId("ad")),
    image: String(ad.image || "/promo-banner.png"),
    title: String(ad.title || "Gacha Pop Promotion"),
    placement: ad.placement === "popup" ? "popup" : "banner",
    dismissHours: Number.isFinite(Number(ad.dismissHours)) && Number(ad.dismissHours) > 0 ? Number(ad.dismissHours) : 1,
    isActive: Boolean(ad.isActive),
    createdAt: String(ad.createdAt || new Date().toISOString()),
  }));
}

function defaultProducts(): ProductRecord[] {
  return gachas.map((gacha) =>
    normalizeProduct({
      id: gacha.id,
      name: gacha.name,
      image: gacha.coverImage || "/hero-machine.png",
      images: gacha.coverImage ? [gacha.coverImage] : ["/hero-machine.png"],
      stock: gacha.remaining,
      priceCoin: gacha.price,
      type: "random",
      categoryId: gacha.category,
      description: "ลุ้นฟิกเกอร์สุดน่ารักจากคอลเลกชันพิเศษ พร้อมเอฟเฟกต์สุ่มแบบเต็มจอ",
      badges: gacha.popular ? ["popular"] : gacha.isNew ? ["new"] : gacha.limited ? ["ending"] : [],
      pinned: false,
      dropItems: [],
      status: "open",
      createdAt: new Date().toISOString(),
    }),
  );
}

function normalizeStore(store: Partial<PublicStore> | null | undefined): PublicStore {
  return {
    products: Array.isArray(store?.products) && store.products.length > 0 ? store.products.map(normalizeProduct) : defaultProducts(),
    categories: normalizeCategories(store?.categories),
    popupAds: normalizeAds(store?.popupAds),
  };
}

async function readJsonStore(filePath: string) {
  try {
    const raw = await readFile(filePath, "utf8");
    return normalizeStore(JSON.parse(raw) as Partial<PublicStore>);
  } catch {
    return null;
  }
}

async function readStore() {
  const runtimeStore = await readJsonStore(runtimeStorePath);
  if (runtimeStore) return runtimeStore;

  const projectStore = await readJsonStore(projectStorePath);
  if (projectStore) {
    await writeStore(projectStore).catch(() => null);
    return projectStore;
  }

  const store = normalizeStore(null);
  await writeStore(store).catch(() => null);
  return store;
}

async function writeStore(store: PublicStore) {
  await mkdir(path.dirname(runtimeStorePath), { recursive: true });
  await writeFile(runtimeStorePath, JSON.stringify(normalizeStore(store), null, 2), "utf8");
}

export async function GET() {
  return NextResponse.json(await readStore());
}

export async function POST(request: Request) {
  const current = await readStore();
  const body = (await request.json()) as Partial<PublicStore>;
  const next = normalizeStore({
    products: body.products ?? current.products,
    categories: body.categories ?? current.categories,
    popupAds: body.popupAds ?? current.popupAds,
  });
  await writeStore(next);
  return NextResponse.json(next);
}

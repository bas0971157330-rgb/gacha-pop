"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Bell,
  Boxes,
  CheckCircle2,
  Clipboard,
  Clock,
  Copy,
  Coins,
  Crown,
  ExternalLink,
  FileText,
  History,
  ImagePlus,
  LayoutDashboard,
  LogIn,
  MapPin,
  Megaphone,
  PackageCheck,
  Phone,
  Plus,
  Save,
  Search,
  Shield,
  Sparkles,
  Tags,
  Ticket,
  Trash2,
  Truck,
  UserCog,
  UserRound,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { UrlImage } from "@/components/UrlImage";
import { fetchCatalogSnapshot, saveCatalogSnapshot } from "@/data/catalogSync";
import {
  COUPONS_STORAGE_KEY,
  createCoupon,
  deleteCoupon,
  formatCouponExpiry,
  getCouponClaimedCount,
  getCouponUsedCount,
  getCoupons,
  isCouponExpired,
  type CouponRecord,
  type CouponType,
} from "@/data/coupons";
import { type ProductBadge, type ProductDropItem, type ProductType } from "@/data/gacha";
import { markInventoryItemsForOrderStatus } from "@/data/inventory";
import { rollRewards } from "@/data/rewards";
import {
  addCoinsToUser,
  adminResetPassword,
  createAdminUser,
  ensureMockDatabase,
  NOTIFICATIONS_STORAGE_KEY,
  ORDERS_STORAGE_KEY,
  USERS_STORAGE_KEY,
  getCoinLogs,
  getCurrentUser,
  getNotifications,
  getOrders,
  getPopupAds,
  getProductCategories,
  getProducts,
  getRollHistory,
  getAdminUserRows,
  getTopupLogs,
  saveOrders,
  savePopupAds,
  saveProductCategories,
  saveProducts,
  suspendUser,
  syncSharedStoreFromServer,
  type AdminUserRow,
  type CoinLog,
  type OrderRecord,
  type OrderStatus,
  type PopupAdPlacement,
  type PopupAdRecord,
  type ProductCategoryRecord,
  type ProductRecord,
  type ProductStatus,
  type RollHistory,
  type SafeUser,
  type TopupLog,
} from "@/data/mockDb";

type AdminSection =
  | "dashboard"
  | "users"
  | "coins"
  | "products"
  | "categories"
  | "ads"
  | "coupons"
  | "admins"
  | "orders"
  | "rolls"
  | "topups";

type ProductFormState = {
  name: string;
  image: string;
  stock: string;
  priceCoin: string;
  status: ProductStatus;
  type: ProductType;
  categoryId: string;
  description: string;
  badges: ProductBadge[];
  pinned: boolean;
  discountDisabled: boolean;
};

const menuItems: Array<{ id: AdminSection; label: string; icon: typeof LayoutDashboard }> = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "users", label: "จัดการผู้ใช้", icon: UserCog },
  { id: "coins", label: "เพิ่ม Coin", icon: Coins },
  { id: "products", label: "สินค้า / สต็อก", icon: Boxes },
  { id: "categories", label: "หมวดหมู่", icon: Tags },
  { id: "ads", label: "โฆษณาป๊อปอัพ", icon: Megaphone },
  { id: "coupons", label: "โค้ดส่วนลด / ส่งฟรี", icon: Ticket },
  { id: "admins", label: "เพิ่มแอดมิน", icon: Crown },
  { id: "orders", label: "ออเดอร์จัดส่ง", icon: Truck },
  { id: "rolls", label: "ประวัติการสุ่ม", icon: History },
  { id: "topups", label: "ประวัติเติมเงิน", icon: PackageCheck },
];

const orderStatusLabel: Record<OrderStatus, string> = {
  pending: "รอดำเนินการ",
  shipping: "กำลังจัดส่ง",
  shipped: "จัดส่งแล้ว",
};

const orderStatusFilters: Array<{ id: OrderStatus | "all"; label: string }> = [
  { id: "all", label: "ทั้งหมด" },
  { id: "pending", label: "รอดำเนินการ" },
  { id: "shipping", label: "กำลังจัดส่ง" },
  { id: "shipped", label: "จัดส่งแล้ว" },
];

const productBadgeOptions: Array<{ id: ProductBadge; label: string }> = [
  { id: "popular", label: "ยอดนิยม" },
  { id: "new", label: "มาใหม่" },
  { id: "ending", label: "กำลังจะหมด" },
];

const emptyProductForm: ProductFormState = {
  name: "",
  image: "",
  stock: "10",
  priceCoin: "59",
  status: "open",
  type: "random",
  categoryId: "gachapon",
  description: "",
  badges: [],
  pinned: false,
  discountDisabled: false,
};

const defaultDropItems = (): ProductDropItem[] =>
  rollRewards.map((reward) => ({
    id: reward.id,
    name: reward.name,
    image: reward.image,
    quantity: Math.max(1, Math.round(reward.chance)),
  }));

function makeId(prefix: string) {
  const randomPart =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  return `${prefix}_${randomPart}`;
}

function normalizeFormImages(primaryImage: string, images: string[]) {
  const normalizedImages = [primaryImage, ...images]
    .map((image) => image.trim())
    .filter(Boolean);

  return Array.from(new Set(normalizedImages)).slice(0, 10);
}

function slugCategory(label: string) {
  const latinSlug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9ก-๙]+/gi, "-")
    .replace(/^-+|-+$/g, "");

  return latinSlug || makeId("category");
}

function cleanDropItems(items: ProductDropItem[]) {
  return items
    .map((item) => ({
      id: item.id || makeId("drop"),
      name: item.name.trim(),
      image: item.image.trim(),
      quantity: Math.max(0, Number(item.quantity)),
    }))
    .filter((item) => item.name && item.image && item.quantity > 0);
}

function dropTotal(items: ProductDropItem[]) {
  return items.reduce((sum, item) => sum + Math.max(0, Number(item.quantity)), 0);
}

function safeFilePart(value: unknown) {
  return String(value ?? "order")
    .trim()
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "order";
}

function shortOrderId(value: string) {
  const digits = (value.match(/\d+/g) ?? []).join("");
  if (digits.length >= 3) return `#${digits.slice(-3)}`;
  return `#${value.replace(/^order[_-]?/i, "").slice(0, 6).toUpperCase()}`;
}

function formatAdminDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(date);
}

export function AdminDashboard() {
  const [ready, setReady] = useState(false);
  const [activeSection, setActiveSection] = useState<AdminSection>("dashboard");
  const [admin, setAdmin] = useState<SafeUser | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [categories, setCategories] = useState<ProductCategoryRecord[]>([]);
  const [popupAds, setPopupAds] = useState<PopupAdRecord[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [coinLogs, setCoinLogs] = useState<CoinLog[]>([]);
  const [topupLogs, setTopupLogs] = useState<TopupLog[]>([]);
  const [rollHistory, setRollHistory] = useState<RollHistory[]>([]);
  const [search, setSearch] = useState("");
  const [coinUserId, setCoinUserId] = useState("");
  const [coinAmount, setCoinAmount] = useState("");
  const [coinReason, setCoinReason] = useState("");
  const [toast, setToast] = useState("");
  const [editingProductId, setEditingProductId] = useState("");
  const [productForm, setProductForm] = useState<ProductFormState>(emptyProductForm);
  const [productImages, setProductImages] = useState<string[]>([]);
  const [productImageUrl, setProductImageUrl] = useState("");
  const [dropItems, setDropItems] = useState<ProductDropItem[]>(defaultDropItems);
  const [categoryName, setCategoryName] = useState("");
  const [adForm, setAdForm] = useState<{ title: string; image: string; placement: PopupAdPlacement; isActive: boolean }>({
    title: "",
    image: "",
    placement: "banner",
    isActive: true,
  });
  const [coupons, setCoupons] = useState<CouponRecord[]>([]);
  const [couponForm, setCouponForm] = useState<{ code: string; type: CouponType; discountPercent: string; maxUses: string; expiresAt: string }>({
    code: "",
    type: "discount",
    discountPercent: "10",
    maxUses: "1",
    expiresAt: "",
  });
  const [couponError, setCouponError] = useState("");
  const [adminForm, setAdminForm] = useState({ username: "", email: "", pin: "", password: "" });
  const [orderSearch, setOrderSearch] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState<OrderStatus | "all">("all");
  const [orderDrafts, setOrderDrafts] = useState<Record<string, Pick<OrderRecord, "trackingNumber" | "status">>>({});

  async function syncCatalogBeforeRefresh() {
    const remoteCatalog = await fetchCatalogSnapshot();
    if (!remoteCatalog) return;

    const localProducts = getProducts();
    const localCategories = getProductCategories();
    const localAds = getPopupAds();
    const productMap = new Map<string, ProductRecord>();
    localProducts.forEach((product) => productMap.set(product.id, product));
    remoteCatalog.products.forEach((product) => productMap.set(product.id, product));

    const categoryMap = new Map<string, ProductCategoryRecord>();
    localCategories.forEach((category) => categoryMap.set(category.id, category));
    remoteCatalog.categories.forEach((category) => categoryMap.set(category.id, category));

    const adMap = new Map<string, PopupAdRecord>();
    localAds.forEach((ad) => adMap.set(ad.id, ad));
    remoteCatalog.popupAds.forEach((ad) => adMap.set(ad.id, ad));

    const nextProducts = Array.from(productMap.values());
    const nextCategories = Array.from(categoryMap.values());
    const nextAds = Array.from(adMap.values()).slice(0, 5);

    saveProducts(nextProducts, false, false);
    saveProductCategories(nextCategories, false, false);
    savePopupAds(nextAds, false, false);

    const hasLocalOnlyProduct = nextProducts.length !== remoteCatalog.products.length;
    const hasLocalOnlyCategory = nextCategories.length !== remoteCatalog.categories.length;
    const hasLocalOnlyAd = nextAds.length !== remoteCatalog.popupAds.length;
    if (hasLocalOnlyProduct || hasLocalOnlyCategory || hasLocalOnlyAd) {
      await saveCatalogSnapshot({ products: nextProducts, categories: nextCategories, popupAds: nextAds });
    }
  }

  function refresh() {
    const current = getCurrentUser();
    setAdmin(current?.role === "admin" ? current : null);
    setUsers(getAdminUserRows());
    setProducts(getProducts());
    setCategories(getProductCategories());
    setPopupAds(getPopupAds());
    setCoupons(getCoupons());
    setOrders(getOrders());
    setCoinLogs(getCoinLogs());
    setTopupLogs(getTopupLogs());
    setRollHistory(getRollHistory());
  }

  useEffect(() => {
    let isMounted = true;

    async function refreshSharedState() {
      await syncSharedStoreFromServer({ notify: false });
      if (isMounted) refresh();
    }

    ensureMockDatabase().then(() => {
      syncCatalogBeforeRefresh().then(() => {
        refreshSharedState().then(() => {
          if (isMounted) setReady(true);
        });
      });
    });

    function refreshFromStorage(event: StorageEvent) {
      if (
        !event.key ||
        event.key === ORDERS_STORAGE_KEY ||
        event.key === NOTIFICATIONS_STORAGE_KEY ||
        event.key === USERS_STORAGE_KEY ||
        event.key === COUPONS_STORAGE_KEY
      ) {
        refresh();
      }
    }

    window.addEventListener("gacha-auth-updated", refresh);
    window.addEventListener("gacha-users-updated", refresh);
    window.addEventListener("gacha-orders-updated", refresh);
    window.addEventListener("gacha-notifications-updated", refresh);
    window.addEventListener("gacha-products-updated", refresh);
    window.addEventListener("gacha-categories-updated", refresh);
    window.addEventListener("gacha-popup-ads-updated", refresh);
    window.addEventListener("gacha-coupons-updated", refresh);
    window.addEventListener("storage", refreshFromStorage);

    return () => {
      isMounted = false;
      window.removeEventListener("gacha-auth-updated", refresh);
      window.removeEventListener("gacha-users-updated", refresh);
      window.removeEventListener("gacha-orders-updated", refresh);
      window.removeEventListener("gacha-notifications-updated", refresh);
      window.removeEventListener("gacha-products-updated", refresh);
      window.removeEventListener("gacha-categories-updated", refresh);
      window.removeEventListener("gacha-popup-ads-updated", refresh);
      window.removeEventListener("gacha-coupons-updated", refresh);
      window.removeEventListener("storage", refreshFromStorage);
    };
  }, []);

  useEffect(() => {
    if (activeSection !== "orders") return;

    let isMounted = true;
    syncSharedStoreFromServer({ notify: false }).then(() => {
      if (isMounted) refresh();
    });

    return () => {
      isMounted = false;
    };
  }, [activeSection]);

  const filteredUsers = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return users;
    return users.filter(
      (user) =>
        user.id.toLowerCase().includes(keyword) ||
        user.username.toLowerCase().includes(keyword) ||
        user.email.toLowerCase().includes(keyword),
    );
  }, [search, users]);

  const unreadNotifications = getNotifications().filter((notification) => !notification.isRead).length;
  const selectedCoinUser = users.find((user) => user.id === coinUserId || user.username.toLowerCase() === coinUserId.toLowerCase());
  const dropItemTotal = dropTotal(dropItems);
  const formProductImages = useMemo(() => normalizeFormImages(productForm.image, productImages), [productForm.image, productImages]);
  const orderCounts = useMemo(
    () => ({
      all: orders.length,
      pending: orders.filter((order) => order.status === "pending").length,
      shipping: orders.filter((order) => order.status === "shipping").length,
      shipped: orders.filter((order) => order.status === "shipped").length,
    }),
    [orders],
  );
  const filteredOrders = useMemo(() => {
    const keyword = orderSearch.trim().toLowerCase();
    const statusRank: Record<OrderStatus, number> = { pending: 0, shipping: 1, shipped: 2 };

    return orders
      .filter((order) => orderStatusFilter === "all" || order.status === orderStatusFilter)
      .filter((order) => {
        if (!keyword) return true;
        return [
          order.id,
          order.userId,
          order.username,
          order.receiverName,
          order.phone,
          order.address,
          order.trackingNumber,
          order.items.map((item) => `${item.name} ${item.quantity}`).join(" "),
        ]
          .join(" ")
          .toLowerCase()
          .includes(keyword);
      })
      .sort((a, b) => {
        const statusDiff = statusRank[a.status] - statusRank[b.status];
        if (statusDiff !== 0) return statusDiff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [orderSearch, orderStatusFilter, orders]);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  function resetProductForm() {
    setEditingProductId("");
    setProductForm(emptyProductForm);
    setProductImages([]);
    setProductImageUrl("");
    setDropItems(defaultDropItems());
  }

  function setProductCoverImage(image: string) {
    setProductForm((current) => ({ ...current, image }));
    setProductImages((current) => {
      const nextCoverImage = image.trim();
      return nextCoverImage ? normalizeFormImages(nextCoverImage, current).slice(1) : normalizeFormImages("", current);
    });
  }

  function addProductImages(images: string[]) {
    const incomingImages = images.map((image) => image.trim()).filter(Boolean);
    if (incomingImages.length === 0) return;

    const currentCoverImage = productForm.image.trim();
    if (!currentCoverImage) {
      const [nextCoverImage, ...nextImages] = incomingImages;
      setProductForm((current) => ({ ...current, image: nextCoverImage }));
      setProductImages((current) => normalizeFormImages(nextCoverImage, [...current, ...nextImages]).slice(1));
      return;
    }

    setProductImages((current) => normalizeFormImages(currentCoverImage, [...current, ...incomingImages]).slice(1));
  }

  function addProductImageUrl() {
    if (!productImageUrl.trim()) return;
    addProductImages([productImageUrl]);
    setProductImageUrl("");
  }

  function removeProductImage(index: number) {
    setProductImages((current) => current.filter((_, imageIndex) => imageIndex !== index));
  }

  function toggleProductBadge(badge: ProductBadge) {
    setProductForm((current) => ({
      ...current,
      badges: current.badges.includes(badge)
        ? current.badges.filter((item) => item !== badge)
        : [...current.badges, badge],
    }));
  }

  function handleAddCoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!admin) return;

    const amount = Number(coinAmount);
    if (!selectedCoinUser) {
      showToast("กรุณาเลือกหรือค้นหาผู้ใช้ให้ถูกต้อง");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast("จำนวน Coin ต้องมากกว่า 0");
      return;
    }
    if (!coinReason.trim()) {
      showToast("กรุณาระบุเหตุผล");
      return;
    }

    addCoinsToUser(selectedCoinUser.id, admin.id, amount, coinReason.trim());
    setCoinAmount("");
    setCoinReason("");
    refresh();
    showToast(`เพิ่ม ${amount} Coin ให้ ${selectedCoinUser.username} แล้ว`);
  }

  function updateDropItem(itemId: string, patch: Partial<ProductDropItem>) {
    setDropItems((current) => current.map((item) => (item.id === itemId ? { ...item, ...patch } : item)));
  }

  function addDropItem() {
    setDropItems((current) => [...current, { id: makeId("drop"), name: "", image: "", quantity: 1 }]);
  }

  function removeDropItem(itemId: string) {
    setDropItems((current) => current.filter((item) => item.id !== itemId));
  }

  function submitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanedDropItems = productForm.type === "random" ? cleanDropItems(dropItems) : [];
    const totalDropStock = dropTotal(cleanedDropItems);
    const productStock = productForm.type === "random" && cleanedDropItems.length > 0 ? totalDropStock : Math.max(0, Number(productForm.stock));

    if (!productForm.name.trim()) {
      showToast("กรุณากรอกชื่อสินค้า");
      return;
    }

    const duplicateProduct = products.find(
      (product) =>
        product.id !== editingProductId &&
        product.categoryId === productForm.categoryId &&
        product.name.trim().toLowerCase() === productForm.name.trim().toLowerCase(),
    );
    if (duplicateProduct) {
      showToast("มีสินค้าชื่อนี้ในหมวดนี้แล้ว กรุณากดแก้ไขจากรายการสินค้าแทน");
      return;
    }

    if (productForm.type === "random" && cleanedDropItems.length === 0) {
      showToast("กรุณาเพิ่มรายการอัตราการออกอย่างน้อย 1 รายการ");
      return;
    }

    const productGalleryImages = formProductImages.length > 0 ? formProductImages : ["/hero-machine.png"];
    const product: ProductRecord = {
      id: editingProductId || makeId("product"),
      name: productForm.name.trim(),
      image: productGalleryImages[0] ?? "/hero-machine.png",
      images: productGalleryImages,
      stock: productStock,
      priceCoin: Math.max(1, Number(productForm.priceCoin)),
      status: productForm.status,
      type: productForm.type,
      categoryId: productForm.categoryId || categories[0]?.id || "gachapon",
      description: productForm.description.trim(),
      badges: productForm.badges,
      pinned: productForm.pinned,
      discountDisabled: productForm.discountDisabled,
      dropItems: cleanedDropItems,
      createdAt: products.find((item) => item.id === editingProductId)?.createdAt ?? new Date().toISOString(),
    };

    const nextProducts = editingProductId
      ? products.map((item) => (item.id === editingProductId ? product : item))
      : [product, ...products];

    saveProducts(nextProducts);
    resetProductForm();
    refresh();
    showToast(editingProductId ? "บันทึกสินค้าแล้ว" : "เพิ่มสินค้าแล้ว");
  }

  function editProduct(product: ProductRecord) {
    const galleryImages = product.images?.length ? product.images : [product.image];
    setEditingProductId(product.id);
    setProductForm({
      name: product.name,
      image: galleryImages[0] ?? product.image,
      stock: String(product.stock),
      priceCoin: String(product.priceCoin),
      status: product.status,
      type: product.type,
      categoryId: product.categoryId,
      description: product.description,
      badges: product.badges ?? [],
      pinned: Boolean(product.pinned),
      discountDisabled: Boolean(product.discountDisabled),
    });
    setProductImages(galleryImages.slice(1));
    setProductImageUrl("");
    setDropItems(product.dropItems.length > 0 ? product.dropItems : defaultDropItems());
    setActiveSection("products");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateProduct(productId: string, patch: Partial<ProductRecord>) {
    saveProducts(products.map((product) => (product.id === productId ? { ...product, ...patch } : product)));
    refresh();
  }

  function deleteProduct(productId: string) {
    saveProducts(products.filter((product) => product.id !== productId));
    refresh();
    showToast("ลบสินค้าแล้ว");
  }

  function addCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const label = categoryName.trim();
    if (!label) {
      showToast("กรุณากรอกชื่อหมวดหมู่");
      return;
    }

    const category: ProductCategoryRecord = {
      id: slugCategory(label),
      label,
      createdAt: new Date().toISOString(),
    };

    if (categories.some((item) => item.id === category.id || item.label === category.label)) {
      showToast("มีหมวดหมู่นี้อยู่แล้ว");
      return;
    }

    saveProductCategories([...categories, category]);
    setCategoryName("");
    refresh();
    showToast("เพิ่มหมวดหมู่แล้ว");
  }

  function deleteCategory(categoryId: string) {
    if (products.some((product) => product.categoryId === categoryId)) {
      showToast("หมวดหมู่นี้มีสินค้าอยู่ กรุณาย้ายสินค้าก่อนลบ");
      return;
    }
    saveProductCategories(categories.filter((category) => category.id !== categoryId));
    refresh();
    showToast("ลบหมวดหมู่แล้ว");
  }

  function addPopupAd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (popupAds.length >= 5) {
      showToast("เพิ่มรูปโฆษณาได้สูงสุด 5 รูป");
      return;
    }
    if (!adForm.image.trim()) {
      showToast("กรุณาใส่รูปโฆษณา");
      return;
    }

    const ad: PopupAdRecord = {
      id: makeId("ad"),
      image: adForm.image.trim(),
      title: adForm.title.trim() || "Gacha Pop Promotion",
      placement: adForm.placement,
      dismissHours: 1,
      isActive: adForm.isActive,
      createdAt: new Date().toISOString(),
    };

    savePopupAds([...popupAds, ad]);
    setAdForm({ title: "", image: "", placement: adForm.placement, isActive: true });
    refresh();
    showToast("เพิ่มรูปโฆษณาแล้ว");
  }

  function updatePopupAd(adId: string, patch: Partial<PopupAdRecord>) {
    savePopupAds(popupAds.map((ad) => (ad.id === adId ? { ...ad, ...patch } : ad)));
    refresh();
  }

  function deletePopupAd(adId: string) {
    savePopupAds(popupAds.filter((ad) => ad.id !== adId));
    refresh();
    showToast("ลบรูปโฆษณาแล้ว");
  }

  function submitCoupon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCouponError("");

    try {
      const coupon = createCoupon({
        code: couponForm.code,
        type: couponForm.type,
        discountPercent: Number(couponForm.discountPercent),
        maxUses: Number(couponForm.maxUses),
        expiresAt: couponForm.expiresAt,
      });

      setCouponForm((current) => ({
        code: "",
        type: current.type,
        discountPercent: "10",
        maxUses: "1",
        expiresAt: "",
      }));
      setCoupons(getCoupons());
      showToast(`สร้างโค้ด ${coupon.code} แล้ว`);
    } catch (error) {
      setCouponError(error instanceof Error ? error.message : "สร้างโค้ดไม่สำเร็จ");
    }
  }

  function removeCoupon(couponId: string) {
    deleteCoupon(couponId);
    setCoupons(getCoupons());
    showToast("ลบโค้ดแล้ว");
  }

  async function submitAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await createAdminUser(adminForm);
      setAdminForm({ username: "", email: "", pin: "", password: "" });
      refresh();
      showToast("สร้างแอดมินใหม่แล้ว");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "สร้างแอดมินไม่สำเร็จ");
    }
  }

  function updateOrder(orderId: string, patch: Partial<OrderRecord>) {
    const nextOrders = orders.map((order) => (order.id === orderId ? { ...order, ...patch } : order));
    const updatedOrder = nextOrders.find((order) => order.id === orderId);

    saveOrders(nextOrders);
    if (updatedOrder?.status === "shipped") {
      markInventoryItemsForOrderStatus(updatedOrder.items, "shipped", updatedOrder.userId);
    }
    refresh();
    showToast("อัปเดตออเดอร์แล้ว");
  }

  function getOrderDraft(order: OrderRecord) {
    return orderDrafts[order.id] ?? { trackingNumber: order.trackingNumber, status: order.status };
  }

  function updateOrderDraft(orderId: string, patch: Partial<Pick<OrderRecord, "trackingNumber" | "status">>) {
    const currentOrder = orders.find((order) => order.id === orderId);
    if (!currentOrder) return;

    setOrderDrafts((current) => ({
      ...current,
      [orderId]: {
        trackingNumber: current[orderId]?.trackingNumber ?? currentOrder.trackingNumber,
        status: current[orderId]?.status ?? currentOrder.status,
        ...patch,
      },
    }));
  }

  function saveOrderChanges(order: OrderRecord) {
    const draft = getOrderDraft(order);
    updateOrder(order.id, {
      trackingNumber: draft.trackingNumber.trim(),
      status: draft.status,
    });
    setOrderDrafts((current) => {
      const nextDrafts = { ...current };
      delete nextDrafts[order.id];
      return nextDrafts;
    });
  }

  function quickUpdateOrderStatus(order: OrderRecord, status: OrderStatus) {
    updateOrder(order.id, { ...getOrderDraft(order), status });
    setOrderDrafts((current) => {
      const nextDrafts = { ...current };
      delete nextDrafts[order.id];
      return nextDrafts;
    });
  }

  function shippingLabelHref(order: OrderRecord) {
    return `/shipping-labels/shipping-label-${safeFilePart(order.id)}.pdf`;
  }

  async function copyOrderAddress(order: OrderRecord) {
    const copyText = [
      `ผู้รับ: ${order.receiverName}`,
      `โทร: ${order.phone}`,
      order.address,
      `รายการ: ${order.items.map((item) => `${item.name} x${item.quantity}`).join(", ")}`,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(copyText);
      showToast("คัดลอกที่อยู่แล้ว");
    } catch {
      showToast("คัดลอกไม่ได้ กรุณาคัดลอกเองจากการ์ดออเดอร์");
    }
  }

  async function resetUserPassword(userId: string) {
    const password = await adminResetPassword(userId);
    refresh();
    showToast(`Reset Password แล้ว: ${password}`);
  }

  function toggleSuspend(userId: string) {
    suspendUser(userId);
    refresh();
    showToast("อัปเดตสถานะผู้ใช้แล้ว");
  }

  if (!ready) {
    return (
      <main className="admin-page">
        <div className="admin-loading">กำลังเตรียมหลังบ้าน...</div>
      </main>
    );
  }

  if (!admin) {
    return (
      <main className="admin-page">
        <section className="admin-login-required">
          <Shield size={58} />
          <h1>Admin Dashboard</h1>
          <p>กรุณาเข้าสู่ระบบด้วยบัญชี admin ก่อนใช้งานหลังบ้าน</p>
          <Link href="/login">
            <LogIn size={22} />
            เข้าสู่ระบบ Admin
          </Link>
          <Link href="/" className="admin-login-back">
            <ArrowLeft size={20} />
            กลับหน้าเว็บ
          </Link>
          <small>บัญชีทดสอบ: kenji2612 / kenji2612</small>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <Sparkles size={28} />
          <div>
            <strong>Gacha Pop</strong>
            <span>Admin Panel</span>
          </div>
        </div>
        <Link href="/profile" className="admin-back-link">
          <ArrowLeft size={20} />
          กลับโปรไฟล์
        </Link>
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.id} className={activeSection === item.id ? "admin-nav-active" : ""} onClick={() => setActiveSection(item.id)}>
              <Icon size={21} />
              {item.label}
              {item.id === "orders" && unreadNotifications > 0 && <i>{unreadNotifications}</i>}
            </button>
          );
        })}
      </aside>

      <section className="admin-content">
        <header className="admin-header">
          <div>
            <p>สวัสดี, {admin.username}</p>
            <h1>{menuItems.find((item) => item.id === activeSection)?.label}</h1>
          </div>
          <div className="admin-notice-pill">
            <Bell size={20} />
            {unreadNotifications} แจ้งเตือนใหม่
          </div>
        </header>

        {activeSection === "dashboard" && (
          <>
            <div className="admin-stats">
              <article><span>Users</span><strong>{users.length}</strong></article>
              <article><span>Orders</span><strong>{orders.length}</strong></article>
              <article><span>Products</span><strong>{products.length}</strong></article>
              <article><span>Ads</span><strong>{popupAds.length}/5</strong></article>
            </div>
            <div className="admin-card">
              <h2>ออเดอร์ล่าสุด</h2>
              {orders.slice(0, 5).map((order) => (
                <div key={order.id} className="admin-list-row">
                  <span>{order.id}</span>
                  <strong>{order.username}</strong>
                  <em className={`admin-badge admin-badge-${order.status}`}>{orderStatusLabel[order.status]}</em>
                </div>
              ))}
              {orders.length === 0 && <p className="admin-empty">ยังไม่มีออเดอร์</p>}
            </div>
          </>
        )}

        {activeSection === "users" && (
          <div className="admin-card">
            <div className="admin-toolbar">
              <h2>ข้อมูลลูกค้า</h2>
              <label>
                <Search size={18} />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหา User ID / Username / Email" />
              </label>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>User ID</th>
                    <th>Username</th>
                    <th>Email</th>
                    <th>PIN</th>
                    <th>Coin</th>
                    <th>Role</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id}>
                      <td>{user.id}</td>
                      <td>{user.username}</td>
                      <td>
                        {user.email}
                        {user.isOrderOnly && <small className="admin-order-only-note">จากออเดอร์</small>}
                      </td>
                      <td>{user.pin}</td>
                      <td>{user.coins.toLocaleString("th-TH")}</td>
                      <td><span className="admin-badge admin-badge-purple">{user.role}</span></td>
                      <td className="admin-actions-cell">
                        <button disabled={user.isOrderOnly} onClick={() => resetUserPassword(user.id)}>Reset Password</button>
                        <button disabled={user.isOrderOnly} onClick={() => toggleSuspend(user.id)}>{user.suspended ? "Unsuspend" : "Suspend"}</button>
                        <button disabled={user.isOrderOnly} onClick={() => { setCoinUserId(user.id); setActiveSection("coins"); }}>Add Coin</button>
                        <button onClick={() => { setOrderSearch(user.id); setOrderStatusFilter("all"); setActiveSection("orders"); }}>View Orders</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeSection === "coins" && (
          <div className="admin-grid-two">
            <form className="admin-card admin-form-card" onSubmit={handleAddCoin}>
              <h2>เพิ่ม Coin ให้ลูกค้า</h2>
              <label>
                <span>User ID / Username</span>
                <input value={coinUserId} onChange={(event) => setCoinUserId(event.target.value)} placeholder="user_player หรือ Player" />
              </label>
              <label>
                <span>จำนวน Coin</span>
                <input value={coinAmount} onChange={(event) => setCoinAmount(event.target.value)} inputMode="numeric" placeholder="100" />
              </label>
              <label>
                <span>เหตุผล</span>
                <textarea value={coinReason} onChange={(event) => setCoinReason(event.target.value)} placeholder="เช่น เติมเงินไม่เข้า" />
              </label>
              <button className="admin-primary-button">
                <Plus size={20} />
                เพิ่ม Coin
              </button>
            </form>
            <div className="admin-card">
              <h2>Coin Logs</h2>
              {coinLogs.map((log) => (
                <div key={log.id} className="admin-log-row">
                  <strong>+{log.amount} Coin</strong>
                  <span>{log.userId}</span>
                  <p>{log.reason}</p>
                  <small>{new Date(log.createdAt).toLocaleString("th-TH")}</small>
                </div>
              ))}
              {coinLogs.length === 0 && <p className="admin-empty">ยังไม่มี log</p>}
            </div>
          </div>
        )}

        {activeSection === "products" && (
          <div className="admin-grid-two admin-grid-products">
            <form className="admin-card admin-form-card" onSubmit={submitProduct}>
              <div className="admin-card-headline">
                <h2>{editingProductId ? "แก้ไขสินค้า" : "เพิ่มสินค้า"}</h2>
                {editingProductId && <button type="button" onClick={resetProductForm}>ยกเลิกแก้ไข</button>}
              </div>

              <div className="admin-segment">
                <button type="button" className={productForm.type === "random" ? "admin-segment-active" : ""} onClick={() => setProductForm((current) => ({ ...current, type: "random" }))}>แบบสุ่ม</button>
                <button type="button" className={productForm.type === "sale" ? "admin-segment-active" : ""} onClick={() => setProductForm((current) => ({ ...current, type: "sale" }))}>แบบลงขาย</button>
              </div>

              <label><span>ชื่อสินค้า</span><input value={productForm.name} onChange={(event) => setProductForm((current) => ({ ...current, name: event.target.value }))} /></label>
              <label><span>รายละเอียด</span><textarea value={productForm.description} onChange={(event) => setProductForm((current) => ({ ...current, description: event.target.value }))} placeholder="รายละเอียดสินค้า / คอลเลกชัน" /></label>
              <label><span>หมวดหมู่</span><select value={productForm.categoryId} onChange={(event) => setProductForm((current) => ({ ...current, categoryId: event.target.value }))}>{categories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}</select></label>
              <label><span>URL รูปปกสินค้า</span><input value={productForm.image} onChange={(event) => setProductCoverImage(event.target.value)} placeholder="https://example.com/product-cover.jpg" /></label>
              <div className="admin-gallery-field">
                <span className="admin-gallery-title">URL รูปตัวอย่างสินค้า (สูงสุด 10 รูป)</span>
                <div className="admin-gallery-url-row">
                  <input value={productImageUrl} onChange={(event) => setProductImageUrl(event.target.value)} placeholder="https://example.com/product-preview.jpg" />
                  <button type="button" onClick={addProductImageUrl} disabled={formProductImages.length >= 10}>
                    <Plus size={16} />
                    เพิ่มรูป
                  </button>
                </div>
                <span className="admin-gallery-counter">{formProductImages.length}/10 รูป</span>
                {formProductImages.length > 0 && (
                  <div className="admin-product-gallery">
                    {formProductImages.map((image, index) => (
                      <div key={`${image}-${index}`} className="admin-product-thumb">
                        <UrlImage src={image} alt={`product preview ${index + 1}`} width={88} height={66} />
                        {index === 0 ? (
                          <span>ปก</span>
                        ) : (
                          <button type="button" onClick={() => removeProductImage(index - 1)} aria-label="ลบรูปตัวอย่าง">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <label><span>{productForm.type === "random" ? "สต็อกรวม (คำนวณจากรางวัล)" : "จำนวนสต็อก"}</span><input value={productForm.type === "random" ? String(dropItemTotal) : productForm.stock} disabled={productForm.type === "random"} onChange={(event) => setProductForm((current) => ({ ...current, stock: event.target.value }))} inputMode="numeric" /></label>
              <label><span>{productForm.type === "random" ? "ราคา Coin / ครั้ง" : "ราคา Coin"}</span><input value={productForm.priceCoin} onChange={(event) => setProductForm((current) => ({ ...current, priceCoin: event.target.value }))} inputMode="numeric" /></label>
              <label><span>สถานะ</span><select value={productForm.status} onChange={(event) => setProductForm((current) => ({ ...current, status: event.target.value as ProductStatus }))}><option value="open">เปิดขาย</option><option value="closed">ปิดขาย</option></select></label>
              <div className="admin-product-flags">
                <span>ป้ายบนรูปสินค้า</span>
                <div>
                  {productBadgeOptions.map((badge) => (
                    <button
                      key={badge.id}
                      type="button"
                      className={productForm.badges.includes(badge.id) ? "admin-flag-active" : ""}
                      onClick={() => toggleProductBadge(badge.id)}
                    >
                      {badge.label}
                    </button>
                  ))}
                </div>
                <label className="admin-pin-toggle">
                  <input
                    type="checkbox"
                    checked={productForm.pinned}
                    onChange={(event) => setProductForm((current) => ({ ...current, pinned: event.target.checked }))}
                  />
                  ปักหมุดให้ขึ้นข้างบน
                </label>
                <label className="admin-pin-toggle">
                  <input
                    type="checkbox"
                    checked={productForm.discountDisabled}
                    onChange={(event) => setProductForm((current) => ({ ...current, discountDisabled: event.target.checked }))}
                  />
                  ไม่ใช้โค้ดส่วนลดกับสินค้านี้
                </label>
              </div>

              {productForm.type === "random" && (
                <section className="admin-drop-section">
                  <div className="admin-drop-head">
                    <strong>อัตราการออก</strong>
                    <span>ระบบคำนวณจากจำนวนชิ้นทั้งหมด {dropItemTotal} ชิ้น</span>
                    <button type="button" onClick={addDropItem}><Plus size={16} />เพิ่มรางวัล</button>
                  </div>
                  <div className="admin-drop-list">
                    {dropItems.map((item) => {
                      const chance = dropItemTotal > 0 ? (Number(item.quantity) / dropItemTotal) * 100 : 0;
                      return (
                        <article key={item.id} className="admin-drop-row">
                          <div className="admin-drop-preview">
                            {item.image ? <UrlImage src={item.image} alt={item.name || "reward"} width={58} height={58} /> : <ImagePlus size={28} />}
                          </div>
                          <label><span>ชื่อ</span><input value={item.name} onChange={(event) => updateDropItem(item.id, { name: event.target.value })} /></label>
                          <label><span>จำนวน</span><input value={item.quantity || ""} onChange={(event) => updateDropItem(item.id, { quantity: Number(event.target.value) })} inputMode="numeric" /></label>
                          <label><span>URL รูป</span><input value={item.image} onChange={(event) => updateDropItem(item.id, { image: event.target.value })} /></label>
                          <strong>{chance.toFixed(1)}%</strong>
                          <button type="button" onClick={() => removeDropItem(item.id)}><Trash2 size={16} /></button>
                        </article>
                      );
                    })}
                  </div>
                </section>
              )}

              <button className="admin-primary-button"><Save size={20} />{editingProductId ? "บันทึกสินค้า" : "เพิ่มสินค้า"}</button>
            </form>

            <div className="admin-card admin-product-list">
              <h2>สินค้า / สต็อก</h2>
              {products.map((product) => {
                const category = categories.find((item) => item.id === product.categoryId);
                return (
                  <article key={product.id} className="admin-product-row">
                    <UrlImage src={product.image} alt={product.name} width={82} height={70} />
                    <div>
                      <strong>{product.name}</strong>
                      <span>{category?.label ?? product.categoryId} · {product.type === "random" ? "แบบสุ่ม" : "ลงขาย"}</span>
                      <span>{product.priceCoin} Coin{product.type === "random" ? " / ครั้ง" : ""} · สต็อก {product.stock}</span>
                      <div className="admin-product-status-row">
                        <em className={product.status === "open" ? "admin-badge admin-badge-shipped" : "admin-badge admin-badge-pending"}>{product.status === "open" ? "เปิดขาย" : "ปิดขาย"}</em>
                        {product.pinned && <em className="admin-badge admin-badge-purple">ปักหมุด</em>}
                        {product.discountDisabled && <em className="admin-badge admin-badge-pending">ไม่ใช้ส่วนลด</em>}
                        {(product.badges ?? []).map((badge) => (
                          <em key={badge} className="admin-badge admin-badge-purple">{productBadgeOptions.find((item) => item.id === badge)?.label ?? badge}</em>
                        ))}
                      </div>
                    </div>
                    <input value={product.stock} onChange={(event) => updateProduct(product.id, { stock: Number(event.target.value) })} inputMode="numeric" />
                    <button onClick={() => updateProduct(product.id, { stock: product.stock + 1 })}>+ สต็อก</button>
                    <button onClick={() => updateProduct(product.id, { stock: Math.max(0, product.stock - 1) })}>- สต็อก</button>
                    <button onClick={() => editProduct(product)}>แก้ไข</button>
                    <button onClick={() => updateProduct(product.id, { status: product.status === "open" ? "closed" : "open" })}>{product.status === "open" ? "ปิดขาย" : "เปิดขาย"}</button>
                    <button onClick={() => deleteProduct(product.id)}>ลบ</button>
                  </article>
                );
              })}
              {products.length === 0 && <p className="admin-empty">ยังไม่มีสินค้า</p>}
            </div>
          </div>
        )}

        {activeSection === "categories" && (
          <div className="admin-grid-two">
            <form className="admin-card admin-form-card" onSubmit={addCategory}>
              <h2>เพิ่มหมวดหมู่</h2>
              <label>
                <span>ชื่อหมวดหมู่</span>
                <input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="เช่น ฟิกเกอร์/โมเดล" />
              </label>
              <button className="admin-primary-button"><Plus size={20} />เพิ่มหมวดหมู่</button>
            </form>
            <div className="admin-card">
              <h2>หมวดหมู่ทั้งหมด</h2>
              <div className="admin-category-list">
                {categories.map((category) => (
                  <article key={category.id} className="admin-category-row">
                    <div>
                      <strong>{category.label}</strong>
                      <span>{category.id}</span>
                    </div>
                    <em>{products.filter((product) => product.categoryId === category.id).length} สินค้า</em>
                    <button onClick={() => deleteCategory(category.id)}><Trash2 size={16} />ลบ</button>
                  </article>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeSection === "ads" && (
          <div className="admin-grid-two">
            <form className="admin-card admin-form-card" onSubmit={addPopupAd}>
              <label>
                <span>รูปแบบโฆษณา</span>
                <select
                  value={adForm.placement}
                  onChange={(event) => setAdForm((current) => ({ ...current, placement: event.target.value as PopupAdPlacement }))}
                >
                  <option value="banner">แบนเนอร์เมนูสินค้า</option>
                  <option value="popup">ป๊อปอัพกลางจอ</option>
                </select>
              </label>
              <h2>เพิ่มรูปโฆษณา ({popupAds.length}/5)</h2>
              <label><span>ชื่อโฆษณา</span><input value={adForm.title} onChange={(event) => setAdForm((current) => ({ ...current, title: event.target.value }))} placeholder="โปรโมชันเปิดตู้ใหม่" /></label>
              <label><span>URL รูปโฆษณา</span><input value={adForm.image} onChange={(event) => setAdForm((current) => ({ ...current, image: event.target.value }))} placeholder="https://example.com/promo-banner.jpg" /></label>
              <label className="admin-check-row"><input type="checkbox" checked={adForm.isActive} onChange={(event) => setAdForm((current) => ({ ...current, isActive: event.target.checked }))} />เปิดใช้งานทันที</label>
              <button className="admin-primary-button" disabled={popupAds.length >= 5}><Plus size={20} />เพิ่มรูปโฆษณา</button>
            </form>
            <div className="admin-card">
              <h2>รูปโฆษณาเมนูสินค้า</h2>
              <div className="admin-ad-grid">
                {popupAds.map((ad) => (
                  <article key={ad.id} className="admin-ad-card">
                    <span className={`admin-ad-type-badge admin-ad-type-${ad.placement ?? "banner"}`}>
                      {(ad.placement ?? "banner") === "popup" ? "ป๊อปอัพ" : "แบนเนอร์"}
                    </span>
                    <UrlImage src={ad.image} alt={ad.title} width={420} height={150} />
                    <input value={ad.title} onChange={(event) => updatePopupAd(ad.id, { title: event.target.value })} />
                    <input value={ad.image} onChange={(event) => updatePopupAd(ad.id, { image: event.target.value })} />
                    <select value={ad.placement ?? "banner"} onChange={(event) => updatePopupAd(ad.id, { placement: event.target.value as PopupAdPlacement })}>
                      <option value="banner">แบนเนอร์เมนูสินค้า</option>
                      <option value="popup">ป๊อปอัพกลางจอ</option>
                    </select>
                    <label><input type="checkbox" checked={ad.isActive} onChange={(event) => updatePopupAd(ad.id, { isActive: event.target.checked })} />เปิดใช้งาน</label>
                    <button onClick={() => deletePopupAd(ad.id)}><Trash2 size={16} />ลบ</button>
                  </article>
                ))}
              </div>
              {popupAds.length === 0 && <p className="admin-empty">ยังไม่มีรูปโฆษณา</p>}
            </div>
          </div>
        )}

        {activeSection === "coupons" && (
          <div className="admin-grid-two">
            <form className="admin-card admin-form-card admin-coupon-form" onSubmit={submitCoupon}>
              <h2>สร้างโค้ดส่วนลด / ส่งฟรี</h2>
              <label>
                <span>รหัสโค้ด</span>
                <input
                  value={couponForm.code}
                  onChange={(event) => setCouponForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))}
                  placeholder="เช่น FREE30"
                />
              </label>
              <label>
                <span>ประเภทโค้ด</span>
                <select
                  value={couponForm.type}
                  onChange={(event) => setCouponForm((current) => ({ ...current, type: event.target.value as CouponType }))}
                >
                  <option value="discount">ส่วนลด</option>
                  <option value="freeShipping">ส่งฟรี</option>
                </select>
              </label>
              {couponForm.type === "discount" && (
                <label>
                  <span>ส่วนลด (%)</span>
                  <input
                    value={couponForm.discountPercent}
                    onChange={(event) => setCouponForm((current) => ({ ...current, discountPercent: event.target.value.replace(/\D/g, "").slice(0, 3) }))}
                    inputMode="numeric"
                    placeholder="10"
                  />
                </label>
              )}
              <label>
                <span>จำกัดจำนวนโค้ดเต็ม</span>
                <input
                  value={couponForm.maxUses}
                  onChange={(event) => setCouponForm((current) => ({ ...current, maxUses: event.target.value.replace(/\D/g, "").slice(0, 5) }))}
                  inputMode="numeric"
                  placeholder="1"
                />
              </label>
              <label>
                <span>วันหมดอายุ</span>
                <input
                  type="datetime-local"
                  value={couponForm.expiresAt}
                  onChange={(event) => setCouponForm((current) => ({ ...current, expiresAt: event.target.value }))}
                />
              </label>
              {couponError && <p className="admin-form-error">{couponError}</p>}
              <button className="admin-primary-button">
                <Ticket size={20} />
                สร้างโค้ด
              </button>
            </form>

            <div className="admin-card admin-coupon-list-card">
              <h2>โค้ดทั้งหมด</h2>
              <div className="admin-coupon-list">
                {coupons.map((coupon) => {
                  const used = getCouponUsedCount(coupon);
                  const claimed = getCouponClaimedCount(coupon);
                  const isFull = claimed >= coupon.maxUses;
                  const isFreeShipping = coupon.type === "freeShipping";
                  const isExpired = isCouponExpired(coupon);

                  return (
                    <article
                      key={coupon.id}
                      className={`admin-coupon-row ${isFreeShipping ? "admin-coupon-row-free" : "admin-coupon-row-discount"} ${isExpired ? "admin-coupon-row-expired" : ""}`}
                    >
                      <div className="admin-coupon-icon">
                        {isFreeShipping ? <Truck size={22} /> : <Ticket size={22} />}
                      </div>
                      <div className="admin-coupon-info">
                        <strong>{coupon.code}</strong>
                        <span>{isFreeShipping ? "โค้ดส่งฟรี" : `ส่วนลด ${coupon.discountPercent}%`}</span>
                        <small>รับแล้ว {claimed}/{coupon.maxUses} • ใช้แล้ว {used} • {formatCouponExpiry(coupon)}</small>
                      </div>
                      <em className={isExpired || isFull ? "admin-badge admin-badge-pending" : "admin-badge admin-badge-shipped"}>
                        {isExpired ? "หมดอายุ" : isFull ? "เต็มแล้ว" : "พร้อมใช้"}
                      </em>
                      <button type="button" onClick={() => removeCoupon(coupon.id)}>
                        <Trash2 size={16} />
                        ลบ
                      </button>
                    </article>
                  );
                })}
              </div>
              {coupons.length === 0 && <p className="admin-empty">ยังไม่มีโค้ด</p>}
            </div>
          </div>
        )}

        {activeSection === "admins" && (
          <div className="admin-grid-two">
            <form className="admin-card admin-form-card" onSubmit={submitAdmin}>
              <h2>เพิ่มแอดมิน</h2>
              <label><span>Username</span><input value={adminForm.username} onChange={(event) => setAdminForm((current) => ({ ...current, username: event.target.value }))} /></label>
              <label><span>Email</span><input value={adminForm.email} onChange={(event) => setAdminForm((current) => ({ ...current, email: event.target.value }))} /></label>
              <label><span>PIN 6 หลัก</span><input value={adminForm.pin} onChange={(event) => setAdminForm((current) => ({ ...current, pin: event.target.value.replace(/\D/g, "").slice(0, 6) }))} inputMode="numeric" /></label>
              <label><span>Password</span><input type="password" value={adminForm.password} onChange={(event) => setAdminForm((current) => ({ ...current, password: event.target.value }))} /></label>
              <button className="admin-primary-button"><Crown size={20} />สร้างแอดมิน</button>
            </form>
            <div className="admin-card">
              <h2>บัญชีแอดมิน</h2>
              {users.filter((user) => user.role === "admin").map((user) => (
                <div key={user.id} className="admin-list-row">
                  <span>{user.id}</span>
                  <strong>{user.username}</strong>
                  <em className="admin-badge admin-badge-purple">admin</em>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeSection === "orders" && (
          <div className="admin-orders-panel">
            <div className="admin-orders-top">
              <div>
                <h2>ออเดอร์จัดส่ง</h2>
                <p>จัดคิวงานจากออเดอร์ใหม่ กรอกเลขพัสดุ เปิด PDF จ่าหน้า และปิดงานได้จากหน้านี้</p>
              </div>
              <div className="admin-orders-summary">
                <article>
                  <strong>{orderCounts.pending}</strong>
                  <span>รอดำเนินการ</span>
                </article>
                <article>
                  <strong>{orderCounts.shipping}</strong>
                  <span>กำลังจัดส่ง</span>
                </article>
                <article>
                  <strong>{orderCounts.shipped}</strong>
                  <span>จัดส่งแล้ว</span>
                </article>
              </div>
            </div>

            <div className="admin-orders-controls">
              <label className="admin-order-search">
                <Search size={18} />
                <input
                  value={orderSearch}
                  onChange={(event) => setOrderSearch(event.target.value)}
                  placeholder="ค้นหาเลขออเดอร์ / ชื่อลูกค้า / เบอร์โทร / สินค้า"
                />
              </label>
              <div className="admin-order-filters">
                {orderStatusFilters.map((filter) => (
                  <button
                    key={filter.id}
                    className={orderStatusFilter === filter.id ? "admin-order-filter-active" : ""}
                    onClick={() => setOrderStatusFilter(filter.id)}
                    type="button"
                  >
                    {filter.label}
                    <span>{orderCounts[filter.id]}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="admin-order-list">
              {filteredOrders.map((order) => {
                const draft = getOrderDraft(order);
                const isEdited = draft.trackingNumber !== order.trackingNumber || draft.status !== order.status;

                return (
                  <article key={order.id} className={`admin-order-card admin-order-card-${order.status}`}>
                    <div className="admin-order-head">
                      <div>
                        <strong>{shortOrderId(order.id)}</strong>
                        <span>{order.id}</span>
                      </div>
                      <em className={`admin-badge admin-badge-${order.status}`}>{orderStatusLabel[order.status]}</em>
                    </div>

                    <div className="admin-order-meta">
                      <span><UserRound size={16} />{order.username}</span>
                      <span><Clock size={16} />{formatAdminDate(order.createdAt)}</span>
                    </div>

                    <section className="admin-order-section">
                      <h3>ข้อมูลผู้รับ</h3>
                      <p><UserRound size={16} />{order.receiverName}</p>
                      <p><Phone size={16} />{order.phone}</p>
                      <p><MapPin size={16} />{order.address}</p>
                    </section>

                    <section className="admin-order-section">
                      <h3>รายการสินค้า</h3>
                      <div className="admin-order-items">
                        {order.items.map((item) => (
                          <span key={`${order.id}-${item.id}`}>
                            {item.name} <b>x{item.quantity}</b>
                          </span>
                        ))}
                      </div>
                    </section>

                    <section className="admin-order-tools">
                      <label>
                        <span>เลขพัสดุ</span>
                        <input
                          value={draft.trackingNumber}
                          onChange={(event) => updateOrderDraft(order.id, { trackingNumber: event.target.value })}
                          placeholder="เช่น TH123456789"
                        />
                      </label>
                      <label>
                        <span>สถานะ</span>
                        <select value={draft.status} onChange={(event) => updateOrderDraft(order.id, { status: event.target.value as OrderStatus })}>
                          <option value="pending">รอดำเนินการ</option>
                          <option value="shipping">กำลังจัดส่ง</option>
                          <option value="shipped">จัดส่งแล้ว</option>
                        </select>
                      </label>
                    </section>

                    <div className="admin-order-actions">
                      <button type="button" onClick={() => copyOrderAddress(order)}>
                        <Copy size={17} />
                        คัดลอกที่อยู่
                      </button>
                      <Link href={shippingLabelHref(order)} target="_blank" rel="noreferrer">
                        <FileText size={17} />
                        เปิด PDF
                        <ExternalLink size={14} />
                      </Link>
                      <button type="button" onClick={() => quickUpdateOrderStatus(order, "shipping")} disabled={order.status === "shipping" || order.status === "shipped"}>
                        <Truck size={17} />
                        กำลังจัดส่ง
                      </button>
                      <button type="button" className="admin-order-done-button" onClick={() => quickUpdateOrderStatus(order, "shipped")} disabled={order.status === "shipped"}>
                        <CheckCircle2 size={17} />
                        จัดส่งแล้ว
                      </button>
                      <button type="button" className="admin-order-save-button" onClick={() => saveOrderChanges(order)} disabled={!isEdited}>
                        <Save size={17} />
                        บันทึก
                      </button>
                    </div>
                  </article>
                );
              })}

              {orders.length === 0 && (
                <div className="admin-empty admin-order-empty">
                  <Clipboard size={54} />
                  <strong>ยังไม่มีออเดอร์จัดส่ง</strong>
                  <span>เมื่อผู้ใช้กดยืนยันจัดส่ง ออเดอร์จะมาอยู่ตรงนี้</span>
                </div>
              )}
              {orders.length > 0 && filteredOrders.length === 0 && (
                <div className="admin-empty admin-order-empty">
                  <Search size={54} />
                  <strong>ไม่พบออเดอร์ตามตัวกรอง</strong>
                  <span>ลองล้างคำค้นหาหรือเปลี่ยนสถานะ</span>
                </div>
              )}
            </div>
          </div>
        )}

        {activeSection === "rolls" && (
          <div className="admin-card">
            <h2>ประวัติการสุ่ม</h2>
            {rollHistory.map((item) => (
              <div key={item.id} className="admin-list-row"><span>{item.userId}</span><strong>{item.rewardName}</strong><em>{item.machineName}</em></div>
            ))}
            {rollHistory.length === 0 && <p className="admin-empty">ยังไม่มีประวัติการสุ่ม</p>}
          </div>
        )}

        {activeSection === "topups" && (
          <div className="admin-card">
            <h2>ประวัติการเติมเงิน</h2>
            {topupLogs.map((item) => (
              <div key={item.id} className="admin-list-row"><span>{item.userId}</span><strong>{item.amount} Coin</strong><em>{item.status}</em></div>
            ))}
            {topupLogs.length === 0 && <p className="admin-empty">ยังไม่มีประวัติเติมเงิน</p>}
          </div>
        )}
      </section>

      {toast && <div className="admin-toast">{toast}</div>}
    </main>
  );
}

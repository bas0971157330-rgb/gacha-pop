export const COUPONS_STORAGE_KEY = "gacha_coupon_codes";

const CURRENT_USER_STORAGE_KEY = "gacha_current_user_id";
const SESSION_USER_STORAGE_KEY = "gacha_session_user_id";

export type CouponType = "discount" | "freeShipping";

export type CouponRecord = {
  id: string;
  code: string;
  type: CouponType;
  discountPercent: number;
  maxUses: number;
  claimedByUserIds: string[];
  usedByUserIds: string[];
  createdAt: string;
  expiresAt?: string;
};

export type CouponFormInput = {
  code: string;
  type: CouponType;
  discountPercent: number;
  maxUses: number;
  expiresAt?: string;
};

type CouponStoreSnapshot = {
  coupons?: CouponRecord[];
};

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function getActiveUserId() {
  if (!canUseStorage()) return "";
  return window.sessionStorage.getItem(SESSION_USER_STORAGE_KEY) ?? window.localStorage.getItem(CURRENT_USER_STORAGE_KEY) ?? "";
}

function makeId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeExpiry(value: unknown) {
  const rawValue = String(value ?? "").trim();
  if (!rawValue) return undefined;

  const timestamp = Date.parse(rawValue);
  if (!Number.isFinite(timestamp)) return undefined;
  return new Date(timestamp).toISOString();
}

function normalizeCoupon(value: Partial<CouponRecord>): CouponRecord | null {
  const code = String(value.code ?? "").trim().toUpperCase();
  if (!code) return null;

  const type: CouponType = value.type === "freeShipping" ? "freeShipping" : "discount";
  const maxUses = Math.max(1, Number(value.maxUses ?? 1));
  const discountPercent = type === "freeShipping"
    ? 100
    : Math.min(100, Math.max(1, Number(value.discountPercent ?? 1)));

  return {
    id: String(value.id ?? makeId("coupon")),
    code,
    type,
    discountPercent,
    maxUses,
    claimedByUserIds: Array.isArray(value.claimedByUserIds)
      ? Array.from(new Set(value.claimedByUserIds.map((item) => String(item)).filter(Boolean)))
      : [],
    usedByUserIds: Array.isArray(value.usedByUserIds)
      ? Array.from(new Set(value.usedByUserIds.map((item) => String(item)).filter(Boolean)))
      : [],
    createdAt: String(value.createdAt ?? new Date().toISOString()),
    expiresAt: normalizeExpiry(value.expiresAt),
  };
}

export function mergeCoupons(localCoupons: CouponRecord[], remoteCoupons: CouponRecord[]) {
  const map = new Map<string, CouponRecord>();

  [...localCoupons, ...remoteCoupons].forEach((coupon) => {
    const normalized = normalizeCoupon(coupon);
    if (!normalized) return;

    const key = normalized.code.toUpperCase();
    const current = map.get(key);
    if (!current) {
      map.set(key, normalized);
      return;
    }

    map.set(key, {
      ...current,
      ...normalized,
      id: current.id || normalized.id,
      expiresAt: normalized.expiresAt ?? current.expiresAt,
      claimedByUserIds: Array.from(new Set([...current.claimedByUserIds, ...normalized.claimedByUserIds])),
      usedByUserIds: Array.from(new Set([...current.usedByUserIds, ...normalized.usedByUserIds])),
    });
  });

  return Array.from(map.values()).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

function syncCouponsToSharedStore(coupons: CouponRecord[]) {
  if (typeof fetch === "undefined") return;
  fetch("/api/shared-store", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ coupons }),
    keepalive: true,
  }).catch(() => undefined);
}

export function getCoupons() {
  if (!canUseStorage()) return [];

  try {
    const value = JSON.parse(window.localStorage.getItem(COUPONS_STORAGE_KEY) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => normalizeCoupon(item as Partial<CouponRecord>))
      .filter((item): item is CouponRecord => Boolean(item));
  } catch {
    return [];
  }
}

export function saveCoupons(coupons: CouponRecord[], syncRemote = true, notify = true) {
  if (!canUseStorage()) return;
  const normalizedCoupons = coupons.map((coupon) => normalizeCoupon(coupon)).filter((coupon): coupon is CouponRecord => Boolean(coupon));
  window.localStorage.setItem(COUPONS_STORAGE_KEY, JSON.stringify(normalizedCoupons));
  if (syncRemote) syncCouponsToSharedStore(normalizedCoupons);
  if (notify) window.dispatchEvent(new CustomEvent("gacha-coupons-updated"));
}

export async function syncCouponsFromServer(options: { notify?: boolean; pushLocal?: boolean } = {}) {
  if (!canUseStorage()) return getCoupons();
  const shouldNotify = options.notify ?? true;
  const shouldPushLocal = options.pushLocal ?? false;

  try {
    const response = await fetch("/api/shared-store", { cache: "no-store" });
    if (!response.ok) return getCoupons();
    const store = (await response.json()) as CouponStoreSnapshot;
    const remoteCoupons = Array.isArray(store.coupons) ? store.coupons : [];
    const localCoupons = getCoupons();
    const coupons = remoteCoupons.length > 0 ? mergeCoupons([], remoteCoupons) : localCoupons;
    saveCoupons(coupons, shouldPushLocal, shouldNotify);
    return coupons;
  } catch {
    return getCoupons();
  }
}

export function createCoupon(input: CouponFormInput) {
  const code = input.code.trim().toUpperCase();
  if (!code) throw new Error("กรุณากรอกรหัสโค้ด");

  const coupons = getCoupons();
  if (coupons.some((coupon) => coupon.code.toUpperCase() === code)) {
    throw new Error("มีโค้ดนี้อยู่แล้ว");
  }

  const expiresAt = normalizeExpiry(input.expiresAt);
  if (input.expiresAt && !expiresAt) throw new Error("วันหมดอายุไม่ถูกต้อง");
  if (expiresAt && Date.parse(expiresAt) <= Date.now()) throw new Error("วันหมดอายุต้องอยู่ในอนาคต");

  const coupon = normalizeCoupon({
    id: makeId("coupon"),
    code,
    type: input.type,
    discountPercent: input.discountPercent,
    maxUses: input.maxUses,
    claimedByUserIds: [],
    usedByUserIds: [],
    createdAt: new Date().toISOString(),
    expiresAt,
  });

  if (!coupon) throw new Error("สร้างโค้ดไม่สำเร็จ");
  saveCoupons([coupon, ...coupons]);
  return coupon;
}

export function deleteCoupon(couponId: string) {
  saveCoupons(getCoupons().filter((coupon) => coupon.id !== couponId));
}

export function getCouponUsedCount(coupon: CouponRecord) {
  return coupon.usedByUserIds.length;
}

export function getCouponClaimedCount(coupon: CouponRecord) {
  return coupon.claimedByUserIds.length;
}

export function isCouponExpired(coupon: CouponRecord, now = Date.now()) {
  if (!coupon.expiresAt) return false;
  const timestamp = Date.parse(coupon.expiresAt);
  return Number.isFinite(timestamp) && timestamp <= now;
}

export function formatCouponExpiry(coupon: CouponRecord) {
  if (!coupon.expiresAt) return "ไม่มีวันหมดอายุ";
  return `หมดอายุ ${new Date(coupon.expiresAt).toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  })}`;
}

export function isCouponAvailableForUser(coupon: CouponRecord, userId = getActiveUserId()) {
  if (!userId) return false;
  return coupon.claimedByUserIds.includes(userId) && !coupon.usedByUserIds.includes(userId) && !isCouponExpired(coupon);
}

export function getAvailableCoupons(userId = getActiveUserId()) {
  return getCoupons().filter((coupon) => isCouponAvailableForUser(coupon, userId));
}

export function claimCouponByCode(codeInput: string, userId = getActiveUserId()) {
  if (!userId) throw new Error("กรุณาเข้าสู่ระบบก่อนรับโค้ด");

  const code = codeInput.trim().toUpperCase();
  if (!code) throw new Error("กรุณากรอกรหัสโค้ด");

  const coupons = getCoupons();
  const coupon = coupons.find((item) => item.code.toUpperCase() === code);
  if (!coupon) throw new Error("ไม่พบโค้ดนี้");
  if (isCouponExpired(coupon)) throw new Error("โค้ดนี้หมดอายุแล้ว");
  if (coupon.usedByUserIds.includes(userId)) throw new Error("คุณใช้โค้ดนี้ไปแล้ว");
  if (coupon.claimedByUserIds.includes(userId)) throw new Error("โค้ดนี้อยู่ในกระเป๋าแล้ว");
  if (getCouponClaimedCount(coupon) >= coupon.maxUses) throw new Error("โค้ดนี้ถูกใช้เต็มจำนวนแล้ว");

  const nextCoupons = coupons.map((item) =>
    item.id === coupon.id
      ? { ...item, claimedByUserIds: [...item.claimedByUserIds, userId] }
      : item,
  );
  saveCoupons(nextCoupons);

  const nextCoupon = nextCoupons.find((item) => item.id === coupon.id);
  if (!nextCoupon) throw new Error("รับโค้ดไม่สำเร็จ");
  return nextCoupon;
}

export function calculateCouponDiscount(coupon: CouponRecord | null | undefined, baseAmount: number) {
  if (!coupon) return 0;
  if (coupon.type === "freeShipping") return Math.max(0, baseAmount);
  return Math.min(baseAmount, Math.floor((baseAmount * coupon.discountPercent) / 100));
}

export function getBestDiscountCoupon(userId = getActiveUserId()) {
  return (
    getAvailableCoupons(userId)
      .filter((coupon) => coupon.type === "discount")
      .sort((a, b) => b.discountPercent - a.discountPercent || Date.parse(a.createdAt) - Date.parse(b.createdAt))[0] ?? null
  );
}

export function getDiscountedCoinPrice(baseAmount: number, coupon: CouponRecord | null | undefined, discountDisabled = false) {
  const price = Math.max(0, Number(baseAmount) || 0);
  if (discountDisabled || !coupon || coupon.type !== "discount") return price;
  return Math.max(0, price - calculateCouponDiscount(coupon, price));
}

export function markCouponUsed(couponId: string, userId = getActiveUserId()) {
  if (!userId) return getCoupons();

  const coupons = getCoupons();
  const nextCoupons = coupons.map((coupon) => {
    if (coupon.id !== couponId || coupon.usedByUserIds.includes(userId)) return coupon;
    if (isCouponExpired(coupon)) return coupon;
    if (getCouponUsedCount(coupon) >= coupon.maxUses) return coupon;
    return { ...coupon, usedByUserIds: [...coupon.usedByUserIds, userId] };
  });

  saveCoupons(nextCoupons);
  return nextCoupons;
}

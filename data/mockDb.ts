import { gachas, type ProductBadge, type ProductDropItem, type ProductType } from "@/data/gacha";
import { INVENTORY_STORAGE_KEY, mergeInventoryItems, type InventoryItem } from "@/data/inventory";
import { SHIPPING_ADDRESS_STORAGE_KEY, getAddressAreaLabels, type ShippingAddress } from "@/data/address";
import {
  getBestDiscountCoupon,
  getCoupons,
  getDiscountedCoinPrice,
  markCouponUsed,
  mergeCoupons,
  saveCoupons,
  type CouponRecord,
} from "@/data/coupons";
import { DEFAULT_COIN_BALANCE, saveCoinBalance, spendCoins } from "@/data/wallet";
import { normalizeAvatarUrl, pickRandomAvatarUrl } from "@/data/avatarOptions";

export type UserRole = "user" | "admin";
export type ProductStatus = "open" | "closed";
export type OrderStatus = "pending" | "shipping" | "shipped";
export type NotificationType = "order" | "coin" | "stock" | "auth";

export type UserRecord = {
  id: string;
  username: string;
  email: string;
  pin: string;
  phone?: string;
  avatarUrl?: string;
  passwordHash: string;
  role: UserRole;
  coins: number;
  coinUpdatedAt?: string;
  suspended?: boolean;
  createdAt: string;
};

export type SafeUser = Omit<UserRecord, "passwordHash">;

export type AdminUserRow = SafeUser & {
  isOrderOnly?: boolean;
};

export type CoinLog = {
  id: string;
  userId: string;
  adminId: string;
  amount: number;
  reason: string;
  createdAt: string;
};

export type ProductRecord = {
  id: string;
  name: string;
  image: string;
  images: string[];
  stock: number;
  priceCoin: number;
  status: ProductStatus;
  type: ProductType;
  categoryId: string;
  description: string;
  badges: ProductBadge[];
  pinned: boolean;
  discountDisabled: boolean;
  dropItems: ProductDropItem[];
  createdAt: string;
};

export type ProductCategoryRecord = {
  id: string;
  label: string;
  createdAt: string;
};

export type PopupAdPlacement = "banner" | "popup";

export type PopupAdRecord = {
  id: string;
  image: string;
  title: string;
  placement?: PopupAdPlacement;
  dismissHours?: number;
  isActive: boolean;
  createdAt: string;
};

export type OrderItem = {
  inventoryItemId?: string;
  id: string;
  name: string;
  image: string;
  quantity: number;
};

export type OrderRecord = {
  id: string;
  userId: string;
  username: string;
  items: OrderItem[];
  receiverName: string;
  phone: string;
  address: string;
  trackingNumber: string;
  status: OrderStatus;
  shippingFee?: number;
  couponCode?: string;
  couponType?: "discount" | "freeShipping";
  couponDiscountPercent?: number;
  createdAt: string;
};

export type AdminNotification = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

export type TopupLog = {
  id: string;
  userId: string;
  amount: number;
  status: "success" | "pending";
  createdAt: string;
};

export type RollHistory = {
  id: string;
  userId: string;
  rewardName: string;
  machineName: string;
  createdAt: string;
};

export const USERS_STORAGE_KEY = "gacha_users";
export const CURRENT_USER_STORAGE_KEY = "gacha_current_user_id";
export const SESSION_USER_STORAGE_KEY = "gacha_session_user_id";
export const COIN_LOGS_STORAGE_KEY = "gacha_coin_logs";
export const PRODUCTS_STORAGE_KEY = "gacha_products";
export const PRODUCT_CATEGORIES_STORAGE_KEY = "gacha_product_categories";
export const POPUP_ADS_STORAGE_KEY = "gacha_popup_ads";
export const ORDERS_STORAGE_KEY = "gacha_orders";
export const NOTIFICATIONS_STORAGE_KEY = "gacha_admin_notifications";
export const TOPUP_LOGS_STORAGE_KEY = "gacha_topup_logs";
export const ROLL_HISTORY_STORAGE_KEY = "gacha_roll_history";

const HASH_ITERATIONS = 120000;
const ADMIN_USERNAME = "kenji2612";
const ADMIN_EMAIL = "bas0971157330@gmail.com";
const ADMIN_PHONE = "0904114622";
const MAX_INLINE_IMAGE_LENGTH = 360000;
const MAX_INVENTORY_QUANTITY = 999;

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function storageGet(key: string) {
  if (!canUseStorage()) return null;
  return window.localStorage.getItem(key);
}

function readList<T>(key: string): T[] {
  if (!canUseStorage()) return [];

  try {
    const value = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(value) ? (value as T[]) : [];
  } catch {
    return [];
  }
}

function compactStorageImage(image: unknown) {
  const nextImage = String(image ?? "").trim();
  if (!nextImage.startsWith("data:image/")) return nextImage;
  return nextImage.length <= MAX_INLINE_IMAGE_LENGTH ? nextImage : "";
}

function normalizeInventoryQuantity(value: unknown) {
  const quantity = Number(value);
  if (!Number.isFinite(quantity) || quantity > MAX_INVENTORY_QUANTITY) return 1;
  return Math.max(1, Math.floor(quantity));
}

function normalizeInventoryItems(value: unknown): InventoryItem[] {
  if (!Array.isArray(value)) return [];

  const normalizedItems = value
    .filter((item): item is Partial<InventoryItem> => Boolean(item) && typeof item === "object")
    .map((item) => {
      const status: InventoryItem["status"] =
        item.status === "shipping" ? "shipping" : item.status === "shipped" ? "shipped" : "pending";
      const quantity = normalizeInventoryQuantity(item.quantity ?? 1);
      const selectedQuantity = Math.min(quantity, normalizeInventoryQuantity(item.selectedQuantity ?? 1));

      return {
        id: String(item.id ?? item.rewardId ?? ""),
        rewardId: String(item.rewardId ?? item.id ?? ""),
        name: String(item.name ?? ""),
        image: compactStorageImage(item.image) || "/hero-machine.png",
        quantity,
        status,
        selectedForShipping: Boolean(item.selectedForShipping) && status === "pending",
        selectedQuantity: Boolean(item.selectedForShipping) && status === "pending" ? selectedQuantity : undefined,
      };
    })
    .filter((item) => item.id && item.rewardId && item.name);

  return mergeInventoryItems(normalizedItems);
}

function normalizeInventoryRecord(record: Record<string, unknown> | undefined) {
  if (!record) return {};

  return Object.entries(record).reduce<Record<string, InventoryItem[]>>((acc, [userId, items]) => {
    const normalizedItems = normalizeInventoryItems(items);
    if (userId && normalizedItems.length > 0) acc[userId] = normalizedItems;
    return acc;
  }, {});
}

function compactProductsForStorage(value: unknown[], maxImages: number, stripInlineImages = false) {
  return value.map((item) => {
    const product = item as Partial<ProductRecord>;
    const cleanImage = (image: unknown) => {
      const nextImage = compactStorageImage(image);
      return stripInlineImages && nextImage.startsWith("data:image/") ? "" : nextImage;
    };
    const images = [product.image, ...(Array.isArray(product.images) ? product.images : [])]
      .map(cleanImage)
      .filter(Boolean)
      .slice(0, maxImages);
    const image = images[0] ?? "/hero-machine.png";

    return {
      ...product,
      image,
      images: images.length > 0 ? images : [image],
      dropItems: Array.isArray(product.dropItems)
        ? product.dropItems.map((drop) => ({ ...drop, image: compactStorageImage(drop.image) || "/hero-machine.png" }))
        : [],
    };
  });
}

function compactOrdersForStorage(value: unknown[]) {
  return value.map((item) => {
    const order = item as Partial<OrderRecord>;

    return {
      ...order,
      items: Array.isArray(order.items)
        ? order.items.map((orderItem) => ({
            ...orderItem,
            image: compactStorageImage(orderItem.image) || "/hero-machine.png",
          }))
        : [],
    };
  });
}

function writeList<T>(key: string, value: T[]) {
  if (!canUseStorage()) return false;

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    if (key === ORDERS_STORAGE_KEY) {
      try {
        window.localStorage.setItem(key, JSON.stringify(compactOrdersForStorage(value)));
        return true;
      } catch {
        // Fall through to the warning below.
      }
    }

    if (key !== PRODUCTS_STORAGE_KEY) {
      console.warn(`Unable to save ${key} to localStorage`, error);
      return false;
    }

    for (const maxImages of [10, 5, 3, 1]) {
      try {
        window.localStorage.setItem(key, JSON.stringify(compactProductsForStorage(value, maxImages)));
        return true;
      } catch {
        // Try a smaller product gallery payload.
      }
    }

    try {
      window.localStorage.setItem(key, JSON.stringify(compactProductsForStorage(value, 10, true)));
      return true;
    } catch {
      // Fall through to the warning below.
    }

    console.warn("Unable to save products to localStorage. Product images are too large.", error);
    return false;
  }
}

function syncPublicStore(value: {
  products?: ProductRecord[];
  categories?: ProductCategoryRecord[];
  popupAds?: PopupAdRecord[];
}) {
  if (!canUseStorage()) return;
  fetch("/api/public-store", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  }).catch(() => undefined);
}

type SharedStoreSnapshot = {
  users: UserRecord[];
  orders: OrderRecord[];
  notifications: AdminNotification[];
  coupons: CouponRecord[];
  inventories?: Record<string, InventoryItem[]>;
  shippingAddresses?: Record<string, ShippingAddress>;
  coinLogs?: CoinLog[];
  topupLogs?: TopupLog[];
  rollHistory?: RollHistory[];
};

type SharedStoreSyncPayload = Partial<SharedStoreSnapshot> & {
  preserveWallets?: boolean;
};

const SHARED_STORE_SYNC_COOLDOWN_MS = 2500;
let sharedStoreSyncPromise: Promise<SharedStoreSnapshot | null> | null = null;
let lastSharedStoreSyncAt = 0;
let lastSharedStoreSyncResult: SharedStoreSnapshot | null = null;

function syncSharedStore(value: SharedStoreSyncPayload) {
  if (!canUseStorage()) return;
  fetch("/api/shared-store", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
    keepalive: true,
  }).catch(() => undefined);
}

async function syncSharedStoreNow(value: SharedStoreSyncPayload) {
  if (!canUseStorage()) return;
  const response = await fetch("/api/shared-store", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
  if (!response.ok) throw new Error("Unable to sync user data");
}

function syncUserRecord(user: UserRecord) {
  return syncSharedStoreNow({ users: [user], preserveWallets: true });
}

function logSafeSyncError(stage: string, user: Pick<UserRecord, "id" | "username">, error: unknown) {
  console.warn(stage, {
    stage,
    userId: user.id,
    username: user.username,
    message: error instanceof Error ? error.message : String(error ?? ""),
  });
}

export async function repairActiveUserSync(stage = "ACTIVE_USER_SYNC_FAILED") {
  const user = getCurrentUser();
  if (!user) return null;

  try {
    await syncUserRecord(user);
    return user;
  } catch (error) {
    logSafeSyncError(stage, user, error);
    return null;
  }
}

function publishSharedStoreSnapshot(value: SharedStoreSyncPayload = {}) {
  if (!canUseStorage()) return;
  syncSharedStore({
    users: getUsers(),
    orders: getOrders(),
    notifications: getNotifications(),
    coupons: getCoupons(),
    inventories: getInventorySnapshot(),
    shippingAddresses: getShippingAddressSnapshot(),
    coinLogs: getCoinLogs(),
    topupLogs: getTopupLogs(),
    rollHistory: getRollHistory(),
    ...value,
  });
}

function stringifyStoreValue(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function storeValueChanged(previousValue: unknown, nextValue: unknown) {
  return stringifyStoreValue(previousValue) !== stringifyStoreValue(nextValue);
}

function getUserCoinValue(users: UserRecord[], userId: string) {
  const user = users.find((item) => item.id === userId);
  return user ? Math.max(0, Number(user.coins || 0)) : null;
}

function getScopedRecordValue<T>(record: Record<string, T>, userId: string) {
  return userId ? record[userId] : undefined;
}

function statusRank(status: OrderStatus) {
  return status === "shipped" ? 2 : status === "shipping" ? 1 : 0;
}

function coinUpdatedTime(user: Pick<UserRecord, "coinUpdatedAt" | "createdAt">) {
  const timestamp = Date.parse(user.coinUpdatedAt ?? user.createdAt ?? "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function mergeUserRecord(current: UserRecord | undefined, incoming: UserRecord) {
  if (!current) return incoming;

  return {
    ...current,
    ...incoming,
    coins: Math.max(0, Number(incoming.coins ?? current.coins ?? 0)),
    coinUpdatedAt: incoming.coinUpdatedAt ?? incoming.createdAt ?? current.coinUpdatedAt ?? current.createdAt,
  };
}

function mergeUsers(localUsers: UserRecord[], remoteUsers: UserRecord[]) {
  const userMap = new Map<string, UserRecord>();
  localUsers.forEach((user) => userMap.set(user.id, user));
  remoteUsers.forEach((user) => {
    const current = userMap.get(user.id);
    userMap.set(user.id, mergeUserRecord(current, user));
  });
  return withAdminUserMigration(Array.from(userMap.values()));
}

function mergeOrders(localOrders: OrderRecord[], remoteOrders: OrderRecord[]) {
  const orderMap = new Map<string, OrderRecord>();
  [...localOrders, ...remoteOrders].forEach((order) => {
    const current = orderMap.get(order.id);
    if (!current) {
      orderMap.set(order.id, order);
      return;
    }

    const nextOrder =
      statusRank(order.status) >= statusRank(current.status)
        ? { ...current, ...order, trackingNumber: order.trackingNumber || current.trackingNumber }
        : { ...order, ...current, trackingNumber: current.trackingNumber || order.trackingNumber };
    orderMap.set(order.id, nextOrder);
  });

  return Array.from(orderMap.values()).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

function mergeNotifications(localNotifications: AdminNotification[], remoteNotifications: AdminNotification[]) {
  const notificationMap = new Map<string, AdminNotification>();
  [...localNotifications, ...remoteNotifications].forEach((notification) => {
    const current = notificationMap.get(notification.id);
    notificationMap.set(notification.id, current ? { ...current, ...notification, isRead: current.isRead || notification.isRead } : notification);
  });

  return Array.from(notificationMap.values()).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

function mergeLogsById<T extends { id: string; createdAt: string }>(localLogs: T[], remoteLogs: T[]) {
  const logMap = new Map<string, T>();
  [...localLogs, ...remoteLogs].forEach((log) => {
    const current = logMap.get(log.id);
    logMap.set(log.id, current ? { ...current, ...log } : log);
  });

  return Array.from(logMap.values()).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

function readScopedRecord<T>(baseKey: string) {
  if (!canUseStorage()) return {};
  const record: Record<string, T> = {};

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key?.startsWith(`${baseKey}:`)) continue;

    try {
      const userId = key.slice(baseKey.length + 1);
      if (userId) record[userId] = JSON.parse(window.localStorage.getItem(key) ?? "null") as T;
    } catch {
      // Ignore one broken scoped value without blocking the rest of the store.
    }
  }

  return record;
}

function writeScopedRecord<T>(baseKey: string, record: Record<string, T>) {
  if (!canUseStorage()) return;
  Object.entries(record).forEach(([userId, value]) => {
    if (userId) window.localStorage.setItem(`${baseKey}:${userId}`, JSON.stringify(value));
  });
}

function mergeRecord<T>(localRecord: Record<string, T>, remoteRecord: Record<string, T> | undefined) {
  return { ...localRecord, ...(remoteRecord ?? {}) };
}

function getShippingAddressSnapshot() {
  return readScopedRecord<ShippingAddress>(SHIPPING_ADDRESS_STORAGE_KEY);
}

function getInventorySnapshot() {
  return normalizeInventoryRecord(readScopedRecord<InventoryItem[]>(INVENTORY_STORAGE_KEY));
}

export async function syncSharedStoreFromServer(options: { notify?: boolean; force?: boolean; pushLocal?: boolean } = {}) {
  if (!canUseStorage()) return null;
  const now = Date.now();
  if (!options.force && sharedStoreSyncPromise) return sharedStoreSyncPromise;
  if (!options.force && now - lastSharedStoreSyncAt < SHARED_STORE_SYNC_COOLDOWN_MS) return lastSharedStoreSyncResult;

  const shouldNotify = options.notify ?? false;
  const shouldPushLocal = options.pushLocal ?? false;
  lastSharedStoreSyncAt = now;

  sharedStoreSyncPromise = (async () => {
  try {
    await repairActiveUserSync("ACTIVE_USER_SYNC_FAILED");

    const response = await fetch("/api/shared-store", { cache: "no-store" });
    if (!response.ok) {
      console.warn("SHARED_STORE_SYNC_FAILED", { stage: "SHARED_STORE_SYNC_FAILED", message: response.statusText });
      return lastSharedStoreSyncResult;
    }
    const remoteStore = (await response.json()) as Partial<SharedStoreSnapshot>;

    const activeUserId = getCurrentUserId();
    const previousUsers = getUsers();
    const previousOrders = getOrders();
    const previousNotifications = getNotifications();
    const previousCoupons = getCoupons();
    const previousInventories = getInventorySnapshot();
    const previousShippingAddresses = getShippingAddressSnapshot();
    const previousCoinLogs = getCoinLogs();
    const previousTopupLogs = getTopupLogs();
    const previousRollHistory = getRollHistory();

    const previousActiveUser = activeUserId ? previousUsers.find((user) => user.id === activeUserId) : null;
    const users = Array.isArray(remoteStore.users)
      ? mergeUsers(previousUsers, remoteStore.users).map((user) =>
          previousActiveUser && user.id === previousActiveUser.id
            ? {
                ...user,
                phone: previousActiveUser.phone || user.phone,
                avatarUrl: previousActiveUser.avatarUrl || user.avatarUrl,
              }
            : user,
        )
      : previousUsers;
    const orders = Array.isArray(remoteStore.orders) ? mergeOrders([], remoteStore.orders) : previousOrders;
    const notifications = Array.isArray(remoteStore.notifications)
      ? mergeNotifications([], remoteStore.notifications)
      : previousNotifications;
    const coupons = Array.isArray(remoteStore.coupons) ? mergeCoupons([], remoteStore.coupons) : previousCoupons;
    const inventories =
      remoteStore.inventories && typeof remoteStore.inventories === "object"
        ? normalizeInventoryRecord(remoteStore.inventories)
        : previousInventories;
    const shippingAddresses =
      remoteStore.shippingAddresses && typeof remoteStore.shippingAddresses === "object"
        ? remoteStore.shippingAddresses
        : previousShippingAddresses;
    const coinLogs = Array.isArray(remoteStore.coinLogs) ? mergeLogsById([], remoteStore.coinLogs) : previousCoinLogs;
    const topupLogs = Array.isArray(remoteStore.topupLogs) ? mergeLogsById([], remoteStore.topupLogs) : previousTopupLogs;
    const rollHistory = Array.isArray(remoteStore.rollHistory) ? mergeLogsById([], remoteStore.rollHistory) : previousRollHistory;

    const usersChanged = storeValueChanged(previousUsers, users);
    const ordersChanged = storeValueChanged(previousOrders, orders);
    const notificationsChanged = storeValueChanged(previousNotifications, notifications);
    const couponsChanged = storeValueChanged(previousCoupons, coupons);
    const inventoriesChanged = storeValueChanged(previousInventories, inventories);
    const shippingAddressesChanged = storeValueChanged(previousShippingAddresses, shippingAddresses);
    const coinLogsChanged = storeValueChanged(previousCoinLogs, coinLogs);
    const topupLogsChanged = storeValueChanged(previousTopupLogs, topupLogs);
    const rollHistoryChanged = storeValueChanged(previousRollHistory, rollHistory);
    const activeInventoryChanged = storeValueChanged(
      getScopedRecordValue(previousInventories, activeUserId),
      getScopedRecordValue(inventories, activeUserId),
    );
    const activeAddressChanged = storeValueChanged(
      getScopedRecordValue(previousShippingAddresses, activeUserId),
      getScopedRecordValue(shippingAddresses, activeUserId),
    );
    const walletChanged =
      activeUserId &&
      getUserCoinValue(previousUsers, activeUserId) !== getUserCoinValue(users, activeUserId);

    if (usersChanged) writeList(USERS_STORAGE_KEY, users);
    if (ordersChanged) writeList(ORDERS_STORAGE_KEY, orders);
    if (notificationsChanged) writeList(NOTIFICATIONS_STORAGE_KEY, notifications);
    if (couponsChanged) saveCoupons(coupons, false, false);
    if (inventoriesChanged) writeScopedRecord(INVENTORY_STORAGE_KEY, inventories);
    if (shippingAddressesChanged) writeScopedRecord(SHIPPING_ADDRESS_STORAGE_KEY, shippingAddresses);
    if (coinLogsChanged) writeList(COIN_LOGS_STORAGE_KEY, coinLogs);
    if (topupLogsChanged) writeList(TOPUP_LOGS_STORAGE_KEY, topupLogs);
    if (rollHistoryChanged) writeList(ROLL_HISTORY_STORAGE_KEY, rollHistory);

    const activeUser = activeUserId ? users.find((user) => user.id === activeUserId) : null;
    if (activeUser) await syncUserRecord(activeUser).catch((error) => logSafeSyncError("ACTIVE_USER_SYNC_FAILED", activeUser, error));

    if (
      shouldPushLocal &&
      (usersChanged ||
        ordersChanged ||
        notificationsChanged ||
        couponsChanged ||
        inventoriesChanged ||
        shippingAddressesChanged ||
        coinLogsChanged ||
        topupLogsChanged ||
        rollHistoryChanged)
    ) {
      syncSharedStore({ users, orders, notifications, coupons, inventories, shippingAddresses, coinLogs, topupLogs, rollHistory });
    }

    if (shouldNotify) {
      if (usersChanged) window.dispatchEvent(new CustomEvent("gacha-users-updated"));
      if (ordersChanged) window.dispatchEvent(new CustomEvent("gacha-orders-updated"));
      if (notificationsChanged) window.dispatchEvent(new CustomEvent("gacha-notifications-updated"));
      if (couponsChanged) window.dispatchEvent(new CustomEvent("gacha-coupons-updated"));
      if (activeInventoryChanged) window.dispatchEvent(new CustomEvent("gacha-inventory-updated"));
      if (activeAddressChanged) window.dispatchEvent(new CustomEvent("gacha-address-updated"));
      if (walletChanged) window.dispatchEvent(new CustomEvent("gacha-wallet-updated"));
      if (rollHistoryChanged) window.dispatchEvent(new CustomEvent("gacha-roll-history-updated"));
    }

    lastSharedStoreSyncResult = { users, orders, notifications, coupons, inventories, shippingAddresses, coinLogs, topupLogs, rollHistory };
    return lastSharedStoreSyncResult;
  } catch (error) {
    console.warn("SHARED_STORE_SYNC_FAILED", {
      stage: "SHARED_STORE_SYNC_FAILED",
      message: error instanceof Error ? error.message : String(error ?? ""),
    });
    return lastSharedStoreSyncResult;
  }
  })().finally(() => {
    sharedStoreSyncPromise = null;
  });

  return sharedStoreSyncPromise;
}

function makeId(prefix: string) {
  const randomPart =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  return `${prefix}_${randomPart}`;
}

function toSafeUser(user: UserRecord): SafeUser {
  const { passwordHash: _passwordHash, ...safeUser } = {
    ...user,
    phone: user.phone ?? "",
    avatarUrl: normalizeAvatarUrl(user.avatarUrl),
  };
  return safeUser;
}

function withAdminUserMigration(users: UserRecord[]) {
  return users.map((user) =>
    user.username.trim().toLowerCase() === ADMIN_USERNAME
      ? { ...user, email: ADMIN_EMAIL, phone: ADMIN_PHONE, role: "admin" as UserRole }
      : user,
  );
}

async function migrateAdminUserIfNeeded() {
  const users = getUsers();
  if (users.length === 0) return;

  const migratedUsers = withAdminUserMigration(users);
  const hasKenjiAdmin = migratedUsers.some((user) => user.username.trim().toLowerCase() === ADMIN_USERNAME);
  const nextUsers = hasKenjiAdmin
    ? migratedUsers
    : [
        {
          id: "admin_kenji2612",
          username: "kenji2612",
          email: ADMIN_EMAIL,
          pin: "261244",
          phone: ADMIN_PHONE,
          avatarUrl: "/avatars/shiba.png",
          passwordHash: await hashPassword("kenji2612"),
          role: "admin" as UserRole,
          coins: 99999,
          createdAt: new Date().toISOString(),
        },
        ...migratedUsers,
      ];

  if (
    nextUsers.length !== users.length ||
    nextUsers.some(
      (user, index) =>
        user.id !== users[index]?.id ||
        user.role !== users[index]?.role ||
        user.email !== users[index]?.email ||
        user.phone !== users[index]?.phone,
    )
  ) {
    saveUsers(nextUsers);
  }
}

function canUseWebCrypto() {
  return Boolean(globalThis.crypto?.subtle) && typeof globalThis.crypto?.getRandomValues === "function";
}

async function requestPasswordApi<T>(body: Record<string, unknown>) {
  const response = await fetch("/api/password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error("Password crypto API failed");
  }

  return (await response.json()) as T;
}

function bytesToBase64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

async function derivePasswordHash(password: string, salt: Uint8Array) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("WebCrypto is unavailable");

  const key = await subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const normalizedSalt = new Uint8Array(salt);
  const bits = await subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: normalizedSalt.buffer as ArrayBuffer,
      iterations: HASH_ITERATIONS,
    },
    key,
    256,
  );

  return bytesToBase64(new Uint8Array(bits));
}

export async function hashPassword(password: string) {
  if (!canUseWebCrypto()) {
    const result = await requestPasswordApi<{ passwordHash: string }>({ action: "hash", password });
    return result.passwordHash;
  }

  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePasswordHash(password, salt);
  return `pbkdf2-sha256$${HASH_ITERATIONS}$${bytesToBase64(salt)}$${hash}`;
}

export async function verifyPassword(password: string, passwordHash: string) {
  if (!canUseWebCrypto()) {
    try {
      const result = await requestPasswordApi<{ valid: boolean }>({ action: "verify", password, passwordHash });
      return Boolean(result.valid);
    } catch {
      return false;
    }
  }

  const [scheme, iterations, salt, hash] = passwordHash.split("$");
  if (scheme !== "pbkdf2-sha256" || !iterations || !salt || !hash) return false;
  const nextHash = await derivePasswordHash(password, base64ToBytes(salt));
  return nextHash === hash;
}

export function getUsers() {
  return readList<UserRecord>(USERS_STORAGE_KEY);
}

export function saveUsers(users: UserRecord[], options: { syncRemote?: boolean } = {}) {
  writeList(USERS_STORAGE_KEY, users);
  if (options.syncRemote ?? true) publishSharedStoreSnapshot({ users });
  if (canUseStorage()) window.dispatchEvent(new CustomEvent("gacha-users-updated"));
}

export function getSafeUsers() {
  return getUsers().map(toSafeUser);
}

export function getAdminUserRows(): AdminUserRow[] {
  const users = getSafeUsers();
  const existingUserIds = new Set(users.map((user) => user.id));
  const orderOnlyUsers = new Map<string, AdminUserRow>();

  getOrders().forEach((order) => {
    if (!order.userId || existingUserIds.has(order.userId) || orderOnlyUsers.has(order.userId)) return;

    orderOnlyUsers.set(order.userId, {
      id: order.userId,
      username: order.username || order.userId,
      email: "จากออเดอร์",
      pin: "-",
      role: "user",
      coins: 0,
      createdAt: order.createdAt,
      isOrderOnly: true,
    });
  });

  return [...users, ...orderOnlyUsers.values()];
}

function defaultCategories(): ProductCategoryRecord[] {
  const now = new Date().toISOString();
  return [
    { id: "gachapon", label: "กาชาปอง", createdAt: now },
    { id: "figure", label: "ฟิกเกอร์/โมเดล", createdAt: now },
    { id: "plush", label: "ตุ๊กตา", createdAt: now },
  ];
}

function normalizeProductImages(image?: string, images?: string[]) {
  const primaryImage = String(image ?? "/hero-machine.png").trim() || "/hero-machine.png";
  const galleryImages = Array.isArray(images) ? images : [];
  const normalizedImages = [primaryImage, ...galleryImages]
    .map((item) => String(item ?? "").trim())
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
    id: String(product.id ?? makeId("product")),
    name: String(product.name ?? ""),
    image: images[0] ?? "/hero-machine.png",
    images,
    stock: Math.max(0, Number(product.stock ?? 0)),
    priceCoin: Math.max(0, Number(product.priceCoin ?? 0)),
    status: product.status === "closed" ? "closed" : "open",
    type: product.type === "sale" ? "sale" : "random",
    categoryId: String(product.categoryId ?? "gachapon"),
    description: String(product.description ?? ""),
    badges,
    pinned: Boolean(product.pinned),
    discountDisabled: Boolean(product.discountDisabled),
    dropItems: Array.isArray(product.dropItems)
      ? product.dropItems.map((item) => ({
          id: String(item.id ?? makeId("drop")),
          name: String(item.name ?? ""),
          image: String(item.image ?? "/hero-machine.png"),
          quantity: Math.max(1, Number(item.quantity ?? 1)),
        })).filter((item) => item.name && item.image)
      : [],
    createdAt: String(product.createdAt ?? new Date().toISOString()),
  };
}

export function getProductCategories() {
  const categories = readList<ProductCategoryRecord>(PRODUCT_CATEGORIES_STORAGE_KEY);
  if (categories.length > 0) return categories;

  const seededCategories = defaultCategories();
  writeList(PRODUCT_CATEGORIES_STORAGE_KEY, seededCategories);
  return seededCategories;
}

export function saveProductCategories(categories: ProductCategoryRecord[], notify = true, syncRemote = true) {
  writeList(PRODUCT_CATEGORIES_STORAGE_KEY, categories);
  if (syncRemote) syncPublicStore({ categories });
  if (notify) window.dispatchEvent(new CustomEvent("gacha-categories-updated"));
}

export function getPopupAds() {
  const ads = readList<PopupAdRecord>(POPUP_ADS_STORAGE_KEY);
  if (ads.length > 0) return ads.map(normalizePopupAd);
  return [];
}

function normalizePopupAd(ad: Partial<PopupAdRecord>): PopupAdRecord {
  const placement: PopupAdPlacement = ad.placement === "popup" ? "popup" : "banner";
  const dismissHours = Number(ad.dismissHours);

  return {
    id: String(ad.id || `ad_${Date.now().toString(36)}`),
    image: String(ad.image || "/promo-banner.png"),
    title: String(ad.title || "Gacha Pop Promotion"),
    placement,
    dismissHours: Number.isFinite(dismissHours) && dismissHours > 0 ? dismissHours : 1,
    isActive: Boolean(ad.isActive),
    createdAt: String(ad.createdAt || new Date().toISOString()),
  };
}

export function savePopupAds(ads: PopupAdRecord[], notify = true, syncRemote = true) {
  const nextAds = ads.slice(0, 5).map(normalizePopupAd);
  writeList(POPUP_ADS_STORAGE_KEY, nextAds);
  if (syncRemote) syncPublicStore({ popupAds: nextAds });
  if (notify) window.dispatchEvent(new CustomEvent("gacha-popup-ads-updated"));
}

export function getProducts() {
  const products = readList<Partial<ProductRecord>>(PRODUCTS_STORAGE_KEY);
  if (products.length > 0) return products.map(normalizeProduct);
  return [];
}

export function saveProducts(products: ProductRecord[], notify = true, syncRemote = true) {
  const nextProducts = products.map(normalizeProduct);
  writeList(PRODUCTS_STORAGE_KEY, nextProducts);
  if (syncRemote) syncPublicStore({ products: nextProducts });
  if (notify) window.dispatchEvent(new CustomEvent("gacha-products-updated"));
}

function resolveDiscountedPurchasePrice(product: ProductRecord) {
  const coupon = product.discountDisabled ? null : getBestDiscountCoupon();
  return {
    coupon,
    priceCoin: getDiscountedCoinPrice(product.priceCoin, coupon, product.discountDisabled),
  };
}

export function getOrders() {
  return readList<OrderRecord>(ORDERS_STORAGE_KEY);
}

export function saveOrders(orders: OrderRecord[]) {
  writeList(ORDERS_STORAGE_KEY, orders);
  publishSharedStoreSnapshot({ orders });
  window.dispatchEvent(new CustomEvent("gacha-orders-updated"));
}

export function getCoinLogs() {
  return readList<CoinLog>(COIN_LOGS_STORAGE_KEY);
}

export function getNotifications() {
  return readList<AdminNotification>(NOTIFICATIONS_STORAGE_KEY);
}

function saveNotifications(notifications: AdminNotification[]) {
  writeList(NOTIFICATIONS_STORAGE_KEY, notifications);
  publishSharedStoreSnapshot({ notifications });
  window.dispatchEvent(new CustomEvent("gacha-notifications-updated"));
}

export function getTopupLogs() {
  return readList<TopupLog>(TOPUP_LOGS_STORAGE_KEY);
}

export function recordTopupLog(amount: number, status: TopupLog["status"] = "success") {
  const log: TopupLog = {
    id: makeId("topup"),
    userId: getCurrentUserId() ?? "guest",
    amount,
    status,
    createdAt: new Date().toISOString(),
  };
  const nextLogs = [log, ...getTopupLogs()];
  writeList(TOPUP_LOGS_STORAGE_KEY, nextLogs);
  publishSharedStoreSnapshot({ topupLogs: nextLogs });
  return log;
}

export function getRollHistory() {
  return readList<RollHistory>(ROLL_HISTORY_STORAGE_KEY);
}

async function purchaseProductOnServer(userId: string, productId: string, priceCoin: number) {
  let response: Response;

  try {
    response = await fetch("/api/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, productId, priceCoin }),
    });
  } catch {
    return null;
  }

  const data = (await response.json().catch(() => ({}))) as {
    nextBalance?: number;
    nextStock?: number;
    error?: string;
  };

  if (!response.ok) {
    const error = String(data.error ?? "PURCHASE_FAILED");
    if (response.status === 503 || error.includes("SUPABASE_NOT_CONFIGURED")) return null;
    if (error.includes("INSUFFICIENT_COINS")) throw new Error(`Coin not enough. Need ${priceCoin} Coin`);
    if (error.includes("INSUFFICIENT_STOCK")) throw new Error("Sold out");
    throw new Error(error);
  }

  return {
    nextBalance: Math.max(0, Number(data.nextBalance ?? 0)),
    nextStock: Math.max(0, Number(data.nextStock ?? 0)),
  };
}

export async function purchaseGachaRoll(productId: string) {
  if (!getCurrentUser()) throw new Error("กรุณาเข้าสู่ระบบก่อนสุ่มสินค้า");

  const currentUser = getCurrentUser()!;
  const products = getProducts();
  const product = products.find((item) => item.id === productId);

  if (!product) throw new Error("ไม่พบสินค้า");
  if (product.type !== "random") throw new Error("สินค้านี้เป็นสินค้าขาย ไม่ใช่ตู้สุ่ม");
  if (product.status !== "open") throw new Error("สินค้านี้ปิดขายอยู่");
  if (product.stock <= 0) throw new Error("สินค้านี้ Sold out แล้ว");

  const discount = resolveDiscountedPurchasePrice(product);
  const serverPurchase = await purchaseProductOnServer(currentUser.id, productId, discount.priceCoin);
  const nextBalance = serverPurchase?.nextBalance ?? spendCoins(discount.priceCoin);
  if (nextBalance === null) throw new Error(`Coin ไม่พอ ต้องใช้ ${discount.priceCoin} Coin`);

  const nextProduct = { ...product, stock: serverPurchase?.nextStock ?? Math.max(0, product.stock - 1) };
  if (serverPurchase) saveCoinBalance(nextBalance, { syncRemote: false });
  saveProducts(products.map((item) => (item.id === productId ? nextProduct : item)), true, !serverPurchase);
  if (discount.coupon) markCouponUsed(discount.coupon.id);

  return { product: nextProduct, nextBalance, paidPrice: discount.priceCoin, discountCoupon: discount.coupon };
}

export async function purchaseSaleProduct(productId: string) {
  if (!getCurrentUser()) throw new Error("กรุณาเข้าสู่ระบบก่อนซื้อสินค้า");

  const currentUser = getCurrentUser()!;
  const products = getProducts();
  const product = products.find((item) => item.id === productId);

  if (!product) throw new Error("ไม่พบสินค้า");
  if (product.type !== "sale") throw new Error("สินค้านี้เป็นตู้สุ่ม กรุณากดสุ่มจากหน้าตู้");
  if (product.status !== "open") throw new Error("สินค้านี้ปิดขายอยู่");
  if (product.stock <= 0) throw new Error("สินค้านี้ Sold out แล้ว");

  const discount = resolveDiscountedPurchasePrice(product);
  const serverPurchase = await purchaseProductOnServer(currentUser.id, productId, discount.priceCoin);
  const nextBalance = serverPurchase?.nextBalance ?? spendCoins(discount.priceCoin);
  if (nextBalance === null) throw new Error(`Coin ไม่พอ ต้องใช้ ${discount.priceCoin} Coin`);

  const nextProduct = { ...product, stock: serverPurchase?.nextStock ?? Math.max(0, product.stock - 1) };
  if (serverPurchase) saveCoinBalance(nextBalance, { syncRemote: false });
  saveProducts(products.map((item) => (item.id === productId ? nextProduct : item)), true, !serverPurchase);
  if (discount.coupon) markCouponUsed(discount.coupon.id);

  return { product: nextProduct, nextBalance, paidPrice: discount.priceCoin, discountCoupon: discount.coupon };
}

export function consumeProductDropItem(productId: string, dropItemId: string) {
  const products = getProducts();
  const product = products.find((item) => item.id === productId);
  if (!product || product.dropItems.length === 0) return null;

  const nextProduct = {
    ...product,
    dropItems: product.dropItems.map((item) =>
      item.id === dropItemId ? { ...item, quantity: Math.max(0, Number(item.quantity) - 1) } : item,
    ),
  };

  saveProducts(products.map((item) => (item.id === productId ? nextProduct : item)));
  return nextProduct;
}

export function addRollHistory(rewardName: string, machineName: string) {
  const user = getCurrentUser();
  const history: RollHistory = {
    id: makeId("roll"),
    userId: user?.id ?? "guest",
    rewardName,
    machineName,
    createdAt: new Date().toISOString(),
  };
  const nextHistory = [history, ...getRollHistory()];
  writeList(ROLL_HISTORY_STORAGE_KEY, nextHistory);
  publishSharedStoreSnapshot({ rollHistory: nextHistory });
  if (canUseStorage()) window.dispatchEvent(new CustomEvent("gacha-roll-history-updated"));
  return history;
}

export async function ensureMockDatabase(options: { notifySync?: boolean } = {}) {
  if (!canUseStorage()) return;
  getProducts();
  getProductCategories();
  getPopupAds();
  await syncSharedStoreFromServer({ notify: options.notifySync ?? false });

  const existingUsers = getUsers();
  if (existingUsers.length > 0) {
    await migrateAdminUserIfNeeded();
    await repairActiveUserSync("ACTIVE_USER_SYNC_FAILED");
    return;
  }

  const now = new Date().toISOString();
  const users: UserRecord[] = [
    {
      id: "admin_001",
      username: "kenji2612",
      email: ADMIN_EMAIL,
      pin: "261244",
      phone: ADMIN_PHONE,
      avatarUrl: "/avatars/shiba.png",
      passwordHash: await hashPassword("kenji2612"),
      role: "admin",
      coins: 99999,
      coinUpdatedAt: now,
      createdAt: now,
    },
    {
      id: "user_player",
      username: "Player",
      email: "player@gachapop.local",
      pin: "111111",
      phone: "0800000000",
      avatarUrl: "/avatars/hamster.png",
      passwordHash: await hashPassword("Player123!"),
      role: "user",
      coins: DEFAULT_COIN_BALANCE,
      coinUpdatedAt: now,
      createdAt: now,
    },
  ];

  saveUsers(users);
  writeList<TopupLog>(TOPUP_LOGS_STORAGE_KEY, [
    { id: "topup_demo_1", userId: "user_player", amount: 1250, status: "success", createdAt: now },
  ]);
  writeList<RollHistory>(ROLL_HISTORY_STORAGE_KEY, []);
  saveNotifications([
    {
      id: "notice_welcome",
      type: "auth",
      title: "ระบบพร้อมใช้งาน",
      message: "Mock admin dashboard ถูกสร้างเรียบร้อยแล้ว",
      isRead: false,
      createdAt: now,
    },
  ]);
}

function setSession(userId: string, remember: boolean) {
  if (!canUseStorage()) return;
  window.sessionStorage.setItem(SESSION_USER_STORAGE_KEY, userId);
  if (remember) {
    window.localStorage.setItem(CURRENT_USER_STORAGE_KEY, userId);
  } else {
    window.localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
  }
  window.dispatchEvent(new CustomEvent("gacha-auth-updated"));
}

export function getCurrentUserId() {
  if (!canUseStorage()) return "";
  return window.sessionStorage.getItem(SESSION_USER_STORAGE_KEY) ?? window.localStorage.getItem(CURRENT_USER_STORAGE_KEY) ?? "";
}

export function getCurrentUser() {
  const userId = getCurrentUserId();
  return getUsers().find((user) => user.id === userId) ?? null;
}

export function logoutUser() {
  if (!canUseStorage()) return;
  window.sessionStorage.removeItem(SESSION_USER_STORAGE_KEY);
  window.localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent("gacha-auth-updated"));
  window.dispatchEvent(new CustomEvent("gacha-wallet-updated"));
}

export async function registerUser(input: {
  username: string;
  email: string;
  phone: string;
  password: string;
  avatarUrl?: string;
}) {
  await ensureMockDatabase();
  const users = getUsers();
  const username = input.username.trim();
  const email = input.email.trim().toLowerCase();
  const phone = input.phone.trim();
  const pinFallback = phone.replace(/\D/g, "").slice(-6).padStart(6, "0");

  if (
    users.some(
      (user) =>
        user.username.toLowerCase() === username.toLowerCase() ||
        user.email === email ||
        (user.phone && user.phone.replace(/\D/g, "") === phone.replace(/\D/g, "")),
    )
  ) {
    throw new Error("ชื่อผู้ใช้หรืออีเมลนี้ถูกใช้แล้ว");
  }

  const newUser: UserRecord = {
    id: makeId("user"),
    username,
    email,
    pin: pinFallback,
    phone,
    avatarUrl: normalizeAvatarUrl(input.avatarUrl ?? pickRandomAvatarUrl()),
    passwordHash: await hashPassword(input.password),
    role: "user",
    coins: DEFAULT_COIN_BALANCE,
    coinUpdatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  const nextUsers = [...users, newUser];
  saveUsers(nextUsers, { syncRemote: false });
  await syncUserRecord(newUser);
  setSession(newUser.id, true);
  return toSafeUser(newUser);
}

export async function loginUser(identifier: string, password: string, remember: boolean) {
  await ensureMockDatabase();
  const normalizedIdentifier = identifier.trim().toLowerCase();
  let user = getUsers().find(
    (item) => item.username.toLowerCase() === normalizedIdentifier || item.email.toLowerCase() === normalizedIdentifier,
  );

  if (!user) {
    await syncSharedStoreFromServer({ notify: false, force: true });
    user = getUsers().find(
      (item) => item.username.toLowerCase() === normalizedIdentifier || item.email.toLowerCase() === normalizedIdentifier,
    );
  }

  if (!user) throw new Error("ไม่พบบัญชีผู้ใช้");
  if (user.suspended) throw new Error("บัญชีนี้ถูกระงับการใช้งาน");

  const validPassword = await verifyPassword(password, user.passwordHash);
  if (!validPassword) throw new Error("รหัสผ่านไม่ถูกต้อง");

  await syncUserRecord(user).catch(() => undefined);
  setSession(user.id, remember);
  window.dispatchEvent(new CustomEvent("gacha-wallet-updated"));
  return toSafeUser(user);
}

export async function resetPasswordWithPin(identifier: string, pin: string, password: string) {
  await ensureMockDatabase();
  const normalizedIdentifier = identifier.trim().toLowerCase();
  const users = getUsers();
  const user = users.find(
    (item) => item.username.toLowerCase() === normalizedIdentifier || item.email.toLowerCase() === normalizedIdentifier,
  );

  if (!user) throw new Error("ไม่พบบัญชีผู้ใช้");
  if (user.pin !== pin) throw new Error("PIN ไม่ถูกต้อง");

  const passwordHash = await hashPassword(password);
  saveUsers(users.map((item) => (item.id === user.id ? { ...item, passwordHash } : item)));
  return true;
}

export async function resetPasswordWithPhone(identifier: string, phone: string, password: string) {
  await ensureMockDatabase();
  const normalizedIdentifier = identifier.trim().toLowerCase();
  const normalizedPhone = phone.replace(/\D/g, "");
  const users = getUsers();
  const user = users.find(
    (item) => item.username.toLowerCase() === normalizedIdentifier || item.email.toLowerCase() === normalizedIdentifier,
  );

  if (!user) throw new Error("ไม่พบบัญชีผู้ใช้");
  if (!normalizedPhone || (user.phone ?? "").replace(/\D/g, "") !== normalizedPhone) throw new Error("เบอร์โทรไม่ถูกต้อง");

  const passwordHash = await hashPassword(password);
  saveUsers(users.map((item) => (item.id === user.id ? { ...item, passwordHash } : item)));
  return true;
}

export function updateUserAvatar(userId: string, avatarUrl: string) {
  const safeAvatarUrl = normalizeAvatarUrl(avatarUrl);
  const users = getUsers();
  const nextUsers = users.map((user) => (user.id === userId ? { ...user, avatarUrl: safeAvatarUrl } : user));
  saveUsers(nextUsers);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("gacha-auth-updated"));
  }
  const updatedUser = nextUsers.find((user) => user.id === userId);
  return updatedUser ? toSafeUser(updatedUser) : null;
}

export async function adminResetPassword(userId: string) {
  const users = getUsers();
  const password = `Reset${Math.floor(100000 + Math.random() * 900000)}!`;
  const passwordHash = await hashPassword(password);
  saveUsers(users.map((user) => (user.id === userId ? { ...user, passwordHash } : user)));
  return password;
}

export async function createAdminUser(input: {
  username: string;
  email: string;
  pin: string;
  password: string;
}) {
  const users = getUsers();
  const username = input.username.trim();
  const email = input.email.trim().toLowerCase();

  if (!username || !email || !input.password || !/^\d{6}$/.test(input.pin)) {
    throw new Error("กรุณากรอกข้อมูลแอดมินให้ครบ และ PIN ต้องเป็นตัวเลข 6 หลัก");
  }

  if (users.some((user) => user.username.toLowerCase() === username.toLowerCase() || user.email === email)) {
    throw new Error("ชื่อผู้ใช้หรืออีเมลนี้ถูกใช้แล้ว");
  }

  const adminUser: UserRecord = {
    id: makeId("admin"),
    username,
    email,
    pin: input.pin,
    passwordHash: await hashPassword(input.password),
    role: "admin",
    coins: DEFAULT_COIN_BALANCE,
    coinUpdatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  saveUsers([adminUser, ...users]);
  window.dispatchEvent(new CustomEvent("gacha-auth-updated"));
  return toSafeUser(adminUser);
}

export async function addCoinsToUser(userId: string, adminId: string, amount: number, reason: string) {
  const users = getUsers();
  const user = users.find((item) => item.id === userId);
  if (!user) throw new Error("ไม่พบผู้ใช้");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("INVALID_COIN_AMOUNT");

  let nextCoins = Math.max(0, user.coins + amount);
  try {
    const response = await fetch("/api/wallet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, delta: amount, reason }),
    });
    const data = (await response.json().catch(() => ({}))) as { coins?: number; error?: string };
    if (!response.ok) throw new Error(data.error ?? "WALLET_UPDATE_FAILED");
    nextCoins = Math.max(0, Number(data.coins ?? nextCoins));
  } catch (error) {
    console.warn("ADMIN_ADD_COIN_FAILED", {
      stage: "ADMIN_ADD_COIN_FAILED",
      table: "wallets",
      userId,
      recordId: userId,
      message: error instanceof Error ? error.message : String(error ?? ""),
    });
    throw error;
  }

  const coinUpdatedAt = new Date().toISOString();
  const nextUsers = users.map((item) =>
    item.id === userId ? { ...item, coins: nextCoins, coinUpdatedAt } : item,
  );
  saveUsers(nextUsers, { syncRemote: false });

  if (getCurrentUserId() === userId) {
    window.dispatchEvent(new CustomEvent("gacha-wallet-updated"));
  }

  const notification: AdminNotification = {
    id: makeId("notice"),
    type: "coin",
    title: "มีการเพิ่ม Coin",
    message: `เพิ่ม ${amount} Coin ให้ ${user.username}`,
    isRead: false,
    createdAt: new Date().toISOString(),
  };
  const nextNotifications = [notification, ...getNotifications()];
  writeList(NOTIFICATIONS_STORAGE_KEY, nextNotifications);
  window.dispatchEvent(new CustomEvent("gacha-users-updated"));
  window.dispatchEvent(new CustomEvent("gacha-notifications-updated"));

  const updatedUser = nextUsers.find((item) => item.id === userId);
  await syncSharedStoreNow({
    users: updatedUser ? [updatedUser] : [],
    notifications: nextNotifications,
    preserveWallets: true,
  }).catch((error) => {
    console.warn("ADMIN_NOTIFICATION_SYNC_FAILED", {
      stage: "ADMIN_NOTIFICATION_SYNC_FAILED",
      table: "admin_notifications",
      userId,
      recordId: notification.id,
      message: error instanceof Error ? error.message : String(error ?? ""),
    });
  });

  return { userId, adminId, amount, reason, coins: nextCoins };
}

export function suspendUser(userId: string) {
  const users = getUsers();
  saveUsers(users.map((user) => (user.id === userId ? { ...user, suspended: !user.suspended } : user)));
}

export function formatShippingAddress(address: ShippingAddress) {
  const areaLabels = getAddressAreaLabels(address.province);

  return [
    address.detail,
    `บ้านเลขที่ ${address.houseNo}`,
    address.road ? `ถนน ${address.road}` : "",
    `${areaLabels.subdistrictLabel} ${address.subdistrict}`,
    `${areaLabels.districtLabel} ${address.district}`,
    `จังหวัด ${address.province}`,
    address.postalCode,
  ]
    .filter(Boolean)
    .join(" ");
}

export function createShippingOrder(
  items: InventoryItem[],
  address: ShippingAddress,
  options?: {
    shippingFee?: number;
    couponCode?: string;
    couponType?: "discount" | "freeShipping";
    couponDiscountPercent?: number;
  },
) {
  const currentUser = getCurrentUser();
  if (!currentUser) throw new Error("กรุณาเข้าสู่ระบบก่อนจัดส่งสินค้า");

  const user = currentUser;
  const username = user?.username ?? "Guest";
  const userId = user?.id ?? "guest";
  const now = new Date().toISOString();
  const order: OrderRecord = {
    id: makeId("order"),
    userId,
    username,
    items: items.map((item) => ({
      inventoryItemId: item.id,
      id: item.rewardId,
      name: item.name,
      image: compactStorageImage(item.image) || "/hero-machine.png",
      quantity: item.quantity,
    })),
    receiverName: address.receiverName || username,
    phone: address.phone || "-",
    address: formatShippingAddress(address),
    trackingNumber: "",
    status: "pending",
    shippingFee: Math.max(0, Number(options?.shippingFee ?? 0)),
    couponCode: options?.couponCode,
    couponType: options?.couponType,
    couponDiscountPercent: options?.couponDiscountPercent,
    createdAt: now,
  };

  const nextOrders = [order, ...getOrders()];
  const nextNotifications = [
    {
      id: makeId("notice"),
      type: "order" as const,
      title: "มีออเดอร์จัดส่งใหม่",
      message: `${username} ส่งคำขอจัดส่ง ${items.length} รายการ`,
      isRead: false,
      createdAt: now,
    },
    ...getNotifications(),
  ];

  writeList(ORDERS_STORAGE_KEY, nextOrders);
  writeList(NOTIFICATIONS_STORAGE_KEY, nextNotifications);
  publishSharedStoreSnapshot({
    orders: nextOrders,
    notifications: nextNotifications,
  });
  window.dispatchEvent(new CustomEvent("gacha-orders-updated"));
  window.dispatchEvent(new CustomEvent("gacha-notifications-updated"));

  return order;
}

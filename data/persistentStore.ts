import { gachas, type ProductBadge, type ProductDropItem, type ProductType } from "@/data/gacha";
import type { ShippingAddress } from "@/data/address";
import { mergeInventoryItems as mergeInventoryStacks, type InventoryItem, type InventoryStatus } from "@/data/inventory";
import type {
  AdminNotification,
  CoinLog,
  NotificationType,
  OrderRecord,
  OrderStatus,
  RollHistory,
  TopupLog,
  UserRecord,
  UserRole,
  ProductRecord,
  ProductCategoryRecord,
  PopupAdRecord,
} from "@/data/mockDb";
import { callRpc, deleteRowsByColumn, isSupabaseConfigured, selectRows, supabaseRequest, upsertRows } from "@/data/supabaseRest";

type DbUserRow = {
  id: string;
  username: string;
  email: string;
  pin: string;
  phone: string | null;
  avatar_url: string | null;
  password_hash: string;
  role: UserRole;
  suspended: boolean | null;
  created_at: string;
  updated_at: string;
};

type DbWalletRow = {
  user_id: string;
  coins: number;
  updated_at: string;
};

type DbProductRow = {
  id: string;
  name: string;
  image: string;
  images: string[] | null;
  stock: number;
  price_coin: number;
  status: ProductRecord["status"];
  type: ProductType;
  category_id: string;
  description: string;
  badges: ProductBadge[] | null;
  pinned: boolean;
  discount_disabled: boolean;
  drop_items: ProductDropItem[] | null;
  created_at: string;
  updated_at: string;
};

type DbCategoryRow = {
  id: string;
  label: string;
  created_at: string;
  updated_at: string;
};

type DbPopupAdRow = {
  id: string;
  image: string;
  title: string;
  placement: "banner" | "popup";
  dismiss_hours: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type DbOrderRow = {
  id: string;
  user_id: string;
  username: string;
  items: OrderRecord["items"];
  receiver_name: string;
  phone: string;
  address: string;
  tracking_number: string;
  status: OrderStatus;
  shipping_fee: number;
  coupon_code: string | null;
  coupon_type: "discount" | "freeShipping" | null;
  coupon_discount_percent: number | null;
  created_at: string;
  updated_at: string;
};

type DbInventoryRow = {
  id: string;
  user_id: string;
  reward_id: string;
  name: string;
  image: string;
  quantity: number;
  status: InventoryStatus;
  selected_for_shipping: boolean;
  selected_quantity: number | null;
  created_at: string;
  updated_at: string;
};

type DbAddressRow = {
  user_id: string;
  receiver_name: string;
  phone: string;
  detail: string;
  house_no: string;
  road: string;
  province: string;
  district: string;
  subdistrict: string;
  postal_code: string;
  updated_at: string;
};

type DbCoinLogRow = {
  id: string;
  user_id: string;
  admin_id: string;
  amount: number;
  reason: string;
  created_at: string;
};

type DbTopupLogRow = {
  id: string;
  user_id: string;
  amount: number;
  status: TopupLog["status"];
  created_at: string;
};

type DbRollHistoryRow = {
  id: string;
  user_id: string;
  reward_name: string;
  machine_name: string;
  created_at: string;
};

type DbNotificationRow = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

type DbCouponRow = {
  id: string;
  code: string;
  type: "discount" | "freeShipping";
  discount_percent: number;
  max_uses: number;
  claimed_by_user_ids: string[] | null;
  used_by_user_ids: string[] | null;
  created_at: string;
  expires_at: string | null;
};

type WalletRpcRow = {
  user_id: string;
  coins: number;
};

type StockRpcRow = {
  product_id: string;
  stock: number;
};

type PurchaseRpcRow = {
  user_id: string;
  product_id: string;
  next_balance: number;
  next_stock: number;
};

type ProductStockRow = {
  id: string;
  stock: number;
};

export type SharedStoreSnapshot = {
  users: UserRecord[];
  orders: OrderRecord[];
  notifications: AdminNotification[];
  coupons: import("@/data/coupons").CouponRecord[];
  inventories: Record<string, InventoryItem[]>;
  shippingAddresses: Record<string, ShippingAddress>;
  coinLogs: CoinLog[];
  topupLogs: TopupLog[];
  rollHistory: RollHistory[];
};

export type PublicStoreSnapshot = {
  products: ProductRecord[];
  categories: ProductCategoryRecord[];
  popupAds: PopupAdRecord[];
};

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix: string) {
  const randomPart = typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID().slice(0, 8)
    : Date.now().toString(36);
  return `${prefix}_${randomPart}`;
}

function toText(value: unknown, fallback = "") {
  return String(value ?? "").trim() || fallback;
}

function normalizeQuantity(value: unknown) {
  const quantity = Number(value);
  if (!Number.isFinite(quantity) || quantity <= 0) return 1;
  return Math.max(1, Math.floor(quantity));
}

function normalizeAddress(address?: Partial<ShippingAddress> | null): ShippingAddress {
  return {
    receiverName: toText(address?.receiverName),
    phone: toText(address?.phone),
    detail: toText(address?.detail),
    houseNo: toText(address?.houseNo),
    road: toText(address?.road),
    province: toText(address?.province),
    district: toText(address?.district),
    subdistrict: toText(address?.subdistrict),
    postalCode: toText(address?.postalCode),
  };
}

function normalizeInventoryItem(item: Partial<InventoryItem>): InventoryItem {
  const status: InventoryStatus = item.status === "shipping" ? "shipping" : item.status === "shipped" ? "shipped" : "pending";
  const quantity = normalizeQuantity(item.quantity ?? 1);
  const selectedQuantity = Math.min(quantity, normalizeQuantity(item.selectedQuantity ?? 1));

  return {
    id: toText(item.id ?? item.rewardId),
    rewardId: toText(item.rewardId ?? item.id),
    name: toText(item.name),
    image: toText(item.image, "/hero-machine.png"),
    quantity,
    status,
    selectedForShipping: Boolean(item.selectedForShipping) && status === "pending",
    selectedQuantity: Boolean(item.selectedForShipping) && status === "pending" ? selectedQuantity : undefined,
  };
}

function normalizeInventoryItems(value: unknown): InventoryItem[] {
  if (!Array.isArray(value)) return [];
  return mergeInventoryStacks(
    value
      .filter((item): item is Partial<InventoryItem> => Boolean(item) && typeof item === "object")
      .map((item) => normalizeInventoryItem(item))
      .filter((item) => item.id && item.rewardId && item.name),
  );
}

function normalizeProductImages(image?: string, images?: string[]) {
  const primaryImage = toText(image, "/hero-machine.png");
  const galleryImages = Array.isArray(images) ? images : [];
  return Array.from(new Set([primaryImage, ...galleryImages].map((item) => toText(item)).filter(Boolean))).slice(0, 10);
}

function normalizeDropItems(items: ProductDropItem[] | undefined): ProductDropItem[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => ({
      id: toText(item.id, makeId("drop")),
      name: toText(item.name),
      image: toText(item.image, "/hero-machine.png"),
      quantity: normalizeQuantity(item.quantity),
    }))
    .filter((item) => item.name && item.image);
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

  return {
    id: toText(product.id, makeId("product")),
    name: toText(product.name),
    image: images[0] ?? "/hero-machine.png",
    images,
    stock: Math.max(0, Number(product.stock ?? 0)),
    priceCoin: Math.max(0, Number(product.priceCoin ?? 0)),
    status: product.status === "closed" ? "closed" : "open",
    type: product.type === "sale" ? "sale" : "random",
    categoryId: toText(product.categoryId, "gachapon"),
    description: toText(product.description),
    badges: Array.from(new Set(storedBadges.length > 0 ? storedBadges : seedBadges)),
    pinned: Boolean(product.pinned),
    discountDisabled: Boolean(product.discountDisabled),
    dropItems: normalizeDropItems(product.dropItems),
    createdAt: toText(product.createdAt, nowIso()),
  };
}

function normalizeCategory(category: Partial<ProductCategoryRecord>): ProductCategoryRecord {
  const id = toText(category.id, makeId("category"));
  const defaultCategoryLabels: Record<string, string> = {
    gachapon: "กาชาปอง",
    figure: "ฟิกเกอร์/โมเดล",
    plush: "ตุ๊กตา",
  };
  const fallbackLabel = defaultCategoryLabels[id] ?? "หมวดหมู่";
  const label = toText(category.label, fallbackLabel);
  const repairedLabel = repairLatin1ThaiMojibake(label);
  const isBuiltInCategory = Boolean(defaultCategoryLabels[id]);

  return {
    id,
    label: isBuiltInCategory || looksLikeThaiMojibake(repairedLabel) ? fallbackLabel : repairedLabel,
    createdAt: toText(category.createdAt, nowIso()),
  };
}

function looksLikeThaiMojibake(value: string): boolean {
  return /เธ|เน€|เน|เน|à¸|à¹|Â|Ã/.test(value);
}

function repairLatin1ThaiMojibake(value: string): string {
  if (!/[àÂÃ]/.test(value)) return value;
  try {
    const bytes = Uint8Array.from(Array.from(value).map((char) => char.charCodeAt(0) & 0xff));
    const repaired = new TextDecoder("utf-8", { fatal: false }).decode(bytes).trim();
    return /[\u0E00-\u0E7F]/.test(repaired) ? repaired : value;
  } catch {
    return value;
  }
}

function normalizeAd(ad: Partial<PopupAdRecord>): PopupAdRecord {
  return {
    id: toText(ad.id, makeId("ad")),
    image: toText(ad.image, "/promo-banner.png"),
    title: toText(ad.title, "Gacha Pop Promotion"),
    placement: ad.placement === "popup" ? "popup" : "banner",
    dismissHours: Number.isFinite(Number(ad.dismissHours)) && Number(ad.dismissHours) > 0 ? Number(ad.dismissHours) : 1,
    isActive: Boolean(ad.isActive),
    createdAt: toText(ad.createdAt, nowIso()),
  };
}

function normalizeUsers(users: UserRecord[]): UserRecord[] {
  return users
    .filter((user) => Boolean(user) && typeof user === "object")
    .map((user) => ({
      id: toText(user.id),
      username: toText(user.username),
      email: toText(user.email).toLowerCase(),
      pin: toText(user.pin),
      phone: toText(user.phone),
      avatarUrl: toText(user.avatarUrl),
      passwordHash: toText(user.passwordHash),
      role: user.role === "admin" ? ("admin" as const) : ("user" as const),
      coins: Math.max(0, Number(user.coins ?? 0)),
      coinUpdatedAt: toText(user.coinUpdatedAt, user.createdAt),
      suspended: Boolean(user.suspended),
      createdAt: toText(user.createdAt, nowIso()),
    }))
    .filter((user) => user.id && user.username && user.email && user.passwordHash);
}

function normalizeOrders(orders: OrderRecord[]): OrderRecord[] {
  return orders
    .filter((order) => Boolean(order) && typeof order === "object")
    .map((order) => ({
      id: toText(order.id),
      userId: toText(order.userId),
      username: toText(order.username),
      items: Array.isArray(order.items)
        ? order.items.map((item) => ({
            id: toText(item.id),
            inventoryItemId: item.inventoryItemId ? toText(item.inventoryItemId) : undefined,
            name: toText(item.name),
            image: toText(item.image, "/hero-machine.png"),
            quantity: normalizeQuantity(item.quantity),
          }))
        : [],
      receiverName: toText(order.receiverName),
      phone: toText(order.phone),
      address: toText(order.address),
      trackingNumber: toText(order.trackingNumber),
      status: order.status === "shipped" ? ("shipped" as OrderStatus) : order.status === "shipping" ? ("shipping" as OrderStatus) : ("pending" as OrderStatus),
      shippingFee: Math.max(0, Number(order.shippingFee ?? 0)),
      couponCode: order.couponCode ? toText(order.couponCode).toUpperCase() : undefined,
      couponType: order.couponType === "freeShipping" || order.couponType === "discount" ? order.couponType : undefined,
      couponDiscountPercent: Number.isFinite(Number(order.couponDiscountPercent)) ? Number(order.couponDiscountPercent) : undefined,
      createdAt: toText(order.createdAt, nowIso()),
    }))
    .filter((order) => order.id && order.userId);
}

function normalizeNotifications(items: AdminNotification[]): AdminNotification[] {
  return items
    .filter((item) => Boolean(item) && typeof item === "object")
    .map((item) => {
      const type: NotificationType =
        item.type === "coin" || item.type === "stock" || item.type === "auth" ? item.type : "order";

      return {
        id: toText(item.id),
        type,
        title: toText(item.title),
        message: toText(item.message),
        isRead: Boolean(item.isRead),
        createdAt: toText(item.createdAt, nowIso()),
      };
    })
    .filter((item) => item.id);
}

function normalizeCoupons(items: import("@/data/coupons").CouponRecord[]): import("@/data/coupons").CouponRecord[] {
  return items
    .filter((item) => Boolean(item) && typeof item === "object")
    .map((item) => {
      const type: import("@/data/coupons").CouponType = item.type === "freeShipping" ? "freeShipping" : "discount";

      return {
        id: toText(item.id),
        code: toText(item.code).toUpperCase(),
        type,
        discountPercent: type === "freeShipping" ? 100 : Math.min(100, Math.max(1, Number(item.discountPercent ?? 1))),
        maxUses: Math.max(1, Number(item.maxUses ?? 1)),
        claimedByUserIds: Array.isArray(item.claimedByUserIds) ? item.claimedByUserIds.map((userId) => toText(userId)).filter(Boolean) : [],
        usedByUserIds: Array.isArray(item.usedByUserIds) ? item.usedByUserIds.map((userId) => toText(userId)).filter(Boolean) : [],
        createdAt: toText(item.createdAt, nowIso()),
        expiresAt: item.expiresAt ? toText(item.expiresAt) : undefined,
      };
    })
    .filter((item) => item.id && item.code);
}

function normalizeCoinLogs(items: CoinLog[]): CoinLog[] {
  return items
    .filter((item) => Boolean(item) && typeof item === "object")
    .map((item) => ({
      id: toText(item.id),
      userId: toText(item.userId),
      adminId: toText(item.adminId),
      amount: Number(item.amount ?? 0),
      reason: toText(item.reason),
      createdAt: toText(item.createdAt, nowIso()),
    }))
    .filter((item) => item.id && item.userId);
}

function normalizeTopupLogs(items: TopupLog[]): TopupLog[] {
  return items
    .filter((item) => Boolean(item) && typeof item === "object")
    .map((item) => {
      const status: TopupLog["status"] = item.status === "pending" ? "pending" : "success";

      return {
        id: toText(item.id),
        userId: toText(item.userId),
        amount: Number(item.amount ?? 0),
        status,
        createdAt: toText(item.createdAt, nowIso()),
      };
    })
    .filter((item) => item.id && item.userId);
}

function normalizeRollHistory(items: RollHistory[]): RollHistory[] {
  return items
    .filter((item) => Boolean(item) && typeof item === "object")
    .map((item) => ({
      id: toText(item.id),
      userId: toText(item.userId),
      rewardName: toText(item.rewardName),
      machineName: toText(item.machineName),
      createdAt: toText(item.createdAt, nowIso()),
    }))
    .filter((item) => item.id && item.userId);
}

function mergeById<T extends { id: string }>(current: T[], incoming: T[]) {
  const map = new Map<string, T>();
  current.forEach((item) => map.set(item.id, item));
  incoming.forEach((item) => map.set(item.id, { ...map.get(item.id), ...item }));
  return Array.from(map.values());
}

function mergeInventoryRecords(current: Record<string, InventoryItem[]>, incoming: Record<string, InventoryItem[]>) {
  const userIds = new Set([...Object.keys(current), ...Object.keys(incoming)]);
  const next: Record<string, InventoryItem[]> = {};
  userIds.forEach((userId) => {
    next[userId] = mergeInventoryStacks([...(current[userId] ?? []), ...(incoming[userId] ?? [])]);
  });
  return next;
}

function mergeAddresses(current: Record<string, ShippingAddress>, incoming: Record<string, ShippingAddress>) {
  return { ...current, ...incoming };
}

function rowToUser(user: DbUserRow, wallet?: DbWalletRow): UserRecord {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    pin: user.pin,
    phone: user.phone ?? "",
    avatarUrl: user.avatar_url ?? "",
    passwordHash: user.password_hash,
    role: user.role,
    coins: Math.max(0, Number(wallet?.coins ?? 0)),
    coinUpdatedAt: wallet?.updated_at ?? user.updated_at ?? user.created_at,
    suspended: Boolean(user.suspended),
    createdAt: user.created_at,
  };
}

function userToRow(user: UserRecord): DbUserRow {
  return {
    id: user.id,
    username: user.username,
    email: user.email.toLowerCase(),
    pin: user.pin,
    phone: user.phone ?? "",
    avatar_url: user.avatarUrl ?? "",
    password_hash: user.passwordHash,
    role: user.role,
    suspended: Boolean(user.suspended),
    created_at: user.createdAt,
    updated_at: user.coinUpdatedAt ?? user.createdAt,
  };
}

function walletToRow(user: UserRecord): DbWalletRow {
  return {
    user_id: user.id,
    coins: Math.max(0, Number(user.coins ?? 0)),
    updated_at: user.coinUpdatedAt ?? user.createdAt,
  };
}

function productToRow(product: ProductRecord): DbProductRow {
  return {
    id: product.id,
    name: product.name,
    image: product.image,
    images: product.images.slice(0, 10),
    stock: Math.max(0, Number(product.stock)),
    price_coin: Math.max(0, Number(product.priceCoin)),
    status: product.status,
    type: product.type,
    category_id: product.categoryId,
    description: product.description,
    badges: product.badges,
    pinned: Boolean(product.pinned),
    discount_disabled: Boolean(product.discountDisabled),
    drop_items: product.dropItems,
    created_at: product.createdAt,
    updated_at: nowIso(),
  };
}

function rowToProduct(row: DbProductRow): ProductRecord {
  return {
    id: row.id,
    name: row.name,
    image: row.image || row.images?.[0] || "/hero-machine.png",
    images: Array.isArray(row.images) && row.images.length > 0 ? row.images.slice(0, 10) : [row.image || "/hero-machine.png"],
    stock: Math.max(0, Number(row.stock ?? 0)),
    priceCoin: Math.max(0, Number(row.price_coin ?? 0)),
    status: row.status === "closed" ? "closed" : "open",
    type: row.type === "sale" ? "sale" : "random",
    categoryId: row.category_id,
    description: row.description,
    badges: Array.isArray(row.badges) ? row.badges : [],
    pinned: Boolean(row.pinned),
    discountDisabled: Boolean(row.discount_disabled),
    dropItems: Array.isArray(row.drop_items) ? row.drop_items : [],
    createdAt: row.created_at,
  };
}

function categoryToRow(category: ProductCategoryRecord): DbCategoryRow {
  const normalizedCategory = normalizeCategory(category);
  return {
    id: normalizedCategory.id,
    label: normalizedCategory.label,
    created_at: normalizedCategory.createdAt,
    updated_at: nowIso(),
  };
}

function rowToCategory(row: DbCategoryRow): ProductCategoryRecord {
  return normalizeCategory({
    id: row.id,
    label: row.label,
    createdAt: row.created_at,
  });
}

function adToRow(ad: PopupAdRecord): DbPopupAdRow {
  return {
    id: ad.id,
    image: ad.image,
    title: ad.title,
    placement: ad.placement === "popup" ? "popup" : "banner",
    dismiss_hours: Math.max(1, Number(ad.dismissHours ?? 1)),
    is_active: Boolean(ad.isActive),
    created_at: ad.createdAt,
    updated_at: nowIso(),
  };
}

function rowToAd(row: DbPopupAdRow): PopupAdRecord {
  return {
    id: row.id,
    image: row.image,
    title: row.title,
    placement: row.placement,
    dismissHours: row.dismiss_hours,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
  };
}

function orderToRow(order: OrderRecord): DbOrderRow {
  return {
    id: order.id,
    user_id: order.userId,
    username: order.username,
    items: order.items,
    receiver_name: order.receiverName,
    phone: order.phone,
    address: order.address,
    tracking_number: order.trackingNumber,
    status: order.status,
    shipping_fee: Math.max(0, Number(order.shippingFee ?? 0)),
    coupon_code: order.couponCode ?? null,
    coupon_type: order.couponType ?? null,
    coupon_discount_percent: order.couponDiscountPercent ?? null,
    created_at: order.createdAt,
    updated_at: nowIso(),
  };
}

function rowToOrder(row: DbOrderRow): OrderRecord {
  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    items: Array.isArray(row.items) ? row.items : [],
    receiverName: row.receiver_name,
    phone: row.phone,
    address: row.address,
    trackingNumber: row.tracking_number,
    status: row.status,
    shippingFee: Math.max(0, Number(row.shipping_fee ?? 0)),
    couponCode: row.coupon_code ?? undefined,
    couponType: row.coupon_type ?? undefined,
    couponDiscountPercent: row.coupon_discount_percent ?? undefined,
    createdAt: row.created_at,
  };
}

function inventoryToRow(userId: string, item: InventoryItem): DbInventoryRow {
  return {
    id: item.id,
    user_id: userId,
    reward_id: item.rewardId,
    name: item.name,
    image: item.image || "/hero-machine.png",
    quantity: Math.max(1, Number(item.quantity ?? 1)),
    status: item.status,
    selected_for_shipping: Boolean(item.selectedForShipping),
    selected_quantity: item.selectedQuantity ?? null,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
}

function rowToInventory(row: DbInventoryRow): InventoryItem {
  return {
    id: row.id,
    rewardId: row.reward_id,
    name: row.name,
    image: row.image || "/hero-machine.png",
    quantity: Math.max(1, Number(row.quantity ?? 1)),
    status: row.status,
    selectedForShipping: Boolean(row.selected_for_shipping) && row.status === "pending",
    selectedQuantity: row.selected_for_shipping && row.status === "pending" ? Math.max(1, Number(row.selected_quantity ?? 1)) : undefined,
  };
}

function addressToRow(userId: string, address: ShippingAddress): DbAddressRow {
  return {
    user_id: userId,
    receiver_name: address.receiverName,
    phone: address.phone,
    detail: address.detail,
    house_no: address.houseNo,
    road: address.road,
    province: address.province,
    district: address.district,
    subdistrict: address.subdistrict,
    postal_code: address.postalCode,
    updated_at: nowIso(),
  };
}

function rowToAddress(row: DbAddressRow): ShippingAddress {
  return {
    receiverName: row.receiver_name,
    phone: row.phone,
    detail: row.detail,
    houseNo: row.house_no,
    road: row.road,
    province: row.province,
    district: row.district,
    subdistrict: row.subdistrict,
    postalCode: row.postal_code,
  };
}

function coinLogToRow(row: CoinLog): DbCoinLogRow {
  return {
    id: row.id,
    user_id: row.userId,
    admin_id: row.adminId,
    amount: Number(row.amount ?? 0),
    reason: row.reason,
    created_at: row.createdAt,
  };
}

function rowToCoinLog(row: DbCoinLogRow): CoinLog {
  return {
    id: row.id,
    userId: row.user_id,
    adminId: row.admin_id,
    amount: Number(row.amount ?? 0),
    reason: row.reason,
    createdAt: row.created_at,
  };
}

function topupLogToRow(row: TopupLog): DbTopupLogRow {
  return {
    id: row.id,
    user_id: row.userId,
    amount: Number(row.amount ?? 0),
    status: row.status,
    created_at: row.createdAt,
  };
}

function rowToTopupLog(row: DbTopupLogRow): TopupLog {
  return {
    id: row.id,
    userId: row.user_id,
    amount: Number(row.amount ?? 0),
    status: row.status,
    createdAt: row.created_at,
  };
}

function rollToRow(row: RollHistory): DbRollHistoryRow {
  return {
    id: row.id,
    user_id: row.userId,
    reward_name: row.rewardName,
    machine_name: row.machineName,
    created_at: row.createdAt,
  };
}

function rowToRoll(row: DbRollHistoryRow): RollHistory {
  return {
    id: row.id,
    userId: row.user_id,
    rewardName: row.reward_name,
    machineName: row.machine_name,
    createdAt: row.created_at,
  };
}

function notificationToRow(row: AdminNotification): DbNotificationRow {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    is_read: Boolean(row.isRead),
    created_at: row.createdAt,
  };
}

function rowToNotification(row: DbNotificationRow): AdminNotification {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    isRead: Boolean(row.is_read),
    createdAt: row.created_at,
  };
}

function couponToRow(row: import("@/data/coupons").CouponRecord): DbCouponRow {
  return {
    id: row.id,
    code: row.code.toUpperCase(),
    type: row.type,
    discount_percent: row.type === "freeShipping" ? 100 : Math.max(1, Number(row.discountPercent ?? 1)),
    max_uses: Math.max(1, Number(row.maxUses ?? 1)),
    claimed_by_user_ids: row.claimedByUserIds,
    used_by_user_ids: row.usedByUserIds,
    created_at: row.createdAt,
    expires_at: row.expiresAt ?? null,
  };
}

function rowToCoupon(row: DbCouponRow): import("@/data/coupons").CouponRecord {
  return {
    id: row.id,
    code: row.code.toUpperCase(),
    type: row.type,
    discountPercent: row.type === "freeShipping" ? 100 : Math.max(1, Number(row.discount_percent ?? 1)),
    maxUses: Math.max(1, Number(row.max_uses ?? 1)),
    claimedByUserIds: Array.isArray(row.claimed_by_user_ids) ? row.claimed_by_user_ids : [],
    usedByUserIds: Array.isArray(row.used_by_user_ids) ? row.used_by_user_ids : [],
    createdAt: row.created_at,
    expiresAt: row.expires_at ?? undefined,
  };
}

async function upsertUsers(users: UserRecord[]) {
  if (users.length === 0) return;
  await upsertRows("users", users.map(userToRow), "id");
  await upsertRows("wallets", users.map(walletToRow), "user_id");
}

async function upsertPublicStore(store: Partial<PublicStoreSnapshot>) {
  if (!isSupabaseConfigured()) return;
  if (store.products) {
    const productRows = store.products.map(productToRow);
    await upsertRows("products", productRows, "id");
  }
  if (store.categories) {
    const categoryRows = store.categories.map(categoryToRow);
    await upsertRows("product_categories", categoryRows, "id");
  }
  if (store.popupAds) {
    const adRows = store.popupAds.map(adToRow);
    await upsertRows("popup_ads", adRows, "id");
  }
}

async function upsertSharedStore(store: Partial<SharedStoreSnapshot>) {
  if (!isSupabaseConfigured()) return;
  if (store.users && store.users.length > 0) await upsertUsers(normalizeUsers(store.users));
  if (store.orders && store.orders.length > 0) await upsertRows("orders", normalizeOrders(store.orders).map(orderToRow), "id");
  if (store.notifications && store.notifications.length > 0) {
    await upsertRows("admin_notifications", normalizeNotifications(store.notifications).map(notificationToRow), "id");
  }
  if (store.coupons && store.coupons.length > 0) {
    await upsertRows("coupons", normalizeCoupons(store.coupons).map(couponToRow), "code");
  }
  if (store.inventories) {
    const inventoryRows: DbInventoryRow[] = Object.entries(store.inventories).flatMap(([userId, items]) =>
      normalizeInventoryItems(items).map((item) => inventoryToRow(userId, item)),
    );
    if (inventoryRows.length > 0) await upsertRows("inventory", inventoryRows, "id");
  }
  if (store.shippingAddresses) {
    const addressRows: DbAddressRow[] = Object.entries(store.shippingAddresses).map(([userId, address]) =>
      addressToRow(userId, normalizeAddress(address)),
    );
    if (addressRows.length > 0) await upsertRows("shipping_addresses", addressRows, "user_id");
  }
  if (store.coinLogs && store.coinLogs.length > 0) {
    await upsertRows("coin_logs", normalizeCoinLogs(store.coinLogs).map(coinLogToRow), "id");
  }
  if (store.topupLogs && store.topupLogs.length > 0) {
    await upsertRows("topup_logs", normalizeTopupLogs(store.topupLogs).map(topupLogToRow), "id");
  }
  if (store.rollHistory && store.rollHistory.length > 0) {
    await upsertRows("roll_history", normalizeRollHistory(store.rollHistory).map(rollToRow), "id");
  }
}

function seedPublicStore(): PublicStoreSnapshot {
  return {
    products: [],
    categories: [
      { id: "gachapon", label: "กาชาปอง", createdAt: nowIso() },
      { id: "figure", label: "ฟิกเกอร์/โมเดล", createdAt: nowIso() },
      { id: "plush", label: "ตุ๊กตา", createdAt: nowIso() },
    ],
    popupAds: [],
  };
}

export async function getPublicStoreFromDatabase(): Promise<PublicStoreSnapshot> {
  if (!isSupabaseConfigured()) {
    return {
      products: [],
      categories: seedPublicStore().categories,
      popupAds: [],
    };
  }

  const [products, categories, popupAds] = await Promise.all([
    selectRows<DbProductRow>("products", "select=id,name,image,images,stock,price_coin,status,type,category_id,description,badges,pinned,discount_disabled,drop_items,created_at,updated_at&order=created_at.desc"),
    selectRows<DbCategoryRow>("product_categories", "select=id,label,created_at,updated_at&order=created_at.asc"),
    selectRows<DbPopupAdRow>("popup_ads", "select=id,image,title,placement,dismiss_hours,is_active,created_at,updated_at&order=created_at.desc"),
  ]);

  const normalizedProducts = products.length > 0 ? products.map(rowToProduct) : [];
  const normalizedCategories = categories.length > 0 ? categories.map(rowToCategory) : seedPublicStore().categories;
  const normalizedPopupAds = popupAds.length > 0 ? popupAds.map(rowToAd) : [];

  return {
    products: normalizedProducts,
    categories: normalizedCategories,
    popupAds: normalizedPopupAds,
  };
}

async function getPublicStoreFromDatabaseFallback(): Promise<PublicStoreSnapshot> {
  return {
    products: [],
    categories: seedPublicStore().categories,
    popupAds: [],
  };
}
export async function savePublicStoreToDatabase(store: Partial<PublicStoreSnapshot>) {
  if (!isSupabaseConfigured()) return;
  await upsertPublicStore({
    products: store.products?.map(normalizeProduct),
    categories: store.categories?.map(normalizeCategory),
    popupAds: store.popupAds?.map(normalizeAd),
  });
}

export async function deletePublicStoreRecord(kind: "product" | "category" | "popupAd", id: string) {
  if (!isSupabaseConfigured()) return;
  const tableByKind = {
    product: "products",
    category: "product_categories",
    popupAd: "popup_ads",
  } satisfies Record<typeof kind, string>;

  await deleteRowsByColumn(tableByKind[kind], "id", id);
}

export async function getSharedStoreFromDatabase(): Promise<SharedStoreSnapshot> {
  if (!isSupabaseConfigured()) {
    return {
      users: [],
      orders: [],
      notifications: [],
      coupons: [],
      inventories: {},
      shippingAddresses: {},
      coinLogs: [],
      topupLogs: [],
      rollHistory: [],
    };
  }

  const [users, wallets, orders, notifications, coupons, inventory, shippingAddresses, coinLogs, topupLogs, rollHistory] =
    await Promise.all([
      selectRows<DbUserRow>("users", "select=id,username,email,pin,phone,avatar_url,password_hash,role,suspended,created_at,updated_at&order=created_at.asc"),
      selectRows<DbWalletRow>("wallets", "select=user_id,coins,updated_at&order=updated_at.desc"),
      selectRows<DbOrderRow>("orders", "select=id,user_id,username,items,receiver_name,phone,address,tracking_number,status,shipping_fee,coupon_code,coupon_type,coupon_discount_percent,created_at,updated_at&order=created_at.desc"),
      selectRows<DbNotificationRow>("admin_notifications", "select=id,type,title,message,is_read,created_at&order=created_at.desc"),
      selectRows<DbCouponRow>("coupons", "select=id,code,type,discount_percent,max_uses,claimed_by_user_ids,used_by_user_ids,created_at,expires_at&order=created_at.desc"),
      selectRows<DbInventoryRow>("inventory", "select=id,user_id,reward_id,name,image,quantity,status,selected_for_shipping,selected_quantity,created_at,updated_at&order=updated_at.desc"),
      selectRows<DbAddressRow>("shipping_addresses", "select=user_id,receiver_name,phone,detail,house_no,road,province,district,subdistrict,postal_code,updated_at"),
      selectRows<DbCoinLogRow>("coin_logs", "select=id,user_id,admin_id,amount,reason,created_at&order=created_at.desc"),
      selectRows<DbTopupLogRow>("topup_logs", "select=id,user_id,amount,status,created_at&order=created_at.desc"),
      selectRows<DbRollHistoryRow>("roll_history", "select=id,user_id,reward_name,machine_name,created_at&order=created_at.desc"),
    ]);

  const walletByUserId = new Map(wallets.map((wallet) => [wallet.user_id, wallet]));

  return {
    users: users.map((user) => rowToUser(user, walletByUserId.get(user.id))),
    orders: orders.map(rowToOrder),
    notifications: notifications.map(rowToNotification),
    coupons: coupons.map(rowToCoupon),
    inventories: inventory.reduce<Record<string, InventoryItem[]>>((acc, row) => {
      if (!acc[row.user_id]) acc[row.user_id] = [];
      acc[row.user_id].push(rowToInventory(row));
      return acc;
    }, {}),
    shippingAddresses: shippingAddresses.reduce<Record<string, ShippingAddress>>((acc, row) => {
      acc[row.user_id] = rowToAddress(row);
      return acc;
    }, {}),
    coinLogs: coinLogs.map(rowToCoinLog),
    topupLogs: topupLogs.map(rowToTopupLog),
    rollHistory: rollHistory.map(rowToRoll),
  };
}

export async function saveSharedStoreToDatabase(store: Partial<SharedStoreSnapshot>) {
  if (!isSupabaseConfigured()) return;
  await upsertSharedStore({
    users: store.users?.map((user) => ({
      ...user,
      coins: Math.max(0, Number(user.coins ?? 0)),
      createdAt: user.createdAt || nowIso(),
    })),
    orders: store.orders?.map((order) => ({
      ...order,
      items: Array.isArray(order.items) ? order.items : [],
    })),
    notifications: store.notifications,
    coupons: store.coupons,
    inventories: store.inventories,
    shippingAddresses: store.shippingAddresses,
    coinLogs: store.coinLogs,
    topupLogs: store.topupLogs,
    rollHistory: store.rollHistory,
  });
}

function isBrokenAtomicRpcError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.includes("42702") || message.toLowerCase().includes("ambiguous");
}

function restEq(value: string) {
  return encodeURIComponent(value);
}

async function getWalletForUpdate(userId: string) {
  const query = `select=user_id,coins,updated_at&user_id=eq.${restEq(userId)}&limit=1`;
  const rows = await selectRows<DbWalletRow>("wallets", query);
  if (rows[0]) return rows[0];

  await supabaseRequest<DbWalletRow[]>("/rest/v1/wallets", {
    method: "POST",
    prefer: "return=representation",
    body: JSON.stringify([{ user_id: userId, coins: 0, updated_at: nowIso() }]),
  }).catch((error) => {
    const message = error instanceof Error ? error.message : String(error ?? "");
    if (!message.includes("23505") && !message.includes("duplicate")) throw error;
  });

  const createdRows = await selectRows<DbWalletRow>("wallets", query);
  if (!createdRows[0]) throw new Error("WALLET_NOT_FOUND");
  return createdRows[0];
}

async function updateWalletWithExpectedCoins(userId: string, currentCoins: number, nextCoins: number) {
  return supabaseRequest<DbWalletRow[]>(
    `/rest/v1/wallets?user_id=eq.${restEq(userId)}&coins=eq.${currentCoins}`,
    {
      method: "PATCH",
      prefer: "return=representation",
      body: JSON.stringify({ coins: nextCoins, updated_at: nowIso() }),
    },
  );
}

async function getProductStockForUpdate(productId: string) {
  const rows = await selectRows<ProductStockRow>(
    "products",
    `select=id,stock&id=eq.${restEq(productId)}&limit=1`,
  );
  if (!rows[0]) throw new Error("PRODUCT_NOT_FOUND");
  return rows[0];
}

async function updateProductStockWithExpectedStock(productId: string, currentStock: number, nextStock: number) {
  return supabaseRequest<ProductStockRow[]>(
    `/rest/v1/products?id=eq.${restEq(productId)}&stock=eq.${currentStock}`,
    {
      method: "PATCH",
      prefer: "return=representation",
      body: JSON.stringify({ stock: nextStock, updated_at: nowIso() }),
    },
  );
}

async function logStockMovement(productId: string, delta: number, reason: string) {
  await supabaseRequest<null>("/rest/v1/stock_movements", {
    method: "POST",
    prefer: "return=minimal",
    body: JSON.stringify([{ product_id: productId, delta, reason }]),
  }).catch(() => undefined);
}

async function logCoinMovement(userId: string, delta: number, reason: string) {
  await supabaseRequest<null>("/rest/v1/coin_logs", {
    method: "POST",
    prefer: "return=minimal",
    body: JSON.stringify([
      {
        id: makeId("coin"),
        user_id: userId,
        admin_id: "",
        amount: delta,
        reason,
        created_at: nowIso(),
      },
    ]),
  }).catch(() => undefined);
}

async function adjustWalletBalanceViaRestFallback(userId: string, delta: number, reason = ""): Promise<WalletRpcRow> {
  const wallet = await getWalletForUpdate(userId);
  const currentCoins = Math.max(0, Number(wallet.coins ?? 0));
  const nextCoins = currentCoins + delta;
  if (nextCoins < 0) throw new Error("INSUFFICIENT_COINS");

  const updatedRows = await updateWalletWithExpectedCoins(userId, currentCoins, nextCoins);
  const updated = updatedRows[0];
  if (!updated) throw new Error("WALLET_CONFLICT_RETRY");

  await logCoinMovement(userId, delta, reason);
  return { user_id: userId, coins: Number(updated.coins ?? nextCoins) };
}

async function adjustProductStockViaRestFallback(productId: string, delta: number): Promise<StockRpcRow> {
  const product = await getProductStockForUpdate(productId);
  const currentStock = Math.max(0, Number(product.stock ?? 0));
  const nextStock = currentStock + delta;
  if (nextStock < 0) throw new Error("INSUFFICIENT_STOCK");

  const updatedRows = await updateProductStockWithExpectedStock(productId, currentStock, nextStock);
  const updated = updatedRows[0];
  if (!updated) throw new Error("STOCK_CONFLICT_RETRY");

  await logStockMovement(productId, delta, "adjustment-fallback");
  return { product_id: productId, stock: Number(updated.stock ?? nextStock) };
}

async function purchaseProductViaRestFallback(userId: string, productId: string, priceCoin: number): Promise<PurchaseRpcRow> {
  const wallet = await getWalletForUpdate(userId);
  const product = await getProductStockForUpdate(productId);
  const currentCoins = Math.max(0, Number(wallet.coins ?? 0));
  const currentStock = Math.max(0, Number(product.stock ?? 0));

  if (currentCoins < priceCoin) throw new Error("INSUFFICIENT_COINS");
  if (currentStock <= 0) throw new Error("INSUFFICIENT_STOCK");

  const nextStock = currentStock - 1;
  const productRows = await updateProductStockWithExpectedStock(productId, currentStock, nextStock);
  const updatedProduct = productRows[0];
  if (!updatedProduct) throw new Error("INSUFFICIENT_STOCK");

  const nextBalance = currentCoins - priceCoin;
  const walletRows = await updateWalletWithExpectedCoins(userId, currentCoins, nextBalance);
  const updatedWallet = walletRows[0];
  if (!updatedWallet) {
    await updateProductStockWithExpectedStock(productId, nextStock, currentStock).catch(() => undefined);
    throw new Error("INSUFFICIENT_COINS");
  }

  await logStockMovement(productId, -1, "purchase-fallback");
  await logCoinMovement(userId, -priceCoin, "purchase-fallback");

  return {
    user_id: userId,
    product_id: productId,
    next_balance: Number(updatedWallet.coins ?? nextBalance),
    next_stock: Number(updatedProduct.stock ?? nextStock),
  };
}

export async function adjustWalletBalanceAtomic(userId: string, delta: number, reason = "") {
  try {
    return await callRpc<WalletRpcRow>("adjust_wallet_balance", {
      target_user_id: userId,
      coin_delta: delta,
      reason,
    });
  } catch (error) {
    if (isBrokenAtomicRpcError(error)) {
      return adjustWalletBalanceViaRestFallback(userId, delta, reason);
    }
    throw error;
  }
}

export async function adjustProductStockAtomic(productId: string, delta: number) {
  try {
    return await callRpc<StockRpcRow>("adjust_product_stock", {
      target_product_id: productId,
      stock_delta: delta,
    });
  } catch (error) {
    if (isBrokenAtomicRpcError(error)) {
      return adjustProductStockViaRestFallback(productId, delta);
    }
    throw error;
  }
}

export async function purchaseProductAtomic(userId: string, productId: string, priceCoin: number) {
  try {
    return await callRpc<PurchaseRpcRow>("purchase_product_atomic", {
      target_user_id: userId,
      target_product_id: productId,
      price_coin: priceCoin,
    });
  } catch (error) {
    if (isBrokenAtomicRpcError(error)) {
      return purchaseProductViaRestFallback(userId, productId, priceCoin);
    }
    throw error;
  }
}


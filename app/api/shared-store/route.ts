import { mkdir, readFile, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { NextResponse } from "next/server";
import type { CouponRecord, CouponType } from "@/data/coupons";
import type { ShippingAddress } from "@/data/address";
import type { InventoryItem, InventoryStatus } from "@/data/inventory";
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
} from "@/data/mockDb";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SharedStore = {
  users: UserRecord[];
  orders: OrderRecord[];
  notifications: AdminNotification[];
  coupons: CouponRecord[];
  inventories: Record<string, InventoryItem[]>;
  shippingAddresses: Record<string, ShippingAddress>;
  coinLogs: CoinLog[];
  topupLogs: TopupLog[];
  rollHistory: RollHistory[];
};

const runtimeStorePath = path.join(os.tmpdir(), "gacha-pop-mock-shared-store.json");
const MAX_INLINE_IMAGE_LENGTH = 360000;
const MAX_INVENTORY_QUANTITY = 999;

function compactImage(image: unknown) {
  const nextImage = String(image ?? "").trim();
  if (!nextImage.startsWith("data:image/")) return nextImage;
  return nextImage.length <= MAX_INLINE_IMAGE_LENGTH ? nextImage : "/hero-machine.png";
}

function normalizeQuantity(value: unknown) {
  const quantity = Number(value);
  if (!Number.isFinite(quantity) || quantity > MAX_INVENTORY_QUANTITY) return 1;
  return Math.max(1, Math.floor(quantity));
}

function normalizeUsers(users: UserRecord[] | undefined): UserRecord[] {
  if (!Array.isArray(users)) return [];

  return users
    .filter((user): user is UserRecord => Boolean(user) && typeof user === "object")
    .map((user) => ({
      id: String(user.id || ""),
      username: String(user.username || "").trim(),
      email: String(user.email || "").trim().toLowerCase(),
      pin: String(user.pin || ""),
      passwordHash: String(user.passwordHash || ""),
      role: user.role === "admin" ? ("admin" as UserRole) : ("user" as UserRole),
      coins: Math.max(0, Number(user.coins || 0)),
      coinUpdatedAt: String(user.coinUpdatedAt || user.createdAt || new Date().toISOString()),
      suspended: Boolean(user.suspended),
      createdAt: String(user.createdAt || new Date().toISOString()),
    }))
    .filter((user) => user.id && user.username && user.email && user.passwordHash);
}

function normalizeOrders(orders: OrderRecord[] | undefined): OrderRecord[] {
  if (!Array.isArray(orders)) return [];

  return orders
    .filter((order): order is OrderRecord => Boolean(order) && typeof order === "object")
    .map((order) => {
      const status: OrderStatus =
        order.status === "shipped" ? "shipped" : order.status === "shipping" ? "shipping" : "pending";

      return {
      id: String(order.id || ""),
      userId: String(order.userId || ""),
      username: String(order.username || ""),
      items: Array.isArray(order.items)
        ? order.items.map((item) => ({
            id: String(item.id || ""),
            inventoryItemId: String(item.inventoryItemId || ""),
            name: String(item.name || ""),
            image: compactImage(item.image) || "/hero-machine.png",
            quantity: normalizeQuantity(item.quantity || 1),
          }))
        : [],
      receiverName: String(order.receiverName || ""),
      phone: String(order.phone || ""),
      address: String(order.address || ""),
      trackingNumber: String(order.trackingNumber || ""),
      status,
      shippingFee: Math.max(0, Number(order.shippingFee || 0)),
      couponCode: order.couponCode ? String(order.couponCode) : undefined,
      couponType: order.couponType === "discount" || order.couponType === "freeShipping" ? order.couponType : undefined,
      couponDiscountPercent: Number.isFinite(Number(order.couponDiscountPercent)) ? Number(order.couponDiscountPercent) : undefined,
      createdAt: String(order.createdAt || new Date().toISOString()),
      };
    })
    .filter((order) => order.id && order.userId);
}

function normalizeNotifications(notifications: AdminNotification[] | undefined): AdminNotification[] {
  if (!Array.isArray(notifications)) return [];

  return notifications
    .filter((notification): notification is AdminNotification => Boolean(notification) && typeof notification === "object")
    .map((notification) => {
      const type: NotificationType =
        notification.type === "coin" || notification.type === "stock" || notification.type === "auth"
          ? notification.type
          : "order";

      return {
      id: String(notification.id || ""),
      type,
      title: String(notification.title || ""),
      message: String(notification.message || ""),
      isRead: Boolean(notification.isRead),
      createdAt: String(notification.createdAt || new Date().toISOString()),
      };
    })
    .filter((notification) => notification.id);
}

function normalizeCoupons(coupons: CouponRecord[] | undefined): CouponRecord[] {
  if (!Array.isArray(coupons)) return [];

  return coupons
    .filter((coupon): coupon is CouponRecord => Boolean(coupon) && typeof coupon === "object")
    .map((coupon) => {
      const type: CouponType = coupon.type === "freeShipping" ? "freeShipping" : "discount";
      return {
        id: String(coupon.id || ""),
        code: String(coupon.code || "").trim().toUpperCase(),
        type,
        discountPercent: type === "freeShipping" ? 100 : Math.min(100, Math.max(1, Number(coupon.discountPercent || 1))),
        maxUses: Math.max(1, Number(coupon.maxUses || 1)),
        claimedByUserIds: Array.isArray(coupon.claimedByUserIds)
          ? Array.from(new Set(coupon.claimedByUserIds.map((item) => String(item)).filter(Boolean)))
          : [],
        usedByUserIds: Array.isArray(coupon.usedByUserIds)
          ? Array.from(new Set(coupon.usedByUserIds.map((item) => String(item)).filter(Boolean)))
          : [],
        createdAt: String(coupon.createdAt || new Date().toISOString()),
        expiresAt: coupon.expiresAt ? String(coupon.expiresAt) : undefined,
      };
    })
    .filter((coupon) => coupon.id && coupon.code);
}

function normalizeInventoryItems(value: unknown): InventoryItem[] {
  if (!Array.isArray(value)) return [];

  const normalizedItems = value
    .filter((item): item is Partial<InventoryItem> => Boolean(item) && typeof item === "object")
    .map((item) => {
      const status: InventoryStatus =
        item.status === "shipping" ? "shipping" : item.status === "shipped" ? "shipped" : "pending";
      const quantity = normalizeQuantity(item.quantity ?? 1);
      const selectedQuantity = Math.min(quantity, normalizeQuantity(item.selectedQuantity ?? 1));

      return {
        id: String(item.id ?? item.rewardId ?? ""),
        rewardId: String(item.rewardId ?? item.id ?? ""),
        name: String(item.name ?? ""),
        image: compactImage(item.image) || "/hero-machine.png",
        quantity,
        status,
        selectedForShipping: Boolean(item.selectedForShipping) && status === "pending",
        selectedQuantity: Boolean(item.selectedForShipping) && status === "pending" ? selectedQuantity : undefined,
      };
    })
    .filter((item) => item.id && item.rewardId && item.name);

  return mergeInventoryItems([], normalizedItems);
}

function normalizeInventories(value: unknown): Record<string, InventoryItem[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, InventoryItem[]>>((acc, [userId, items]) => {
    const normalizedItems = normalizeInventoryItems(items);
    if (userId && normalizedItems.length > 0) acc[userId] = normalizedItems;
    return acc;
  }, {});
}

function normalizeShippingAddress(address: Partial<ShippingAddress> | null | undefined): ShippingAddress {
  return {
    receiverName: String(address?.receiverName ?? ""),
    phone: String(address?.phone ?? ""),
    detail: String(address?.detail ?? ""),
    houseNo: String(address?.houseNo ?? ""),
    road: String(address?.road ?? ""),
    province: String(address?.province ?? ""),
    district: String(address?.district ?? ""),
    subdistrict: String(address?.subdistrict ?? ""),
    postalCode: String(address?.postalCode ?? ""),
  };
}

function normalizeShippingAddresses(value: unknown): Record<string, ShippingAddress> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return Object.entries(value as Record<string, Partial<ShippingAddress>>).reduce<Record<string, ShippingAddress>>(
    (acc, [userId, address]) => {
      if (userId) acc[userId] = normalizeShippingAddress(address);
      return acc;
    },
    {},
  );
}

function normalizeCoinLogs(logs: CoinLog[] | undefined): CoinLog[] {
  if (!Array.isArray(logs)) return [];
  return logs
    .filter((log): log is CoinLog => Boolean(log) && typeof log === "object")
    .map((log) => ({
      id: String(log.id || ""),
      userId: String(log.userId || ""),
      adminId: String(log.adminId || ""),
      amount: Number(log.amount || 0),
      reason: String(log.reason || ""),
      createdAt: String(log.createdAt || new Date().toISOString()),
    }))
    .filter((log) => log.id && log.userId);
}

function normalizeTopupLogs(logs: TopupLog[] | undefined): TopupLog[] {
  if (!Array.isArray(logs)) return [];
  return logs
    .filter((log): log is TopupLog => Boolean(log) && typeof log === "object")
    .map((log) => {
      const status: TopupLog["status"] = log.status === "pending" ? "pending" : "success";
      return {
        id: String(log.id || ""),
        userId: String(log.userId || ""),
        amount: Number(log.amount || 0),
        status,
        createdAt: String(log.createdAt || new Date().toISOString()),
      };
    })
    .filter((log) => log.id && log.userId);
}

function normalizeRollHistory(history: RollHistory[] | undefined): RollHistory[] {
  if (!Array.isArray(history)) return [];
  return history
    .filter((item): item is RollHistory => Boolean(item) && typeof item === "object")
    .map((item) => ({
      id: String(item.id || ""),
      userId: String(item.userId || ""),
      rewardName: String(item.rewardName || ""),
      machineName: String(item.machineName || ""),
      createdAt: String(item.createdAt || new Date().toISOString()),
    }))
    .filter((item) => item.id && item.userId);
}

function normalizeStore(store: Partial<SharedStore> | null | undefined): SharedStore {
  return {
    users: normalizeUsers(store?.users),
    orders: normalizeOrders(store?.orders),
    notifications: normalizeNotifications(store?.notifications),
    coupons: normalizeCoupons(store?.coupons),
    inventories: normalizeInventories(store?.inventories),
    shippingAddresses: normalizeShippingAddresses(store?.shippingAddresses),
    coinLogs: normalizeCoinLogs(store?.coinLogs),
    topupLogs: normalizeTopupLogs(store?.topupLogs),
    rollHistory: normalizeRollHistory(store?.rollHistory),
  };
}

function mergeById<T extends { id: string }>(current: T[], incoming: T[]) {
  const map = new Map<string, T>();
  current.forEach((item) => map.set(item.id, item));
  incoming.forEach((item) => map.set(item.id, { ...map.get(item.id), ...item }));
  return Array.from(map.values());
}

function coinUpdatedTime(user: Pick<UserRecord, "coinUpdatedAt" | "createdAt">) {
  const timestamp = Date.parse(user.coinUpdatedAt ?? user.createdAt ?? "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function mergeUserRecord(current: UserRecord | undefined, incoming: UserRecord) {
  if (!current) return incoming;

  const currentCoinTime = coinUpdatedTime(current);
  const incomingCoinTime = coinUpdatedTime(incoming);
  const coinSource =
    incomingCoinTime > currentCoinTime
      ? incoming
      : currentCoinTime > incomingCoinTime
        ? current
        : Number(incoming.coins) > Number(current.coins)
          ? incoming
          : current;

  return {
    ...current,
    ...incoming,
    coins: Math.max(0, Number(coinSource.coins || 0)),
    coinUpdatedAt: coinSource.coinUpdatedAt ?? coinSource.createdAt ?? new Date().toISOString(),
  };
}

function mergeUsers(current: UserRecord[], incoming: UserRecord[]) {
  const map = new Map<string, UserRecord>();
  current.forEach((user) => map.set(user.id, user));
  incoming.forEach((user) => map.set(user.id, mergeUserRecord(map.get(user.id), user)));
  return Array.from(map.values());
}

function orderStatusRank(status: OrderStatus) {
  return status === "shipped" ? 2 : status === "shipping" ? 1 : 0;
}

function mergeOrders(current: OrderRecord[], incoming: OrderRecord[]) {
  const map = new Map<string, OrderRecord>();
  current.forEach((order) => map.set(order.id, order));
  incoming.forEach((order) => {
    const saved = map.get(order.id);
    if (!saved) {
      map.set(order.id, order);
      return;
    }

    const nextOrder =
      orderStatusRank(order.status) >= orderStatusRank(saved.status)
        ? { ...saved, ...order, trackingNumber: order.trackingNumber || saved.trackingNumber }
        : { ...order, ...saved, trackingNumber: saved.trackingNumber || order.trackingNumber };
    map.set(order.id, nextOrder);
  });

  return Array.from(map.values()).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

function mergeNotifications(current: AdminNotification[], incoming: AdminNotification[]) {
  const map = new Map<string, AdminNotification>();
  current.forEach((notification) => map.set(notification.id, notification));
  incoming.forEach((notification) => {
    const saved = map.get(notification.id);
    map.set(notification.id, saved ? { ...saved, ...notification, isRead: saved.isRead || notification.isRead } : notification);
  });
  return Array.from(map.values()).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

function mergeCoupons(current: CouponRecord[], incoming: CouponRecord[]) {
  const map = new Map<string, CouponRecord>();
  current.forEach((coupon) => map.set(coupon.code.toUpperCase(), coupon));
  incoming.forEach((coupon) => {
    const saved = map.get(coupon.code.toUpperCase());
    map.set(
      coupon.code.toUpperCase(),
      saved
        ? {
            ...saved,
            ...coupon,
            id: saved.id || coupon.id,
            expiresAt: coupon.expiresAt ?? saved.expiresAt,
            claimedByUserIds: Array.from(new Set([...(saved.claimedByUserIds ?? []), ...(coupon.claimedByUserIds ?? [])])),
            usedByUserIds: Array.from(new Set([...(saved.usedByUserIds ?? []), ...(coupon.usedByUserIds ?? [])])),
          }
        : coupon,
    );
  });
  return Array.from(map.values()).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

function mergeInventoryItems(current: InventoryItem[], incoming: InventoryItem[]) {
  const byId = new Map<string, InventoryItem>();

  [...current, ...incoming].forEach((item) => {
    const saved = byId.get(item.id);
    if (!saved) {
      byId.set(item.id, item);
      return;
    }

    const nextStatus =
      orderStatusRank(item.status) >= orderStatusRank(saved.status) ? item.status : saved.status;
    const quantity = Math.max(normalizeQuantity(saved.quantity), normalizeQuantity(item.quantity));
    const selectedForShipping = nextStatus === "pending" && (saved.selectedForShipping || item.selectedForShipping);
    const selectedQuantity = Math.min(
      quantity,
      Math.max(normalizeQuantity(saved.selectedQuantity), normalizeQuantity(item.selectedQuantity)),
    );

    byId.set(item.id, {
      ...saved,
      image: saved.image || item.image || "/hero-machine.png",
      quantity,
      status: nextStatus,
      selectedForShipping,
      selectedQuantity: selectedForShipping ? selectedQuantity : undefined,
    });
  });

  const map = new Map<string, InventoryItem>();

  byId.forEach((item) => {
    const key = item.status === "pending" ? `${item.status}:${item.rewardId}:${item.name}` : `${item.status}:${item.id}`;
    const saved = map.get(key);
    if (!saved) {
      map.set(key, item);
      return;
    }

    const quantity = Math.max(normalizeQuantity(saved.quantity), normalizeQuantity(item.quantity));
    const selectedForShipping = saved.status === "pending" && (saved.selectedForShipping || item.selectedForShipping);
    const selectedQuantity = Math.min(
      quantity,
      Math.max(normalizeQuantity(saved.selectedQuantity), normalizeQuantity(item.selectedQuantity)),
    );

    map.set(key, {
      ...saved,
      image: saved.image || item.image || "/hero-machine.png",
      quantity,
      selectedForShipping,
      selectedQuantity: selectedForShipping ? selectedQuantity : undefined,
    });
  });

  return Array.from(map.values());
}

function mergeInventories(current: Record<string, InventoryItem[]>, incoming: Record<string, InventoryItem[]>) {
  const userIds = new Set([...Object.keys(current), ...Object.keys(incoming)]);
  const next: Record<string, InventoryItem[]> = {};
  userIds.forEach((userId) => {
    next[userId] = mergeInventoryItems(current[userId] ?? [], incoming[userId] ?? []);
  });
  return next;
}

function mergeRecords<T>(current: Record<string, T>, incoming: Record<string, T>) {
  return { ...current, ...incoming };
}

function mergeLogsById<T extends { id: string; createdAt: string }>(current: T[], incoming: T[]) {
  const map = new Map<string, T>();
  current.forEach((item) => map.set(item.id, item));
  incoming.forEach((item) => map.set(item.id, { ...map.get(item.id), ...item }));
  return Array.from(map.values()).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

async function readStore() {
  try {
    const raw = await readFile(runtimeStorePath, "utf8");
    return normalizeStore(JSON.parse(raw) as Partial<SharedStore>);
  } catch {
    return normalizeStore(null);
  }
}

async function writeStore(store: SharedStore) {
  await mkdir(path.dirname(runtimeStorePath), { recursive: true });
  await writeFile(runtimeStorePath, JSON.stringify(normalizeStore(store), null, 2), "utf8");
}

export async function GET() {
  return NextResponse.json(await readStore());
}

export async function POST(request: Request) {
  const current = await readStore();
  const body = (await request.json()) as Partial<SharedStore>;
  const incoming = normalizeStore(body);
  const next = normalizeStore({
    users: body.users ? mergeUsers(current.users, incoming.users) : current.users,
    orders: body.orders ? mergeOrders(current.orders, incoming.orders) : current.orders,
    notifications: body.notifications ? mergeNotifications(current.notifications, incoming.notifications) : current.notifications,
    coupons: body.coupons ? mergeCoupons(current.coupons, incoming.coupons) : current.coupons,
    inventories: body.inventories ? mergeInventories(current.inventories, incoming.inventories) : current.inventories,
    shippingAddresses: body.shippingAddresses
      ? mergeRecords(current.shippingAddresses, incoming.shippingAddresses)
      : current.shippingAddresses,
    coinLogs: body.coinLogs ? mergeLogsById(current.coinLogs, incoming.coinLogs) : current.coinLogs,
    topupLogs: body.topupLogs ? mergeLogsById(current.topupLogs, incoming.topupLogs) : current.topupLogs,
    rollHistory: body.rollHistory ? mergeLogsById(current.rollHistory, incoming.rollHistory) : current.rollHistory,
  });

  await writeStore(next);
  return NextResponse.json(next);
}

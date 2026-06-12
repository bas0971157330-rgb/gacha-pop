import type { RollReward } from "@/data/rewards";

export const INVENTORY_STORAGE_KEY = "gacha_inventory";
const CURRENT_USER_STORAGE_KEY = "gacha_current_user_id";
const SESSION_USER_STORAGE_KEY = "gacha_session_user_id";

export type InventoryStatus = "pending" | "shipping" | "shipped";

export type InventoryItem = {
  id: string;
  rewardId: string;
  name: string;
  image: string;
  quantity: number;
  status: InventoryStatus;
  selectedForShipping: boolean;
  selectedQuantity?: number;
};

type OrderStatusLike = "pending" | "shipping" | "shipped";
const FALLBACK_INVENTORY_IMAGE = "/hero-machine.png";
const MAX_INVENTORY_QUANTITY = 999;

type SaveInventoryOptions = {
  syncRemote?: boolean;
  notify?: boolean;
};

type InventorySharedStoreSnapshot = {
  inventories?: Record<string, InventoryItem[]>;
};

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function getActiveUserId() {
  if (!canUseStorage()) return "";
  return window.sessionStorage.getItem(SESSION_USER_STORAGE_KEY) ?? window.localStorage.getItem(CURRENT_USER_STORAGE_KEY) ?? "";
}

export function createInventoryItemId(prefix: string) {
  const safePrefix = String(prefix || "inventory").replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") || "inventory";
  const randomPart =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return `${safePrefix}-${randomPart}`;
}

function normalizeQuantity(value: unknown) {
  const quantity = Number(value);
  if (!Number.isFinite(quantity) || quantity > MAX_INVENTORY_QUANTITY) return 1;
  return Math.max(1, Math.floor(quantity));
}

function statusPriority(status: InventoryStatus) {
  return status === "shipped" ? 2 : status === "shipping" ? 1 : 0;
}

function mergeInventoryRecord(current: InventoryItem, incoming: InventoryItem) {
  const nextStatus: InventoryStatus =
    statusPriority(incoming.status) >= statusPriority(current.status) ? incoming.status : current.status;
  const quantity = Math.max(normalizeQuantity(current.quantity), normalizeQuantity(incoming.quantity));
  const selectedForShipping = nextStatus === "pending" && (current.selectedForShipping || incoming.selectedForShipping);
  const selectedQuantity = selectedForShipping
    ? Math.min(
        quantity,
        Math.max(normalizeQuantity(current.selectedQuantity), normalizeQuantity(incoming.selectedQuantity)),
      )
    : undefined;

  return {
    ...current,
    ...incoming,
    image: current.image || incoming.image || FALLBACK_INVENTORY_IMAGE,
    quantity,
    status: nextStatus,
    selectedForShipping,
    selectedQuantity,
  };
}

export function getInventoryStorageKey(userId = getActiveUserId()) {
  return userId ? `${INVENTORY_STORAGE_KEY}:${userId}` : "";
}

export function mergeInventoryItems(items: InventoryItem[]) {
  const mergedById = new Map<string, InventoryItem>();

  items.forEach((item) => {
    const id = String(item.id ?? "").trim();
    if (!id) return;

    const current = mergedById.get(id);
    mergedById.set(id, current ? mergeInventoryRecord(current, item) : item);
  });

  const merged = new Map<string, InventoryItem>();

  mergedById.forEach((item) => {
    const key =
      item.status === "pending" ? `${item.status}:${item.rewardId}:${item.name}` : `${item.status}:${item.id}`;
    const current = merged.get(key);
    merged.set(key, current ? mergeInventoryRecord(current, item) : item);
  });

  return Array.from(merged.values());
}

function normalizeInventory(value: unknown): InventoryItem[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is Partial<InventoryItem> => Boolean(item) && typeof item === "object")
    .map((item) => {
      const status: InventoryStatus =
        item.status === "shipping" ? "shipping" : item.status === "shipped" ? "shipped" : "pending";

      const quantity = normalizeQuantity(item.quantity ?? 1);
      const selectedQuantity = Math.min(quantity, normalizeQuantity(item.selectedQuantity ?? 1));

      const image = String(item.image ?? "").trim() || FALLBACK_INVENTORY_IMAGE;

      return {
        id: String(item.id ?? item.rewardId ?? ""),
        rewardId: String(item.rewardId ?? item.id ?? ""),
        name: String(item.name ?? ""),
        image,
        quantity,
        status,
        selectedForShipping: Boolean(item.selectedForShipping) && status === "pending",
        selectedQuantity: Boolean(item.selectedForShipping) && status === "pending" ? selectedQuantity : undefined,
      };
    })
    .filter((item) => item.id && item.rewardId && item.name);
}

export function getInventory(userId?: string) {
  if (!canUseStorage()) return [];
  const inventoryKey = getInventoryStorageKey(userId);
  if (!inventoryKey) return [];

  try {
    const userInventory = normalizeInventory(JSON.parse(window.localStorage.getItem(inventoryKey) ?? "[]"));
    const legacyInventory = normalizeInventory(JSON.parse(window.localStorage.getItem(INVENTORY_STORAGE_KEY) ?? "[]"));
    const mergedInventory = mergeInventoryItems([...userInventory, ...legacyInventory]);
    const currentSerializedInventory = window.localStorage.getItem(inventoryKey);
    const normalizedSerializedInventory = JSON.stringify(mergedInventory);

    if (legacyInventory.length > 0 || currentSerializedInventory !== normalizedSerializedInventory) {
      window.localStorage.setItem(inventoryKey, normalizedSerializedInventory);
      window.localStorage.removeItem(INVENTORY_STORAGE_KEY);
    }

    if (window.localStorage.getItem(inventoryKey) !== null) return mergedInventory;

    if (legacyInventory.length > 0) {
      window.localStorage.setItem(inventoryKey, JSON.stringify(legacyInventory));
      window.localStorage.removeItem(INVENTORY_STORAGE_KEY);
    }

    return legacyInventory;
  } catch {
    return [];
  }
}

function syncInventoryToSharedStore(userId: string, inventory: InventoryItem[]) {
  if (!userId || typeof fetch === "undefined") return;

  fetch("/api/shared-store", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ inventories: { [userId]: normalizeInventory(inventory) } }),
    keepalive: true,
  }).catch(() => undefined);
}

export async function syncInventoryFromServer(userId = getActiveUserId(), options: SaveInventoryOptions = {}) {
  const shouldNotify = options.notify ?? false;
  if (!canUseStorage() || !userId) return [];

  try {
    const response = await fetch("/api/shared-store", { cache: "no-store" });
    if (!response.ok) return getInventory(userId);

    const snapshot = (await response.json()) as InventorySharedStoreSnapshot;
    const remoteInventory = normalizeInventory(snapshot.inventories?.[userId] ?? []);
    const localInventory = getInventory(userId);
    const nextInventory = remoteInventory.length > 0 ? remoteInventory : localInventory;

    saveInventory(nextInventory, userId, { syncRemote: false, notify: shouldNotify });

    return nextInventory;
  } catch {
    return getInventory(userId);
  }
}

export function saveInventory(inventory: InventoryItem[], userId?: string, options: SaveInventoryOptions = {}) {
  if (!canUseStorage()) return;
  const inventoryKey = getInventoryStorageKey(userId);
  if (!inventoryKey) return;
  const activeUserId = userId || getActiveUserId();
  const normalizedInventory = mergeInventoryItems(normalizeInventory(inventory));

  window.localStorage.setItem(inventoryKey, JSON.stringify(normalizedInventory));
  window.localStorage.removeItem(INVENTORY_STORAGE_KEY);
  if (options.syncRemote ?? true) syncInventoryToSharedStore(activeUserId, normalizedInventory);
  if (options.notify ?? true) window.dispatchEvent(new CustomEvent("gacha-inventory-updated"));
}

export function addRewardToInventory(reward: RollReward) {
  const rewardImage = String(reward.image ?? "").trim() || FALLBACK_INVENTORY_IMAGE;
  const inventory = getInventory();
  const pendingItem = inventory.find((item) => item.rewardId === reward.id && item.status === "pending");

  if (pendingItem) {
    const nextInventory = inventory.map((item) =>
      item.id === pendingItem.id
        ? { ...item, image: item.image || rewardImage, quantity: item.quantity + 1, selectedForShipping: false }
        : item,
    );
    saveInventory(nextInventory);
    return nextInventory;
  }

  const hasShippedStack = inventory.some((item) => item.rewardId === reward.id);
  const nextInventory = [
    ...inventory,
    {
      id: hasShippedStack ? createInventoryItemId(reward.id) : reward.id,
      rewardId: reward.id,
      name: reward.name,
      image: rewardImage,
      quantity: 1,
      status: "pending" as const,
      selectedForShipping: false,
    },
  ];

  saveInventory(nextInventory);
  return nextInventory;
}

export function markInventoryItemsForOrderStatus(
  orderItems: Array<{ inventoryItemId?: string; id?: string; rewardId?: string; name?: string }>,
  status: Extract<InventoryStatus, "shipping" | "shipped">,
  userId?: string,
) {
  const orderInventoryIds = new Set(orderItems.map((item) => String(item.inventoryItemId ?? "")).filter(Boolean));
  const orderRewardIds = new Set(orderItems.map((item) => String(item.id ?? item.rewardId ?? "")).filter(Boolean));
  const orderNames = new Set(orderItems.map((item) => String(item.name ?? "")).filter(Boolean));

  if (orderInventoryIds.size === 0 && orderRewardIds.size === 0 && orderNames.size === 0) return getInventory(userId);

  const inventory = getInventory(userId);
  const nextInventory = inventory.map((item) => {
    const matchesOrderItem = orderInventoryIds.size > 0
      ? orderInventoryIds.has(item.id)
      : orderRewardIds.has(item.rewardId) || orderNames.has(item.name);
    if (!matchesOrderItem || item.status !== "shipping") return item;

    return { ...item, status, selectedForShipping: false };
  });

  saveInventory(nextInventory, userId);
  return nextInventory;
}

export function syncInventoryStatusesFromOrders(
  orders: Array<{
    status: OrderStatusLike;
    items: Array<{ inventoryItemId?: string; id?: string; rewardId?: string; name?: string }>;
  }>,
  userId?: string,
) {
  const statusByInventoryId = new Map<string, Extract<InventoryStatus, "shipping" | "shipped">>();
  const statusByRewardId = new Map<string, Extract<InventoryStatus, "shipping" | "shipped">>();
  const statusByName = new Map<string, Extract<InventoryStatus, "shipping" | "shipped">>();

  orders.forEach((order) => {
    const nextStatus: Extract<InventoryStatus, "shipping" | "shipped"> =
      order.status === "shipped" ? "shipped" : "shipping";

    order.items.forEach((item) => {
      const inventoryItemId = String(item.inventoryItemId ?? "").trim();
      const rewardId = String(item.id ?? item.rewardId ?? "").trim();
      const name = String(item.name ?? "").trim();

      if (inventoryItemId) statusByInventoryId.set(inventoryItemId, nextStatus);
      if (rewardId) statusByRewardId.set(rewardId, nextStatus);
      if (name) statusByName.set(name, nextStatus);
    });
  });

  if (statusByInventoryId.size === 0 && statusByRewardId.size === 0 && statusByName.size === 0) return getInventory(userId);

  let hasChanges = false;
  const inventory = getInventory(userId);
  const nextInventory = inventory.map((item) => {
    if (item.status !== "shipping") return item;

    const nextStatus = statusByInventoryId.get(item.id) ?? statusByRewardId.get(item.rewardId) ?? statusByName.get(item.name);
    if (!nextStatus || nextStatus === item.status) return item;

    hasChanges = true;
    return { ...item, status: nextStatus, selectedForShipping: false };
  });

  if (hasChanges) {
    saveInventory(nextInventory, userId);
    return nextInventory;
  }

  return inventory;
}

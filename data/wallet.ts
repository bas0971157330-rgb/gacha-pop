export const DEFAULT_COIN_BALANCE = 0;
export const SHIPPING_FEE = 30;

const USERS_STORAGE_KEY = "gacha_users";
const CURRENT_USER_STORAGE_KEY = "gacha_current_user_id";
const SESSION_USER_STORAGE_KEY = "gacha_session_user_id";

type WalletUser = {
  id: string;
  coins?: number;
  coinUpdatedAt?: string;
  createdAt?: string;
};

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function getActiveUserId() {
  if (!canUseStorage()) return "";
  return window.sessionStorage.getItem(SESSION_USER_STORAGE_KEY) ?? window.localStorage.getItem(CURRENT_USER_STORAGE_KEY) ?? "";
}

function syncUsers(users: unknown[]) {
  fetch("/api/shared-store", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ users }),
  }).catch(() => undefined);
}

function syncWalletDeltaToServer(userId: string, delta: number, reason = "") {
  fetch("/api/wallet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, delta, reason }),
  }).catch(() => undefined);
}

function readWalletUsers() {
  try {
    const users = JSON.parse(window.localStorage.getItem(USERS_STORAGE_KEY) ?? "[]") as WalletUser[];
    return Array.isArray(users) ? users : [];
  } catch {
    return [];
  }
}

function writeWalletUsers(users: WalletUser[]) {
  window.localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
}

function coinTimestamp(user: WalletUser) {
  const timestamp = Date.parse(user.coinUpdatedAt ?? user.createdAt ?? "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function mergeWalletUsers(localUsers: WalletUser[], remoteUsers: WalletUser[]) {
  const userMap = new Map<string, WalletUser>();
  remoteUsers.forEach((user) => userMap.set(user.id, user));

  localUsers.forEach((user) => {
    if (!userMap.has(user.id)) userMap.set(user.id, user);
  });

  return Array.from(userMap.values());
}

function walletUsersChanged(previousUsers: WalletUser[], nextUsers: WalletUser[]) {
  try {
    return JSON.stringify(previousUsers) !== JSON.stringify(nextUsers);
  } catch {
    return true;
  }
}

export async function syncWalletFromServer(options: { notify?: boolean } = {}) {
  if (!canUseStorage()) return DEFAULT_COIN_BALANCE;

  const userId = getActiveUserId();
  if (!userId) return DEFAULT_COIN_BALANCE;
  const previousBalance = getCoinBalance();

  try {
    const response = await fetch("/api/shared-store", { cache: "no-store" });
    if (!response.ok) return getCoinBalance();

    const store = (await response.json()) as { users?: WalletUser[] };
    const remoteUsers = Array.isArray(store.users) ? store.users : [];
    const localUsers = readWalletUsers();
    const mergedUsers = mergeWalletUsers(localUsers, remoteUsers);
    const usersChanged = walletUsersChanged(localUsers, mergedUsers);
    const remoteUser = remoteUsers.find((user) => user.id === userId);
    const currentUser = remoteUser ?? mergedUsers.find((user) => user.id === userId);
    if (!currentUser || !Number.isFinite(Number(currentUser.coins))) {
      const fallbackBalance = getCoinBalance();
      if (usersChanged) writeWalletUsers(mergedUsers);
      return fallbackBalance;
    }

    if (usersChanged) writeWalletUsers(mergedUsers);
    const nextBalance = Math.max(0, Number(currentUser.coins));
    if ((options.notify ?? true) && nextBalance !== previousBalance) {
      window.dispatchEvent(new CustomEvent("gacha-wallet-updated"));
      window.dispatchEvent(new CustomEvent("gacha-users-updated"));
    }
    return nextBalance;
  } catch {
    return getCoinBalance();
  }
}

export function getCoinBalance() {
  if (!canUseStorage()) return DEFAULT_COIN_BALANCE;

  const userId = getActiveUserId();
  if (!userId) return DEFAULT_COIN_BALANCE;

  try {
    const users = readWalletUsers();
    const user = Array.isArray(users) ? users.find((item) => item.id === userId) : null;
    if (user && Number.isFinite(Number(user.coins))) return Math.max(0, Number(user.coins));
  } catch {
    // Return the safe empty balance when user data cannot be read.
  }

  return DEFAULT_COIN_BALANCE;
}

export function saveCoinBalance(balance: number, options: { syncRemote?: boolean; reason?: string } = {}) {
  if (!canUseStorage()) return;
  const nextBalance = Math.max(0, balance);
  const userId = getActiveUserId();
  const previousBalance = getCoinBalance();
  const coinUpdatedAt = new Date().toISOString();
  const shouldSyncRemote = options.syncRemote ?? true;

  if (!userId) {
    window.dispatchEvent(new CustomEvent("gacha-wallet-updated"));
    return;
  }

  try {
    const users = readWalletUsers();
    if (userId && Array.isArray(users)) {
      const hasUser = users.some((user) => user.id === userId);
      const nextUsers = hasUser
        ? users.map((user) => (user.id === userId ? { ...user, coins: nextBalance, coinUpdatedAt } : user))
        : users;
      writeWalletUsers(nextUsers);
      if (shouldSyncRemote && walletUsersChanged(users, nextUsers)) syncUsers(nextUsers);
      if (shouldSyncRemote) {
        syncWalletDeltaToServer(userId, nextBalance - previousBalance, options.reason);
      }
    }
  } catch {
    // The mock wallet still works even if user data is not available yet.
  }

  if (nextBalance !== previousBalance) {
    window.dispatchEvent(new CustomEvent("gacha-wallet-updated"));
  }
  window.dispatchEvent(new CustomEvent("gacha-users-updated"));
}

export function spendCoins(amount: number) {
  if (!getActiveUserId()) return null;

  const currentBalance = getCoinBalance();
  if (currentBalance < amount) return null;

  const nextBalance = currentBalance - amount;
  saveCoinBalance(nextBalance);
  return nextBalance;
}

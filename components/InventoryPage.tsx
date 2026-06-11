"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Backpack,
  Check,
  CheckCircle2,
  Clock3,
  Home,
  MapPin,
  PackageCheck,
  Percent,
  Save,
  Sparkles,
  Ticket,
  Truck,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  emptyShippingAddress,
  getAddressAreaLabels,
  getShippingAddress,
  isShippingAddressComplete,
  loadThaiAddressOptions,
  saveShippingAddress,
  thaiAddressOptions,
  type AddressOption,
  type ShippingAddress,
} from "@/data/address";
import {
  INVENTORY_STORAGE_KEY,
  createInventoryItemId,
  getInventory,
  saveInventory,
  syncInventoryStatusesFromOrders,
  type InventoryItem,
  type InventoryStatus,
} from "@/data/inventory";
import {
  COUPONS_STORAGE_KEY,
  formatCouponExpiry,
  getAvailableCoupons,
  markCouponUsed,
  type CouponRecord,
} from "@/data/coupons";
import {
  ORDERS_STORAGE_KEY,
  createShippingOrder,
  getCurrentUser,
  getCurrentUserId,
  getOrders,
  syncSharedStoreFromServer,
  type OrderRecord,
  type OrderStatus,
} from "@/data/mockDb";
import { getCoinBalance, SHIPPING_FEE, spendCoins } from "@/data/wallet";
import { UrlImage } from "@/components/UrlImage";

type InventoryTab = "all" | InventoryStatus;
type WalletView = "inventory" | "address" | "history";

const tabs: Array<{ id: InventoryTab; label: string; icon: typeof Backpack }> = [
  { id: "all", label: "ทั้งหมด", icon: Backpack },
  { id: "pending", label: "ยังไม่จัดส่ง", icon: PackageCheck },
  { id: "shipping", label: "รอจัดส่ง", icon: Truck },
  { id: "shipped", label: "จัดส่งแล้ว", icon: CheckCircle2 },
];

const orderStatusLabel: Record<OrderStatus, string> = {
  pending: "รอดำเนินการ",
  shipping: "กำลังจัดส่ง",
  shipped: "จัดส่งแล้ว",
};

function filterInventory(inventory: InventoryItem[], activeTab: InventoryTab) {
  if (activeTab === "all") return inventory;
  return inventory.filter((item) => item.status === activeTab);
}

function getCount(inventory: InventoryItem[], status?: InventoryStatus) {
  return inventory
    .filter((item) => (status ? item.status === status : true))
    .reduce((sum, item) => sum + item.quantity, 0);
}

function formatAddress(address: ShippingAddress) {
  const areaLabels = getAddressAreaLabels(address.province);

  return [
    address.receiverName,
    address.phone,
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

function notifyDiscordOrder(order: OrderRecord) {
  fetch("/api/discord-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ order }),
  }).catch(() => undefined);
}

export function InventoryPage() {
  const router = useRouter();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [coins, setCoins] = useState(0);
  const [address, setAddress] = useState<ShippingAddress>(emptyShippingAddress);
  const [addressOptions, setAddressOptions] = useState<AddressOption[]>(thaiAddressOptions);
  const [addressLoading, setAddressLoading] = useState(true);
  const [addressSaved, setAddressSaved] = useState(false);
  const [walletView, setWalletView] = useState<WalletView>("inventory");
  const [activeTab, setActiveTab] = useState<InventoryTab>("all");
  const [showConfirm, setShowConfirm] = useState(false);
  const [toast, setToast] = useState("");
  const [coupons, setCoupons] = useState<CouponRecord[]>([]);
  const [selectedCouponId, setSelectedCouponId] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadWallet() {
      if (!getCurrentUser()) {
        router.replace("/login");
        return;
      }

      await syncSharedStoreFromServer({ notify: false });
      if (!isMounted) return;

      const userId = getCurrentUserId();
      const storedAddress = getShippingAddress(userId);
      const userOrders = getOrders().filter((order) => order.userId === userId);
      setInventory(syncInventoryStatusesFromOrders(userOrders, userId));
      setOrders(userOrders);
      setCoins(getCoinBalance());
      setCoupons(getAvailableCoupons(userId));
      setAddress(storedAddress);
      setAddressSaved(isShippingAddressComplete(storedAddress));
    }

    void loadWallet();

    setAddressLoading(true);
    loadThaiAddressOptions()
      .then((options) => {
        if (isMounted) setAddressOptions(options);
      })
      .finally(() => {
        if (isMounted) setAddressLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [router]);

  useEffect(() => {
    let isMounted = true;

    async function syncOrders() {
      if (!getCurrentUser()) {
        router.replace("/login");
        return;
      }

      await syncSharedStoreFromServer({ notify: false });
      if (!isMounted) return;

      const userId = getCurrentUserId();
      const userOrders = getOrders().filter((order) => order.userId === userId);
      setOrders(userOrders);
      setInventory(syncInventoryStatusesFromOrders(userOrders, userId));
      setCoins(getCoinBalance());
      setCoupons(getAvailableCoupons(userId));
    }

    function syncFromStorage(event: StorageEvent) {
      const isInventoryUpdate =
        event.key === INVENTORY_STORAGE_KEY || Boolean(event.key?.startsWith(`${INVENTORY_STORAGE_KEY}:`));
      if (!event.key || event.key === ORDERS_STORAGE_KEY || event.key === COUPONS_STORAGE_KEY || isInventoryUpdate) {
        void syncOrders();
      }
    }

    const handleOrdersUpdate = () => void syncOrders();
    const handleAuthUpdate = () => void syncOrders();
    const handleWalletUpdate = () => void syncOrders();
    const handleInventoryUpdate = () => void syncOrders();
    const handleCouponsUpdate = () => void syncOrders();

    window.addEventListener("gacha-orders-updated", handleOrdersUpdate);
    window.addEventListener("gacha-auth-updated", handleAuthUpdate);
    window.addEventListener("gacha-wallet-updated", handleWalletUpdate);
    window.addEventListener("gacha-inventory-updated", handleInventoryUpdate);
    window.addEventListener("gacha-coupons-updated", handleCouponsUpdate);
    window.addEventListener("storage", syncFromStorage);
    return () => {
      isMounted = false;
      window.removeEventListener("gacha-orders-updated", handleOrdersUpdate);
      window.removeEventListener("gacha-auth-updated", handleAuthUpdate);
      window.removeEventListener("gacha-wallet-updated", handleWalletUpdate);
      window.removeEventListener("gacha-inventory-updated", handleInventoryUpdate);
      window.removeEventListener("gacha-coupons-updated", handleCouponsUpdate);
      window.removeEventListener("storage", syncFromStorage);
    };
  }, [router]);

  const visibleItems = useMemo(() => filterInventory(inventory, activeTab), [activeTab, inventory]);
  const selectedItems = useMemo(
    () => inventory.filter((item) => item.status === "pending" && item.selectedForShipping),
    [inventory],
  );
  const selectedOrderItems = useMemo(
    () =>
      selectedItems.map((item) => ({
        ...item,
        quantity: Math.min(item.quantity, Math.max(1, Number(item.selectedQuantity ?? item.quantity))),
      })),
    [selectedItems],
  );
  const selectedTotalQuantity = selectedOrderItems.reduce((sum, item) => sum + item.quantity, 0);
  const hasSelectedItems = selectedItems.length > 0;
  const shippingCoupons = coupons.filter((coupon) => coupon.type === "freeShipping");
  const selectedCoupon = shippingCoupons.find((coupon) => coupon.id === selectedCouponId) ?? null;
  const shippingDiscount = selectedCoupon ? SHIPPING_FEE : 0;
  const finalShippingFee = Math.max(0, SHIPPING_FEE - shippingDiscount);
  const canPayShipping = coins >= finalShippingFee;
  const hasShippingAddress = addressSaved && isShippingAddressComplete(address);
  const showCouponCards = activeTab === "all" || activeTab === "pending";

  const selectedProvince = addressOptions.find((item) => item.province === address.province);
  const selectedDistrict = selectedProvince?.districts.find((item) => item.district === address.district);
  const districtOptions = selectedProvince?.districts ?? [];
  const subdistrictOptions = selectedDistrict?.subdistricts ?? [];
  const addressAreaLabels = getAddressAreaLabels(address.province);

  useEffect(() => {
    if (selectedCouponId && !coupons.some((coupon) => coupon.id === selectedCouponId && coupon.type === "freeShipping")) {
      setSelectedCouponId("");
    }
  }, [coupons, selectedCouponId]);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  function updateInventory(nextInventory: InventoryItem[]) {
    setInventory(nextInventory);
    saveInventory(nextInventory, getCurrentUserId());
  }

  function updateAddress(field: keyof ShippingAddress, value: string) {
    setAddressSaved(false);
    setAddress((current) => {
      if (field === "province") {
        return { ...current, province: value, district: "", subdistrict: "", postalCode: "" };
      }

      if (field === "district") {
        return { ...current, district: value, subdistrict: "", postalCode: "" };
      }

      if (field === "subdistrict") {
        const option = subdistrictOptions.find((item) => item.subdistrict === value);
        return { ...current, subdistrict: value, postalCode: option?.postalCode ?? current.postalCode };
      }

      return { ...current, [field]: value };
    });
  }

  function handleSaveAddress() {
    if (!isShippingAddressComplete(address)) {
      showToast("กรุณากรอกที่อยู่จัดส่งให้ครบก่อนบันทึก");
      return;
    }

    saveShippingAddress(address, getCurrentUserId());
    setAddressSaved(true);
    showToast("บันทึกที่อยู่จัดส่งแล้ว");
  }

  function toggleShipping(itemId: string) {
    updateInventory(
      inventory.map((item) =>
        item.id === itemId && item.status === "pending"
          ? {
              ...item,
              selectedForShipping: !item.selectedForShipping,
              selectedQuantity: !item.selectedForShipping ? Math.min(item.quantity, Math.max(1, item.selectedQuantity ?? 1)) : undefined,
            }
          : item,
      ),
    );
  }

  function updateSelectedQuantity(itemId: string, quantity: number) {
    updateInventory(
      inventory.map((item) =>
        item.id === itemId && item.status === "pending"
          ? { ...item, selectedForShipping: true, selectedQuantity: Math.min(item.quantity, Math.max(1, quantity)) }
          : item,
      ),
    );
  }

  function openShippingConfirm() {
    if (!hasSelectedItems) return;
    if (!hasShippingAddress) {
      setWalletView("address");
      showToast("กรุณาบันทึกที่อยู่จัดส่งก่อน");
      return;
    }
    if (!canPayShipping && shippingCoupons.length === 0) {
      showToast(`Coin ไม่พอสำหรับค่าจัดส่ง ${finalShippingFee} Coin`);
      return;
    }
    setShowConfirm(true);
  }

  function confirmShipping() {
    if (!hasSelectedItems) return;
    if (!hasShippingAddress) {
      showToast("กรุณาบันทึกที่อยู่จัดส่งก่อน");
      return;
    }

    const nextCoinBalance = spendCoins(finalShippingFee);
    if (nextCoinBalance === null) {
      showToast(`Coin ไม่พอสำหรับค่าจัดส่ง ${finalShippingFee} Coin`);
      return;
    }

    const selectedItemIds = new Set(selectedItems.map((item) => item.id));
    const shippingItems = selectedItems.map((item) => {
      const quantity = Math.min(item.quantity, Math.max(1, Number(item.selectedQuantity ?? item.quantity)));
      const fullStack = quantity >= item.quantity;

      return {
        ...item,
        id: fullStack ? item.id : createInventoryItemId(`${item.id}-ship`),
        quantity,
        status: "shipping" as const,
        selectedForShipping: false,
        selectedQuantity: undefined,
      };
    });
    const shippingItemBySourceId = new Map(selectedItems.map((item, index) => [item.id, shippingItems[index]]));
    const nextInventory = inventory.flatMap((item) => {
      if (!selectedItemIds.has(item.id) || item.status !== "pending") return [item];

      const shippingItem = shippingItemBySourceId.get(item.id);
      if (!shippingItem) return [item];
      if (shippingItem.quantity >= item.quantity) return [shippingItem];

      return [
        { ...item, quantity: item.quantity - shippingItem.quantity, selectedForShipping: false, selectedQuantity: undefined },
        shippingItem,
      ];
    });

    setCoins(nextCoinBalance);
    const order = createShippingOrder(shippingItems, address, {
      shippingFee: finalShippingFee,
      couponCode: selectedCoupon?.code,
      couponType: selectedCoupon?.type,
      couponDiscountPercent: selectedCoupon?.discountPercent,
    });
    if (selectedCoupon) {
      markCouponUsed(selectedCoupon.id, getCurrentUserId());
      setSelectedCouponId("");
      setCoupons(getAvailableCoupons(getCurrentUserId()));
    }
    void notifyDiscordOrder(order);
    setOrders(getOrders().filter((order) => order.userId === getCurrentUserId()));
    updateInventory(nextInventory);
    setShowConfirm(false);
    setActiveTab("shipping");
    setWalletView("inventory");
    showToast(`ส่งคำขอจัดส่งเรียบร้อยแล้ว หัก ${finalShippingFee} Coin`);
  }

  function renderWalletNav(compact = false) {
    return (
      <div className={compact ? "inventory-mobile-menu" : ""}>
        <button
          className={`inventory-side-link ${walletView === "inventory" ? "inventory-side-link-active" : ""}`}
          onClick={() => setWalletView("inventory")}
        >
          <Backpack size={22} />
          กระเป๋าของฉัน
        </button>
        <button
          className={`inventory-side-link ${walletView === "history" ? "inventory-side-link-active" : ""}`}
          onClick={() => setWalletView("history")}
        >
          <Clock3 size={22} />
          ประวัติการสุ่ม
        </button>
        <button
          className={`inventory-side-link ${walletView === "address" ? "inventory-side-link-active" : ""}`}
          onClick={() => setWalletView("address")}
        >
          <MapPin size={22} />
          ที่อยู่จัดส่ง
        </button>
      </div>
    );
  }

  return (
    <main className="inventory-page">
      <div className="inventory-float inventory-float-a" />
      <div className="inventory-float inventory-float-b" />
      <div className="inventory-float inventory-float-c" />

      <div className="inventory-shell">
        <aside className="inventory-sidebar">
          <Link href="/" className="inventory-side-link">
            <Home size={22} />
            ภาพรวม
          </Link>
          {renderWalletNav()}
          <div className="inventory-sidebar-character">
            <Sparkles className="inventory-sidebar-sparkle" size={22} />
          </div>
          <div className="inventory-coin-card">
            <span>Coin ของฉัน</span>
            <strong>
              <span className="coin-badge">C</span>
              {coins.toLocaleString("th-TH")}
            </strong>
          </div>
        </aside>

        <section className="inventory-main-panel">
          {renderWalletNav(true)}

          {walletView === "inventory" && (
            <>
              <div className="inventory-title-row">
                <h1>
                  <Backpack size={36} />
                  กระเป๋าของฉัน
                </h1>
                <p>เลือกของรางวัลที่ต้องการจัดส่งได้จากรายการรอจัดส่ง ค่าจัดส่งครั้งละ {SHIPPING_FEE} Coin</p>
              </div>

              <div className="inventory-tabs">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const count = tab.id === "all" ? getCount(inventory) : getCount(inventory, tab.id);

                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`inventory-tab ${activeTab === tab.id ? "inventory-tab-active" : ""}`}
                    >
                      <Icon size={22} />
                      {tab.label}
                      <span>{count}</span>
                    </button>
                  );
                })}
              </div>

              <section className="inventory-coupon-wallet">
                <div className="inventory-coupon-head">
                  <strong>
                    <Ticket size={20} />
                    โค้ดในกระเป๋า
                  </strong>
                  <span>{coupons.length} โค้ดพร้อมใช้</span>
                </div>
                {coupons.length > 0 ? (
                  <div className="inventory-coupon-list">
                    {coupons.map((coupon) => {
                      const isActive = selectedCouponId === coupon.id;
                      const isFreeShipping = coupon.type === "freeShipping";

                      return (
                        <button
                          key={coupon.id}
                          type="button"
                          className={`inventory-coupon-chip ${isFreeShipping ? "inventory-coupon-free" : "inventory-coupon-discount"} ${isActive ? "inventory-coupon-active" : ""}`}
                          onClick={() => setSelectedCouponId(isActive ? "" : coupon.id)}
                        >
                          {isFreeShipping ? <Truck size={18} /> : <Percent size={18} />}
                          <span>{coupon.code}</span>
                          <em>{isFreeShipping ? "ส่งฟรี" : `ลด ${coupon.discountPercent}%`}</em>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="inventory-coupon-empty">ยังไม่มีโค้ดพร้อมใช้ในกระเป๋า</p>
                )}
              </section>

              {visibleItems.length > 0 || (showCouponCards && coupons.length > 0) ? (
                <div className="inventory-grid">
                  {showCouponCards &&
                    coupons.map((coupon) => {
                      const isFreeShipping = coupon.type === "freeShipping";

                      return (
                        <article key={coupon.id} className={`inventory-card inventory-coupon-card ${isFreeShipping ? "inventory-coupon-card-free" : "inventory-coupon-card-discount"}`}>
                          <div className="inventory-coupon-ticket-art">
                            {isFreeShipping ? <Truck size={46} /> : <Percent size={46} />}
                          </div>
                          <h2>{coupon.code}</h2>
                          <p>{isFreeShipping ? "โค้ดส่งฟรี" : `ส่วนลด ${coupon.discountPercent}%`}</p>
                          <small className="inventory-coupon-expiry">{formatCouponExpiry(coupon)}</small>
                          <span className="inventory-coupon-ready">พร้อมใช้</span>
                        </article>
                      );
                    })}
                  {visibleItems.map((item) => {
                    const isSelected = item.status === "pending" && item.selectedForShipping;
                    const isShipping = item.status === "shipping";
                    const isShipped = item.status === "shipped";

                    return (
                      <article key={item.id} className={`inventory-card ${isSelected ? "inventory-card-selected" : ""} ${isShipping ? "inventory-card-shipping" : ""} ${isShipped ? "inventory-card-shipped" : ""}`}>
                        <label className="inventory-checkbox">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={item.status !== "pending"}
                            onChange={() => toggleShipping(item.id)}
                          />
                          <span>
                            <Check size={18} />
                          </span>
                        </label>

                        <Sparkles className="inventory-card-sparkle" size={22} />
                        {isSelected && <div className="inventory-selected-badge">เลือกจัดส่งแล้ว</div>}
                        {isShipping && <div className="inventory-shipping-badge">รอจัดส่ง</div>}
                        {isShipped && <div className="inventory-shipped-badge">จัดส่งแล้ว</div>}

                        <div className="inventory-image-frame">
                          <UrlImage src={item.image} alt={item.name} width={260} height={220} className="inventory-image" />
                        </div>
                        <h2>{item.name}</h2>
                        <p>x{item.quantity}</p>
                        {item.status === "pending" && item.quantity > 1 && (
                          <div className="inventory-quantity-picker">
                            <button
                              type="button"
                              disabled={!isSelected || Number(item.selectedQuantity ?? 1) <= 1}
                              onClick={(event) => {
                                event.stopPropagation();
                                updateSelectedQuantity(item.id, Number(item.selectedQuantity ?? 1) - 1);
                              }}
                            >
                              -
                            </button>
                            <span>ส่ง {isSelected ? Number(item.selectedQuantity ?? 1) : 0}/{item.quantity}</span>
                            <button
                              type="button"
                              disabled={!isSelected || Number(item.selectedQuantity ?? 1) >= item.quantity}
                              onClick={(event) => {
                                event.stopPropagation();
                                updateSelectedQuantity(item.id, Number(item.selectedQuantity ?? 1) + 1);
                              }}
                            >
                              +
                            </button>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="inventory-empty">
                  <div className="result-capsule">?</div>
                  <h2>ยังไม่มีของในกระเป๋า</h2>
                  <p>ไปสุ่มกาชาปอง แล้วของรางวัลจะถูกเพิ่มเข้ากระเป๋าอัตโนมัติ</p>
                  <Link href="/gacha" className="inventory-empty-link">
                    ไปหน้ากาชาปอง
                  </Link>
                </div>
              )}

              <div className="inventory-bottom-bar inventory-bottom-bar-new">
                <div className="inventory-bottom-info">
                  <strong>เลือกแล้ว {selectedTotalQuantity} ชิ้น</strong>
                  <span>ค่าส่ง {finalShippingFee === 0 ? "ฟรี" : `+${finalShippingFee} Coin`}</span>
                </div>
                <button
                  className="inventory-ship-button"
                  disabled={!hasSelectedItems}
                  onClick={openShippingConfirm}
                >
                  <PackageCheck size={24} />
                  จัดส่งสินค้าที่เลือก ({selectedTotalQuantity})
                </button>
              </div>

              <div className="inventory-bottom-bar inventory-bottom-bar-legacy">
                <div className="inventory-bottom-info">
                  <strong>เลือกแล้ว {selectedItems.length} รายการ</strong>
                  <span>ค่าจัดส่ง +{SHIPPING_FEE} Coin</span>
                </div>
                <button
                  className="inventory-ship-button"
                  disabled={!hasSelectedItems}
                  onClick={openShippingConfirm}
                >
                  <PackageCheck size={24} />
                  จัดส่งสินค้าที่เลือก ({selectedItems.length})
                </button>
              </div>
            </>
          )}

          {walletView === "address" && (
            <section className="inventory-address-card inventory-address-card-page">
              <div className="inventory-address-title">
                <MapPin size={30} />
                <div>
                  <h2>ที่อยู่</h2>
                  <p>Address</p>
                </div>
                <span className={hasShippingAddress ? "address-status-saved" : "address-status-missing"}>
                  {hasShippingAddress ? "บันทึกแล้ว" : "ยังไม่ครบ"}
                </span>
              </div>

              <label className="inventory-address-field inventory-address-field-full">
                <span>รายละเอียดที่อยู่ *</span>
                <textarea
                  value={address.detail}
                  onChange={(event) => updateAddress("detail", event.target.value)}
                  placeholder="เช่น หมู่บ้าน / อาคาร / ห้อง / จุดสังเกต"
                />
              </label>

              <div className="inventory-address-grid">
                <label className="inventory-address-field">
                  <span>ชื่อผู้รับ *</span>
                  <input value={address.receiverName} onChange={(event) => updateAddress("receiverName", event.target.value)} placeholder="ชื่อ-นามสกุล" />
                </label>
                <label className="inventory-address-field">
                  <span>เบอร์โทร *</span>
                  <input value={address.phone} onChange={(event) => updateAddress("phone", event.target.value)} placeholder="08x-xxx-xxxx" inputMode="tel" />
                </label>
                <label className="inventory-address-field">
                  <span>บ้านเลขที่ *</span>
                  <input value={address.houseNo} onChange={(event) => updateAddress("houseNo", event.target.value)} placeholder="-" />
                </label>
                <label className="inventory-address-field">
                  <span>ถนน</span>
                  <input value={address.road} onChange={(event) => updateAddress("road", event.target.value)} placeholder="-" />
                </label>
                <label className="inventory-address-field">
                  <span>จังหวัด *</span>
                  <select value={address.province} onChange={(event) => updateAddress("province", event.target.value)}>
                    <option value="">เลือกจังหวัด</option>
                    {addressOptions.map((item) => (
                      <option key={item.province} value={item.province}>
                        {item.province}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="inventory-address-field">
                  <span>{addressAreaLabels.districtLabel} *</span>
                  <select
                    value={address.district}
                    onChange={(event) => updateAddress("district", event.target.value)}
                    disabled={!selectedProvince || districtOptions.length === 0}
                  >
                    <option value="">{addressAreaLabels.districtOptionLabel}</option>
                    {districtOptions.map((item) => (
                      <option key={item.district} value={item.district}>
                        {item.district}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="inventory-address-field">
                  <span>{addressAreaLabels.subdistrictLabel} *</span>
                  <select
                    value={address.subdistrict}
                    onChange={(event) => updateAddress("subdistrict", event.target.value)}
                    disabled={!selectedDistrict || subdistrictOptions.length === 0}
                  >
                    <option value="">{addressAreaLabels.subdistrictOptionLabel}</option>
                    {subdistrictOptions.map((item) => (
                      <option key={item.subdistrict} value={item.subdistrict}>
                        {item.subdistrict}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="inventory-address-field">
                  <span>รหัสไปรษณีย์ *</span>
                  <input value={address.postalCode} onChange={(event) => updateAddress("postalCode", event.target.value)} placeholder="81120" inputMode="numeric" />
                </label>
              </div>

              {addressLoading && (
                <p className="inventory-address-helper">กำลังโหลดข้อมูลจังหวัด อำเภอ และตำบลให้ครบ...</p>
              )}

              <button className="inventory-address-save" onClick={handleSaveAddress}>
                <Save size={20} />
                บันทึก
              </button>
            </section>
          )}

          {walletView === "history" && (
            <section className="inventory-orders-card">
              <div className="inventory-address-title">
                <Clock3 size={30} />
                <div>
                  <h2>ประวัติของฉัน</h2>
                  <p>Orders & Roll History</p>
                </div>
              </div>
              <h3>ออเดอร์จัดส่งของฉัน</h3>
              {orders.length > 0 ? (
                <div className="inventory-order-list">
                  {orders.map((order) => (
                    <article key={order.id} className="inventory-order-card">
                      <div>
                        <strong>{order.id}</strong>
                        <span>{new Date(order.createdAt).toLocaleString("th-TH")}</span>
                      </div>
                      <p>{order.items.map((item) => `${item.name} x${item.quantity}`).join(", ")}</p>
                      <p>เลขพัสดุ: {order.trackingNumber || "รออัปเดตจากแอดมิน"}</p>
                      <em className={`inventory-order-status inventory-order-status-${order.status}`}>{orderStatusLabel[order.status]}</em>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="inventory-empty inventory-history-empty">
                  <Truck size={72} />
                  <h2>ยังไม่มีออเดอร์จัดส่ง</h2>
                  <p>เมื่อเลือกจัดส่งสินค้าแล้ว ออเดอร์จะมาแสดงตรงนี้</p>
                </div>
              )}
            </section>
          )}
        </section>

        <aside className="inventory-summary-panel">
          <div className="inventory-summary-head">
            <h2>เลือกจัดส่ง</h2>
            <Sparkles size={24} />
          </div>

          {selectedItems.length > 0 ? (
            <div className="inventory-summary-list">
              {selectedOrderItems.map((item) => (
                <div key={item.id} className="inventory-summary-item">
                  <UrlImage src={item.image} alt={item.name} width={82} height={70} />
                  <div>
                    <strong>{item.name}</strong>
                    <span>x{item.quantity}</span>
                  </div>
                  <Check size={22} />
                </div>
              ))}
            </div>
          ) : (
            <div className="inventory-summary-empty">
              <Truck size={52} />
              <p>ยังไม่ได้เลือกสินค้า</p>
            </div>
          )}

          <div className="inventory-summary-total">
            <span>รวมทั้งหมด</span>
            <strong>{selectedItems.length} รายการ</strong>
          </div>
          <div className="inventory-summary-total inventory-fee-row">
            <span>ค่าจัดส่ง</span>
            <strong>+{SHIPPING_FEE} Coin</strong>
          </div>
          <div className="inventory-summary-total inventory-selected-quantity-row">
            <span>จำนวนที่เลือกส่ง</span>
            <strong>{selectedTotalQuantity} ชิ้น</strong>
          </div>
          <div className="inventory-summary-total inventory-final-fee-row">
            <span>ค่าส่งหลังใช้โค้ด</span>
            <strong>{finalShippingFee === 0 ? "ฟรี" : `+${finalShippingFee} Coin`}</strong>
          </div>
          {selectedCoupon && (
            <div className="inventory-summary-total inventory-coupon-applied">
              <span>โค้ดที่ใช้</span>
              <strong>{selectedCoupon.code}</strong>
            </div>
          )}
          <div className="inventory-summary-address">
            <strong>ที่อยู่จัดส่ง</strong>
            <p>{hasShippingAddress ? formatAddress(address) : "ยังไม่ได้บันทึกที่อยู่"}</p>
          </div>
          {!canPayShipping && selectedItems.length > 0 && (
            <p className="inventory-balance-warning">Coin ไม่พอสำหรับค่าจัดส่ง</p>
          )}
        </aside>
      </div>

      {showConfirm && (
        <div className="inventory-modal-backdrop" role="dialog" aria-modal="true">
          <section className="inventory-modal">
            <button className="inventory-modal-close" onClick={() => setShowConfirm(false)} aria-label="ปิด">
              <X size={24} />
            </button>
            <div className="inventory-modal-icon">
              <PackageCheck size={42} />
            </div>
            <h2>ยืนยันจัดส่ง</h2>
            <p>ตรวจสอบรายการสินค้าและที่อยู่ก่อนยืนยันจัดส่ง</p>

            <div className="inventory-modal-list">
              {selectedOrderItems.map((item) => (
                <div key={item.id} className="inventory-modal-item">
                  <UrlImage src={item.image} alt={item.name} width={74} height={64} />
                  <span>{item.name}</span>
                  <strong>x{item.quantity}</strong>
                </div>
              ))}
            </div>

            <div className="inventory-modal-coupon-picker">
              <div>
                <strong>โค้ดส่งฟรี</strong>
                <span>{shippingCoupons.length > 0 ? "เลือกใช้โค้ดส่งฟรีกับออเดอร์นี้" : "ยังไม่มีโค้ดส่งฟรีในกระเป๋า"}</span>
              </div>
              {shippingCoupons.length > 0 && (
                <div className="inventory-modal-coupon-options">
                  <button type="button" className={!selectedCouponId ? "is-active" : ""} onClick={() => setSelectedCouponId("")}>
                    ไม่ใช้โค้ด
                  </button>
                  {shippingCoupons.map((coupon) => (
                    <button
                      key={coupon.id}
                      type="button"
                      className={selectedCouponId === coupon.id ? "is-active" : ""}
                      onClick={() => setSelectedCouponId(coupon.id)}
                    >
                      <Truck size={16} />
                      <span>
                        {coupon.code}
                        <small>{formatCouponExpiry(coupon)}</small>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="inventory-modal-coupon-summary">
              <div>
                <span>ค่าส่งหลังใช้โค้ด</span>
                <strong>{finalShippingFee === 0 ? "ฟรี" : `+${finalShippingFee} Coin`}</strong>
              </div>
              {selectedCoupon && (
                <div>
                  <span>โค้ดที่ใช้</span>
                  <strong>{selectedCoupon.code}</strong>
                </div>
              )}
            </div>

            <div className="inventory-modal-address">
              <strong>ที่อยู่จัดส่ง</strong>
              <p>{formatAddress(address)}</p>
            </div>

            <div className="inventory-modal-total">
              <span>จำนวนรวม</span>
              <strong>{selectedTotalQuantity} ชิ้น</strong>
            </div>
            <div className="inventory-modal-total inventory-fee-row">
              <span>ค่าจัดส่ง</span>
              <strong>+{SHIPPING_FEE} Coin</strong>
            </div>
            <div className="inventory-modal-total">
              <span>Coin หลังจัดส่ง</span>
              <strong>{Math.max(0, coins - finalShippingFee).toLocaleString("th-TH")} Coin</strong>
            </div>

            <div className="inventory-modal-actions">
              <button className="inventory-cancel-button" onClick={() => setShowConfirm(false)}>
                ยกเลิก
              </button>
              <button className="inventory-confirm-button" disabled={!canPayShipping} onClick={confirmShipping}>
                ยืนยันจัดส่ง
              </button>
            </div>
          </section>
        </div>
      )}

      {toast && (
        <div className="inventory-toast">
          <CheckCircle2 size={28} />
          {toast}
        </div>
      )}
    </main>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BadgeInfo,
  Bell,
  CalendarDays,
  ChevronRight,
  Eye,
  EyeOff,
  Gift,
  Home,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  MapPin,
  Menu,
  Pencil,
  Save,
  ShieldCheck,
  Sparkles,
  UserCircle,
  Users,
  Wallet,
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
import { AVATAR_OPTIONS, normalizeAvatarUrl } from "@/data/avatarOptions";
import { ensureMockDatabase, getCurrentUser, logoutUser, updateUserAvatar, type SafeUser } from "@/data/mockDb";
import { getCoinBalance } from "@/data/wallet";

const fallbackUser = {
  username: "kenji_i7",
  handle: "@kenji_i7",
  email: "kenji_i7@gmail.com",
  coins: 0,
  pin: "123456",
  phone: "0800000000",
  avatarUrl: "/avatars/hamster.png",
  joinDate: "12 เธเธคเธฉเธ เธฒเธเธก 2024",
};

const sidebarItems = [
  { id: "profile-section", label: "เนเธเธฃเนเธเธฅเน", icon: UserCircle },
  { id: "account-section", label: "เธเนเธญเธกเธนเธฅเธเธฑเธเธเธต", icon: BadgeInfo },
  { id: "address-section", label: "เธ—เธตเนเธญเธขเธนเนเธเธฑเธ”เธชเนเธ", icon: MapPin },
  { id: "settings-section", label: "เธ•เธฑเนเธเธเนเธฒเธเธฑเธเธเธต", icon: ShieldCheck },
  { id: "invite-section", label: "เธเธงเธเน€เธเธทเนเธญเธ", icon: Users },
];

function formatJoinDate(value?: string) {
  if (!value) return fallbackUser.joinDate;

  try {
    return new Date(value).toLocaleDateString("th-TH", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return fallbackUser.joinDate;
  }
}
function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!name || !domain) return email;
  return `${name.slice(0, 1)}${"*".repeat(Math.max(4, name.length - 1))}@${domain}`;
}
function formatAddress(address: ShippingAddress) {
  const areaLabels = getAddressAreaLabels(address.province);

  return [
    address.detail,
    `เธเนเธฒเธเน€เธฅเธเธ—เธตเน ${address.houseNo}`,
    address.road ? `เธ–เธเธ ${address.road}` : "",
    `${areaLabels.subdistrictLabel} ${address.subdistrict}`,
    `${areaLabels.districtLabel} ${address.district}`,
    `เธเธฑเธเธซเธงเธฑเธ” ${address.province}`,
    address.postalCode,
  ]
    .filter(Boolean)
    .join(" ");
}

export function ProfilePage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<SafeUser | null>(null);
  const [coins, setCoins] = useState(fallbackUser.coins);
  const [address, setAddress] = useState<ShippingAddress>(emptyShippingAddress);
  const [addressOptions, setAddressOptions] = useState<AddressOption[]>(thaiAddressOptions);
  const [addressSaved, setAddressSaved] = useState(false);
  const [addressMessage, setAddressMessage] = useState("");
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [activeSection, setActiveSection] = useState("profile-section");
  const [showPin, setShowPin] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);

  useEffect(() => {
    ensureMockDatabase().then(() => {
      const storedUser = getCurrentUser();
      if (!storedUser) {
        router.replace("/login");
        return;
      }

      const storedAddress = getShippingAddress(storedUser?.id);
      setCurrentUser(storedUser);
      setCoins(getCoinBalance());
      setAddress(storedAddress);
      setAddressSaved(isShippingAddressComplete(storedAddress));
      setProfileReady(true);
    });

    let isMounted = true;
    loadThaiAddressOptions().then((options) => {
      if (isMounted) setAddressOptions(options);
    });

    return () => {
      isMounted = false;
    };
  }, [router]);

  const user = useMemo(
    () => ({
      username: currentUser?.username ?? fallbackUser.username,
      handle: currentUser ? `@${currentUser.username}` : fallbackUser.handle,
      email: currentUser?.email ?? fallbackUser.email,
      coins: currentUser?.coins ?? coins,
      pin: currentUser?.pin ?? fallbackUser.pin,
      phone: currentUser?.phone ?? fallbackUser.phone,
      avatarUrl: normalizeAvatarUrl(currentUser?.avatarUrl ?? fallbackUser.avatarUrl),
      role: currentUser?.role ?? "user",
      joinDate: formatJoinDate(currentUser?.createdAt),
    }),
    [coins, currentUser],
  );

    const hasAddress = addressSaved && isShippingAddressComplete(address);
  const isAdmin = user.role === "admin";
  const selectedProvince = addressOptions.find((item) => item.province === address.province);
  const selectedDistrict = selectedProvince?.districts.find((item) => item.district === address.district);
  const districtOptions = selectedProvince?.districts ?? [];
  const subdistrictOptions = selectedDistrict?.subdistricts ?? [];
  const addressAreaLabels = getAddressAreaLabels(address.province);

  function scrollToSection(sectionId: string) {
    setActiveSection(sectionId);
    setProfileMenuOpen(false);
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleLogout() {
    logoutUser();
    router.push("/");
  }

  function handleAvatarSelect(avatarUrl: string) {
    if (!currentUser) return;
    const updatedUser = updateUserAvatar(currentUser.id, avatarUrl);
    if (updatedUser) setCurrentUser(updatedUser);
    setAvatarPickerOpen(false);
  }

  if (!profileReady) {
    return (
      <main className="profile-page">
        <div className="profile-layout">
          <section className="profile-hero-card">
            <h1>เธเธณเธฅเธฑเธเนเธซเธฅเธ”เนเธเธฃเนเธเธฅเน...</h1>
          </section>
        </div>
      </main>
    );
  }

  function updateAddress(field: keyof ShippingAddress, value: string) {
    setAddressSaved(false);
    setAddressMessage("");
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
      setAddressMessage("เธเธฃเธธเธ“เธฒเธเธฃเธญเธเธเนเธญเธกเธนเธฅเธ—เธตเนเธญเธขเธนเนเธเธฑเธ”เธชเนเธเนเธซเนเธเธฃเธเธเนเธญเธเธเธฑเธเธ—เธถเธ");
      return;
    }

    saveShippingAddress(address, currentUser?.id);
    setAddressSaved(true);
    setAddressMessage("เธเธฑเธเธ—เธถเธเธ—เธตเนเธญเธขเธนเนเธเธฑเธ”เธชเนเธเนเธงเนเนเธเนเธญเธ”เธตเธเธตเนเนเธฅเนเธง");
  }

  return (
    <main className="profile-page">
      <div className="profile-float profile-float-a" />
      <div className="profile-float profile-float-b" />
      <div className="profile-float profile-float-c" />
      <span className="profile-sparkle profile-sparkle-a">โฆ</span>
      <span className="profile-sparkle profile-sparkle-b">โง</span>

      <header className="profile-topbar">
        <Link href="/" aria-label="Gacha Pop เธซเธเนเธฒเธซเธฅเธฑเธ" className="profile-logo-link">
          <Image src="/navbar-logo.png" alt="Gacha Pop" width={1129} height={1122} priority />
        </Link>

        <button
          type="button"
          className="profile-mobile-menu-button"
          aria-label={profileMenuOpen ? "close profile menu" : "open profile menu"}
          aria-expanded={profileMenuOpen}
          onClick={() => setProfileMenuOpen((current) => !current)}
        >
          {profileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        <nav className={`profile-nav${profileMenuOpen ? " profile-nav-open" : ""}`}>
          <Link href="/">
            <Home size={20} />
            เธซเธเนเธฒเธซเธฅเธฑเธ
          </Link>
          <Link href="/gacha">
            <Sparkles size={20} />
            เธชเธดเธเธเนเธฒ
          </Link>
          <Link href="/wallet">
            <Wallet size={20} />
            เธเธฃเธฐเน€เธเนเธฒ
          </Link>
          <Link href="/topup">
            <span className="profile-coin-dot">C</span>
            เน€เธ•เธดเธกเน€เธเธดเธ
          </Link>
        </nav>

        <div className="profile-top-actions">
          <button aria-label="เนเธเนเธเน€เธ•เธทเธญเธ">
            <Bell size={24} />
          </button>
          <div className="profile-mini-avatar">
            <img src={user.avatarUrl} alt={user.username} />
          </div>
        </div>
      </header>

      {profileMenuOpen && (
        <div className="nav-mobile-shell profile-mobile-drawer-shell" aria-label="เน€เธกเธเธนเนเธเธฃเนเธเธฅเนเธกเธทเธญเธ–เธทเธญ">
          <button
            type="button"
            className="nav-mobile-backdrop"
            aria-label="เธเธดเธ”เน€เธกเธเธน"
            onClick={() => setProfileMenuOpen(false)}
          />
          <aside className="nav-mobile-drawer profile-mobile-drawer" aria-label="เน€เธกเธเธนเนเธเธฃเนเธเธฅเน">
            <div className="nav-mobile-drawer-header">
              <Image src="/navbar-logo.png" alt="Gacha Pop" width={1129} height={1122} priority />
              <button
                type="button"
                className="nav-mobile-close"
                aria-label="เธเธดเธ”เน€เธกเธเธน"
                onClick={() => setProfileMenuOpen(false)}
              >
                <X size={22} strokeWidth={2.8} />
              </button>
            </div>

            <div className="nav-mobile-drawer-body">
              <p className="nav-mobile-section-title">เน€เธกเธเธน</p>
              <div className="nav-mobile-link-grid">
                <Link href="/" onClick={() => setProfileMenuOpen(false)} className="nav-mobile-link">
                  <Home size={20} strokeWidth={2.5} />
                  <span>เธซเธเนเธฒเธซเธฅเธฑเธ</span>
                </Link>
                <Link href="/gacha" onClick={() => setProfileMenuOpen(false)} className="nav-mobile-link">
                  <Sparkles size={20} strokeWidth={2.5} />
                  <span>เธชเธดเธเธเนเธฒ</span>
                </Link>
                <Link href="/wallet" onClick={() => setProfileMenuOpen(false)} className="nav-mobile-link">
                  <Wallet size={20} strokeWidth={2.5} />
                  <span>เธเธฃเธฐเน€เธเนเธฒ</span>
                </Link>
                <Link href="/topup" onClick={() => setProfileMenuOpen(false)} className="nav-mobile-link">
                  <span className="profile-coin-dot">C</span>
                  <span>เน€เธ•เธดเธกเน€เธเธดเธ</span>
                </Link>
              </div>

              <p className="nav-mobile-section-title">เนเธเธฃเนเธเธฅเน</p>
              <div className="nav-mobile-link-grid">
                {sidebarItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`nav-mobile-link ${activeSection === item.id ? "nav-mobile-link-active" : ""}`}
                      onClick={() => scrollToSection(item.id)}
                    >
                      <Icon size={20} strokeWidth={2.5} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
                {isAdmin && (
                  <button
                    type="button"
                    className="nav-mobile-link"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      router.push("/admin");
                    }}
                  >
                    <LayoutDashboard size={20} strokeWidth={2.5} />
                    <span>เนเธญเธ”เธกเธดเธ</span>
                  </button>
                )}
                <button type="button" className="nav-mobile-link profile-mobile-logout" onClick={handleLogout}>
                  <LogOut size={20} strokeWidth={2.5} />
                  <span>เธญเธญเธเธเธฒเธเธฃเธฐเธเธ</span>
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      <div className="profile-shell">
        <aside className="profile-sidebar">
          <section className="profile-side-card">
            <div className="profile-avatar profile-avatar-small">
              <img src={user.avatarUrl} alt={user.username} />
              <button type="button" onClick={() => setAvatarPickerOpen(true)} aria-label="เปลี่ยนรูปโปรไฟล์">
                <Pencil size={16} />
              </button>
            </div>
            <h2>{user.username}</h2>
            <p>{user.handle}</p>
            <span className="profile-side-label">เธเธเน€เธซเธฅเธทเธญ</span>
            <strong className="profile-side-coins">
              <span className="coin-badge">C</span>
              {user.coins.toLocaleString("th-TH")}
            </strong>
            <Link href="/topup" className="profile-topup-button">
              + เน€เธ•เธดเธกเน€เธเธดเธ
            </Link>
          </section>

          <nav className="profile-side-menu">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  className={activeSection === item.id ? "profile-side-active" : ""}
                  onClick={() => scrollToSection(item.id)}
                >
                  <Icon size={23} />
                  {item.label}
                </button>
              );
            })}
            {isAdmin && (
              <button className="profile-side-admin" onClick={() => router.push("/admin")}>
                <LayoutDashboard size={23} />
                เนเธญเธ”เธกเธดเธ
              </button>
            )}
            <button className="profile-side-logout" onClick={handleLogout}>
              <LogOut size={23} />
              เธญเธญเธเธเธฒเธเธฃเธฐเธเธ
            </button>
          </nav>

          <div className="profile-side-illustration">
            <Image src="/hero-machine.png" alt="Gacha machine" width={360} height={440} />
          </div>
        </aside>

        <section className="profile-main">
          <section id="profile-section" className="profile-hero-card profile-scroll-section">
            <div className="profile-section-title">
              <Sparkles size={26} />
              <h1>เนเธเธฃเนเธเธฅเนเธเธญเธเธเธฑเธ</h1>
              <Sparkles size={20} />
            </div>

            <div className="profile-hero-content">
              <div className="profile-avatar profile-avatar-large">
                <img src={user.avatarUrl} alt={user.username} />
                <button type="button" onClick={() => setAvatarPickerOpen(true)} aria-label="เปลี่ยนรูปโปรไฟล์">
                  <Pencil size={18} />
                </button>
              </div>
              <div className="profile-hero-info">
                <h2>{user.username}</h2>
                <p>{user.handle}</p>
                <span className="profile-join-date">
                  <CalendarDays size={19} />
                  เน€เธเนเธฒเธฃเนเธงเธกเน€เธกเธทเนเธญ {user.joinDate}
                </span>
              </div>
              <div className="profile-hero-art">
                <span className="profile-capsule-icon" />
                <Image src="/hero-machine.png" alt="Gacha Pop character" width={320} height={390} />
              </div>
            </div>
          </section>

          <section id="account-section" className="profile-card profile-account-card profile-scroll-section">
            <h2>เธเนเธญเธกเธนเธฅเธเธฑเธเธเธต</h2>
            <div className="profile-row-list">
              <div className="profile-info-row">
                <span>
                  <UserCircle size={24} />
                  เธเธทเนเธญเธเธนเนเนเธเน
                </span>
                <strong>{user.username}</strong>
              </div>
              <div className="profile-info-row">
                <span>
                  <Gift size={24} />
                  เธญเธตเน€เธกเธฅ
                </span>
                <strong>{maskEmail(user.email)}</strong>
              </div>
              <div className="profile-info-row">
                <span>
                  <LockKeyhole size={24} />
                  เธฃเธซเธฑเธชเธเนเธฒเธ
                </span>
                <strong>********</strong>
                <button>เน€เธเธฅเธตเนเธขเธเธฃเธซเธฑเธชเธเนเธฒเธ</button>
              </div>
              <div className="profile-info-row">
                <span>
                  <LockKeyhole size={24} />
                  เธฃเธซเธฑเธช PIN 6 เธซเธฅเธฑเธ
                </span>
                <strong>{showPin ? user.pin : "โ€ขโ€ขโ€ขโ€ขโ€ขโ€ข"}</strong>
                <button
                  type="button"
                  className="profile-pin-eye-button"
                  onClick={() => setShowPin((current) => !current)}
                  aria-label={showPin ? "เธเนเธญเธเธฃเธซเธฑเธช PIN" : "เนเธชเธ”เธเธฃเธซเธฑเธช PIN"}
                >
                  {showPin ? <EyeOff size={22} /> : <Eye size={22} />}
                </button>
              </div>
            </div>
          </section>

          <section id="address-section" className="profile-card profile-address-card profile-scroll-section">
            <div className="profile-card-head">
              <h2>เธ—เธตเนเธญเธขเธนเนเธเธฑเธ”เธชเนเธเธเธญเธเธเธฑเธ</h2>
              <button type="button" onClick={handleSaveAddress}>
                <Save size={18} />
                เธเธฑเธเธ—เธถเธเธ—เธตเนเธญเธขเธนเน
              </button>
            </div>
            {hasAddress ? (
              <article className="profile-address-box">
                <MapPin size={26} />
                <div>
                  <strong>เธเนเธฒเธ <span>เธ—เธตเนเธญเธขเธนเนเธซเธฅเธฑเธ</span></strong>
                  <p>เธเธทเนเธญเธเธนเนเธฃเธฑเธ: {address.receiverName}</p>
                  <p>เน€เธเธญเธฃเนเนเธ—เธฃ: {address.phone}</p>
                  <p>{formatAddress(address)}</p>
                </div>
                <span className="profile-address-saved">เธเธฑเธเธ—เธถเธเนเธฅเนเธง</span>
              </article>
            ) : (
              <article className="profile-address-box profile-address-empty">
                <MapPin size={28} />
                <div>
                  <strong>เธขเธฑเธเนเธกเนเธกเธตเธ—เธตเนเธญเธขเธนเนเธเธฑเธ”เธชเนเธ</strong>
                  <p>เธเธฃเธญเธเธเนเธญเธกเธนเธฅเธ”เนเธฒเธเธฅเนเธฒเธเนเธฅเนเธงเธเธ”เธเธฑเธเธ—เธถเธ เธ—เธตเนเธญเธขเธนเนเธเธตเนเธเธฐเธเธนเธเธเธฑเธเนเธญเธ”เธตเธเธญเธเธเธธเธ“เธ—เธฑเธเธ—เธต</p>
                </div>
              </article>
            )}
            <div className="profile-address-form">
              <label className="profile-address-field profile-address-field-wide">
                <span>เธฃเธฒเธขเธฅเธฐเน€เธญเธตเธขเธ”เธ—เธตเนเธญเธขเธนเน *</span>
                <textarea
                  value={address.detail}
                  onChange={(event) => updateAddress("detail", event.target.value)}
                  placeholder="เน€เธเนเธ เธซเธกเธนเนเธเนเธฒเธ / เธญเธฒเธเธฒเธฃ / เธซเนเธญเธ / เธเธธเธ”เธชเธฑเธเน€เธเธ•"
                />
              </label>
              <label className="profile-address-field">
                <span>เธเธทเนเธญเธเธนเนเธฃเธฑเธ *</span>
                <input value={address.receiverName} onChange={(event) => updateAddress("receiverName", event.target.value)} placeholder="เธเธทเนเธญ-เธเธฒเธกเธชเธเธธเธฅ" />
              </label>
              <label className="profile-address-field">
                <span>เน€เธเธญเธฃเนเนเธ—เธฃ *</span>
                <input value={address.phone} onChange={(event) => updateAddress("phone", event.target.value)} placeholder="08x-xxx-xxxx" inputMode="tel" />
              </label>
              <label className="profile-address-field">
                <span>เธเนเธฒเธเน€เธฅเธเธ—เธตเน *</span>
                <input value={address.houseNo} onChange={(event) => updateAddress("houseNo", event.target.value)} placeholder="-" />
              </label>
              <label className="profile-address-field">
                <span>เธ–เธเธ</span>
                <input value={address.road} onChange={(event) => updateAddress("road", event.target.value)} placeholder="-" />
              </label>
              <label className="profile-address-field">
                <span>เธเธฑเธเธซเธงเธฑเธ” *</span>
                <select value={address.province} onChange={(event) => updateAddress("province", event.target.value)}>
                  <option value="">เน€เธฅเธทเธญเธเธเธฑเธเธซเธงเธฑเธ”</option>
                  {addressOptions.map((item) => (
                    <option key={item.province} value={item.province}>
                      {item.province}
                    </option>
                  ))}
                </select>
              </label>
              <label className="profile-address-field">
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
              <label className="profile-address-field">
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
              <label className="profile-address-field">
                <span>เธฃเธซเธฑเธชเนเธเธฃเธฉเธ“เธตเธขเน *</span>
                <input value={address.postalCode} onChange={(event) => updateAddress("postalCode", event.target.value)} placeholder="81120" inputMode="numeric" />
              </label>
            </div>
            <div className="profile-address-actions">
              <button type="button" onClick={handleSaveAddress}>
                <Save size={19} />
                เธเธฑเธเธ—เธถเธเธ—เธตเนเธญเธขเธนเน
              </button>
              {addressMessage && <p className={addressSaved ? "profile-address-message-success" : ""}>{addressMessage}</p>}
            </div>
          </section>

          <section id="settings-section" className="profile-card profile-settings-card profile-scroll-section">
            <h2>เธ•เธฑเนเธเธเนเธฒเธเธฑเธเธเธต</h2>
            <div className="profile-setting-row">
              <span>
                <Bell size={26} />
                <div>
                  <strong>เธเธฒเธฃเนเธเนเธเน€เธ•เธทเธญเธ</strong>
                  <p>เน€เธเธดเธ” / เธเธดเธ” เธเธฒเธฃเนเธเนเธเน€เธ•เธทเธญเธ</p>
                </div>
              </span>
              <button
                className={`profile-toggle ${notificationsEnabled ? "profile-toggle-on" : ""}`}
                onClick={() => setNotificationsEnabled((current) => !current)}
                aria-label="เธชเธฅเธฑเธเธเธฒเธฃเนเธเนเธเน€เธ•เธทเธญเธ"
              >
                <i />
              </button>
            </div>
            <button className="profile-setting-row profile-setting-button">
              <span>
                <ShieldCheck size={26} />
                <div>
                  <strong>เธเธงเธฒเธกเธเธฅเธญเธ”เธ เธฑเธข</strong>
                  <p>เธเธฑเธ”เธเธฒเธฃเธเธฒเธฃเน€เธเนเธฒเธชเธนเนเธฃเธฐเธเธเนเธฅเธฐเธเธงเธฒเธกเธเธฅเธญเธ”เธ เธฑเธขเธเธฑเธเธเธต</p>
                </div>
              </span>
              <ChevronRight size={26} />
            </button>
          </section>

          <section id="invite-section" className="profile-promo-card profile-scroll-section">
            <div>
              <h2>เธญเธขเธฒเธเนเธ”เนเธเธญเธขเธเนเน€เธเธดเนเธกเนเธซเธก?</h2>
              <p>เธเธงเธเน€เธเธทเนเธญเธเธกเธฒเน€เธฅเนเธ เธฃเธฑเธเธเธญเธขเธเนเธเธฃเธตเนเธกเนเธญเธฑเนเธ!</p>
              <button>
                <Users size={21} />
                เธเธงเธเน€เธเธทเนเธญเธเธ•เธญเธเธเธตเน
              </button>
            </div>
            <div className="profile-promo-art">
              <span className="profile-gift-box">๐</span>
              <span className="profile-coin-float coin-a">C</span>
              <span className="profile-coin-float coin-b">C</span>
            </div>
          </section>

          <footer className="profile-footer">ยฉ 2024 Gacha Pop. All rights reserved.</footer>
        </section>
      </div>
      {avatarPickerOpen && (
        <div className="profile-avatar-picker-backdrop" role="dialog" aria-modal="true" aria-label="เลือกรูปโปรไฟล์">
          <button
            type="button"
            className="profile-avatar-picker-close-layer"
            aria-label="ปิดตัวเลือกรูปโปรไฟล์"
            onClick={() => setAvatarPickerOpen(false)}
          />
          <section className="profile-avatar-picker">
            <h3>เลือกรูปโปรไฟล์</h3>
            <div className="profile-avatar-picker-grid">
              {AVATAR_OPTIONS.map((avatar) => (
                <button
                  key={avatar.id}
                  type="button"
                  className={`profile-avatar-option ${user.avatarUrl === avatar.src ? "is-active" : ""}`}
                  onClick={() => handleAvatarSelect(avatar.src)}
                  aria-label={avatar.label}
                >
                  <img src={avatar.src} alt={avatar.label} />
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

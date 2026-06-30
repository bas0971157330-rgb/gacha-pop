"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BadgeInfo,
  Bell,
  CalendarDays,
  ChevronRight,
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
  joinDate: "12 พฤษภาคม 2024",
};

const sidebarItems = [
  { id: "profile-section", label: "โปรไฟล์", icon: UserCircle },
  { id: "account-section", label: "ข้อมูลบัญชี", icon: BadgeInfo },
  { id: "address-section", label: "ที่อยู่จัดส่ง", icon: MapPin },
  { id: "settings-section", label: "ตั้งค่าบัญชี", icon: ShieldCheck },
  { id: "invite-section", label: "ชวนเพื่อน", icon: Users },
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
            <h1>กำลังโหลดโปรไฟล์...</h1>
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
      setAddressMessage("กรุณากรอกข้อมูลที่อยู่จัดส่งให้ครบก่อนบันทึก");
      return;
    }

    saveShippingAddress(address, currentUser?.id);
    setAddressSaved(true);
    setAddressMessage("บันทึกที่อยู่จัดส่งไว้ในไอดีนี้แล้ว");
  }

  return (
    <main className="profile-page">
      <div className="profile-float profile-float-a" />
      <div className="profile-float profile-float-b" />
      <div className="profile-float profile-float-c" />
      <span className="profile-sparkle profile-sparkle-a">✦</span>
      <span className="profile-sparkle profile-sparkle-b">✧</span>

      <header className="profile-topbar">
        <Link href="/" aria-label="Gacha Pop หน้าหลัก" className="profile-logo-link">
          <Image src="/navbar-logo.png" alt="Gacha Pop" width={1129} height={1122} priority />
        </Link>

        <button
          type="button"
          className="profile-mobile-menu-button"
          aria-label={profileMenuOpen ? "ปิดเมนูโปรไฟล์" : "เปิดเมนูโปรไฟล์"}
          aria-expanded={profileMenuOpen}
          onClick={() => setProfileMenuOpen((current) => !current)}
        >
          {profileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        <nav className={`profile-nav${profileMenuOpen ? " profile-nav-open" : ""}`}>
          <Link href="/">
            <Home size={20} />
            หน้าหลัก
          </Link>
          <Link href="/gacha">
            <Sparkles size={20} />
            สินค้า
          </Link>
          <Link href="/wallet">
            <Wallet size={20} />
            กระเป๋า
          </Link>
          <Link href="/topup">
            <span className="profile-coin-dot">C</span>
            เติมเงิน
          </Link>
        </nav>

        <div className="profile-top-actions">
          <button aria-label="แจ้งเตือน">
            <Bell size={24} />
          </button>
          <div className="profile-mini-avatar">
            <img src={user.avatarUrl} alt={user.username} />
          </div>
        </div>
      </header>

      {profileMenuOpen && (
        <div className="nav-mobile-shell profile-mobile-drawer-shell" aria-label="เมนูโปรไฟล์มือถือ">
          <button
            type="button"
            className="nav-mobile-backdrop"
            aria-label="ปิดเมนู"
            onClick={() => setProfileMenuOpen(false)}
          />
          <aside className="nav-mobile-drawer profile-mobile-drawer" aria-label="เมนูโปรไฟล์">
            <div className="nav-mobile-drawer-header">
              <Image src="/navbar-logo.png" alt="Gacha Pop" width={1129} height={1122} priority />
              <button
                type="button"
                className="nav-mobile-close"
                aria-label="ปิดเมนู"
                onClick={() => setProfileMenuOpen(false)}
              >
                <X size={22} strokeWidth={2.8} />
              </button>
            </div>

            <div className="nav-mobile-drawer-body">
              <p className="nav-mobile-section-title">เมนู</p>
              <div className="nav-mobile-link-grid">
                <Link href="/" onClick={() => setProfileMenuOpen(false)} className="nav-mobile-link">
                  <Home size={20} strokeWidth={2.5} />
                  <span>หน้าหลัก</span>
                </Link>
                <Link href="/gacha" onClick={() => setProfileMenuOpen(false)} className="nav-mobile-link">
                  <Sparkles size={20} strokeWidth={2.5} />
                  <span>สินค้า</span>
                </Link>
                <Link href="/wallet" onClick={() => setProfileMenuOpen(false)} className="nav-mobile-link">
                  <Wallet size={20} strokeWidth={2.5} />
                  <span>กระเป๋า</span>
                </Link>
                <Link href="/topup" onClick={() => setProfileMenuOpen(false)} className="nav-mobile-link">
                  <span className="profile-coin-dot">C</span>
                  <span>เติมเงิน</span>
                </Link>
              </div>

              <p className="nav-mobile-section-title">โปรไฟล์</p>
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
                    <span>แอดมิน</span>
                  </button>
                )}
                <button type="button" className="nav-mobile-link profile-mobile-logout" onClick={handleLogout}>
                  <LogOut size={20} strokeWidth={2.5} />
                  <span>ออกจากระบบ</span>
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
            <span className="profile-side-label">คงเหลือ</span>
            <strong className="profile-side-coins">
              <span className="coin-badge">C</span>
              {user.coins.toLocaleString("th-TH")}
            </strong>
            <Link href="/topup" className="profile-topup-button">
              + เติมเงิน
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
                แอดมิน
              </button>
            )}
            <button className="profile-side-logout" onClick={handleLogout}>
              <LogOut size={23} />
              ออกจากระบบ
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
              <h1>โปรไฟล์ของฉัน</h1>
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
                  เข้าร่วมเมื่อ {user.joinDate}
                </span>
              </div>
              <div className="profile-hero-art">
                <span className="profile-capsule-icon" />
                <Image src="/hero-machine.png" alt="Gacha Pop character" width={320} height={390} />
              </div>
            </div>
          </section>

          <section id="account-section" className="profile-card profile-account-card profile-scroll-section">
            <h2>ข้อมูลบัญชี</h2>
            <div className="profile-row-list">
              <div className="profile-info-row">
                <span>
                  <UserCircle size={24} />
                  ชื่อผู้ใช้
                </span>
                <strong>{user.username}</strong>
              </div>
              <div className="profile-info-row">
                <span>
                  <Gift size={24} />
                  อีเมล
                </span>
                <strong>{maskEmail(user.email)}</strong>
              </div>
              <div className="profile-info-row">
                <span>
                  <LockKeyhole size={24} />
                  รหัสผ่าน
                </span>
                <strong>********</strong>
                <button>เปลี่ยนรหัสผ่าน</button>
              </div>
              <div className="profile-info-row">
                <span>
                  <LockKeyhole size={24} />
                  เบอร์โทรศัพท์
                </span>
                <strong>{user.phone || "-"}</strong>
              </div>
            </div>
          </section>

          <section id="address-section" className="profile-card profile-address-card profile-scroll-section">
            <div className="profile-card-head">
              <h2>ที่อยู่จัดส่งของฉัน</h2>
              <button type="button" onClick={handleSaveAddress}>
                <Save size={18} />
                บันทึกที่อยู่
              </button>
            </div>
            {hasAddress ? (
              <article className="profile-address-box">
                <MapPin size={26} />
                <div>
                  <strong>บ้าน <span>ที่อยู่หลัก</span></strong>
                  <p>ชื่อผู้รับ: {address.receiverName}</p>
                  <p>เบอร์โทร: {address.phone}</p>
                  <p>{formatAddress(address)}</p>
                </div>
                <span className="profile-address-saved">บันทึกแล้ว</span>
              </article>
            ) : (
              <article className="profile-address-box profile-address-empty">
                <MapPin size={28} />
                <div>
                  <strong>ยังไม่มีที่อยู่จัดส่ง</strong>
                  <p>กรอกข้อมูลด้านล่างแล้วกดบันทึก เพื่อใช้จัดส่งรางวัลได้เร็วขึ้น</p>
                </div>
              </article>
            )}
            <div className="profile-address-form">
              <label className="profile-address-field profile-address-field-wide">
                <span>รายละเอียดที่อยู่ *</span>
                <textarea
                  value={address.detail}
                  onChange={(event) => updateAddress("detail", event.target.value)}
                  placeholder="เช่น หมู่บ้าน / อาคาร / ห้อง / จุดสังเกต"
                />
              </label>
              <label className="profile-address-field">
                <span>ชื่อผู้รับ *</span>
                <input value={address.receiverName} onChange={(event) => updateAddress("receiverName", event.target.value)} placeholder="ชื่อ-นามสกุล" />
              </label>
              <label className="profile-address-field">
                <span>เบอร์โทร *</span>
                <input value={address.phone} onChange={(event) => updateAddress("phone", event.target.value)} placeholder="08x-xxx-xxxx" inputMode="tel" />
              </label>
              <label className="profile-address-field">
                <span>บ้านเลขที่ *</span>
                <input value={address.houseNo} onChange={(event) => updateAddress("houseNo", event.target.value)} placeholder="-" />
              </label>
              <label className="profile-address-field">
                <span>ถนน</span>
                <input value={address.road} onChange={(event) => updateAddress("road", event.target.value)} placeholder="-" />
              </label>
              <label className="profile-address-field">
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
                <span>รหัสไปรษณีย์ *</span>
                <input value={address.postalCode} onChange={(event) => updateAddress("postalCode", event.target.value)} placeholder="81120" inputMode="numeric" />
              </label>
            </div>
            <div className="profile-address-actions">
              <button type="button" onClick={handleSaveAddress}>
                <Save size={19} />
                บันทึกที่อยู่
              </button>
              {addressMessage && <p className={addressSaved ? "profile-address-message-success" : ""}>{addressMessage}</p>}
            </div>
          </section>

          <section id="settings-section" className="profile-card profile-settings-card profile-scroll-section">
            <h2>ตั้งค่าบัญชี</h2>
            <div className="profile-setting-row">
              <span>
                <Bell size={26} />
                <div>
                  <strong>การแจ้งเตือน</strong>
                  <p>เปิด / ปิด การแจ้งเตือน</p>
                </div>
              </span>
              <button
                className={`profile-toggle ${notificationsEnabled ? "profile-toggle-on" : ""}`}
                onClick={() => setNotificationsEnabled((current) => !current)}
                aria-label="สลับการแจ้งเตือน"
              >
                <i />
              </button>
            </div>
            <button className="profile-setting-row profile-setting-button">
              <span>
                <ShieldCheck size={26} />
                <div>
                  <strong>ความปลอดภัย</strong>
                  <p>จัดการรหัสผ่านและความปลอดภัยบัญชี</p>
                </div>
              </span>
              <ChevronRight size={26} />
            </button>
          </section>

          <section id="invite-section" className="profile-promo-card profile-scroll-section">
            <div>
              <h2>อยากได้คอยน์เพิ่มไหม?</h2>
              <p>ชวนเพื่อนมาเล่น รับคอยน์ฟรีไม่อั้น!</p>
              <button>
                <Users size={21} />
                ชวนเพื่อนตอนนี้
              </button>
            </div>
            <div className="profile-promo-art">
              <span className="profile-gift-box">🎁</span>
              <span className="profile-coin-float coin-a">C</span>
              <span className="profile-coin-float coin-b">C</span>
            </div>
          </section>

          <footer className="profile-footer">© 2024 Gacha Pop. All rights reserved.</footer>
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

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Backpack,
  Coins,
  Gamepad2,
  Heart,
  Home,
  LogOut,
  Menu,
  MessageCircle,
  PackageOpen,
  Plus,
  X,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import {
  ensureMockDatabase,
  getCurrentUser,
  getProductCategories,
  logoutUser,
  type ProductCategoryRecord,
  type SafeUser,
} from "@/data/mockDb";
import { getCoinBalance } from "@/data/wallet";

const links = [
  { href: "/", label: "หน้าหลัก", icon: Home },
  { href: "/gacha", label: "สินค้า", icon: Gamepad2 },
  { href: "/topup", label: "เติมเงิน", icon: Coins },
  { href: "/wallet", label: "กระเป๋า", icon: Backpack },
  { href: "/contact", label: "ติดต่อเรา", icon: MessageCircle },
];

const MOBILE_MENU_ID = "gacha-mobile-menu-toggle";

function getCategoryIcon(categoryId: string) {
  if (categoryId === "gachapon") return Gamepad2;
  if (categoryId === "figure") return PackageOpen;
  if (categoryId === "plush") return Heart;
  return PackageOpen;
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [coins, setCoins] = useState(0);
  const [user, setUser] = useState<SafeUser | null>(null);
  const [categories, setCategories] = useState<ProductCategoryRecord[]>([]);
  const mobileMenuId = MOBILE_MENU_ID;
  const visibleLinks = links.filter((link) => user || (link.href !== "/topup" && link.href !== "/wallet"));
  const maskedUsername = user ? `${user.username.trim().slice(0, 3)}*****` : "";
  const mobileCategories = [{ id: "all", label: "ทั้งหมด", createdAt: "" }, ...categories];

  useEffect(() => {
    async function syncUser() {
      await ensureMockDatabase();
      const currentUser = getCurrentUser();
      setUser(currentUser);
      setCoins(getCoinBalance());
      setCategories(getProductCategories());
    }

    syncUser();
    window.addEventListener("storage", syncUser);
    window.addEventListener("gacha-wallet-updated", syncUser);
    window.addEventListener("gacha-auth-updated", syncUser);

    return () => {
      window.removeEventListener("storage", syncUser);
      window.removeEventListener("gacha-wallet-updated", syncUser);
      window.removeEventListener("gacha-auth-updated", syncUser);
    };
  }, []);

  function handleLogout() {
    logoutUser();
    setUser(null);
    setCoins(0);
    closeMobileMenu();
    router.push("/");
  }

  function closeMobileMenu() {
    const toggle = document.getElementById(mobileMenuId) as HTMLInputElement | null;
    if (toggle) toggle.checked = false;
  }

  function toggleMobileMenu() {
    const toggle = document.getElementById(mobileMenuId) as HTMLInputElement | null;
    if (toggle) toggle.checked = !toggle.checked;
  }

  return (
    <>
      <input id={mobileMenuId} type="checkbox" className="nav-mobile-toggle" aria-hidden="true" />
      <header className="sticky top-0 z-40 border-b border-violet-200/70 bg-white/75 shadow-[0_8px_24px_rgba(94,57,177,0.14)] backdrop-blur-xl">
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <label
          htmlFor={mobileMenuId}
          className="nav-mobile-trigger"
          role="button"
          tabIndex={0}
          aria-label="เปิดเมนู"
          onClick={(event) => {
            event.preventDefault();
            toggleMobileMenu();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              toggleMobileMenu();
            }
          }}
        >
          <Menu size={24} strokeWidth={2.6} />
        </label>

        <Link href="/" aria-label="Gacha Pop หน้าหลัก" className="navbar-logo-link">
          <Logo />
        </Link>

        <div className="hidden items-center gap-2 lg:flex">
          {visibleLinks.map((link) => {
            const Icon = link.icon;
            const active = pathname === link.href.split("?")[0];
            return (
              <Link
                key={link.label}
                href={link.href}
                className={`nav-pill ${active ? "nav-pill-active" : ""}`}
              >
                <Icon size={18} strokeWidth={2.5} />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </div>

        {user ? (
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Link href="/topup" className="coin-wallet" aria-label={`เหรียญคงเหลือ ${coins.toLocaleString("th-TH")} เติม Coin`}>
              <span className="coin-badge">C</span>
              <span>{coins.toLocaleString("th-TH")}</span>
              <span className="coin-wallet-plus">
                <Plus size={17} strokeWidth={3} />
              </span>
            </Link>
            <Link href="/profile" className="nav-profile-link" aria-label="เปิดหน้าโปรไฟล์">
              <div className="avatar-pixel">{user.username.slice(0, 1).toUpperCase()}</div>
              <div className="hidden leading-tight sm:block">
                <p className="text-xs font-bold text-indigo-900">สวัสดี, {maskedUsername}</p>
                <p className="text-[11px] text-violet-500">{user.role === "admin" ? "ผู้ดูแลระบบ" : "พร้อมสุ่มแล้ว"}</p>
              </div>
            </Link>
            <button className="nav-logout-button" onClick={handleLogout} aria-label="ออกจากระบบ">
              <LogOut size={17} />
            </button>
          </div>
        ) : (
          <div className="nav-auth-actions">
            <Link href="/login">เข้าสู่ระบบ</Link>
            <Link href="/register">สมัครสมาชิก</Link>
          </div>
        )}
      </nav>
      </header>

      <div className="nav-mobile-shell" aria-label="เมนูมือถือ">
          <label
            htmlFor={mobileMenuId}
            className="nav-mobile-backdrop"
            aria-label="ปิดเมนู"
          />
          <aside className="nav-mobile-drawer" aria-label="เมนูมือถือ">
            <div className="nav-mobile-drawer-header">
              <Logo />
              <label htmlFor={mobileMenuId} className="nav-mobile-close" aria-label="ปิดเมนู">
                <X size={22} strokeWidth={2.8} />
              </label>
            </div>

            <div className="nav-mobile-drawer-body">
              <p className="nav-mobile-section-title">เมนู</p>
              <div className="nav-mobile-link-grid">
                {visibleLinks.map((link) => {
                  const Icon = link.icon;
                  const active = pathname === link.href.split("?")[0];
                  return (
                    <Link
                      key={link.label}
                      href={link.href}
                      onClick={closeMobileMenu}
                      className={`nav-mobile-link ${active ? "nav-mobile-link-active" : ""}`}
                    >
                      <Icon size={20} strokeWidth={2.5} />
                      <span>{link.label}</span>
                    </Link>
                  );
                })}
              </div>

              <p className="nav-mobile-section-title">หมวดหมู่สินค้า</p>
              <div className="nav-mobile-link-grid nav-mobile-category-grid">
                {mobileCategories.map((category) => {
                  const Icon = category.id === "all" ? Home : getCategoryIcon(category.id);
                  const href = category.id === "all" ? "/gacha" : `/gacha?category=${category.id}`;
                  return (
                    <Link
                      key={category.id}
                      href={href}
                      onClick={closeMobileMenu}
                      className="nav-mobile-link"
                    >
                      <Icon size={20} strokeWidth={2.5} />
                      <span>{category.label}</span>
                    </Link>
                  );
                })}
              </div>

              <p className="nav-mobile-note">เลือกเมนูหรือหมวดหมู่ได้จากตรงนี้บนมือถือ</p>
            </div>
          </aside>
      </div>
    </>
  );
}

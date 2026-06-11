"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Coins, CreditCard, Percent, Sparkles, Ticket, Truck } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { claimCouponByCode, formatCouponExpiry, getAvailableCoupons, syncCouponsFromServer, type CouponRecord } from "@/data/coupons";
import { getCurrentUser, recordTopupLog } from "@/data/mockDb";
import { getCoinBalance, saveCoinBalance, syncWalletFromServer } from "@/data/wallet";

const packages = [
  { coins: 100, price: "฿39" },
  { coins: 300, price: "฿99" },
  { coins: 650, price: "฿199" },
  { coins: 1250, price: "฿349" },
];

export function TopupPage() {
  const router = useRouter();
  const [coins, setCoins] = useState(0);
  const [message, setMessage] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [coupons, setCoupons] = useState<CouponRecord[]>([]);

  useEffect(() => {
    if (!getCurrentUser()) {
      router.replace("/login");
      return;
    }

    void syncWalletFromServer({ notify: false }).then((balance) => setCoins(balance));
    void syncCouponsFromServer({ notify: false }).then(() => setCoupons(getAvailableCoupons()));
  }, [router]);

  useEffect(() => {
    const syncCoupons = () => setCoupons(getAvailableCoupons());
    window.addEventListener("gacha-coupons-updated", syncCoupons);
    return () => window.removeEventListener("gacha-coupons-updated", syncCoupons);
  }, []);

  async function topup(amount: number) {
    if (!getCurrentUser()) {
      router.push("/login");
      return;
    }

    await syncWalletFromServer({ notify: false });
    const nextCoins = getCoinBalance() + amount;
    saveCoinBalance(nextCoins);
    recordTopupLog(amount);
    setCoins(nextCoins);
    setMessage(`เติม ${amount.toLocaleString("th-TH")} Coin สำเร็จ`);
  }

  async function redeemCoupon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!getCurrentUser()) {
      router.push("/login");
      return;
    }

    try {
      await syncCouponsFromServer({ notify: false });
      const coupon = claimCouponByCode(couponCode);
      setCouponCode("");
      setCoupons(getAvailableCoupons());
      setMessage(`รับโค้ด ${coupon.code} เข้ากระเป๋าแล้ว`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "รับโค้ดไม่สำเร็จ");
    }
  }

  return (
    <>
      <Navbar />
      <main className="topup-page">
        <div className="sparkle-field" />
        <section className="topup-card">
          <div className="topup-head">
            <span>
              <Coins size={30} />
            </span>
            <div>
              <p>ยอดคอยน์ของฉัน</p>
              <h1>{coins.toLocaleString("th-TH")} Coin</h1>
            </div>
          </div>

          <div className="topup-title">
            <Sparkles size={28} />
            <div>
              <h2>เติม Coin</h2>
              <p>ระบบชำระเงินจริงสามารถต่อเพิ่มได้ภายหลัง ตอนนี้ใช้ mock topup สำหรับทดสอบ</p>
            </div>
          </div>

          <div className="topup-packages">
            {packages.map((item) => (
              <button key={item.coins} type="button" onClick={() => topup(item.coins)}>
                <span className="coin-badge">C</span>
                <strong>{item.coins.toLocaleString("th-TH")}</strong>
                <em>{item.price}</em>
              </button>
            ))}
          </div>

          <section className="topup-coupon-card">
            <div className="topup-coupon-title">
              <Ticket size={24} />
              <div>
                <h3>แลกโค้ดส่วนลด / ส่งฟรี</h3>
                <p>กรอกรหัสที่ได้รับ เพื่อเก็บโค้ดไว้ในกระเป๋าและเลือกใช้ตอนจัดส่ง</p>
              </div>
            </div>
            <form className="topup-coupon-form" onSubmit={redeemCoupon}>
              <input
                value={couponCode}
                onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                placeholder="กรอกรหัสโค้ด"
              />
              <button type="submit">
                <Ticket size={18} />
                รับโค้ด
              </button>
            </form>
            <div className="topup-coupon-wallet">
              {coupons.length > 0 ? (
                coupons.map((coupon) => {
                  const isFreeShipping = coupon.type === "freeShipping";
                  return (
                    <span key={coupon.id} className={isFreeShipping ? "topup-coupon-chip topup-coupon-free" : "topup-coupon-chip topup-coupon-discount"}>
                      {isFreeShipping ? <Truck size={16} /> : <Percent size={16} />}
                      {coupon.code}
                      <em>{isFreeShipping ? "ส่งฟรี" : `ลด ${coupon.discountPercent}%`} • {formatCouponExpiry(coupon)}</em>
                    </span>
                  );
                })
              ) : (
                <p>ยังไม่มีโค้ดในกระเป๋า</p>
              )}
            </div>
          </section>

          {message && <p className="topup-message">{message}</p>}

          <Link href="/gacha?category=gachapon" className="topup-back-link">
            <CreditCard size={20} />
            กลับไปเลือกสินค้า
          </Link>
        </section>
      </main>
    </>
  );
}

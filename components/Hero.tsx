"use client";

import Image from "next/image";
import Link from "next/link";
import { LockKeyhole, ShieldCheck, Truck } from "lucide-react";
import { FeatureCard } from "@/components/FeatureCard";

export function Hero() {
  return (
    <main className="relative overflow-hidden">
      <div className="sparkle-field" />
      <section className="hero-shell">
        <div className="hero-copy">
          <Image
            src="/hero-logo-sda.png"
            alt="ยินดีต้อนรับสู่ Gacha Pop กาชาปองญี่ปุ่นแท้"
            width={1536}
            height={1024}
            priority
            draggable={false}
            className="hero-logo-art"
          />
          <p className="hero-description">
            ลุ้นฟิกเกอร์ ของสะสม และของน่ารักจากญี่ปุ่น ของแท้ 100%
            พร้อมจัดส่งถึงมือคุณ
          </p>

          <div className="hero-features">
            <FeatureCard icon={ShieldCheck} title="ของแท้ 100%" description="นำเข้าจากญี่ปุ่น" />
            <FeatureCard icon={Truck} title="จัดส่งไว" description="ทั่วประเทศ" />
            <FeatureCard icon={LockKeyhole} title="ปลอดภัย" description="มั่นใจได้" />
          </div>
        </div>

        <div className="hero-art-panel">
          <div className="hero-price-card">
            <p className="text-sm font-medium">เริ่มต้นเพียง</p>
            <p className="text-6xl font-semibold leading-none">59</p>
            <p className="text-sm font-medium">Coin / ครั้ง</p>
          </div>
          <Image
            src="/hero-machine.png"
            alt="ตู้กาชาปอง"
            width={1024}
            height={1024}
            priority
            draggable={false}
            className="hero-machine-art gacha-machine"
          />
          <Link href="/gacha?category=gachapon" className="bounce-button hero-start-button">
            <Image
              src="/start-button-icon.png"
              alt=""
              width={256}
              height={171}
              draggable={false}
              className="start-button-icon"
            />
            เริ่มสุ่มเลย !
          </Link>
        </div>
      </section>
      <div className="pixel-ground" />
    </main>
  );
}

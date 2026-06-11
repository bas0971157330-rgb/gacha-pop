"use client";

import Link from "next/link";
import { Backpack, Sparkles, Store } from "lucide-react";
import { useEffect, useState } from "react";
import { UrlImage } from "@/components/UrlImage";
import { rollRewards, type RollReward } from "@/data/rewards";

const defaultReward = rollRewards[1];

export function GachaResultPage() {
  const [reward, setReward] = useState<RollReward>(defaultReward);

  useEffect(() => {
    const storedReward = window.sessionStorage.getItem("gachaReward");
    if (!storedReward) return;

    try {
      setReward(JSON.parse(storedReward) as RollReward);
    } catch {
      setReward(defaultReward);
    }
  }, []);

  return (
    <main className="result-page">
      <div className="result-glow" />

      {Array.from({ length: 28 }).map((_, index) => (
        <span key={`confetti-${index}`} className={`result-confetti result-confetti-${index % 7}`} />
      ))}

      {Array.from({ length: 9 }).map((_, index) => (
        <span key={`capsule-${index}`} className={`result-floating-capsule result-floating-capsule-${index % 3}`} />
      ))}

      <section className="result-card">
        <div className="result-card-sparkle">
          <Sparkles size={36} />
        </div>
        <p className="result-kicker">ยินดีด้วย!</p>
        <p className="result-subtitle">คุณได้รับ</p>

        <div className="result-item-frame">
          <UrlImage src={reward.image} alt={reward.name} width={420} height={340} className="result-item-image" />
        </div>

        <h1>{reward.name}</h1>
        <div className="result-stars" aria-label={`${reward.stars} ดาว`}>
          {Array.from({ length: reward.stars }).map((_, index) => (
            <span key={index}>⭐</span>
          ))}
        </div>

        <div className="result-actions">
          <Link href="/wallet" className="result-button result-button-pink">
            <Backpack size={24} />
            ดูในกระเป๋า
          </Link>
          <Link href="/gacha" className="result-button result-button-purple">
            <Store size={24} />
            กลับไปหน้าตู้
          </Link>
        </div>
      </section>
    </main>
  );
}

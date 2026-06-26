"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { UrlImage } from "@/components/UrlImage";
import { addRewardToInventory } from "@/data/inventory";
import type { ProductDropItem } from "@/data/gacha";
import { addRollHistory, consumeProductDropItem, getCurrentUser, purchaseGachaRoll } from "@/data/mockDb";
import { rollRewards, rollWeightedReward, type RollReward } from "@/data/rewards";

const capsuleColors = ["pink", "purple", "blue", "gold"] as const;

type CapsuleColor = (typeof capsuleColors)[number];

function rollFromDropItems(dropItems: ProductDropItem[]): RollReward {
  const validItems = dropItems.filter((item) => item.name && item.image && Number(item.quantity) > 0);
  if (validItems.length === 0) return rollWeightedReward();

  const total = validItems.reduce((sum, item) => sum + Number(item.quantity), 0);
  let ticket = Math.random() * total;

  for (const item of validItems) {
    ticket -= Number(item.quantity);
    if (ticket <= 0) {
      return {
        id: item.id,
        name: item.name,
        image: item.image,
        stars: 3,
        chance: (Number(item.quantity) / total) * 100,
      };
    }
  }

  const fallback = validItems[validItems.length - 1];
  return {
    id: fallback.id,
    name: fallback.name,
    image: fallback.image,
    stars: 3,
    chance: (Number(fallback.quantity) / total) * 100,
  };
}

export function GachaRollPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const savedToInventoryRef = useRef(false);
  const purchasedRef = useRef(false);
  const rewardRef = useRef<RollReward | null>(null);
  const machineNameRef = useRef("Gacha Pop");
  const [step, setStep] = useState(1);
  const [capsuleColor, setCapsuleColor] = useState<CapsuleColor>("pink");
  const [reward, setReward] = useState<RollReward>(rollRewards[1]);

  useEffect(() => {
    const machineId = searchParams.get("machine");
    const timers: number[] = [];
    let cancelled = false;

    async function startRoll() {
      if (!machineId) {
        router.replace("/gacha?category=gachapon");
        return;
      }
      window.sessionStorage.setItem("gachaReturnPath", `/gacha/${machineId}`);

      if (!getCurrentUser()) {
        router.replace("/login");
        return;
      }

      if (!purchasedRef.current) {
        try {
          const purchase = await purchaseGachaRoll(machineId);
          if (cancelled) return;

          machineNameRef.current = purchase.product.name;
          if (!rewardRef.current) {
            const rolledReward = rollFromDropItems(purchase.product.dropItems);
            rewardRef.current = rolledReward;
            if (purchase.product.dropItems.length > 0) {
              consumeProductDropItem(machineId, rolledReward.id);
            }
          }
          purchasedRef.current = true;
        } catch (error) {
          window.sessionStorage.setItem("gachaRollError", error instanceof Error ? error.message : "Could not roll");
          router.replace(`/gacha/${machineId}`);
          return;
        }
      }

      if (cancelled) return;

      const color = capsuleColors[Math.floor(Math.random() * capsuleColors.length)];
      const nextReward = rewardRef.current ?? rollWeightedReward();

      rewardRef.current = nextReward;
      setCapsuleColor(color);
      setReward(nextReward);
      window.sessionStorage.setItem("gachaReward", JSON.stringify(nextReward));

      timers.push(
        window.setTimeout(() => setStep(2), 650),
        window.setTimeout(() => setStep(3), 3650),
        window.setTimeout(() => setStep(4), 4550),
        window.setTimeout(() => setStep(5), 5650),
        window.setTimeout(() => {
          setStep(6);
          if (!savedToInventoryRef.current) {
            addRewardToInventory(nextReward);
            addRollHistory(nextReward.name, machineNameRef.current);
            savedToInventoryRef.current = true;
          }
        }, 6400),
        window.setTimeout(() => router.push(`/gacha/result?machine=${machineId}`), 8200),
      );
    }

    void startRoll();

    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [router, searchParams]);

  return (
    <main className="roll-page">
      <div className="roll-glow roll-glow-left" />
      <div className="roll-glow roll-glow-right" />

      {Array.from({ length: 18 }).map((_, index) => (
        <span key={`sparkle-${index}`} className={`roll-sparkle roll-sparkle-${index % 6}`} />
      ))}

      {Array.from({ length: 10 }).map((_, index) => (
        <span key={`capsule-${index}`} className={`roll-floating-capsule roll-floating-capsule-${index % 4}`} />
      ))}

      <section className="roll-stage" aria-live="polite">
        <p className={`roll-status ${step < 6 ? "roll-status-blink" : ""}`}>
          {step < 6 ? "กำลังสุ่ม..." : "เปิดรางวัล!"}
        </p>

        <div className={`roll-machine-wrap ${step >= 2 && step < 5 ? "roll-machine-shake" : ""} ${step >= 6 ? "roll-machine-dim" : ""}`}>
          <Image
            src="/hero-machine.png"
            alt="ตู้กาชาปองกำลังสุ่ม"
            width={764}
            height={938}
            priority
            className="roll-machine-image"
          />
        </div>

        {step >= 3 && (
          <span
            className={`roll-capsule roll-capsule-${capsuleColor} ${step >= 4 ? "roll-capsule-center" : ""} ${step >= 5 ? "roll-capsule-burst" : ""}`}
          />
        )}

        {step >= 5 && (
          <>
            <div className="roll-white-flash" />
            <div className="roll-particle-field">
              {Array.from({ length: 28 }).map((_, index) => (
                <span key={index} style={{ "--particle-index": index } as CSSProperties} />
              ))}
            </div>
          </>
        )}

        {step >= 6 && (
          <div className="roll-reward-reveal">
            <UrlImage src={reward.image} alt={reward.name} width={360} height={300} />
            <strong>{reward.name}</strong>
          </div>
        )}
      </section>
    </main>
  );
}

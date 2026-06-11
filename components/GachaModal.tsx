"use client";

import { useMemo, useState } from "react";
import { Sparkles, X } from "lucide-react";
import type { GachaItem, Prize } from "@/data/gacha";
import { prizes } from "@/data/gacha";

type GachaModalProps = {
  gacha: GachaItem | null;
  coins: number;
  onClose: () => void;
  onSpend: (price: number) => void;
};

const rarityStyle = {
  Common: "bg-sky-100 text-sky-700",
  Rare: "bg-fuchsia-100 text-fuchsia-700",
  "Super Rare": "bg-amber-100 text-amber-700",
};

function pickPrize(): Prize {
  const roll = Math.random();
  if (roll > 0.92) return prizes.find((prize) => prize.rarity === "Super Rare") ?? prizes[0];
  if (roll > 0.68) return prizes.find((prize) => prize.rarity === "Rare") ?? prizes[0];
  const commons = prizes.filter((prize) => prize.rarity === "Common");
  return commons[Math.floor(Math.random() * commons.length)] ?? prizes[0];
}

export function GachaModal({ gacha, coins, onClose, onSpend }: GachaModalProps) {
  const [isRolling, setIsRolling] = useState(false);
  const [result, setResult] = useState<Prize | null>(null);
  const canRoll = Boolean(gacha && coins >= gacha.price);
  const previewPrize = useMemo(() => prizes.slice(0, 3), []);

  if (!gacha) return null;

  const roll = () => {
    if (!canRoll || isRolling) return;
    setResult(null);
    setIsRolling(true);
    onSpend(gacha.price);
    window.setTimeout(() => {
      setResult(pickPrize());
      setIsRolling(false);
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-indigo-950/35 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg overflow-hidden rounded-[28px] border-2 border-white bg-white/95 p-6 shadow-[0_24px_70px_rgba(69,45,139,0.35)]">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-2xl bg-violet-100 text-violet-700"
          aria-label="ปิด"
        >
          <X size={20} />
        </button>

        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-pink-100 px-4 py-2 text-sm font-black text-pink-600">
            <Sparkles size={16} /> พร้อมสุ่ม
          </span>
          <h2 className="mt-3 text-3xl font-black text-indigo-950">{gacha.name}</h2>
          <p className="font-bold text-violet-600">{gacha.price} Coin / ครั้ง</p>
        </div>

        <div className="mx-auto mt-6 grid h-44 w-44 place-items-center rounded-full bg-gradient-to-br from-violet-100 via-pink-100 to-sky-100 shadow-inner">
          <div className={`result-capsule ${isRolling ? "rolling" : ""}`}>
            {result ? "★" : "?"}
          </div>
        </div>

        {result ? (
          <div className="mt-5 rounded-3xl border border-violet-100 bg-violet-50 p-5 text-center">
            <p className="text-sm font-bold text-violet-600">คุณได้รับ</p>
            <h3 className="mt-1 text-2xl font-black text-indigo-950">{result.name}</h3>
            <span className={`mt-3 inline-flex rounded-full px-4 py-2 text-sm font-black ${rarityStyle[result.rarity]}`}>
              {result.rarity}
            </span>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-3 gap-2">
            {previewPrize.map((prize) => (
              <div key={prize.name} className="rounded-2xl bg-violet-50 p-3 text-center text-xs font-bold text-violet-700">
                {prize.name}
              </div>
            ))}
          </div>
        )}

        <button
          onClick={roll}
          disabled={!canRoll || isRolling}
          className="bounce-button mt-6 w-full justify-center disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isRolling ? "กำลังสุ่ม..." : canRoll ? "สุ่มเลย !" : "Coin ไม่พอ"}
        </button>
      </div>
    </div>
  );
}

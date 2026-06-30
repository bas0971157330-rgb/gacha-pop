import { NextResponse } from "next/server";
import { adjustWalletBalanceAtomic } from "@/data/persistentStore";
import { isSupabaseConfigured, SupabaseConfigError } from "@/data/supabaseRest";

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
  Pragma: "no-cache",
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      userId?: string;
      delta?: number;
      reason?: string;
    };

    const userId = String(body.userId ?? "").trim();
    const delta = Number(body.delta ?? 0);

    if (!userId || !Number.isFinite(delta)) {
      return NextResponse.json({ error: "INVALID_WALLET_REQUEST" }, { status: 400, headers: noStoreHeaders });
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "SUPABASE_NOT_CONFIGURED" }, { status: 503, headers: noStoreHeaders });
    }

    const result = await adjustWalletBalanceAtomic(userId, Math.trunc(delta), body.reason ?? "");
    const wallet = Array.isArray(result) ? result[0] : result;

    return NextResponse.json(
      {
        userId,
        coins: Number(wallet?.coins ?? 0),
      },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    const status = error instanceof SupabaseConfigError ? 503 : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "WALLET_UPDATE_FAILED" },
      { status, headers: noStoreHeaders },
    );
  }
}

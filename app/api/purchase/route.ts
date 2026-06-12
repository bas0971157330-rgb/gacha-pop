import { NextResponse } from "next/server";
import { purchaseProductAtomic } from "@/data/persistentStore";
import { isSupabaseConfigured, SupabaseConfigError } from "@/data/supabaseRest";

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
  Pragma: "no-cache",
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      userId?: string;
      productId?: string;
      priceCoin?: number;
    };

    const userId = String(body.userId ?? "").trim();
    const productId = String(body.productId ?? "").trim();
    const priceCoin = Number(body.priceCoin ?? 0);

    if (!userId || !productId || !Number.isFinite(priceCoin) || priceCoin < 0) {
      return NextResponse.json({ error: "INVALID_PURCHASE_REQUEST" }, { status: 400, headers: noStoreHeaders });
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "SUPABASE_NOT_CONFIGURED" }, { status: 503, headers: noStoreHeaders });
    }

    const result = await purchaseProductAtomic(userId, productId, Math.trunc(priceCoin));
    const purchase = Array.isArray(result) ? result[0] : result;

    return NextResponse.json(
      {
        userId,
        productId,
        nextBalance: Number(purchase?.next_balance ?? 0),
        nextStock: Number(purchase?.next_stock ?? 0),
      },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "PURCHASE_FAILED";
    const status =
      error instanceof SupabaseConfigError ? 503 : message.includes("INSUFFICIENT_COINS") || message.includes("INSUFFICIENT_STOCK") ? 409 : 500;

    return NextResponse.json({ error: message }, { status, headers: noStoreHeaders });
  }
}

import { NextResponse } from "next/server";
import { purchaseProductAtomic } from "@/data/persistentStore";
import { isSupabaseConfigured, selectRows, SupabaseConfigError } from "@/data/supabaseRest";

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
  Pragma: "no-cache",
};

type PurchaseProductRow = {
  id: string;
  stock: number;
  price_coin: number;
  status: "open" | "closed";
};

const inFlightPurchases = new Set<string>();

function safeId(value: unknown) {
  const text = String(value ?? "").trim();
  return /^[a-zA-Z0-9_-]{1,120}$/.test(text) ? text : "";
}

function purchaseKey(userId: string, productId: string) {
  return `${userId}:${productId}`;
}

async function getPurchasableProduct(productId: string) {
  const rows = await selectRows<PurchaseProductRow>(
    "products",
    `select=id,stock,price_coin,status&id=eq.${encodeURIComponent(productId)}&limit=1`,
  );

  return rows[0] ?? null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      userId?: string;
      productId?: string;
      priceCoin?: number;
    } | null;

    const userId = safeId(body?.userId);
    const productId = safeId(body?.productId);

    if (!body || !userId || !productId) {
      return NextResponse.json({ error: "INVALID_PURCHASE_REQUEST" }, { status: 400, headers: noStoreHeaders });
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "SUPABASE_NOT_CONFIGURED" }, { status: 503, headers: noStoreHeaders });
    }

    const key = purchaseKey(userId, productId);
    if (inFlightPurchases.has(key)) {
      return NextResponse.json({ error: "DUPLICATE_PURCHASE_IN_PROGRESS" }, { status: 409, headers: noStoreHeaders });
    }

    inFlightPurchases.add(key);

    try {
      const product = await getPurchasableProduct(productId);
      const priceCoin = Math.trunc(Number(product?.price_coin ?? NaN));
      const stock = Math.trunc(Number(product?.stock ?? NaN));

      if (!product) {
        return NextResponse.json({ error: "PRODUCT_NOT_FOUND" }, { status: 404, headers: noStoreHeaders });
      }

      if (product.status !== "open") {
        return NextResponse.json({ error: "PRODUCT_NOT_AVAILABLE" }, { status: 409, headers: noStoreHeaders });
      }

      if (!Number.isFinite(stock) || stock <= 0) {
        return NextResponse.json({ error: "INSUFFICIENT_STOCK" }, { status: 409, headers: noStoreHeaders });
      }

      if (!Number.isFinite(priceCoin) || priceCoin < 0) {
        return NextResponse.json({ error: "INVALID_PRODUCT_PRICE" }, { status: 409, headers: noStoreHeaders });
      }

      const result = await purchaseProductAtomic(userId, productId, priceCoin);
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
    } finally {
      inFlightPurchases.delete(key);
    }
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "PURCHASE_FAILED";
    const message =
      rawMessage.includes("INSUFFICIENT_COINS")
        ? "INSUFFICIENT_COINS"
        : rawMessage.includes("INSUFFICIENT_STOCK")
          ? "INSUFFICIENT_STOCK"
          : "PURCHASE_FAILED";
    const status =
      error instanceof SupabaseConfigError ? 503 : message === "INSUFFICIENT_COINS" || message === "INSUFFICIENT_STOCK" ? 409 : 500;

    return NextResponse.json({ error: message }, { status, headers: noStoreHeaders });
  }
}

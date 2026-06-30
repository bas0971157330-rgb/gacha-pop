import { NextResponse } from "next/server";
import {
  deletePublicStoreRecord,
  getPublicStoreFromDatabase,
  savePublicStoreToDatabase,
  type PublicStoreSnapshot,
} from "@/data/persistentStore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
  Pragma: "no-cache",
};

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown database error";
  return NextResponse.json({ ok: false, error: message }, { status: 500, headers: noStoreHeaders });
}

export async function GET() {
  try {
    const store = await getPublicStoreFromDatabase();
    return NextResponse.json(store, { headers: noStoreHeaders });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Partial<PublicStoreSnapshot>;
    await savePublicStoreToDatabase(body);
    const store = await getPublicStoreFromDatabase();
    return NextResponse.json(store, { headers: noStoreHeaders });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      kind?: "product" | "category" | "popupAd";
      id?: string;
    };
    const id = String(body.id ?? "").trim();

    if (!body.kind || !id) {
      return NextResponse.json({ ok: false, error: "Missing kind or id" }, { status: 400, headers: noStoreHeaders });
    }

    await deletePublicStoreRecord(body.kind, id);
    const store = await getPublicStoreFromDatabase();
    return NextResponse.json(store, { headers: noStoreHeaders });
  } catch (error) {
    return errorResponse(error);
  }
}

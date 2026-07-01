import { NextResponse } from "next/server";
import {
  getSharedStoreFromDatabase,
  saveSharedStoreToDatabase,
  type SharedStoreSnapshot,
} from "@/data/persistentStore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
  Pragma: "no-cache",
};

function errorResponse(error: unknown, stage = "SHARED_STORE_SYNC_FAILED") {
  const message = error instanceof Error ? error.message : "Unknown database error";
  console.warn(stage, { stage, message });
  return NextResponse.json({ ok: false, error: message }, { status: 500, headers: noStoreHeaders });
}

export async function GET() {
  try {
    const store = await getSharedStoreFromDatabase();
    return NextResponse.json(store, { headers: noStoreHeaders });
  } catch (error) {
    return errorResponse(error, "SHARED_STORE_GET_FAILED");
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Partial<SharedStoreSnapshot>;
    await saveSharedStoreToDatabase(body);
    const store = await getSharedStoreFromDatabase();
    return NextResponse.json(store, { headers: noStoreHeaders });
  } catch (error) {
    return errorResponse(error, "SHARED_STORE_SYNC_FAILED");
  }
}

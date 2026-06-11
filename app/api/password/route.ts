import { pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HASH_ITERATIONS = 120000;

function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(password, salt, HASH_ITERATIONS, 32, "sha256");
  return `pbkdf2-sha256$${HASH_ITERATIONS}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

function verifyPassword(password: string, passwordHash: string) {
  const [scheme, iterations, salt, hash] = passwordHash.split("$");
  if (scheme !== "pbkdf2-sha256" || !iterations || !salt || !hash) return false;

  const iterationCount = Number(iterations);
  if (!Number.isFinite(iterationCount) || iterationCount < 1) return false;

  const saltBuffer = Buffer.from(salt, "base64");
  const savedHash = Buffer.from(hash, "base64");
  const nextHash = pbkdf2Sync(password, saltBuffer, iterationCount, savedHash.length, "sha256");

  return savedHash.length === nextHash.length && timingSafeEqual(savedHash, nextHash);
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    action?: "hash" | "verify";
    password?: string;
    passwordHash?: string;
  };

  const password = String(body.password ?? "");
  if (!password) {
    return NextResponse.json({ error: "Password is required" }, { status: 400 });
  }

  if (body.action === "hash") {
    return NextResponse.json({ passwordHash: hashPassword(password) });
  }

  if (body.action === "verify") {
    return NextResponse.json({ valid: verifyPassword(password, String(body.passwordHash ?? "")) });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

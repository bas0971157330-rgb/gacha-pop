import { NextResponse } from "next/server";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { generateShippingLabelPdf, type ShippingLabelOrder } from "@/data/shippingLabelPdf";

export const runtime = "nodejs";

type DiscordOrderItem = {
  id?: unknown;
  name?: unknown;
  variantName?: unknown;
  quantity?: unknown;
};

type DiscordOrderPayload = {
  id?: unknown;
  userId?: unknown;
  username?: unknown;
  receiverName?: unknown;
  phone?: unknown;
  address?: unknown;
  status?: unknown;
  createdAt?: unknown;
  items?: DiscordOrderItem[];
};

let cachedShippingLabelFont: Uint8Array | null | undefined;

function toText(value: unknown, fallback = "-", maxLength = 900) {
  const text = String(value ?? "").trim() || fallback;
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

async function getShippingLabelFontBytes() {
  if (cachedShippingLabelFont !== undefined) return cachedShippingLabelFont;

  const fontPaths = [
    process.env.SHIPPING_LABEL_FONT_PATH,
    join(process.cwd(), "public", "fonts", "AngsanaNew.ttf"),
    join(process.cwd(), "public", "fonts", "AngsanaNew.ttc"),
    "C:\\Windows\\Fonts\\angsana.ttc",
    "C:\\Windows\\Fonts\\tahoma.ttf",
    "C:\\Windows\\Fonts\\tahomabd.ttf",
  ].filter(Boolean) as string[];

  for (const fontPath of fontPaths) {
    try {
      const font = await readFile(fontPath);
      cachedShippingLabelFont = new Uint8Array(font);
      return cachedShippingLabelFont;
    } catch {
      // Try the next configured font path.
    }
  }

  cachedShippingLabelFont = null;
  return cachedShippingLabelFont;
}

function formatOrderItems(items: unknown) {
  if (!Array.isArray(items) || items.length === 0) return "-";

  return items
    .slice(0, 10)
    .map((item) => {
      const orderItem = item as DiscordOrderItem;
      return `- ${toText(orderItem.name, "Item", 120)} x${Number(orderItem.quantity) || 1}`;
    })
    .join("\n")
    .slice(0, 1000);
}

function formatDate(value: unknown) {
  const date = new Date(String(value ?? Date.now()));
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(date);
}

function normalizeOrder(order: DiscordOrderPayload): ShippingLabelOrder {
  return {
    id: toText(order.id, "-", 160),
    receiverName: toText(order.receiverName, "-", 160),
    phone: toText(order.phone, "-", 80),
    address: toText(order.address, "-", 1200),
    createdAt: String(order.createdAt ?? new Date().toISOString()),
    items: Array.isArray(order.items)
      ? order.items.map((item) => ({
          id: toText(item.id, "", 160),
          name: toText(item.name, "Item", 220),
          variantName: toText(item.variantName, "-", 120),
          quantity: Math.max(1, Number(item.quantity ?? 1)),
        }))
      : [],
  };
}

function safeFilePart(value: unknown) {
  return String(value ?? "order")
    .trim()
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "order";
}

async function createShippingLabel(order: ShippingLabelOrder, requestUrl: string) {
  const fontBytes = await getShippingLabelFontBytes();
  const pdfBytes = generateShippingLabelPdf(order, fontBytes ?? undefined);
  const fileName = `shipping-label-${safeFilePart(order.id)}.pdf`;
  const outputDir = join(process.cwd(), "public", "shipping-labels");
  let publicUrl = "";

  try {
    await mkdir(outputDir, { recursive: true });
    await writeFile(join(outputDir, fileName), pdfBytes);
    publicUrl = new URL(`/shipping-labels/${fileName}`, requestUrl).toString();
  } catch {
    publicUrl = "";
  }

  return { fileName, pdfBytes, publicUrl };
}

function buildDiscordPayload(order: DiscordOrderPayload, shippingLabel: { fileName: string; publicUrl: string }) {
  return {
    username: "Gacha Pop Orders",
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: "มีออเดอร์จัดส่งใหม่",
        color: 0xa855f7,
        fields: [
          { name: "Order ID", value: toText(order.id, "-", 120), inline: true },
          { name: "User", value: `${toText(order.username, "-", 80)} (${toText(order.userId, "-", 80)})`, inline: true },
          { name: "สถานะ", value: toText(order.status, "pending", 80), inline: true },
          { name: "รายการสินค้า", value: formatOrderItems(order.items), inline: false },
          { name: "ผู้รับ", value: toText(order.receiverName, "-", 120), inline: true },
          { name: "เบอร์โทร", value: toText(order.phone, "-", 80), inline: true },
          { name: "เวลาสั่ง", value: formatDate(order.createdAt), inline: true },
          { name: "ที่อยู่จัดส่ง", value: toText(order.address, "-", 900), inline: false },
          {
            name: "PDF จ่าหน้าพัสดุ",
            value: shippingLabel.publicUrl || `แนบไฟล์ ${shippingLabel.fileName} ในข้อความนี้`,
            inline: false,
          },
        ],
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

export async function POST(request: Request) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL?.trim();
  const shouldSkipDiscord = new URL(request.url).searchParams.get("skipDiscord") === "1";

  const body = await request.json().catch(() => null);
  const order = ((body as { order?: DiscordOrderPayload } | null)?.order ?? body) as DiscordOrderPayload | null;

  if (!order || typeof order !== "object") {
    return NextResponse.json({ ok: false, error: "Invalid order payload" }, { status: 400 });
  }

  const normalizedOrder = normalizeOrder(order);
  const shippingLabel = await createShippingLabel(normalizedOrder, request.url);

  if (shouldSkipDiscord) {
    return NextResponse.json({ ok: true, skipped: true, shippingLabelUrl: shippingLabel.publicUrl });
  }

  if (!webhookUrl) {
    console.warn("DISCORD_WEBHOOK_URL is not configured; skipping Discord order notification.");
    return NextResponse.json(
      { ok: false, error: "DISCORD_WEBHOOK_URL is not configured", shippingLabelUrl: shippingLabel.publicUrl },
      { status: 500 },
    );
  }

  const payload = buildDiscordPayload(order, shippingLabel);

  const formData = new FormData();
  const pdfFileBytes = new Uint8Array(shippingLabel.pdfBytes.length);
  pdfFileBytes.set(shippingLabel.pdfBytes);

  formData.append("payload_json", JSON.stringify(payload));
  formData.append("files[0]", new Blob([pdfFileBytes], { type: "application/pdf" }), shippingLabel.fileName);

  const webhookEndpoint = `${webhookUrl}${webhookUrl.includes("?") ? "&" : "?"}wait=true`;
  const response = await fetch(webhookEndpoint, {
    method: "POST",
    body: formData,
    cache: "no-store",
  });

  if (!response.ok) {
    return NextResponse.json({ ok: false, error: "Discord webhook failed" }, { status: 502 });
  }

  const discordMessage = await response.json().catch(() => null);
  const attachmentUrl =
    Array.isArray((discordMessage as { attachments?: Array<{ url?: string }> } | null)?.attachments)
      ? (discordMessage as { attachments: Array<{ url?: string }> }).attachments[0]?.url
      : "";

  return NextResponse.json({ ok: true, shippingLabelUrl: shippingLabel.publicUrl, attachmentUrl });
}

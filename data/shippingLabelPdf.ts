export type ShippingLabelOrderItem = {
  id?: string;
  name?: string;
  variantName?: string;
  quantity?: number;
};

export type ShippingLabelOrder = {
  id?: string;
  receiverName?: string;
  phone?: string;
  address?: string;
  createdAt?: string;
  items?: ShippingLabelOrderItem[];
};

type PdfObject = string | Uint8Array;

type FontProgram = {
  bytes: Uint8Array;
  cmap: Map<number, number>;
  widths: Map<number, number>;
  descriptor: {
    ascent: number;
    bbox: [number, number, number, number];
    capHeight: number;
    descent: number;
    fontName: string;
  };
};

const MM_TO_PT = 72 / 25.4;
const PAGE_WIDTH = 100 * MM_TO_PT;
const PAGE_HEIGHT = 150 * MM_TO_PT;

function pdfNumber(value: number) {
  return Number(value.toFixed(2)).toString();
}

function toText(value: unknown, fallback = "-") {
  return String(value ?? "").trim() || fallback;
}

function toPdfLiteral(value: unknown) {
  return `(${toText(value, "").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/[^\x20-\x7e]/g, "?")})`;
}

function wrapText(value: unknown, maxChars: number, maxLines = 3) {
  const text = toText(value, "").replace(/\s+/g, " ").trim();
  if (!text) return [""];

  const chunks: string[] = [];
  const words = text.includes(" ") ? text.split(" ") : Array.from(text);
  let line = "";

  for (const word of words) {
    const separator = text.includes(" ") && line ? " " : "";
    const nextLine = `${line}${separator}${word}`;

    if (nextLine.length <= maxChars) {
      line = nextLine;
      continue;
    }

    if (line) chunks.push(line);
    line = word.length > maxChars ? word.slice(0, maxChars) : word;

    if (word.length > maxChars) {
      const rest = word.slice(maxChars);
      for (let index = 0; index < rest.length && chunks.length < maxLines; index += maxChars) {
        chunks.push(line);
        line = rest.slice(index, index + maxChars);
      }
    }

    if (chunks.length >= maxLines) break;
  }

  if (line && chunks.length < maxLines) chunks.push(line);
  return chunks.slice(0, maxLines);
}

function formatPrintTime(value: unknown) {
  const date = new Date(String(value ?? Date.now()));
  const printDate = Number.isNaN(date.getTime()) ? new Date() : date;

  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(printDate);
}

function concatBytes(chunks: Uint8Array[]) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;

  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }

  return output;
}

function textBytes(value: string) {
  return new TextEncoder().encode(value);
}

function u16(bytes: Uint8Array, offset: number) {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function i16(bytes: Uint8Array, offset: number) {
  const value = u16(bytes, offset);
  return value & 0x8000 ? value - 0x10000 : value;
}

function u32(bytes: Uint8Array, offset: number) {
  return (bytes[offset] * 0x1000000) + ((bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]);
}

function tableTag(bytes: Uint8Array, offset: number) {
  return String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
}

function writeU16(bytes: Uint8Array, offset: number, value: number) {
  bytes[offset] = (value >> 8) & 0xff;
  bytes[offset + 1] = value & 0xff;
}

function writeU32(bytes: Uint8Array, offset: number, value: number) {
  bytes[offset] = (value >>> 24) & 0xff;
  bytes[offset + 1] = (value >>> 16) & 0xff;
  bytes[offset + 2] = (value >>> 8) & 0xff;
  bytes[offset + 3] = value & 0xff;
}

function align4(value: number) {
  return (value + 3) & ~3;
}

function extractFirstTrueTypeFromCollection(fontBytes: Uint8Array) {
  if (tableTag(fontBytes, 0) !== "ttcf") return fontBytes;

  const firstFontOffset = u32(fontBytes, 12);
  const numTables = u16(fontBytes, firstFontOffset + 4);
  const records = Array.from({ length: numTables }, (_, index) => {
    const recordOffset = firstFontOffset + 12 + index * 16;
    return {
      tag: fontBytes.slice(recordOffset, recordOffset + 4),
      checksum: u32(fontBytes, recordOffset + 4),
      offset: u32(fontBytes, recordOffset + 8),
      length: u32(fontBytes, recordOffset + 12),
    };
  });
  let nextOffset = 12 + numTables * 16;
  const outputRecords = records.map((record) => {
    const offset = align4(nextOffset);
    nextOffset = offset + align4(record.length);
    return { ...record, outputOffset: offset };
  });
  const output = new Uint8Array(nextOffset);

  output.set(fontBytes.slice(firstFontOffset, firstFontOffset + 12), 0);
  outputRecords.forEach((record, index) => {
    const recordOffset = 12 + index * 16;
    output.set(record.tag, recordOffset);
    writeU32(output, recordOffset + 4, record.checksum);
    writeU32(output, recordOffset + 8, record.outputOffset);
    writeU32(output, recordOffset + 12, record.length);
    output.set(fontBytes.slice(record.offset, record.offset + record.length), record.outputOffset);
  });

  return output;
}

function getTables(fontBytes: Uint8Array) {
  const tables = new Map<string, { offset: number; length: number }>();
  const numTables = u16(fontBytes, 4);

  for (let index = 0; index < numTables; index += 1) {
    const recordOffset = 12 + index * 16;
    tables.set(tableTag(fontBytes, recordOffset), {
      offset: u32(fontBytes, recordOffset + 8),
      length: u32(fontBytes, recordOffset + 12),
    });
  }

  return tables;
}

function getCmapSubtable(fontBytes: Uint8Array, cmapOffset: number) {
  const numTables = u16(fontBytes, cmapOffset + 2);
  let fallbackOffset = 0;

  for (let index = 0; index < numTables; index += 1) {
    const recordOffset = cmapOffset + 4 + index * 8;
    const platformId = u16(fontBytes, recordOffset);
    const encodingId = u16(fontBytes, recordOffset + 2);
    const subtableOffset = cmapOffset + u32(fontBytes, recordOffset + 4);
    const format = u16(fontBytes, subtableOffset);

    if (format === 4 && fallbackOffset === 0) fallbackOffset = subtableOffset;
    if (format === 4 && platformId === 3 && (encodingId === 1 || encodingId === 10)) return subtableOffset;
    if (format === 4 && platformId === 0) fallbackOffset = subtableOffset;
  }

  return fallbackOffset;
}

function parseFormat4Cmap(fontBytes: Uint8Array, offset: number) {
  const cmap = new Map<number, number>();
  const segCount = u16(fontBytes, offset + 6) / 2;
  const endCodeOffset = offset + 14;
  const startCodeOffset = endCodeOffset + segCount * 2 + 2;
  const idDeltaOffset = startCodeOffset + segCount * 2;
  const idRangeOffsetOffset = idDeltaOffset + segCount * 2;

  for (let segment = 0; segment < segCount; segment += 1) {
    const endCode = u16(fontBytes, endCodeOffset + segment * 2);
    const startCode = u16(fontBytes, startCodeOffset + segment * 2);
    const idDelta = i16(fontBytes, idDeltaOffset + segment * 2);
    const idRangeOffset = u16(fontBytes, idRangeOffsetOffset + segment * 2);

    if (startCode === 0xffff && endCode === 0xffff) continue;

    for (let code = startCode; code <= endCode; code += 1) {
      let glyphId = 0;
      if (idRangeOffset === 0) {
        glyphId = (code + idDelta) & 0xffff;
      } else {
        const glyphOffset = idRangeOffsetOffset + segment * 2 + idRangeOffset + (code - startCode) * 2;
        if (glyphOffset + 1 < fontBytes.length) {
          glyphId = u16(fontBytes, glyphOffset);
          if (glyphId !== 0) glyphId = (glyphId + idDelta) & 0xffff;
        }
      }

      if (glyphId !== 0) cmap.set(code, glyphId);
      if (code === 0xffff) break;
    }
  }

  return cmap;
}

function parseFontProgram(fontBytes: Uint8Array): FontProgram | null {
  try {
    const normalizedFontBytes = extractFirstTrueTypeFromCollection(fontBytes);
    const tables = getTables(normalizedFontBytes);
    const cmapTable = tables.get("cmap");
    const headTable = tables.get("head");
    const hheaTable = tables.get("hhea");
    const hmtxTable = tables.get("hmtx");
    const maxpTable = tables.get("maxp");
    if (!cmapTable || !headTable || !hheaTable || !hmtxTable || !maxpTable) return null;

    const cmapOffset = getCmapSubtable(normalizedFontBytes, cmapTable.offset);
    if (!cmapOffset) return null;

    const cmap = parseFormat4Cmap(normalizedFontBytes, cmapOffset);
    const unitsPerEm = u16(normalizedFontBytes, headTable.offset + 18) || 1000;
    const scale = 1000 / unitsPerEm;
    const numberOfHMetrics = u16(normalizedFontBytes, hheaTable.offset + 34);
    const numberOfGlyphs = u16(normalizedFontBytes, maxpTable.offset + 4);
    const widths = new Map<number, number>();
    let lastAdvance = 500;

    for (let glyphId = 0; glyphId < numberOfGlyphs; glyphId += 1) {
      const metricIndex = Math.min(glyphId, Math.max(0, numberOfHMetrics - 1));
      const advance = u16(normalizedFontBytes, hmtxTable.offset + metricIndex * 4);
      if (glyphId < numberOfHMetrics) lastAdvance = advance;
      widths.set(glyphId, Math.max(0, Math.round((glyphId < numberOfHMetrics ? advance : lastAdvance) * scale)));
    }

    const bbox: [number, number, number, number] = [
      Math.round(i16(normalizedFontBytes, headTable.offset + 36) * scale),
      Math.round(i16(normalizedFontBytes, headTable.offset + 38) * scale),
      Math.round(i16(normalizedFontBytes, headTable.offset + 40) * scale),
      Math.round(i16(normalizedFontBytes, headTable.offset + 42) * scale),
    ];
    const ascent = Math.round(i16(normalizedFontBytes, hheaTable.offset + 4) * scale);
    const descent = Math.round(i16(normalizedFontBytes, hheaTable.offset + 6) * scale);

    return {
      bytes: normalizedFontBytes,
      cmap,
      widths,
      descriptor: {
        ascent,
        bbox,
        capHeight: ascent,
        descent,
        fontName: "AngsanaNew",
      },
    };
  } catch {
    return null;
  }
}

function unicodeHex(codePoint: number) {
  if (codePoint <= 0xffff) return codePoint.toString(16).padStart(4, "0").toUpperCase();

  const high = Math.floor((codePoint - 0x10000) / 0x400) + 0xd800;
  const low = ((codePoint - 0x10000) % 0x400) + 0xdc00;
  return `${high.toString(16).padStart(4, "0")}${low.toString(16).padStart(4, "0")}`.toUpperCase();
}

function glyphHex(value: unknown, font: FontProgram, usedGlyphs: Map<number, number>) {
  const text = toText(value, "");
  let hex = "";

  for (const char of text) {
    const rawCodePoint = char.codePointAt(0) ?? 0x20;
    const codePoint = rawCodePoint <= 0xffff ? rawCodePoint : 0x003f;
    const glyphId = font.cmap.get(codePoint) ?? font.cmap.get(0x003f) ?? font.cmap.get(0x20) ?? 0;
    if (!usedGlyphs.has(glyphId)) usedGlyphs.set(glyphId, codePoint);
    hex += glyphId.toString(16).padStart(4, "0");
  }

  return `<${hex.toUpperCase()}>`;
}

function makeToUnicodeCMap(usedGlyphs: Map<number, number>) {
  const entries = Array.from(usedGlyphs.entries()).sort((a, b) => a[0] - b[0]);
  const chunks: string[] = [
    "/CIDInit /ProcSet findresource begin",
    "12 dict begin",
    "begincmap",
    "/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def",
    "/CMapName /Adobe-Identity-UCS def",
    "/CMapType 2 def",
    "1 begincodespacerange",
    "<0000> <FFFF>",
    "endcodespacerange",
  ];

  for (let index = 0; index < entries.length; index += 100) {
    const group = entries.slice(index, index + 100);
    chunks.push(`${group.length} beginbfchar`);
    group.forEach(([glyphId, codePoint]) => {
      chunks.push(`<${glyphId.toString(16).padStart(4, "0").toUpperCase()}> <${unicodeHex(codePoint)}>`);
    });
    chunks.push("endbfchar");
  }

  chunks.push("endcmap", "CMapName currentdict /CMap defineresource pop", "end", "end");
  return chunks.join("\n");
}

function makeWidthArray(font: FontProgram, usedGlyphs: Map<number, number>) {
  const entries = Array.from(usedGlyphs.keys())
    .sort((a, b) => a - b)
    .map((glyphId) => `${glyphId} [${font.widths.get(glyphId) ?? 600}]`);

  return entries.length > 0 ? `/W [${entries.join(" ")}]` : "";
}

function shortOrderId(value: unknown) {
  const text = toText(value, "");
  const digitText = (text.match(/\d+/g) ?? []).join("");
  if (digitText.length >= 3) return `#${digitText.slice(-3)}`;

  let hash = 0;
  for (const char of text) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 900;
  }

  return `#${String(hash + 100).padStart(3, "0")}`;
}

function streamObject(dictionary: string, streamBytes: Uint8Array) {
  return concatBytes([
    textBytes(`<< ${dictionary} /Length ${streamBytes.length} >>\nstream\n`),
    streamBytes,
    textBytes("\nendstream"),
  ]);
}

function buildPdf(objects: PdfObject[]) {
  const chunks: Uint8Array[] = [];
  const offsets = [0];
  let byteOffset = 0;

  function add(value: string | Uint8Array) {
    const bytes = typeof value === "string" ? textBytes(value) : value;
    chunks.push(bytes);
    byteOffset += bytes.length;
  }

  add("%PDF-1.7\n%\xE2\xE3\xCF\xD3\n");

  objects.forEach((object, index) => {
    offsets[index + 1] = byteOffset;
    add(`${index + 1} 0 obj\n`);
    add(object);
    add("\nendobj\n");
  });

  const xrefOffset = byteOffset;
  add(`xref\n0 ${objects.length + 1}\n`);
  add("0000000000 65535 f \n");
  for (let index = 1; index <= objects.length; index += 1) {
    add(`${String(offsets[index]).padStart(10, "0")} 00000 n \n`);
  }
  add(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  return concatBytes(chunks);
}

export function generateShippingLabelPdf(order: ShippingLabelOrder, fontBytes?: Uint8Array) {
  const font = fontBytes ? parseFontProgram(fontBytes) : null;
  const usedGlyphs = new Map<number, number>();
  const orderId = shortOrderId(order.id);
  const receiverName = toText(order.receiverName, "-");
  const phone = toText(order.phone, "-");
  const address = toText(order.address, "-");
  const items = Array.isArray(order.items) ? order.items : [];
  const content: string[] = [];

  function strokeColor(r: number, g: number, b: number) {
    content.push(`${pdfNumber(r)} ${pdfNumber(g)} ${pdfNumber(b)} RG`);
  }

  function fillColor(r: number, g: number, b: number) {
    content.push(`${pdfNumber(r)} ${pdfNumber(g)} ${pdfNumber(b)} rg`);
  }

  function lineWidth(width: number) {
    content.push(`${pdfNumber(width)} w`);
  }

  function rect(x: number, y: number, width: number, height: number, options: { stroke?: boolean; fill?: boolean } = {}) {
    content.push(`${pdfNumber(x)} ${pdfNumber(y)} ${pdfNumber(width)} ${pdfNumber(height)} re ${options.fill ? "f" : ""}${options.stroke ? "S" : ""}`);
  }

  function line(x1: number, y1: number, x2: number, y2: number) {
    content.push(`${pdfNumber(x1)} ${pdfNumber(y1)} m ${pdfNumber(x2)} ${pdfNumber(y2)} l S`);
  }

  function text(value: unknown, x: number, y: number, size = 12, bold = false) {
    const encodedText = font ? glyphHex(value, font, usedGlyphs) : toPdfLiteral(value);
    content.push(`BT /${bold ? "F2" : "F1"} ${pdfNumber(size)} Tf 1 0 0 1 ${pdfNumber(x)} ${pdfNumber(y)} Tm ${encodedText} Tj ET`);
  }

  fillColor(1, 1, 1);
  rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, { fill: true });
  strokeColor(0.72, 0.72, 0.72);
  lineWidth(1.2);
  rect(1, 1, PAGE_WIDTH - 2, PAGE_HEIGHT - 2, { stroke: true });
  fillColor(0, 0, 0);

  text("ผู้ส่ง: Gacha Pop", 12, 394, 10.8, true);
  text("ที่อยู่ร้าน หมู่บ้านเปรมประชาเลคแอนด์พาร์ค ซอย3 4/56", 12, 379, 9.8);
  text("ต.บางกระสั้น อ.บางปะอิน จ.พระนครศรีอยุธยา 13160", 12, 364, 9.8);
  text("เบอร์โทร 0904114622", 12, 349, 9.8);

  strokeColor(0, 0, 0);
  lineWidth(1.35);
  rect(11, 248, 261, 90, { stroke: true });
  text(`ผู้รับ: ${wrapText(receiverName, 31, 1)[0] || "-"}`, 17, 320, 11.5, true);
  text(orderId, 214, 320, 12.8, true);

  wrapText(address, 48, 4).forEach((lineText, index) => {
    text(lineText, 17, 302 - index * 14, 9.8);
  });
  text(phone, 17, 256, 11.5, true);

  text("#", 12, 220, 9.8, true);
  text("ชื่อสินค้า", 31, 220, 9.8, true);
  text("ชื่อแบบสินค้า", 180, 220, 9.8, true);
  text("จำนวน", 250, 220, 9.8, true);
  strokeColor(0.82, 0.82, 0.82);
  lineWidth(0.8);
  line(12, 212, 272, 212);
  line(26, 226, 26, 126);
  line(176, 226, 176, 126);
  line(244, 226, 244, 126);

  if (items.length === 0) {
    text("-", 31, 197, 10);
  }

  items.slice(0, 4).forEach((item, index) => {
    const y = 197 - index * 16;
    const productName = wrapText(item.name, 28, 1)[0] || "-";
    const variantName = wrapText(item.variantName, 12, 1)[0] || "Figure";
    const quantity = Math.max(1, Number(item.quantity ?? 1));

    text(`${index + 1}.`, 12, y, 10);
    text(productName, 31, y, 10);
    text(variantName, 180, y, 10);
    text(String(quantity), 256, y, 10, true);
  });

  text(`Print Time: ${formatPrintTime(order.createdAt ?? new Date())}`, 12, 17, 7.7);
  text("ร้านคุณภาพที่ใช้งาน Gacha Pop", 154, 17, 7.7);

  const contentBytes = textBytes(content.join("\n"));

  if (!font) {
    return buildPdf([
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
      streamObject("", contentBytes),
    ]);
  }

  const toUnicodeBytes = textBytes(makeToUnicodeCMap(usedGlyphs));
  const descriptor = font.descriptor;
  const bbox = descriptor.bbox.map(String).join(" ");
  const fontFileObject = streamObject(`/Length1 ${font.bytes.length}`, font.bytes);

  return buildPdf([
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 4 0 R /F2 4 0 R >> >> /Contents 9 0 R >>`,
    `<< /Type /Font /Subtype /Type0 /BaseFont /${descriptor.fontName} /Encoding /Identity-H /DescendantFonts [5 0 R] /ToUnicode 7 0 R >>`,
    `<< /Type /Font /Subtype /CIDFontType2 /BaseFont /${descriptor.fontName} /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor 6 0 R /CIDToGIDMap /Identity /DW 600 ${makeWidthArray(font, usedGlyphs)} >>`,
    `<< /Type /FontDescriptor /FontName /${descriptor.fontName} /Flags 4 /FontBBox [${bbox}] /ItalicAngle 0 /Ascent ${descriptor.ascent} /Descent ${descriptor.descent} /CapHeight ${descriptor.capHeight} /StemV 90 /FontFile2 8 0 R >>`,
    streamObject("", toUnicodeBytes),
    fontFileObject,
    streamObject("", contentBytes),
  ]);
}

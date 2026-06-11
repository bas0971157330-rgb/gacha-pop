import type { PopupAdRecord, ProductCategoryRecord, ProductRecord } from "@/data/mockDb";

export type CatalogSnapshot = {
  products: ProductRecord[];
  categories: ProductCategoryRecord[];
  popupAds: PopupAdRecord[];
};

export async function fetchCatalogSnapshot() {
  try {
    const response = await fetch("/api/public-store", { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as CatalogSnapshot;
  } catch {
    return null;
  }
}

export async function saveCatalogSnapshot(snapshot: Partial<CatalogSnapshot>) {
  try {
    const response = await fetch("/api/public-store", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(snapshot),
    });
    if (!response.ok) return null;
    return (await response.json()) as CatalogSnapshot;
  } catch {
    return null;
  }
}

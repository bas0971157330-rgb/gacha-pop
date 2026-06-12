type SupabaseRequestOptions = RequestInit & {
  prefer?: string;
};

export class SupabaseConfigError extends Error {
  constructor() {
    super("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    this.name = "SupabaseConfigError";
  }
}

function cleanEnv(value: string | undefined) {
  const nextValue = String(value ?? "").trim();
  return nextValue && !nextValue.includes("your-") ? nextValue : "";
}

export function isSupabaseConfigured() {
  return Boolean(cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL) && cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY));
}

function getSupabaseConfig() {
  const url = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL)?.replace(/\/+$/, "");
  const serviceRoleKey = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (!url || !serviceRoleKey) throw new SupabaseConfigError();
  return { url, serviceRoleKey };
}

export async function supabaseRequest<T>(path: string, options: SupabaseRequestOptions = {}) {
  const { url, serviceRoleKey } = getSupabaseConfig();
  const endpoint = `${url}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = new Headers(options.headers);

  headers.set("apikey", serviceRoleKey);
  headers.set("Authorization", `Bearer ${serviceRoleKey}`);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (options.prefer) headers.set("Prefer", options.prefer);

  const response = await fetch(endpoint, {
    ...options,
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Supabase request failed: ${response.status} ${response.statusText}${detail ? ` - ${detail}` : ""}`);
  }

  if (response.status === 204) return null as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}

export async function selectRows<T>(table: string, query = "select=*") {
  return supabaseRequest<T[]>(`/rest/v1/${table}?${query}`, {
    method: "GET",
  });
}

export async function upsertRows<T extends Record<string, unknown>>(
  table: string,
  rows: T[],
  onConflict = "id",
) {
  if (rows.length === 0) return [];

  return supabaseRequest<T[]>(`/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`, {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=representation",
    body: JSON.stringify(rows),
  });
}

export async function callRpc<T>(functionName: string, body: Record<string, unknown>) {
  return supabaseRequest<T>(`/rest/v1/rpc/${functionName}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

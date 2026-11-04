import { supabase } from "./supabase";

export const API_BASE = (
  import.meta.env.VITE_PRODUCTS_API_URL ||
  "http://127.0.0.1:3001/api/products"
).replace(/\/products\/?$/, "");

export async function api(path, options = {}) {
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error || !session?.access_token) {
    throw new Error("Your session has expired. Please sign in again.");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      ...(options.headers || {}),
    },
    cache: "no-store",
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body.error || `Request failed (${response.status}).`);
  }

  return body;
}

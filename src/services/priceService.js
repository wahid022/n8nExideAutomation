
const PRICES_API_URL = import.meta.env.VITE_PRICES_API_URL;

const VERIFIED_CURRENT_STATUSES = new Set([
  // Add a status only when business rules confirm it is verified and current.
]);

const REVIEW_STATUSES = new Set([
  "REVIEW",
  "LIKELY CURRENT - VERIFY",
  "NOT DETERMINED",
  "HISTORICAL / OVERLAP - VERIFY",
  "VERIFY AGAINST LATEST LIST",
]);

function normalizeStatus(value) {
  return String(value ?? "").trim().toUpperCase();
}

export function getPriceStatus(price) {
  const status = normalizeStatus(price?.is_current);

  if (VERIFIED_CURRENT_STATUSES.has(status)) {
    return "verified-current";
  }

  if (REVIEW_STATUSES.has(status)) {
    return "review";
  }

  return "unverified";
}

export function isVerifiedCurrentPrice(price) {
  return getPriceStatus(price) === "verified-current";
}

export function isPriceUnderReview(price) {
  return getPriceStatus(price) === "review";
}

async function fetchPrices(filters = {}) {
  if (!PRICES_API_URL) {
    throw new Error(
      "Pricing API URL is missing. Check VITE_PRICES_API_URL in .env.local."
    );
  }

  const url = new URL(PRICES_API_URL);

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  // Request fresh pricing data instead of using a cached response.
  const response = await fetch(url.toString(), {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Pricing API failed with HTTP ${response.status}.`);
  }

  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error("The Pricing API returned invalid JSON.");
  }

  if (!result?.success || !Array.isArray(result.data)) {
    throw new Error("The Pricing API returned an unexpected response.");
  }

  return result;
}

export function getProductPrices(productId) {
  if (typeof productId !== "string" || !productId.trim()) {
    throw new Error("Please enter a valid product ID.");
  }

  return fetchPrices({ productId: productId.trim() });
}

export function getPricesByType(priceType) {
  return fetchPrices({ priceType });
}

export function getAllPrices() {
  return fetchPrices();
}

const UPDATE_PRICE_API_URL =
  import.meta.env.VITE_UPDATE_PRICE_API_URL ||
  "http://localhost:5678/webhook/exide-update-price";

export async function updateProductPrice({
  product_price_id,
  source_price_value,
  effective_from,
}) {
  if (!product_price_id) {
    throw new Error("Price record ID is required.");
  }

  const price = Number(source_price_value);

  if (!Number.isFinite(price) || price <= 0) {
    throw new Error("Enter a valid price greater than zero.");
  }

  if (!effective_from) {
    throw new Error("Effective date is required.");
  }

  const response = await fetch(UPDATE_PRICE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({
      product_price_id,
      source_price_value: price,
      effective_from,
    }),
  });

  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error(
      `Price update returned an invalid response (HTTP ${response.status}).`
    );
  }

  if (!response.ok || result?.success !== true) {
    throw new Error(
      result?.message ||
        result?.detail ||
        `Price update failed with HTTP ${response.status}.`
    );
  }

  return result;
}

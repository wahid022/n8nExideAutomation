
const PRICES_API_URL = import.meta.env.VITE_PRICES_API_URL;

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

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`Pricing API failed with HTTP ${response.status}.`);
  }

  const result = await response.json();

  if (!result.success || !Array.isArray(result.data)) {
    throw new Error("The Pricing API returned an unexpected response.");
  }

  return result;
}

export function getProductPrices(productId) {
  if (!productId?.trim()) {
    throw new Error("Please enter a product ID.");
  }

  return fetchPrices({ productId: productId.trim() });
}

export function getPricesByType(priceType) {
  return fetchPrices({ priceType });
}

export function getAllPrices() {
  return fetchPrices();
}

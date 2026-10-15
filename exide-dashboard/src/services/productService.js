
const API_URL = "http://localhost:5678/webhook/exide-products";

export async function getProducts() {
  const response = await fetch(API_URL);

  if (!response.ok) {
    throw new Error(`Failed to fetch products: ${response.status}`);
  }

  const data = await response.json();

  // Support either a direct array or n8n-style items.
  if (!Array.isArray(data)) {
    throw new Error("Unexpected API response: expected an array of products.");
  }

  return data.map((item) => item.json ?? item);
}

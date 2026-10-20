
const API_URL = "http://localhost:5678/webhook/exide-products";

export async function getProducts() {
  const response = await fetch(API_URL);

  if (!response.ok) {
    throw new Error(`Failed to fetch products: ${response.status}`);
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    throw new Error(
      "Unexpected API response: expected an array of products."
    );
  }

  return data.map((item) => {
    const product = item.json ?? item;

    return {
      ...product,

      // Product details
      product_id: product["Product Code"] ?? "",
      product_name: product["Model / SKU"] ?? "",
      brand: product["Brand"] ?? "",
      category: product["Category"] ?? "",
      sub_category: product["Sub Category"] ?? "",
      model: product["Model / SKU"] ?? "",
      mrp: product["MRP"] ?? null,
      dealer_price: product["Dealer Price"] ?? null,
      warranty: product["Warranty"] ?? "",
      specs: product["Specs / Capacity"] ?? "",
      hsn: product["HSN"] ?? "",
      effective_from: product["Effective From"] ?? "",

      // GST rate from the master workbook.
      // Example: 18 means 18%, not 0.18.
      gst_rate: product["GST Rate %"] ?? null,
    };
  });
}

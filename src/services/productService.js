const API_URL =
  import.meta.env.VITE_PRODUCTS_API_URL ||
  "http://127.0.0.1:3001/api/products";

const PAGE_SIZE = 100;

function mapProduct(item) {
  return {
    ...item,

    // Existing application aliases
    product_id: item.productCode ?? "",
    product_name: item.modelSku ?? "",
    brand: item.brand ?? "",
    category: item.category ?? "",
    sub_category: item.subCategory ?? "",
    model: item.modelSku ?? "",
    specs: item.specsCapacity ?? "",
    warranty: item.warranty ?? "",
    hsn: item.hsn ?? "",
    mrp: item.mrp ?? null,
    dealer_price: item.dealerPrice ?? null,
    gst_rate: item.gstRate ?? null,
    effective_from: item.effectiveFrom ?? "",

    // Preserve workbook field names for existing components
    "Product Code": item.productCode ?? "",
    "Brand": item.brand ?? "",
    "Category": item.category ?? "",
    "Sub Category": item.subCategory ?? "",
    "Model / SKU": item.modelSku ?? "",
    "Specs / Capacity": item.specsCapacity ?? "",
    "Warranty": item.warranty ?? null,
    "HSN": item.hsn ?? null,
    "MRP": item.mrp ?? null,
    "Dealer Price": item.dealerPrice ?? null,
    "GST Rate %": item.gstRate ?? null,
    "Effective From": item.effectiveFrom ?? null,
  };
}

export async function getProducts() {
  const products = [];
  let page = 1;
  let totalPages = 1;

  do {
    const url = new URL(API_URL);
    url.searchParams.set("page", String(page));
    url.searchParams.set("pageSize", String(PAGE_SIZE));

    const response = await fetch(url.toString(), {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(
        `Product API failed with HTTP ${response.status}.`
      );
    }

    let result;

    try {
      result = await response.json();
    } catch {
      throw new Error("Product API returned invalid JSON.");
    }

    if (!Array.isArray(result?.data) || !result?.pagination) {
      throw new Error("Product API returned an unexpected response.");
    }

    products.push(...result.data.map(mapProduct));
    totalPages = result.pagination.totalPages;
    page += 1;
  } while (page <= totalPages);

  return products;
}

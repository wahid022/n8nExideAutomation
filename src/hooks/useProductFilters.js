
import { useMemo } from "react";
import { matchesPriceType } from "../utils/priceHelpers";

const DEFAULT_BRAND = "All Brands";
const DEFAULT_CATEGORY = "All Categories";

export default function useProductFilters({
  products,
  search,
  brand,
  category,
  priceType,
  allPrices,
}) {
  return useMemo(() => {
    const term = search.trim().toLowerCase();
    const pricesByProduct = new Map();

    for (const price of allPrices) {
      if (!price.product_id) continue;

      const records = pricesByProduct.get(price.product_id) ?? [];
      records.push(price);
      pricesByProduct.set(price.product_id, records);
    }

    return products.filter((product) => {
      const searchableText = [
        product.product_id,
        product.product_name,
        product.model,
        product.brand_id,
        product.category_id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = searchableText.includes(term);

      const matchesBrand =
        brand === DEFAULT_BRAND ||
        String(product.brand_id ?? "").toLowerCase() ===
          brand.toLowerCase();

      const matchesCategory =
        category === DEFAULT_CATEGORY ||
        String(product.category_id ?? "").toLowerCase() ===
          category.toLowerCase();

      const productPrices =
        pricesByProduct.get(product.product_id) ?? [];

      const matchesType = matchesPriceType(
        productPrices,
        priceType
      );

      return (
        matchesSearch &&
        matchesBrand &&
        matchesCategory &&
        matchesType
      );
    });
  }, [products, search, brand, category, priceType, allPrices]);
}

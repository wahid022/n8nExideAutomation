
import { useMemo } from "react";

function getPriceForProduct(product, allPrices, priceType) {
  const matchingPrices = allPrices.filter((price) => {
    if (price.product_id !== product.product_id) return false;

    if (priceType === "All Price Types") return true;

    const label = String(price.source_price_label ?? "")
      .trim()
      .toLowerCase();

    const type = String(price.price_type ?? "")
      .trim()
      .toLowerCase();

    const selected = priceType.toLowerCase();

    return label === selected || type === selected;
  });

  const values = matchingPrices
    .map((price) => Number(price.source_price_value))
    .filter((value) => Number.isFinite(value));

  return values.length ? Math.min(...values) : null;
}

export default function useProductSorting({
  products,
  sortBy,
  allPrices,
  priceType,
}) {
  return useMemo(() => {
    if (sortBy === "default") return products;

    const sorted = [...products];

    if (sortBy === "name-asc" || sortBy === "name-desc") {
      sorted.sort((a, b) => {
        const result = String(a.product_name ?? "").localeCompare(
          String(b.product_name ?? ""),
          undefined,
          { sensitivity: "base" }
        );

        return sortBy === "name-asc" ? result : -result;
      });
    }

    if (sortBy === "brand-asc" || sortBy === "brand-desc") {
      sorted.sort((a, b) => {
        const result = String(a.brand_id ?? "").localeCompare(
          String(b.brand_id ?? ""),
          undefined,
          { sensitivity: "base" }
        );

        return sortBy === "brand-asc" ? result : -result;
      });
    }

    if (sortBy === "price-asc" || sortBy === "price-desc") {
      sorted.sort((a, b) => {
        const priceA = getPriceForProduct(a, allPrices, priceType);
        const priceB = getPriceForProduct(b, allPrices, priceType);

        // Products without prices stay at the end in either direction.
        if (priceA === null) return priceB === null ? 0 : 1;
        if (priceB === null) return -1;

        return sortBy === "price-asc"
          ? priceA - priceB
          : priceB - priceA;
      });
    }

    return sorted;
  }, [products, sortBy, allPrices, priceType]);
}

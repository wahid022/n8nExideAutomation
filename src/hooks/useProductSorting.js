
import { useMemo } from "react";

function getValue(product, alias, workbookField) {
  return product?.[alias] ?? product?.[workbookField] ?? "";
}

function getName(product) {
  return String(
    getValue(product, "product_name", "Model / SKU") ||
    getValue(product, "model", "Model / SKU")
  ).trim();
}

function getBrand(product) {
  return String(getValue(product, "brand", "Brand")).trim();
}

function getPrice(product, priceType) {
  const field = priceType === "MRP" ? "MRP" : "Dealer Price";
  const alias = priceType === "MRP" ? "mrp" : "dealer_price";
  const value = getValue(product, alias, field);

  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export default function useProductSorting({
  products = [],
  sortBy = "default",
  priceType = "All Price Types",
}) {
  return useMemo(() => {
    if (sortBy === "default") return products;

    const sorted = [...products];

    switch (sortBy) {
      case "name-asc":
        sorted.sort((a, b) =>
          getName(a).localeCompare(getName(b), undefined, {
            sensitivity: "base",
            numeric: true,
          })
        );
        break;

      case "name-desc":
        sorted.sort((a, b) =>
          getName(b).localeCompare(getName(a), undefined, {
            sensitivity: "base",
            numeric: true,
          })
        );
        break;

      case "brand-asc":
        sorted.sort((a, b) =>
          getBrand(a).localeCompare(getBrand(b), undefined, {
            sensitivity: "base",
          })
        );
        break;

      case "brand-desc":
        sorted.sort((a, b) =>
          getBrand(b).localeCompare(getBrand(a), undefined, {
            sensitivity: "base",
          })
        );
        break;

      case "price-asc":
      case "price-desc": {
        const direction = sortBy === "price-asc" ? 1 : -1;

        sorted.sort((a, b) => {
          const priceA = getPrice(a, priceType);
          const priceB = getPrice(b, priceType);

          // Keep products without the selected price at the end.
          if (priceA === null && priceB === null) return 0;
          if (priceA === null) return 1;
          if (priceB === null) return -1;

          return (priceA - priceB) * direction;
        });
        break;
      }

      default:
        break;
    }

    return sorted;
  }, [products, sortBy, priceType]);
}


import { useMemo } from "react";

const DEFAULT_BRAND = "All Brands";
const DEFAULT_CATEGORY = "All Categories";
const DEFAULT_PRICE_TYPE = "All Price Types";

function getValue(product, alias, workbookField) {
  return product?.[alias] ?? product?.[workbookField] ?? "";
}

function hasPrice(product, priceType) {
  if (priceType === DEFAULT_PRICE_TYPE) return true;

  const field = priceType === "MRP" ? "MRP" : "Dealer Price";
  const alias = priceType === "MRP" ? "mrp" : "dealer_price";
  const value = getValue(product, alias, field);

  return value !== null &&
    value !== undefined &&
    String(value).trim() !== "" &&
    Number.isFinite(Number(value));
}

export default function useProductFilters({
  products = [],
  search = "",
  brand = DEFAULT_BRAND,
  category = DEFAULT_CATEGORY,
  priceType = DEFAULT_PRICE_TYPE,
}) {
  return useMemo(() => {
    const term = String(search).trim().toLowerCase();

    return products.filter((product) => {
      const searchableText = [
        getValue(product, "product_id", "Product Code"),
        getValue(product, "product_name", "Model / SKU"),
        getValue(product, "model", "Model / SKU"),
        getValue(product, "brand", "Brand"),
        getValue(product, "category", "Category"),
        getValue(product, "sub_category", "Sub Category"),
        getValue(product, "specs", "Specs / Capacity"),
        getValue(product, "hsn", "HSN"),
      ]
        .filter((value) => value !== null && value !== undefined)
        .join(" ")
        .toLowerCase();

      const productBrand = String(
        getValue(product, "brand", "Brand")
      ).trim();

      const productCategory = String(
        getValue(product, "category", "Category")
      ).trim();

      const matchesSearch = !term || searchableText.includes(term);
      const matchesBrand =
        brand === DEFAULT_BRAND ||
        productBrand.toLowerCase() === brand.toLowerCase();
      const matchesCategory =
        category === DEFAULT_CATEGORY ||
        productCategory.toLowerCase() === category.toLowerCase();

      return (
        matchesSearch &&
        matchesBrand &&
        matchesCategory &&
        hasPrice(product, priceType)
      );
    });
  }, [products, search, brand, category, priceType]);
}

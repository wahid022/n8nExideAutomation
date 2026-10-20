
import { useMemo } from "react";

const DEFAULT_BRAND = "All Brands";
const DEFAULT_CATEGORY = "All Categories";

function getValue(product, alias, workbookField) {
  return product?.[alias] ?? product?.[workbookField] ?? "";
}

export default function useProductFilters({
  products = [],
  search = "",
  brand = DEFAULT_BRAND,
  category = DEFAULT_CATEGORY,
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

      const matchesSearch =
        !term || searchableText.includes(term);

      const matchesBrand =
        brand === DEFAULT_BRAND ||
        productBrand.toLowerCase() === brand.toLowerCase();

      const matchesCategory =
        category === DEFAULT_CATEGORY ||
        productCategory.toLowerCase() === category.toLowerCase();

      return matchesSearch && matchesBrand && matchesCategory;
    });
  }, [products, search, brand, category]);
}

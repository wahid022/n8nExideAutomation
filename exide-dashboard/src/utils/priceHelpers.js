
export const PRICE_TYPE_FILTERS = {
  MRP: ["MRP_SOURCE_LABEL"],
  "Dealer Price": ["DP_DEALER_PRICE"],
  MRCP: ["MRCP", "MRCP_SOURCE_LABEL"],
  "Distributor Price": ["DISTRIBUTOR_PRICE"],
};

export function matchesPriceType(prices, selectedType) {
  if (!selectedType || selectedType === "All Price Types") {
    return true;
  }

  const acceptedTypes = PRICE_TYPE_FILTERS[selectedType];

  if (!acceptedTypes) return false;

  return prices.some((price) =>
    acceptedTypes.includes(
      String(price.price_type ?? "").trim().toUpperCase()
    )
  );
}

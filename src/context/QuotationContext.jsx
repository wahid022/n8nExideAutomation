
import { createContext, useContext, useState } from "react";

const QuotationContext = createContext(null);

export function QuotationProvider({ children }) {
  const [draft, setDraft] = useState({
    selected: [],
    customer: {
      name: "",
      company: "",
      phone: "",
      gstin: "",
      address: "",
    },
    quote: {
      number: `QTN-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`,
      date: new Date().toISOString().slice(0, 10),
      validDays: "7",
      terms:
        "Prices are valid for the period mentioned above. Goods are subject to availability.",
    },
  });

  return (
    <QuotationContext.Provider value={{ draft, setDraft }}>
      {children}
    </QuotationContext.Provider>
  );
}

export function useQuotationDraft() {
  const context = useContext(QuotationContext);

  if (!context) {
    throw new Error(
      "useQuotationDraft must be used inside QuotationProvider"
    );
  }

  return context;
}


import { createContext, useContext, useState } from "react";

const QuotationContext = createContext(null);


const createInitialDraft = () => ({
  selected: [],

  // Customer details are entered for each new quotation.
  customer: {
    name: "",
    company: "",
    phone: "",
    gstin: "",
    address: "",
  },

  // Hardcoded supplier details — prefilled in every quotation.
  supplier: {
    businessName: "Bharat Batteries",
    tagline: "Your Trusted Partner in Power Solutions",

    // Replace these sample values with your verified business details.
    gstin: "20ABCDE1234F1Z5",
    address:
      "Shop No. 12, Main Market, Jamshedpur, Jharkhand - 831001",
    state: "Jharkhand",
    stateCode: "20",
    phone: "9000000000",
    email: "accounts@bharatbatteries.example",

    paymentTerms: "Payment as mutually agreed",
    deliveryTerms: "Subject to stock availability",
  },

  quote: {
    number: `QTN-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`,
    date: new Date().toISOString().slice(0, 10),
    validDays: "7",
    terms:
      "Prices are valid for the period mentioned above. Goods are subject to availability.",
  },
});


export function QuotationProvider({ children }) {
  const [draft, setDraft] = useState(createInitialDraft);

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

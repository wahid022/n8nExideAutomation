import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { QuotationProvider } from "./context/QuotationContext";
import ProtectedRoute from "./components/ProtectedRoute";
import "./App.css";

const Dashboard         = lazy(() => import("./pages/Dashboard"));
const SalesDashboard    = lazy(() => import("./pages/SalesDashboard"));
const Quotation         = lazy(() => import("./pages/Quotation"));
const Customers         = lazy(() => import("./pages/Customers"));
const Sales             = lazy(() => import("./pages/Sales"));
const SalesOperations   = lazy(() => import("./pages/SalesOperations"));
const PaymentEntry      = lazy(() => import("./pages/PaymentEntry"));
const Purchase          = lazy(() => import("./pages/Purchase"));
const PurchaseDashboard = lazy(() => import("./pages/PurchaseDashboard"));
const PurchaseOperations= lazy(() => import("./pages/PurchaseOperations"));
const Vendors           = lazy(() => import("./pages/Vendors"));
const Reports           = lazy(() => import("./pages/Reports"));
const DocumentPage      = lazy(() => import("./pages/DocumentPage"));
const Login             = lazy(() => import("./pages/Login"));

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <QuotationProvider>
          <Suspense fallback={<div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "#64748b", fontSize: 14 }}>Loading…</div>}>
            <Routes>
              <Route path="/login" element={<Login />} />

              <Route element={<ProtectedRoute />}>
                <Route path="/dashboard" element={<Dashboard activePage="Dashboard" onNavigate={() => {}} />} />

                <Route path="/sales"           element={<SalesDashboard activePage="Sales Dashboard" />} />
                <Route path="/sales/invoices/new"       element={<DocumentPage docType="sales-invoice" />} />
                <Route path="/sales/invoices/:id/edit" element={<DocumentPage docType="sales-invoice" />} />
                <Route path="/sales/invoices"          element={<Sales activePage="Sales Invoice" />} />
                <Route path="/sales/orders/new"        element={<DocumentPage docType="sales-order" />} />
                <Route path="/sales/orders/:id/edit"   element={<DocumentPage docType="sales-order" />} />
                <Route path="/sales/orders"            element={<Sales activePage="Sales Order" />} />
                <Route path="sales/quotation"  element={<Quotation activePage="Quotation" onNavigate={() => {}} />} />
                <Route path="sales/customers"  element={<Customers activePage="Customers" />} />

                <Route path="/sales-operations/credit-notes"     element={<SalesOperations activePage="Credit Notes" />} />
                <Route path="/sales-operations/delivery-challans" element={<SalesOperations activePage="Delivery Challans" />} />
                <Route path="/sales-operations"                   element={<SalesOperations />} />

                <Route path="/accounting/payment-entry" element={<PaymentEntry activePage="Payment Entry" />} />

                <Route path="/purchase"           element={<PurchaseDashboard activePage="Purchase Dashboard" />} />
                <Route path="/purchase/invoices/new"       element={<DocumentPage docType="purchase-invoice" />} />
                <Route path="/purchase/invoices/:id/edit" element={<DocumentPage docType="purchase-invoice" />} />
                <Route path="/purchase/invoices"          element={<Purchase activePage="Purchase Invoice" />} />
                <Route path="/purchase/orders/new"        element={<DocumentPage docType="purchase-order" />} />
                <Route path="/purchase/orders/:id/edit"   element={<DocumentPage docType="purchase-order" />} />
                <Route path="/purchase/orders"            element={<Purchase activePage="Purchase Order" />} />
                <Route path="/purchase/debit-notes" element={<PurchaseOperations activePage="Debit Notes" />} />
                <Route path="/purchase/vendors"   element={<Vendors activePage="Vendor List" />} />

                <Route path="/reports/profit-loss"   element={<Reports activePage="Profit & Loss" />} />
                <Route path="/reports/balance-sheet" element={<Reports activePage="Balance Sheet" />} />
                <Route path="/reports/cash-flow"     element={<Reports activePage="Cash Flow" />} />
                <Route path="/reports/banking"       element={<Reports activePage="Banking" />} />
              </Route>

              <Route path="/"  element={<Navigate to="/dashboard" replace />} />
              <Route path="*"  element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
        </QuotationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

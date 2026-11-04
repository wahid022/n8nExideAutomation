
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import Dashboard from "./pages/Dashboard";
import SalesDashboard from "./pages/SalesDashboard";
import Quotation from "./pages/Quotation";
import Customers from "./pages/Customers";
import Sales from "./pages/Sales";
import SalesOperations from "./pages/SalesOperations";
import PaymentEntry from "./pages/PaymentEntry";
import Purchase from "./pages/Purchase";
import PurchaseDashboard from "./pages/PurchaseDashboard";
import PurchaseOperations from "./pages/PurchaseOperations";
import Vendors from "./pages/Vendors";
import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";

import { AuthProvider } from "./context/AuthContext";
import { QuotationProvider } from "./context/QuotationContext";

import "./App.css";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <QuotationProvider>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route element={<ProtectedRoute />}>
              {/* Main Dashboard */}
              <Route
                path="/dashboard"
                element={
                  <Dashboard
                    activePage="Dashboard"
                    onNavigate={() => {}}
                  />
                }
              />

              {/* Sales Dashboard */}
              <Route
                path="/sales"
                element={<SalesDashboard activePage="Sales Dashboard" />}
              />

              {/* Sales Invoice */}
              <Route
                path="/sales/invoices"
                element={<Sales activePage="Sales Invoice" />}
              />

              {/* Sales Order */}
              <Route
                path="/sales/orders"
                element={<Sales activePage="Sales Order" />}
              />

              {/* Quotation */}
              <Route
                path="sales/quotation"
                element={
                  <Quotation
                    activePage="Quotation"
                    onNavigate={() => {}}
                  />
                }
              />

              {/* Customers */}
              <Route
                path="sales/customers"
                element={<Customers activePage="Customers" />}
              />

              {/* Credit Notes - Separate Page */}
              <Route
                path="/sales-operations/credit-notes"
                element={<SalesOperations activePage="Credit Notes" />}
              />

              {/* Delivery Challans - Separate Page */}
              <Route
                path="/sales-operations/delivery-challans"
                element={<SalesOperations activePage="Delivery Challans" />}
              />

              {/* Existing Sales Operations */}
              <Route
                path="/sales-operations"
                element={<SalesOperations />}
              />

              {/* Accounting - Payment Entry */}
              <Route
                path="/accounting/payment-entry"
                element={<PaymentEntry activePage="Payment Entry" />}
              />

              {/* Purchase Dashboard */}
              <Route
                path="/purchase"
                element={<PurchaseDashboard activePage="Purchase Dashboard" />}
              />

              {/* Purchase Invoice */}
              <Route
                path="/purchase/invoices"
                element={<Purchase activePage="Purchase Invoice" />}
              />

              {/* Purchase Order */}
              <Route
                path="/purchase/orders"
                element={<Purchase activePage="Purchase Order" />}
              />

              {/* Debit Notes */}
              <Route
                path="/purchase/debit-notes"
                element={<PurchaseOperations activePage="Debit Notes" />}
              />

              {/* Vendor List */}
              <Route
                path="/purchase/vendors"
                element={<Vendors activePage="Vendor List" />}
              />
            </Route>

            <Route
              path="/"
              element={<Navigate to="/dashboard" replace />}
            />

            <Route
              path="*"
              element={<Navigate to="/dashboard" replace />}
            />
          </Routes>
        </QuotationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

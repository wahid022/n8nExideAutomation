
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import Dashboard from "./pages/Dashboard";
import SalesDashboard from "./pages/SalesDashboard";
import Quotation from "./pages/Quotation";
import Customers from "./pages/Customers";
import Sales from "./pages/Sales";
import SalesOperations from "./pages/SalesOperations";
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
            {/* Authentication */}
            <Route path="/login" element={<Login />} />

            {/* Protected application routes */}
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
                path="/sales/quotation"
                element={
                  <Quotation
                    activePage="Quotation"
                    onNavigate={() => {}}
                  />
                }
              />

              {/* Credit Notes */}
              <Route
                path="/sales-operations/credit-notes"
                element={<SalesOperations activePage="Credit Notes" />}
              />

              {/* Delivery Challan */}
              <Route
                path="/sales-operations/delivery-challans"
                element={<SalesOperations activePage="Delivery Challan" />}
              />

              {/* Customers */}
              <Route
                path="/sales/customers"
                element={<Customers activePage="Customers" />}
              />
            </Route>

            {/* Default redirects */}
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

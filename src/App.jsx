
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Quotation from "./pages/Quotation";
import { QuotationProvider } from "./context/QuotationContext";
import "./App.css";

export default function App() {
  return (
    <BrowserRouter>
      <QuotationProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          <Route
            path="/dashboard"
            element={
              <Dashboard
                activePage="Dashboard"
                onNavigate={() => {}}
              />
            }
          />

          <Route
            path="/quotation"
            element={
              <Quotation
                activePage="Quotation"
                onNavigate={() => {}}
              />
            }
          />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </QuotationProvider>
    </BrowserRouter>
  );
}

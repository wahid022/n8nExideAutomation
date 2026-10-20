
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import Dashboard from "./pages/Dashboard";
import Quotation from "./pages/Quotation";
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

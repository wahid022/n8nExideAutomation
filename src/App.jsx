import { useState } from "react";
import Dashboard from "./pages/Dashboard";
import Quotation from "./pages/Quotation";
import "./App.css";

export default function App() {
  const [activePage, setActivePage] = useState("Dashboard");

  return activePage === "Quotation" ? (
    <Quotation activePage={activePage} onNavigate={setActivePage} />
  ) : (
    <Dashboard activePage={activePage} onNavigate={setActivePage} />
  );
}

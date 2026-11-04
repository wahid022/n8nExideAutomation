export const AVATAR_PALETTE = [
  "#4F46E5", "#059669", "#DC2626", "#D97706",
  "#0EA5E9", "#7C3AED", "#0D9488", "#DB2777",
];

export const money = (value, decimals = 2) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: decimals,
  }).format(Number(value || 0));

export const moneyCompact = (value) => money(value, 0);

export const today = () => new Date().toISOString().slice(0, 10);

export const formatDate = (value) =>
  value ? String(value).slice(0, 10) : "—";

export const fmtDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

export const statusClass = (status) =>
  String(status || "").toLowerCase().replaceAll(" ", "-");

export const avatarColor = (name) =>
  AVATAR_PALETTE[(name || "?").charCodeAt(0) % AVATAR_PALETTE.length];

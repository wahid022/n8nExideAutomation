import { useEffect } from "react";

export function useAutoPrint(enabled, delay = 400) {
  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(() => window.print(), delay);
    return () => clearTimeout(t);
  }, [enabled]);
}

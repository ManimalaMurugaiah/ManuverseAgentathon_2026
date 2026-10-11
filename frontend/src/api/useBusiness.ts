import { useSearchParams } from "react-router-dom";

/** The business filter lives in the URL (`?business=`) so every page and link shares it. */
export function useBusiness(): { business: string; setBusiness: (value: string) => void; withBusiness: (path: string) => string } {
  const [searchParams, setSearchParams] = useSearchParams();
  const business = searchParams.get("business") ?? "";

  const setBusiness = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set("business", value);
    else next.delete("business");
    setSearchParams(next, { replace: true });
  };

  const withBusiness = (path: string) => {
    if (!business) return path;
    return `${path}${path.includes("?") ? "&" : "?"}business=${encodeURIComponent(business)}`;
  };

  return { business, setBusiness, withBusiness };
}

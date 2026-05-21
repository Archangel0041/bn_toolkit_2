import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const SCRIPT_SRC = "https://media.ethicalads.io/media/client/ethicalads.min.js";
const PUBLISHER =
  (import.meta.env.VITE_ETHICAL_ADS_PUBLISHER as string | undefined) ||
  "vogelslabaratory";

function ensureScript() {
  if (typeof document === "undefined") return;
  if (document.querySelector(`script[src="${SCRIPT_SRC}"]`)) return;
  const s = document.createElement("script");
  s.src = SCRIPT_SRC;
  s.async = true;
  s.id = "ethicaladsjs";
  document.head.appendChild(s);
}

interface EthicalAdProps {
  /** EthicalAds placement type. */
  type?: "image" | "text" | "image-stickybox";
  /** Layout style; "fixed-footer" renders a small dismissible footer. */
  style?: "fixed-footer" | "stickybox" | "default";
  className?: string;
  /** Optional keywords to improve targeting. */
  keywords?: string[];
}

/**
 * Non-obtrusive EthicalAds slot. Hidden for users with access (Discord-verified),
 * and never rendered in the Lovable dev environment.
 */
export function EthicalAd({
  type = "image",
  style = "default",
  className,
  keywords,
}: EthicalAdProps) {
  const { hasAccess, loading } = useAuth();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (loading || hasAccess) return;
    ensureScript();
    // Re-process ads if the script has already loaded
    const w = window as unknown as { ethicalads?: { load: () => void } };
    if (w.ethicalads?.load) {
      try {
        w.ethicalads.load();
      } catch {
        /* noop */
      }
    }
  }, [loading, hasAccess]);

  if (loading || hasAccess) return null;

  return (
    <div
      ref={ref}
      data-ea-publisher={PUBLISHER}
      data-ea-type={type}
      {...(style !== "default" ? { "data-ea-style": style } : {})}
      {...(keywords?.length ? { "data-ea-keywords": keywords.join("|") } : {})}
      className={cn(
        "ethical-ad not-prose mx-auto my-6 max-w-2xl text-sm",
        className,
      )}
    />
  );
}

export default EthicalAd;

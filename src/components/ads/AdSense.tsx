import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const PUBLISHER_ID =
  (import.meta.env.VITE_ADSENSE_PUBLISHER_ID as string | undefined) ||
  "ca-pub-0000000000000000"; // TODO: replace with real AdSense publisher ID

const SCRIPT_SRC = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${PUBLISHER_ID}`;

function ensureScript() {
  if (typeof document === "undefined") return;
  if (PUBLISHER_ID === "ca-pub-0000000000000000") return; // don't load with placeholder
  if (document.querySelector('script[data-adsense="true"]')) return;
  const s = document.createElement("script");
  s.src = SCRIPT_SRC;
  s.async = true;
  s.crossOrigin = "anonymous";
  s.dataset.adsense = "true";
  document.head.appendChild(s);
}

interface AdSenseProps {
  /** AdSense ad slot ID. Optional — omit to use auto-sized responsive unit. */
  slot?: string;
  className?: string;
  /** Ad format: 'auto' (responsive), 'fluid' (in-article), etc. */
  format?: "auto" | "fluid" | "rectangle";
  /** Full-width responsive ad. */
  responsive?: boolean;
}

/**
 * Non-obtrusive Google AdSense slot. Hidden for users with access
 * (Discord-verified) and skipped entirely until a real publisher ID is set.
 */
export function AdSense({
  slot,
  className,
  format = "auto",
  responsive = true,
}: AdSenseProps) {
  const { hasAccess, loading } = useAuth();
  const pushedRef = useRef(false);

  useEffect(() => {
    if (loading || hasAccess) return;
    if (PUBLISHER_ID === "ca-pub-0000000000000000") return;
    ensureScript();
    if (pushedRef.current) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      (w.adsbygoogle = w.adsbygoogle || []).push({});
      pushedRef.current = true;
    } catch {
      /* noop */
    }
  }, [loading, hasAccess]);

  if (loading || hasAccess) return null;

  // Hide entirely until a real publisher ID + slot is configured.
  if (PUBLISHER_ID === "ca-pub-0000000000000000") {
    return null;
  }


  return (
    <ins
      className={cn("adsbygoogle mx-auto my-6 block max-w-2xl", className)}
      style={{ display: "block" }}
      data-ad-client={PUBLISHER_ID}
      {...(slot ? { "data-ad-slot": slot } : {})}
      data-ad-format={format}
      data-full-width-responsive={responsive ? "true" : "false"}
    />
  );
}

export default AdSense;

/**
 * Registers the asset service worker and prewarms the cache with known
 * static icons (damage types + every loaded status-effect family).
 *
 * The SW caches every Supabase Art-bucket icon with stale-while-revalidate,
 * so after the first hit each icon loads instantly from disk on every page.
 */

import { getDamageTypeIconUrl } from "@/lib/damageImages";
import { getAllStatusEffectFamilies, getStatusEffectIconUrl } from "@/lib/statusEffects";

let registered = false;
let prewarmed = false;

export async function registerAssetServiceWorker(): Promise<void> {
  if (registered) return;
  registered = true;

  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  // Service workers require a secure context. Skip in iframes that disallow them.
  try {
    await navigator.serviceWorker.register("/asset-sw.js", { scope: "/" });
  } catch (err) {
    console.warn("[assetCache] SW registration failed:", err);
  }
}

/**
 * Once the gameDataStore is loaded, ask the SW to prefetch the known set of
 * static icons during browser idle time so first-paint of common UI is instant.
 */
export function prewarmStaticIcons(): void {
  if (prewarmed) return;
  prewarmed = true;

  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  const schedule = (cb: () => void) => {
    const ric = (window as any).requestIdleCallback as
      | ((cb: () => void, opts?: { timeout: number }) => number)
      | undefined;
    if (ric) ric(cb, { timeout: 4000 });
    else setTimeout(cb, 1500);
  };

  schedule(() => {
    try {
      const urls = collectStaticIconUrls();
      if (!urls.length) return;
      navigator.serviceWorker.ready
        .then((reg) => {
          reg.active?.postMessage({ type: "prewarm", urls });
        })
        .catch(() => {});
    } catch (err) {
      console.warn("[assetCache] prewarm failed:", err);
    }
  });
}

function collectStaticIconUrls(): string[] {
  const urls = new Set<string>();

  // Damage type UI icons (fixed set 1..6).
  for (let i = 1; i <= 6; i++) {
    const u = getDamageTypeIconUrl(i);
    if (u) urls.add(u);
  }

  // All status-effect family icons present in the loaded config.
  try {
    for (const { id } of getAllStatusEffectFamilies()) {
      const u = getStatusEffectIconUrl(id);
      if (u) urls.add(u);
    }
  } catch {
    /* status effects may not be loaded yet — caller handles ordering */
  }

  return Array.from(urls);
}

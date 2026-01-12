import { useState, useEffect } from "react";
import { getUnitImageUrl } from "@/lib/unitImages";
import { fetchAndCacheIcon } from "@/lib/cacheStorage";
import { cn } from "@/lib/utils";

interface UnitImageProps {
  iconName: string;
  alt: string;
  className?: string;
  fallbackClassName?: string;
}

export function UnitImage({ iconName, alt, className, fallbackClassName }: UnitImageProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [cachedUrl, setCachedUrl] = useState<string | null>(null);
  
  const originalUrl = getUnitImageUrl(iconName);

  useEffect(() => {
    let isMounted = true;
    
    async function loadCachedIcon() {
      if (!originalUrl) return;
      
      try {
        const cached = await fetchAndCacheIcon(originalUrl);
        if (isMounted && cached) {
          setCachedUrl(cached);
        }
      } catch {
        // Fall back to original URL
        if (isMounted) {
          setCachedUrl(originalUrl);
        }
      }
    }
    
    loadCachedIcon();
    
    return () => {
      isMounted = false;
      // Revoke blob URL on unmount
      if (cachedUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(cachedUrl);
      }
    };
  }, [originalUrl]);

  if (!originalUrl || hasError) {
    return (
      <div className={cn(
        "flex items-center justify-center bg-muted text-muted-foreground text-xs font-medium",
        fallbackClassName || className
      )}>
        {iconName?.slice(0, 2).toUpperCase() || "??"}
      </div>
    );
  }

  const displayUrl = cachedUrl || originalUrl;

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {isLoading && (
        <div className="absolute inset-0 bg-muted animate-pulse" />
      )}
      <img
        src={displayUrl}
        alt={alt}
        className={cn("w-full h-full object-cover", isLoading && "opacity-0")}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setIsLoading(false);
          setHasError(true);
        }}
      />
    </div>
  );
}

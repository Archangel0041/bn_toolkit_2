import { memo, useEffect, useState } from "react";
import { getUnitImageUrl } from "@/lib/unitImages";
import { cn } from "@/lib/utils";

// Track already-loaded unit image URLs (prevents skeleton flash on remount)
const loadedUnitImageUrls = new Set<string>();

interface UnitImageProps {
  iconName: string;
  alt: string;
  className?: string;
  fallbackClassName?: string;
}

// Memoize to prevent unnecessary re-renders
export const UnitImage = memo(function UnitImage({ iconName, alt, className, fallbackClassName }: UnitImageProps) {
  const imageUrl = getUnitImageUrl(iconName);

  // Note: after a full page refresh this Set is empty again, so we also use a
  // short "delayed skeleton" to avoid flashing when the browser serves from cache.
  const alreadySeenThisSession = imageUrl ? loadedUnitImageUrls.has(imageUrl) : false;

  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(alreadySeenThisSession);
  const [showPlaceholder, setShowPlaceholder] = useState(!alreadySeenThisSession ? false : false);

  useEffect(() => {
    // Reset error/loading when the image changes
    setHasError(false);

    if (!imageUrl) return;

    const seen = loadedUnitImageUrls.has(imageUrl);
    setIsLoaded(seen);
    setShowPlaceholder(false);

    if (seen) return;

    // Only show skeleton if the image isn't loaded quickly (prevents flash on refresh)
    const timeoutId = window.setTimeout(() => setShowPlaceholder(true), 120);
    return () => window.clearTimeout(timeoutId);
  }, [imageUrl]);

  if (!imageUrl || hasError) {
    return (
      <div className={cn(
        "flex items-center justify-center bg-muted text-muted-foreground text-xs font-medium",
        fallbackClassName || className
      )}>
        {iconName?.slice(0, 2).toUpperCase() || "??"}
      </div>
    );
  }

  const isLoading = !isLoaded;
  const shouldShowSkeleton = isLoading && showPlaceholder;

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {shouldShowSkeleton && (
        <div className="absolute inset-0 bg-muted animate-pulse" />
      )}
      <img
        src={imageUrl}
        alt={alt}
        loading="lazy"
        decoding="async"
        crossOrigin="anonymous"
        className={cn("w-full h-full object-cover", shouldShowSkeleton && "opacity-0")}
        onLoad={() => {
          loadedUnitImageUrls.add(imageUrl);
          setIsLoaded(true);
          setShowPlaceholder(false);
        }}
        onError={() => {
          setShowPlaceholder(false);
          setIsLoaded(false);
          setHasError(true);
        }}
      />
    </div>
  );
});

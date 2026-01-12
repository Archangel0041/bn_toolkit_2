import { memo, useEffect, useState } from "react";
import { getUnitImageUrl } from "@/lib/unitImages";
import { getCachedImageUrl, isImageInMemoryCache } from "@/lib/imageCache";
import { cn } from "@/lib/utils";

interface UnitImageProps {
  iconName: string;
  alt: string;
  className?: string;
  fallbackClassName?: string;
}

// Memoize to prevent unnecessary re-renders
export const UnitImage = memo(function UnitImage({ iconName, alt, className, fallbackClassName }: UnitImageProps) {
  const originalUrl = getUnitImageUrl(iconName);
  
  // Check if already in memory cache (instant)
  const cachedUrl = originalUrl && isImageInMemoryCache(originalUrl) ? originalUrl : null;
  
  const [imageSrc, setImageSrc] = useState<string | null>(cachedUrl);
  const [hasError, setHasError] = useState(false);
  const [showPlaceholder, setShowPlaceholder] = useState(false);

  useEffect(() => {
    if (!originalUrl) return;
    
    // If already in memory cache, we already have it
    if (isImageInMemoryCache(originalUrl)) {
      getCachedImageUrl(originalUrl).then(url => {
        if (url) setImageSrc(url);
      });
      return;
    }
    
    // Show placeholder after a short delay (prevents flash on fast loads)
    const timeoutId = window.setTimeout(() => setShowPlaceholder(true), 100);
    
    // Fetch from cache or network
    getCachedImageUrl(originalUrl).then(url => {
      clearTimeout(timeoutId);
      if (url) {
        setImageSrc(url);
        setShowPlaceholder(false);
      } else {
        setHasError(true);
        setShowPlaceholder(false);
      }
    }).catch(() => {
      clearTimeout(timeoutId);
      setHasError(true);
      setShowPlaceholder(false);
    });
    
    return () => clearTimeout(timeoutId);
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

  // Still loading from cache
  if (!imageSrc) {
    return (
      <div className={cn("relative overflow-hidden", className)}>
        {showPlaceholder && (
          <div className="absolute inset-0 bg-muted animate-pulse" />
        )}
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden", className)}>
      <img
        src={imageSrc}
        alt={alt}
        decoding="async"
        className="w-full h-full object-cover"
        onError={() => setHasError(true)}
      />
    </div>
  );
});

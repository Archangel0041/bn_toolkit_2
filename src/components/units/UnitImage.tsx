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
  
  // If this image was already loaded before, skip the loading state entirely
  const alreadyCached = imageUrl ? loadedUnitImageUrls.has(imageUrl) : false;
  
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(!alreadyCached);

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

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {isLoading && (
        <div className="absolute inset-0 bg-muted animate-pulse" />
      )}
      <img
        src={imageUrl}
        alt={alt}
        loading="lazy"
        decoding="async"
        crossOrigin="anonymous"
        className={cn("w-full h-full object-cover", isLoading && "opacity-0")}
        onLoad={() => {
          loadedUnitImageUrls.add(imageUrl);
          setIsLoading(false);
        }}
        onError={() => {
          setIsLoading(false);
          setHasError(true);
        }}
      />
    </div>
  );
});

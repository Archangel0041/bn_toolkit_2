import { memo, useState } from "react";
import { getUnitImageUrl } from "@/lib/unitImages";
import { cn } from "@/lib/utils";

interface UnitImageProps {
  iconName: string;
  alt: string;
  className?: string;
  fallbackClassName?: string;
}

// Memoize to prevent unnecessary re-renders
export const UnitImage = memo(function UnitImage({ iconName, alt, className, fallbackClassName }: UnitImageProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  
  const imageUrl = getUnitImageUrl(iconName);

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
      {!isLoaded && (
        <div className="absolute inset-0 bg-muted animate-pulse" />
      )}
      <img
        src={imageUrl}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={cn("w-full h-full object-cover", !isLoaded && "opacity-0")}
        onLoad={() => setIsLoaded(true)}
        onError={() => {
          setIsLoaded(true);
          setHasError(true);
        }}
      />
    </div>
  );
});

import { useState } from "react";
import { getUnitImageUrl } from "@/lib/unitImages";
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
      {isLoading && (
        <div className="absolute inset-0 bg-muted animate-pulse" />
      )}
      <img
        src={imageUrl}
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

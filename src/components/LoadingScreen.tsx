import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";

interface LoadingScreenProps {
  progress?: number;
  message?: string;
}

export function LoadingScreen({ progress = 0, message = "Loading game data..." }: LoadingScreenProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-6 max-w-md w-full px-8">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold">{message}</h2>
          <p className="text-sm text-muted-foreground">
            Fetching configuration from server...
          </p>
        </div>
        
        <div className="w-full space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground text-center">
            {Math.round(progress)}%
          </p>
        </div>
      </div>
    </div>
  );
}

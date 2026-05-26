import { useAuth } from "@/contexts/AuthContext";
import NotFound from "@/pages/NotFound";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

// Check if we're in a Lovable-hosted environment (preview, published, or custom domain)
function isLovableEnvironment(): boolean {
  const hostname = window.location.hostname;
  return (
    hostname.includes('lovableproject.com') ||
    hostname.includes('lovable.app') ||
    hostname.includes('localhost') ||
    hostname.includes('127.0.0.1') ||
    hostname.endsWith('vogelslabaratory.com')
  );
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading, hasAccess } = useAuth();

  // Allow access in Lovable environment without auth
  if (isLovableEnvironment()) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user || !hasAccess) {
    return <NotFound />;
  }

  return <>{children}</>;
}

// Export for use in other components
export { isLovableEnvironment };

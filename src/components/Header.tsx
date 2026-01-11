import { LanguageSelector } from "./LanguageSelector";
import { ThemeToggle } from "./ThemeToggle";
import { Link } from "react-router-dom";
import { Sword, Upload, Shield, LogIn, LogOut, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

export function Header() {
  const { user, isAdmin, canUpload, signOut, loading } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-bold text-xl">
          <Sword className="h-6 w-6" />
          <span>Battle Nations Toolkit</span>
        </Link>
        <div className="flex items-center gap-2">
          {!loading && (
            <>
              {canUpload && (
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/upload" className="gap-2">
                    <Upload className="h-4 w-4" />
                    Upload
                  </Link>
                </Button>
              )}
              {isAdmin && (
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/admin" className="gap-2">
                    <Shield className="h-4 w-4" />
                    Admin
                  </Link>
                </Button>
              )}
              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <User className="h-4 w-4" />
                      <span className="hidden sm:inline">{user.email?.split('@')[0]}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem disabled>
                      <span className="text-muted-foreground">{user.email}</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => signOut()}>
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button variant="outline" size="sm" asChild>
                  <Link to="/auth" className="gap-2">
                    <LogIn className="h-4 w-4" />
                    Sign In
                  </Link>
                </Button>
              )}
            </>
          )}
          <ThemeToggle />
          <LanguageSelector />
        </div>
      </div>
    </header>
  );
}

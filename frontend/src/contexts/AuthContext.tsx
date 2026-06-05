"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import api from "@/lib/api";

type User = {
  id: number;
  email: string;
  name?: string;
  plan?: string;
  is_admin?: boolean;
  role?: string;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem("access_token");
      
      // Check if we're on login page with OAuth callback params - don't interfere
      if (pathname === "/login") {
        const searchParams = new URLSearchParams(window.location.search);
        if (searchParams.get("token")) {
          setLoading(false);
          return; // Let login page handle the OAuth callback
        }
      }
      
      if (!token) {
        setLoading(false);
        if (pathname !== "/" && pathname !== "/login" && pathname !== "/register") {
          router.push("/login");
        }
        return;
      }

      try {
        const response = await api.get("/auth/me");
        setUser(response.data.user);
        
        // Ensure workspace context is preserved on auth init
        if (!localStorage.getItem("active_workspace_id")) {
          // Fetch workspaces to set a default one
          try {
            const wsResponse = await api.get("/workspaces");
            if (wsResponse.data.workspaces && wsResponse.data.workspaces.length > 0) {
              localStorage.setItem("active_workspace_id", wsResponse.data.workspaces[0].id.toString());
            }
          } catch (wsErr) {
            console.error("Failed to fetch workspaces", wsErr);
          }
        }
      } catch (err) {
        console.error("Auth verification failed", err);
        localStorage.removeItem("access_token");
        localStorage.removeItem("active_workspace_id");
        if (pathname !== "/" && pathname !== "/login" && pathname !== "/register") {
          router.push("/login");
        }
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, [pathname, router]);

  const login = (token: string, userData: User) => {
    localStorage.setItem("access_token", token);
    setUser(userData);
    router.push("/dashboard");
  };

  const logout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("active_workspace_id");
    setUser(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

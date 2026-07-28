import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface AuthState {
  user: { id: string; subiektUzId: number; role: string } | null;
  operatorName: string;
  warehouse: string;
}

interface AuthContextType extends AuthState {
  login: (user: AuthState["user"], name: string, wh: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    try {
      const saved = localStorage.getItem("pomagier_session");
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          user: parsed.user || null,
          operatorName: parsed.operatorName || "",
          warehouse: parsed.warehouse || "",
        };
      }
    } catch {
      /* corrupted localStorage entry — ignore and reset */
    }
    return { user: null, operatorName: "", warehouse: "" };
  });

  const login = useCallback((user: AuthState["user"], name: string, wh: string) => {
    const session = { user, operatorName: name, warehouse: wh };
    localStorage.setItem("pomagier_session", JSON.stringify(session));
    setState({ user, operatorName: name, warehouse: wh });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("pomagier_session");
    setState({ user: null, operatorName: "", warehouse: "" });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}

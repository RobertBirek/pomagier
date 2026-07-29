import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface AuthState {
  token: string | null;
  user: { id: string; subiektUzId: number; role: string } | null;
  operatorName: string;
  warehouse: string;
}

interface AuthContextType extends AuthState {
  login: (token: string, user: AuthState["user"], name: string, wh: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    try {
      const saved = localStorage.getItem("pomagier_auth");
      if (saved) return JSON.parse(saved);
    } catch {
      /* localStorage parse failed */
    }
    return { token: null, user: null, operatorName: "", warehouse: "" };
  });

  const login = useCallback((token: string, user: AuthState["user"], name: string, wh: string) => {
    const session = { token, user, operatorName: name, warehouse: wh };
    localStorage.setItem("pomagier_auth", JSON.stringify(session));
    setState(session);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("pomagier_auth");
    setState({ token: null, user: null, operatorName: "", warehouse: "" });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>{children}</AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}

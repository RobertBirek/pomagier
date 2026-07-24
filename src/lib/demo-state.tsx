import { createContext, useContext, useState, type ReactNode } from "react";

type DemoState = {
  offline: boolean;
  setOffline: (v: boolean) => void;
  currentOperator: string;
  setCurrentOperator: (v: string) => void;
  currentWarehouse: string;
  setCurrentWarehouse: (v: string) => void;
  pendingSync: number;
  bumpPendingSync: (n?: number) => void;
  clearPendingSync: () => void;
  battery: number;
};

const Ctx = createContext<DemoState | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [offline, setOffline] = useState(false);
  const [currentOperator, setCurrentOperator] = useState("Marek Wiśniewski");
  const [currentWarehouse, setCurrentWarehouse] = useState("MAG");
  const [pendingSync, setPendingSync] = useState(3);
  return (
    <Ctx.Provider
      value={{
        offline,
        setOffline,
        currentOperator,
        setCurrentOperator,
        currentWarehouse,
        setCurrentWarehouse,
        pendingSync,
        bumpPendingSync: (n = 1) => setPendingSync((p) => p + n),
        clearPendingSync: () => setPendingSync(0),
        battery: 68,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useDemo() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDemo must be used within DemoProvider");
  return v;
}

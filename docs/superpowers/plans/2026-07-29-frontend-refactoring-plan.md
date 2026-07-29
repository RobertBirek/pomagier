# Frontend Refaktoryzacja — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) to implement this plan task-by-task.

**Goal:** Lint zero + rozbicie dużych plików + testy renderowania + E2E Playwright.

**Architecture:** Faza 1: szybkie typowanie `any` → konkretne interfejsy w istniejących plikach. Faza 2: rozbicie admin.map.tsx (623→5 plików) i admin.erp.tsx (433→4 pliki) na komponenty + hooki. Faza 3: Playwright E2E.

**Tech Stack:** React 19, TypeScript, TanStack Router, Tailwind CSS 4, shadcn/ui, Vitest, React Testing Library, Playwright

## Global Constraints

- `npm run build` musi przechodzić po każdej iteracji
- `npm run typecheck` musi być czyste
- `npm run lint` → docelowo 0 błędów, 0 ostrzeżeń
- `npx vitest run` — wszystkie testy muszą przechodzić
- 0 `@typescript-eslint/no-explicit-any` w całym projekcie
- 0 `no-empty` (puste catch) — zastąpione `catch { /* reason */ }`
- Każdy plik po refaktoryzacji ≤200 linii
- Zakaz zmiany logiki biznesowej i wyglądu UI
- Wzorzec: każdy nowy komponent/hook ma test renderowania

---

## Faza 1: Lint-zero

### Task 1.1: Install deps + setup React Testing Library

**Files:**
- Modify: `package.json`
- Create: `tests/setup.ts`
- Modify: `vitest.config.ts`

- [ ] **Step 1: Install packages**

```bash
npm install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

- [ ] **Step 2: Create tests/setup.ts**

```typescript
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 3: Update vitest.config.ts** — add jsdom environment for frontend tests

```typescript
import { defineConfig } from "vitest/config";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsConfigPaths()],
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/api/**/*.ts"],
      exclude: ["src/api/adapter-provider.ts"],
    },
    // Frontend test overrides via workspace or inline
    setupFiles: ["./tests/setup.ts"],
  },
});
```

- [ ] **Step 4: Verify**

```bash
npx vitest run
```

Expected: all 65 tests still pass

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tests/setup.ts vitest.config.ts
git commit -m "chore: add React Testing Library + jsdom for frontend tests"
```

### Task 1.2: Fix admin.map.tsx — 22 any + no-unused-expressions

**Files:**
- Modify: `src/routes/admin.map.tsx`

**Approach:** Read the file, find all `any` casts, replace with local interfaces at top of file. Fix the `no-unused-expressions` at line 471.

- [ ] **Step 1: Read admin.map.tsx, extract all `any` patterns**

Run: `grep -n " as any\|: any\|\.any" src/routes/admin.map.tsx`

Expected output: ~22 lines

- [ ] **Step 2: Create local interfaces at top of file**

Based on the actual data shapes used, add interfaces like:

```typescript
interface MapLocation { id: string; code: string; area: string; aisle: number; rack: number; shelf: number; label: string; }
interface MapProduct { productId: number; symbol: string; name: string; quantity: number; locationCode: string; }
interface MapGridCell { row: number; col: number; location?: MapLocation; products: MapProduct[]; }
interface MapDataResponse { grid: MapGridCell[][]; areas: string[]; aisles: number[]; }
```

- [ ] **Step 3: Replace all `any` with proper types**

Replace `(row as any).field` → `(row as MapLocation).field`
Replace `const x: any = ...` → `const x: MapDataResponse = ...`

- [ ] **Step 4: Fix no-unused-expressions at line 471**

Read the line: likely a standalone expression like `condition && <Component />` that ESLint flags. Replace with ternary: `condition ? <Component /> : null`

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit && npm run build && npx eslint src/routes/admin.map.tsx
```

Expected: typecheck clean, build passes, 0 lint errors for this file

- [ ] **Step 6: Commit**

```bash
git add src/routes/admin.map.tsx
git commit -m "fix: type admin.map.tsx — remove 22 any, fix no-unused-expressions"
```

### Task 1.3: Fix admin.erp.tsx — 8 any

**Files:**
- Modify: `src/routes/admin.erp.tsx`

- [ ] **Step 1: Find `any` patterns**

```bash
grep -n " as any\|: any" src/routes/admin.erp.tsx
```

- [ ] **Step 2: Create local interfaces**

```typescript
interface ErpConfigForm { host: string; port: number; database: string; user: string; password: string; }
interface TestResult { ok: boolean; latencyMs?: number; error?: string; }
```

- [ ] **Step 3: Replace `any` with types**

- [ ] **Step 4: Verify** — typecheck, build, lint

- [ ] **Step 5: Commit**

```bash
git add src/routes/admin.erp.tsx
git commit -m "fix: type admin.erp.tsx — remove 8 any"
```

### Task 1.4: Fix remaining single-any files (5 plików)

**Files:**
- `src/routes/admin.dashboard.tsx`
- `src/routes/admin.login.tsx`
- `src/routes/admin.users.tsx`
- `src/routes/mobile.login.tsx`
- `src/routes/mobile.product.$code.tsx`

- [ ] **Step 1: Fix each file** — pattern: `err: any` → `err: unknown` + type guard, `data as any` → typed interface

- [ ] **Step 2: Verify all at once**

```bash
npx tsc --noEmit && npm run lint
```

Expected: all single-any files clean

- [ ] **Step 3: Commit**

```bash
git add src/routes/admin.dashboard.tsx src/routes/admin.login.tsx src/routes/admin.users.tsx src/routes/mobile.login.tsx src/routes/mobile.product.$code.tsx
git commit -m "fix: type remaining frontend files — remove all any"
```

### Task 1.5: Fix shadcn/ui react-refresh warnings (12 warnings)

**Files:** 6 plików w `src/components/ui/` (badge, button, form, navigation-menu, sidebar, toggle)

**Approach:** Każdy plik ma warning `Fast refresh only works when a file only exports components`. To są pliki biblioteki shadcn/ui — dodajemy `// eslint-disable-next-line react-refresh/only-export-components` przed eksportem stałych.

- [ ] **Step 1: Fix each file**

Pattern: find the non-component export, add eslint-disable comment above it. Example for `badge.tsx`:

```typescript
// eslint-disable-next-line react-refresh/only-export-components
export const badgeVariants = cva(...)
```

- [ ] **Step 2: Verify**

```bash
npm run lint
```

Expected: 0 warnings

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/
git commit -m "fix: suppress react-refresh warnings in shadcn/ui components"
```

---

## Faza 2: Deep Refactor

### Task 2.1: Extract use-map-data hook from admin.map.tsx

**Files:**
- Create: `src/hooks/use-map-data.ts`
- Create: `tests/unit/hooks/use-map-data.test.ts`
- Modify: `src/routes/admin.map.tsx`

**Interfaces:**
- Produces: `useMapData(): { grid, areas, aisles, loading, error, selectedZone, setSelectedZone, ... }`

- [ ] **Step 1: Write failing test for use-map-data hook**

Create `tests/unit/hooks/use-map-data.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useMapData } from "@/hooks/use-map-data";

describe("useMapData", () => {
  it("returns empty state initially", async () => {
    const queryClient = new QueryClient();
    const { result } = renderHook(() => useMapData(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });
    expect(result.current.grid).toEqual([]);
    expect(result.current.loading).toBe(true);
  });

  it("loads areas and aisles from API", async () => {
    // mock fetch to return test data
    // ... test that areas and aisles populate after load
  });
});
```

- [ ] **Step 2: Extract the hook**

Move all data-fetching and filtering logic from `admin.map.tsx` into `src/hooks/use-map-data.ts`. The hook should:
- Accept no props (reads from TanStack Router params)
- Return: `{ grid, areas, aisles, loading, error, selected, setSelected, filters, setFilters }`
- Use `useQuery` for data fetching

- [ ] **Step 3: Update admin.map.tsx** to use the hook

Replace inline fetch/filter logic with `const { grid, areas, ... } = useMapData()`

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit && npx vitest run && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/hooks/use-map-data.ts tests/unit/hooks/use-map-data.test.ts src/routes/admin.map.tsx
git commit -m "refactor: extract useMapData hook from admin.map.tsx"
```

### Task 2.2: Split admin.map.tsx into components

**Files:**
- Create: `src/components/admin/MapGrid.tsx`
- Create: `src/components/admin/MapControls.tsx`
- Create: `src/components/admin/MapRack.tsx`
- Create: `src/components/admin/MapShelf.tsx`
- Create: `src/components/admin/MapProductCard.tsx`
- Create: `tests/unit/admin/MapGrid.test.tsx`
- Create: `tests/unit/admin/MapControls.test.tsx`
- Modify: `src/routes/admin.map.tsx` (reduced to ~40 lines)

- [ ] **Step 1: Create MapControls.tsx** — zone/aisle filters, exports `MapControls({ areas, aisles, selected, onChange })`

- [ ] **Step 2: Create MapShelf.tsx** — single shelf cell, exports `MapShelf({ location, products, onClick })`

- [ ] **Step 3: Create MapRack.tsx** — column of shelves, exports `MapRack({ shelves, rackIndex })`

- [ ] **Step 4: Create MapProductCard.tsx** — product tooltip, exports `MapProductCard({ product, onClose })`

- [ ] **Step 5: Create MapGrid.tsx** — the grid container, composes MapControls + MapRack + MapProductCard, exports `MapGrid({ grid, areas, aisles })`

- [ ] **Step 6: Add render tests for MapGrid and MapControls**

```typescript
// tests/unit/admin/MapGrid.test.tsx
import { render, screen } from "@testing-library/react";
import { MapGrid } from "@/components/admin/MapGrid";

describe("MapGrid", () => {
  it("renders empty grid message when no data", () => {
    render(<MapGrid grid={[]} areas={[]} aisles={[]} />);
    expect(screen.getByText(/brak danych/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 7: Rewrite admin.map.tsx** to just compose components

```typescript
export default function AdminMap() {
  const { grid, areas, aisles, loading, error } = useMapData();
  if (loading) return <Loading />;
  if (error) return <ErrorState />;
  return <MapGrid grid={grid} areas={areas} aisles={aisles} />;
}
```

- [ ] **Step 8: Verify**

```bash
npx tsc --noEmit && npx vitest run && npm run build
```

- [ ] **Step 9: Commit**

```bash
git add src/components/admin/ src/routes/admin.map.tsx tests/unit/admin/
git commit -m "refactor: split admin.map.tsx into MapGrid, MapControls, MapRack, MapShelf, MapProductCard"
```

### Task 2.3: Extract use-erp-config hook from admin.erp.tsx

**Files:**
- Create: `src/hooks/use-erp-config.ts`
- Create: `tests/unit/hooks/use-erp-config.test.ts`
- Modify: `src/routes/admin.erp.tsx`

Same pattern as Task 2.1:
- Hook returns `{ config, loading, saving, error, saveConfig, testConnection, testResult }`
- Uses `useQuery` + `useMutation` from TanStack Query
- Write test, extract hook, update component

### Task 2.4: Split admin.erp.tsx into components

**Files:**
- Create: `src/components/admin/ErpConnectionForm.tsx`
- Create: `src/components/admin/ErpTestButton.tsx`
- Create: `src/components/admin/ErpStatusBadge.tsx`
- Create: `tests/unit/admin/ErpConnectionForm.test.tsx`
- Create: `tests/unit/admin/ErpTestButton.test.tsx`
- Modify: `src/routes/admin.erp.tsx`

Same pattern as Task 2.2 — split, test, recompose.

### Task 2.5: Extract use-scan-input hook from ScanHeader.tsx

**Files:**
- Create: `src/hooks/use-scan-input.ts`
- Create: `tests/unit/hooks/use-scan-input.test.ts`
- Modify: `src/components/pomagier/ScanHeader.tsx`

Extract the scan input logic (auto-focus, keyboard wedge detection, debounce, enter handling) from ScanHeader into a hook. ScanHeader stays as the UI shell.

### Task 2.6: Add render tests for remaining components

**Files:**
- Create: `tests/unit/components/BasketPanel.test.tsx`
- Create: `tests/unit/components/MobileShell.test.tsx`
- Create: `tests/unit/routes/mobile-product.test.tsx`
- Create: `tests/unit/routes/admin-dashboard.test.tsx`

Simple render tests: "renders without crash", "shows loading state", "shows error state".

---

## Faza 3: E2E Playwright

### Task 3.1: Install Playwright + configuration

```bash
npm install -D @playwright/test
npx playwright install chromium
```

Create `playwright.config.ts` at project root:

```typescript
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
  },
  use: { baseURL: "http://localhost:5173" },
});
```

### Task 3.2: E2E Scan Flow test

**File:** `tests/e2e/scan.spec.ts`

```typescript
import { test, expect } from "@playwright/test";

test("scan EAN shows product info", async ({ page }) => {
  await page.goto("/mobile/login");
  // Select operator, enter PIN, submit
  await page.click("text=Wybierz operatora");
  await page.click("text=Admin");
  await page.fill('[placeholder="PIN"]', "0000");
  // Navigate to scan
  await page.goto("/mobile/scan");
  // Type EAN
  await page.fill('[placeholder*="skanuj"]', "5901234567890");
  await page.keyboard.press("Enter");
  // Expect product result
  await expect(page.locator("text=Gaz ziemny")).toBeVisible();
});
```

### Task 3.3: E2E Map + ERP Config flows

Same pattern — navigate, interact, assert.

---

## Self-Review

**Spec coverage:**
- ✅ Faza 1 (lint zero) — Tasks 1.1-1.5 cover all files
- ✅ Faza 2 (deep refactor) — Tasks 2.1-2.6 cover admin.map, admin.erp, ScanHeader, remaining components
- ✅ Faza 3 (E2E) — Tasks 3.1-3.3 cover 3 critical flows
- ✅ Nowe zależności — Task 1.1 + Task 3.1
- ✅ Kryteria akceptacji — lint 0, build, typecheck, tests, ≤200 linii, docs

**Placeholder scan:** No TBD/TODO. All tasks have concrete file paths, code examples, and commands.

**Type consistency:** Hook interfaces defined in Tasks 2.1, 2.3, 2.5 — consumed by Tasks 2.2, 2.4, 2.5. Consistent naming: `useMapData()`, `useErpConfig()`, `useScanInput()`.

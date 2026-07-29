# Spec: Refaktoryzacja frontendu — PomagierGT

**Data:** 2026-07-29
**Status:** Zatwierdzony
**Autor:** pomagier (agent)

## 1. Cel

Wyczyszczenie warstwy frontendowej PomagierGT:
- Lint do zera (obecnie 37 błędów `any`/`no-empty` + 14 ostrzeżeń)
- Rozbicie dużych plików (>200 linii) na komponenty i hooki
- Dodanie testów renderowania (React Testing Library) i E2E (Playwright)
- 0 błędów `npm run lint`, build ✅, typecheck ✅

## 2. Fazy

### Faza 1: Lint-zero (szybkie przejście)

Tylko typowanie, bez zmiany struktury. Jeden commit na plik/grupę.

| Plik | Błędy | Akcja |
|---|---|---|
| `admin.map.tsx` | 22 `any` + 1 `no-unused-expressions` | Interfejsy w pliku, fix wyrażenia |
| `admin.erp.tsx` | 8 `any` | Interfejsy dla rekordów MSSQL + formularzy |
| `admin.dashboard.tsx` | 1 `any` | Pojedynczy typ |
| `admin.login.tsx` | 1 `any` | `err: unknown` + type guard |
| `admin.users.tsx` | 1 `any` | j.w. |
| `mobile.product.$code.tsx` | 3 `any` | Interfejsy dla danych produktu |
| `mobile.login.tsx` | 1 `any` | `err: unknown` |
| Ostrzeżenia `react-refresh` | 12 | `eslint-disable` w shadcn/ui |
| `auth-middleware.ts` | 1 `no-namespace` | Już fixnięte w poprzedniej iteracji — weryfikacja |

### Faza 2: Deep refactor

Pliki >200 linii rozbijane na komponenty + hooki + testy.

#### 2.1 `admin.map.tsx` (623 linii)

```
src/routes/admin.map.tsx           ← ~40 linii
src/components/admin/
├── MapGrid.tsx                    ← ~100 linii
├── MapControls.tsx                ← ~60 linii
├── MapRack.tsx                    ← ~80 linii
├── MapShelf.tsx                   ← ~50 linii
└── MapProductCard.tsx             ← ~60 linii
src/hooks/
└── use-map-data.ts                ← ~80 linii
```

Testy: MapGrid, MapControls, use-map-data (unit) + map.spec.ts (E2E)

#### 2.2 `admin.erp.tsx` (433 linii)

```
src/routes/admin.erp.tsx           ← ~30 linii
src/components/admin/
├── ErpConnectionForm.tsx          ← ~80 linii
├── ErpTestButton.tsx              ← ~40 linii
├── ErpStatusBadge.tsx             ← ~30 linii
src/hooks/
└── use-erp-config.ts              ← ~70 linii
```

Testy: ErpConnectionForm, ErpTestButton, use-erp-config (unit) + erp.spec.ts (E2E)

#### 2.3 `ScanHeader.tsx` (405 linii)

Wydzielenie `use-scan-input.ts` hooka (~100 linii). Reszta zostaje.

#### 2.4 Pozostałe pliki (już ≤275 linii)

Bez podziału — tylko testy renderowania:
- `MobileShell.tsx` (268 linii)
- `BasketPanel.tsx` (275 linii)
- `mobile.product.$code.tsx` (232 linii)
- `admin.dashboard.tsx` (157 linii)

### Faza 3: E2E Playwright

Trzy scenariusze krytyczne:
1. Skanowanie: login → scan EAN → zobacz produkt → strona produktu
2. Mapa: login admin → mapa → filtr strefy → kliknij półkę
3. ERP config: login admin → formularz MSSQL → test połączenia

Konfiguracja Playwright w `playwright.config.ts`, testy w `tests/e2e/`.

## 3. Nowe zależności

```json
"devDependencies": {
  "@testing-library/react": "^latest",
  "@testing-library/jest-dom": "^latest",
  "@playwright/test": "^latest"
}
```

## 4. Kryteria akceptacji

- [ ] `npm run lint` — 0 błędów, 0 ostrzeżeń
- [ ] `npm run build` ✅
- [ ] `npm run typecheck` ✅
- [ ] `npx vitest run` — wszystkie istniejące + nowe testy zielone
- [ ] `npx playwright test` — 3 scenariusze E2E zielone
- [ ] Wszystkie pliki ≤200 linii (po refaktoryzacji)
- [ ] CHANGELOG, TASKS zaktualizowane

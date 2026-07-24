// Dane demonstracyjne dla prototypu PomagierGT. Wszystko lokalne, żadnego API.

export type Warehouse = {
  code: string;
  name: string;
  active: boolean;
  locations: number;
  products: number;
  isDefault?: boolean;
};
export const warehouses: Warehouse[] = [
  {
    code: "MAG",
    name: "Magazyn główny",
    active: true,
    locations: 428,
    products: 3241,
    isDefault: true,
  },
  { code: "MAG-2", name: "Magazyn wysyłkowy", active: true, locations: 216, products: 1180 },
  { code: "SERWIS", name: "Magazyn serwisowy", active: false, locations: 64, products: 312 },
];

export type Location = {
  code: string;
  zone: string;
  rack: string;
  shelf: string;
  slot: string;
  warehouse: string;
  qty: number;
};
export const locations: Location[] = [
  { code: "A-01-02-03", zone: "A", rack: "01", shelf: "02", slot: "03", warehouse: "MAG", qty: 24 },
  { code: "A-01-02-04", zone: "A", rack: "01", shelf: "02", slot: "04", warehouse: "MAG", qty: 12 },
  { code: "A-02-01-01", zone: "A", rack: "02", shelf: "01", slot: "01", warehouse: "MAG", qty: 60 },
  { code: "B-04-01-02", zone: "B", rack: "04", shelf: "01", slot: "02", warehouse: "MAG", qty: 8 },
  { code: "B-04-01-03", zone: "B", rack: "04", shelf: "01", slot: "03", warehouse: "MAG", qty: 0 },
  {
    code: "C-01-01-01",
    zone: "C",
    rack: "01",
    shelf: "01",
    slot: "01",
    warehouse: "MAG-2",
    qty: 100,
  },
];

export type Role =
  | "Administrator"
  | "Kierownik magazynu"
  | "Magazynier"
  | "Operator przyjęcia"
  | "Operator kompletacji"
  | "Audytor";
export const roles: Role[] = [
  "Administrator",
  "Kierownik magazynu",
  "Magazynier",
  "Operator przyjęcia",
  "Operator kompletacji",
  "Audytor",
];

export type User = {
  id: string;
  name: string;
  pin: string;
  role: Role;
  warehouse: string;
  active: boolean;
  lastLogin: string;
  terminal?: string;
};
export const users: User[] = [
  {
    id: "u1",
    name: "Anna Kowalska",
    pin: "1234",
    role: "Kierownik magazynu",
    warehouse: "MAG",
    active: true,
    lastLogin: "2026-07-23 07:12",
    terminal: "T-01",
  },
  {
    id: "u2",
    name: "Piotr Nowak",
    pin: "2345",
    role: "Magazynier",
    warehouse: "MAG",
    active: true,
    lastLogin: "2026-07-23 06:58",
    terminal: "T-02",
  },
  {
    id: "u3",
    name: "Marek Wiśniewski",
    pin: "3456",
    role: "Operator kompletacji",
    warehouse: "MAG",
    active: true,
    lastLogin: "2026-07-23 07:01",
    terminal: "T-03",
  },
  {
    id: "u4",
    name: "Katarzyna Zielińska",
    pin: "4567",
    role: "Operator przyjęcia",
    warehouse: "MAG-2",
    active: true,
    lastLogin: "2026-07-22 15:30",
    terminal: "T-05",
  },
  {
    id: "u5",
    name: "Tomasz Lewandowski",
    pin: "5678",
    role: "Magazynier",
    warehouse: "MAG-2",
    active: false,
    lastLogin: "2026-07-20 12:44",
  },
  {
    id: "u6",
    name: "Ewa Dąbrowska",
    pin: "6789",
    role: "Audytor",
    warehouse: "MAG",
    active: true,
    lastLogin: "2026-07-22 09:15",
  },
  {
    id: "u7",
    name: "Jan Wójcik",
    pin: "7890",
    role: "Administrator",
    warehouse: "MAG",
    active: true,
    lastLogin: "2026-07-23 08:00",
  },
];

export type Terminal = {
  id: string;
  name: string;
  model: string;
  type: "Terminal Android" | "Telefon";
  user?: string;
  warehouse: string;
  appVersion: string;
  battery: number;
  lastActivity: string;
  online: boolean;
  syncQuality: "dobra" | "średnia" | "słaba";
};
export const terminals: Terminal[] = [
  {
    id: "T-01",
    name: "Zebra MC3300 #01",
    model: "Zebra MC3300",
    type: "Terminal Android",
    user: "Anna Kowalska",
    warehouse: "MAG",
    appVersion: "1.4.2",
    battery: 78,
    lastActivity: "2 min temu",
    online: true,
    syncQuality: "dobra",
  },
  {
    id: "T-02",
    name: "Zebra MC3300 #02",
    model: "Zebra MC3300",
    type: "Terminal Android",
    user: "Piotr Nowak",
    warehouse: "MAG",
    appVersion: "1.4.2",
    battery: 42,
    lastActivity: "5 min temu",
    online: true,
    syncQuality: "dobra",
  },
  {
    id: "T-03",
    name: "Honeywell CT40 #01",
    model: "Honeywell CT40",
    type: "Terminal Android",
    user: "Marek Wiśniewski",
    warehouse: "MAG",
    appVersion: "1.4.1",
    battery: 15,
    lastActivity: "1 min temu",
    online: true,
    syncQuality: "średnia",
  },
  {
    id: "T-04",
    name: "Samsung XCover 6",
    model: "Samsung XCover 6",
    type: "Telefon",
    warehouse: "MAG",
    appVersion: "1.4.2",
    battery: 90,
    lastActivity: "3 godz temu",
    online: false,
    syncQuality: "słaba",
  },
  {
    id: "T-05",
    name: "Zebra TC26 #01",
    model: "Zebra TC26",
    type: "Terminal Android",
    user: "Katarzyna Zielińska",
    warehouse: "MAG-2",
    appVersion: "1.4.2",
    battery: 63,
    lastActivity: "12 min temu",
    online: true,
    syncQuality: "dobra",
  },
];

export type Product = {
  code: string;
  ean: string;
  name: string;
  unit: string;
  available: number;
  stock: number;
  reserved: number;
  locations: string[];
  lastReceipt: string;
  price?: number;
  variant?: string;
  expiry?: string;
  blocked?: boolean;
};
export const products: Product[] = [
  {
    code: "PR-001",
    ean: "5901234123457",
    name: "Wkrętarka akumulatorowa 18V",
    unit: "szt",
    available: 24,
    stock: 30,
    reserved: 6,
    locations: ["A-01-02-03", "B-04-01-02"],
    lastReceipt: "2026-07-18",
    price: 429.0,
    variant: "18V / 2Ah",
  },
  {
    code: "PR-002",
    ean: "5902345234568",
    name: "Zestaw wierteł HSS 25 szt",
    unit: "opak",
    available: 60,
    stock: 60,
    reserved: 0,
    locations: ["A-02-01-01"],
    lastReceipt: "2026-07-15",
    price: 89.5,
  },
  {
    code: "PR-003",
    ean: "5903456345679",
    name: "Rękawice robocze L",
    unit: "para",
    available: 240,
    stock: 260,
    reserved: 20,
    locations: ["C-01-01-01"],
    lastReceipt: "2026-07-20",
    price: 12.9,
  },
  {
    code: "PR-004",
    ean: "5904567456780",
    name: "Klej montażowy 300ml",
    unit: "szt",
    available: 12,
    stock: 40,
    reserved: 28,
    locations: ["A-01-02-04"],
    lastReceipt: "2026-07-10",
    price: 24.9,
    expiry: "2027-03-01",
  },
  {
    code: "PR-005",
    ean: "5905678567891",
    name: "Śruby M8x40 (opak. 100)",
    unit: "opak",
    available: 0,
    stock: 0,
    reserved: 0,
    locations: ["B-04-01-03"],
    lastReceipt: "2026-06-30",
    price: 34.5,
    blocked: true,
  },
];

export type TaskType =
  | "Kompletacja"
  | "Inwentaryzacja"
  | "Weryfikacja dostawy"
  | "Przyjęcie"
  | "Przesunięcie MM"
  | "Kontrola lokalizacji"
  | "Sprawdzenie towaru";
export type TaskStatus = "Nowe" | "W toku" | "Wstrzymane" | "Zakończone" | "Anulowane";
export type Priority = "Niski" | "Normalny" | "Wysoki" | "Krytyczny";
export type Task = {
  id: string;
  type: TaskType;
  docNumber: string;
  warehouse: string;
  operator?: string;
  priority: Priority;
  progress: number;
  status: TaskStatus;
  startedAt: string;
  sla: string;
  positions: number;
  positionsDone: number;
};
export const tasks: Task[] = [
  {
    id: "K-1041",
    type: "Kompletacja",
    docNumber: "ZK 1245/07/2026",
    warehouse: "MAG",
    operator: "Marek Wiśniewski",
    priority: "Wysoki",
    progress: 65,
    status: "W toku",
    startedAt: "07:12",
    sla: "45 min",
    positions: 12,
    positionsDone: 8,
  },
  {
    id: "K-1042",
    type: "Kompletacja",
    docNumber: "ZK 1246/07/2026",
    warehouse: "MAG",
    operator: "Piotr Nowak",
    priority: "Normalny",
    progress: 30,
    status: "W toku",
    startedAt: "07:20",
    sla: "60 min",
    positions: 8,
    positionsDone: 2,
  },
  {
    id: "K-1043",
    type: "Kompletacja",
    docNumber: "ZK 1247/07/2026",
    warehouse: "MAG",
    priority: "Normalny",
    progress: 0,
    status: "Nowe",
    startedAt: "-",
    sla: "60 min",
    positions: 5,
    positionsDone: 0,
  },
  {
    id: "P-0812",
    type: "Weryfikacja dostawy",
    docNumber: "PZ 812/07/2026",
    warehouse: "MAG-2",
    operator: "Katarzyna Zielińska",
    priority: "Wysoki",
    progress: 80,
    status: "W toku",
    startedAt: "06:45",
    sla: "90 min",
    positions: 20,
    positionsDone: 16,
  },
  {
    id: "M-0104",
    type: "Przesunięcie MM",
    docNumber: "MM 104/07/2026",
    warehouse: "MAG",
    priority: "Niski",
    progress: 0,
    status: "Nowe",
    startedAt: "-",
    sla: "120 min",
    positions: 4,
    positionsDone: 0,
  },
  {
    id: "I-0033",
    type: "Inwentaryzacja",
    docNumber: "SP 33/07/2026",
    warehouse: "MAG",
    operator: "Ewa Dąbrowska",
    priority: "Normalny",
    progress: 45,
    status: "W toku",
    startedAt: "06:30",
    sla: "480 min",
    positions: 120,
    positionsDone: 54,
  },
  {
    id: "K-1039",
    type: "Kompletacja",
    docNumber: "ZK 1239/07/2026",
    warehouse: "MAG",
    operator: "Anna Kowalska",
    priority: "Normalny",
    progress: 100,
    status: "Zakończone",
    startedAt: "06:00",
    sla: "60 min",
    positions: 10,
    positionsDone: 10,
  },
  {
    id: "K-1040",
    type: "Kompletacja",
    docNumber: "ZK 1240/07/2026",
    warehouse: "MAG",
    operator: "Piotr Nowak",
    priority: "Krytyczny",
    progress: 0,
    status: "Anulowane",
    startedAt: "06:15",
    sla: "45 min",
    positions: 6,
    positionsDone: 0,
  },
];

export type QueueItem = {
  id: string;
  type: string;
  source: string;
  status: "Oczekuje" | "Przetwarza" | "Błąd" | "Zakończone";
  priority: Priority;
  createdAt: string;
  lastAttempt: string;
  retries: number;
  error?: string;
};
export const queue: QueueItem[] = [
  {
    id: "Q-9001",
    type: "Rejestracja PZ",
    source: "T-01",
    status: "Przetwarza",
    priority: "Wysoki",
    createdAt: "07:24:11",
    lastAttempt: "07:24:14",
    retries: 0,
  },
  {
    id: "Q-9002",
    type: "Aktualizacja stanu",
    source: "T-02",
    status: "Oczekuje",
    priority: "Normalny",
    createdAt: "07:24:32",
    lastAttempt: "-",
    retries: 0,
  },
  {
    id: "Q-9003",
    type: "Rejestracja MM",
    source: "T-03",
    status: "Błąd",
    priority: "Krytyczny",
    createdAt: "07:20:02",
    lastAttempt: "07:23:55",
    retries: 3,
    error: "Timeout połączenia ze Sferą GT",
  },
  {
    id: "Q-9004",
    type: "Zamknięcie ZK",
    source: "T-05",
    status: "Zakończone",
    priority: "Wysoki",
    createdAt: "07:15:00",
    lastAttempt: "07:15:12",
    retries: 0,
  },
  {
    id: "Q-9005",
    type: "Aktualizacja lokalizacji",
    source: "T-01",
    status: "Oczekuje",
    priority: "Niski",
    createdAt: "07:24:45",
    lastAttempt: "-",
    retries: 0,
  },
  {
    id: "Q-9006",
    type: "Rejestracja spisu",
    source: "T-03",
    status: "Błąd",
    priority: "Normalny",
    createdAt: "07:10:30",
    lastAttempt: "07:22:00",
    retries: 5,
    error: "Brak dostępu do bazy MSSQL: WAREHOUSE_DB",
  },
];

export type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG";
export type LogEntry = {
  id: string;
  time: string;
  level: LogLevel;
  module: string;
  user?: string;
  terminal?: string;
  message: string;
  correlationId: string;
};
export const logs: LogEntry[] = [
  {
    id: "L-1",
    time: "07:24:14",
    level: "INFO",
    module: "sfera-gt",
    user: "Anna Kowalska",
    terminal: "T-01",
    message: "Otwarto sesję Sfery dla PZ 812/07/2026",
    correlationId: "c-9a1b",
  },
  {
    id: "L-2",
    time: "07:23:55",
    level: "ERROR",
    module: "queue",
    terminal: "T-03",
    message: "Timeout połączenia ze Sferą GT po 30000ms",
    correlationId: "c-3f2d",
  },
  {
    id: "L-3",
    time: "07:22:00",
    level: "ERROR",
    module: "mssql",
    message: "Brak dostępu do bazy WAREHOUSE_DB (login denied for user 'pomagier')",
    correlationId: "c-4e11",
  },
  {
    id: "L-4",
    time: "07:21:30",
    level: "WARN",
    module: "sync",
    terminal: "T-02",
    message: "Powtórna próba rejestracji Q-9002",
    correlationId: "c-7b0c",
  },
  {
    id: "L-5",
    time: "07:20:10",
    level: "INFO",
    module: "auth",
    user: "Marek Wiśniewski",
    terminal: "T-03",
    message: "Zalogowano operatora PIN-em",
    correlationId: "c-1234",
  },
  {
    id: "L-6",
    time: "07:18:02",
    level: "DEBUG",
    module: "picking",
    terminal: "T-01",
    message: "Zeskanowano EAN 5901234123457 (PR-001)",
    correlationId: "c-abc1",
  },
  {
    id: "L-7",
    time: "07:15:00",
    level: "INFO",
    module: "sync",
    terminal: "T-05",
    message: "Zakończono synchronizację (6 zdarzeń)",
    correlationId: "c-88f0",
  },
];

export type Event = {
  id: string;
  time: string;
  text: string;
  type: "info" | "warning" | "error" | "success";
};
export const events: Event[] = [
  { id: "e1", time: "07:24", text: "Nowe zadanie kompletacji ZK 1247/07/2026", type: "info" },
  { id: "e2", time: "07:23", text: "Błąd synchronizacji Q-9003 (Sfera GT timeout)", type: "error" },
  { id: "e3", time: "07:21", text: "Terminal T-03 — bateria poniżej 20%", type: "warning" },
  { id: "e4", time: "07:15", text: "Zakończono kompletację ZK 1239/07/2026", type: "success" },
  {
    id: "e5",
    time: "07:00",
    text: "Uruchomienie usługi integracyjnej PomagierGT 1.4.2",
    type: "info",
  },
];

export const kpi = {
  activeTerminals: terminals.filter((t) => t.online).length,
  totalTerminals: terminals.length,
  loggedOperators: 4,
  runningTasks: tasks.filter((t) => t.status === "W toku").length,
  doneToday: 27,
  syncErrors: queue.filter((q) => q.status === "Błąd").length,
  queueLength: queue.filter((q) => q.status === "Oczekuje").length,
  lastSync: "07:24:14",
};

// Wykresy aktywności
export const activityChart = [
  { hour: "06:00", operacje: 12 },
  { hour: "07:00", operacje: 34 },
  { hour: "08:00", operacje: 58 },
  { hour: "09:00", operacje: 72 },
  { hour: "10:00", operacje: 65 },
  { hour: "11:00", operacje: 81 },
  { hour: "12:00", operacje: 40 },
  { hour: "13:00", operacje: 55 },
  { hour: "14:00", operacje: 68 },
];

export const weeklyChart = [
  { day: "Pn", kompletacje: 120, inwentaryzacje: 20, dostawy: 15 },
  { day: "Wt", kompletacje: 145, inwentaryzacje: 18, dostawy: 22 },
  { day: "Śr", kompletacje: 132, inwentaryzacje: 30, dostawy: 18 },
  { day: "Cz", kompletacje: 158, inwentaryzacje: 12, dostawy: 25 },
  { day: "Pt", kompletacje: 170, inwentaryzacje: 22, dostawy: 30 },
  { day: "Sb", kompletacje: 60, inwentaryzacje: 8, dostawy: 5 },
  { day: "Nd", kompletacje: 12, inwentaryzacje: 0, dostawy: 0 },
];

// Pozycje w wybranym zadaniu kompletacji (dla flow mobile)
export type PickingPosition = {
  n: number;
  location: string;
  productCode: string;
  productName: string;
  ean: string;
  required: number;
  picked: number;
  unit: string;
  variant?: string;
  alternativeLocation?: string;
  status?: "pending" | "picked" | "short" | "skipped";
};
export const pickingPositions: PickingPosition[] = [
  {
    n: 1,
    location: "A-01-02-03",
    productCode: "PR-001",
    productName: "Wkrętarka akumulatorowa 18V",
    ean: "5901234123457",
    required: 2,
    picked: 0,
    unit: "szt",
    variant: "18V / 2Ah",
    alternativeLocation: "B-04-01-02",
  },
  {
    n: 2,
    location: "A-02-01-01",
    productCode: "PR-002",
    productName: "Zestaw wierteł HSS 25 szt",
    ean: "5902345234568",
    required: 5,
    picked: 0,
    unit: "opak",
  },
  {
    n: 3,
    location: "C-01-01-01",
    productCode: "PR-003",
    productName: "Rękawice robocze L",
    ean: "5903456345679",
    required: 12,
    picked: 0,
    unit: "para",
  },
  {
    n: 4,
    location: "A-01-02-04",
    productCode: "PR-004",
    productName: "Klej montażowy 300ml",
    ean: "5904567456780",
    required: 3,
    picked: 0,
    unit: "szt",
  },
  {
    n: 5,
    location: "B-04-01-02",
    productCode: "PR-001",
    productName: "Wkrętarka akumulatorowa 18V",
    ean: "5901234123457",
    required: 1,
    picked: 0,
    unit: "szt",
    variant: "18V / 2Ah",
  },
];

export type DocumentType = "ZK" | "PZ" | "MM" | "SP" | "FS";
export type Document = {
  id: string;
  type: DocumentType;
  number: string;
  warehouse: string;
  contractor?: string;
  status: "Otwarty" | "W realizacji" | "Zakończony" | "Anulowany" | "Zawieszony";
  createdAt: string;
  positions: number;
  positionsDone: number;
  value?: number;
};
export const documents: Document[] = [
  {
    id: "ZK/1245/07/2026",
    type: "ZK",
    number: "ZK 1245/07/2026",
    warehouse: "MAG",
    contractor: "Tech-Serwis Sp. z o.o.",
    status: "W realizacji",
    createdAt: "2026-07-23",
    positions: 12,
    positionsDone: 8,
    value: 2450.0,
  },
  {
    id: "ZK/1246/07/2026",
    type: "ZK",
    number: "ZK 1246/07/2026",
    warehouse: "MAG",
    contractor: "Bud-Max Sp. z o.o.",
    status: "W realizacji",
    createdAt: "2026-07-23",
    positions: 8,
    positionsDone: 2,
    value: 890.5,
  },
  {
    id: "ZK/1247/07/2026",
    type: "ZK",
    number: "ZK 1247/07/2026",
    warehouse: "MAG",
    contractor: "Elektro-Plus",
    status: "Otwarty",
    createdAt: "2026-07-23",
    positions: 5,
    positionsDone: 0,
    value: 430.0,
  },
  {
    id: "PZ/812/07/2026",
    type: "PZ",
    number: "PZ 812/07/2026",
    warehouse: "MAG-2",
    contractor: "Hurtownia Narzędzi",
    status: "W realizacji",
    createdAt: "2026-07-22",
    positions: 20,
    positionsDone: 16,
    value: 12500.0,
  },
  {
    id: "MM/104/07/2026",
    type: "MM",
    number: "MM 104/07/2026",
    warehouse: "MAG",
    contractor: "Wewnętrzny",
    status: "Otwarty",
    createdAt: "2026-07-21",
    positions: 4,
    positionsDone: 0,
    value: 0,
  },
  {
    id: "SP/33/07/2026",
    type: "SP",
    number: "SP 33/07/2026",
    warehouse: "MAG",
    contractor: "Wewnętrzny",
    status: "W realizacji",
    createdAt: "2026-07-20",
    positions: 120,
    positionsDone: 54,
    value: 0,
  },
];

export type Alert = {
  id: string;
  time: string;
  level: "info" | "warning" | "error" | "success";
  title: string;
  description: string;
  module: string;
  read: boolean;
  acknowledged?: boolean;
};
export const alerts: Alert[] = [
  {
    id: "A-1",
    time: "07:24",
    level: "warning",
    title: "Niski poziom baterii T-03",
    description: "Terminal T-03 (Marek Wiśniewski) ma 15% baterii. Rozważ wymianę lub ładowanie.",
    module: "terminale",
    read: false,
  },
  {
    id: "A-2",
    time: "07:23",
    level: "error",
    title: "Błąd synchronizacji Q-9003",
    description: "Timeout połączenia ze Sferą GT podczas rejestracji MM 104/07/2026. Próba 3/5.",
    module: "kolejka",
    read: false,
  },
  {
    id: "A-3",
    time: "07:21",
    level: "error",
    title: "Brak dostępu do bazy WAREHOUSE_DB",
    description: "MSSQL zwrócił login denied dla użytkownika 'pomagier'. Sprawdź uprawnienia.",
    module: "baza danych",
    read: false,
  },
  {
    id: "A-4",
    time: "07:15",
    level: "success",
    title: "Zakończono kompletację ZK 1239/2026",
    description: "Anna Kowalska zakończyła kompletację 10 pozycji. Zadanie wysłane do Sfery GT.",
    module: "zadania",
    read: true,
  },
  {
    id: "A-5",
    time: "07:00",
    level: "info",
    title: "Uruchomienie usługi PomagierGT 1.4.2",
    description: "Usługa integracyjna wystartowała poprawnie. Wszystkie moduły aktywne.",
    module: "system",
    read: true,
  },
];

export type Printer = {
  id: string;
  name: string;
  model: string;
  location: string;
  warehouse: string;
  status: "online" | "offline" | "busy" | "error";
  labelsToday: number;
  lastActivity: string;
};
export const printers: Printer[] = [
  {
    id: "P-01",
    name: "Drukarka etykiet #01",
    model: "Zebra ZD421",
    location: "Strefa A",
    warehouse: "MAG",
    status: "online",
    labelsToday: 124,
    lastActivity: "2 min temu",
  },
  {
    id: "P-02",
    name: "Drukarka etykiet #02",
    model: "Zebra ZD421",
    location: "Strefa B",
    warehouse: "MAG",
    status: "busy",
    labelsToday: 89,
    lastActivity: "5 min temu",
  },
  {
    id: "P-03",
    name: "Drukarka etykiet #03",
    model: "TSC TE210",
    location: "Strefa C",
    warehouse: "MAG-2",
    status: "offline",
    labelsToday: 0,
    lastActivity: "3 godz temu",
  },
  {
    id: "P-04",
    name: "Drukarka kodów kreskowych",
    model: "Zebra ZT411",
    location: "Wysyłka",
    warehouse: "MAG-2",
    status: "error",
    labelsToday: 12,
    lastActivity: "15 min temu",
  },
];

export const zoneMap = [
  { zone: "A", rows: 4, cols: 6, occupancy: 0.78, label: "Strefa A — małe części" },
  { zone: "B", rows: 3, cols: 5, occupancy: 0.62, label: "Strefa B — średnie części" },
  { zone: "C", rows: 3, cols: 4, occupancy: 0.91, label: "Strefa C — wysyłkowa" },
  { zone: "D", rows: 2, cols: 4, occupancy: 0.34, label: "Strefa D — sezonowa" },
];

// Historia skanów dla pozycji zadania (widoczna w panelu admina)
export type ScanEventKind =
  | "ok"
  | "wrong_location"
  | "wrong_product"
  | "duplicate"
  | "unknown_code"
  | "manual"
  | "correction";
export type ScanEvent = {
  id: string;
  taskId: string;
  positionN: number;
  time: string;
  operator: string;
  terminal: string;
  kind: ScanEventKind;
  scannedCode: string;
  location: string;
  productCode?: string;
  productName?: string;
  qty?: number;
  unit?: string;
  note?: string;
};
export const scanHistory: ScanEvent[] = [
  // K-1041 (Marek Wiśniewski, T-03) — 8/12 pozycji zeskanowanych, część z błędami
  {
    id: "S-1",
    taskId: "K-1041",
    positionN: 1,
    time: "07:12:04",
    operator: "Marek Wiśniewski",
    terminal: "T-03",
    kind: "ok",
    scannedCode: "A-01-02-03",
    location: "A-01-02-03",
    note: "Potwierdzenie lokalizacji",
  },
  {
    id: "S-2",
    taskId: "K-1041",
    positionN: 1,
    time: "07:12:18",
    operator: "Marek Wiśniewski",
    terminal: "T-03",
    kind: "ok",
    scannedCode: "5901234123457",
    location: "A-01-02-03",
    productCode: "PR-001",
    productName: "Wkrętarka akumulatorowa 18V",
    qty: 2,
    unit: "szt",
  },
  {
    id: "S-3",
    taskId: "K-1041",
    positionN: 2,
    time: "07:13:41",
    operator: "Marek Wiśniewski",
    terminal: "T-03",
    kind: "wrong_location",
    scannedCode: "A-02-01-02",
    location: "A-02-01-01",
    note: "Zeskanowano sąsiednią półkę",
  },
  {
    id: "S-4",
    taskId: "K-1041",
    positionN: 2,
    time: "07:13:55",
    operator: "Marek Wiśniewski",
    terminal: "T-03",
    kind: "ok",
    scannedCode: "A-02-01-01",
    location: "A-02-01-01",
  },
  {
    id: "S-5",
    taskId: "K-1041",
    positionN: 2,
    time: "07:14:09",
    operator: "Marek Wiśniewski",
    terminal: "T-03",
    kind: "ok",
    scannedCode: "5902345234568",
    location: "A-02-01-01",
    productCode: "PR-002",
    productName: "Zestaw wierteł HSS 25 szt",
    qty: 5,
    unit: "opak",
  },
  {
    id: "S-6",
    taskId: "K-1041",
    positionN: 3,
    time: "07:15:22",
    operator: "Marek Wiśniewski",
    terminal: "T-03",
    kind: "unknown_code",
    scannedCode: "5900000000001",
    location: "C-01-01-01",
    note: "EAN nie znaleziony w kartotece",
  },
  {
    id: "S-7",
    taskId: "K-1041",
    positionN: 3,
    time: "07:15:47",
    operator: "Marek Wiśniewski",
    terminal: "T-03",
    kind: "ok",
    scannedCode: "5903456345679",
    location: "C-01-01-01",
    productCode: "PR-003",
    productName: "Rękawice robocze L",
    qty: 12,
    unit: "para",
  },
  {
    id: "S-8",
    taskId: "K-1041",
    positionN: 4,
    time: "07:16:30",
    operator: "Marek Wiśniewski",
    terminal: "T-03",
    kind: "ok",
    scannedCode: "A-01-02-04",
    location: "A-01-02-04",
  },
  {
    id: "S-9",
    taskId: "K-1041",
    positionN: 4,
    time: "07:16:44",
    operator: "Marek Wiśniewski",
    terminal: "T-03",
    kind: "duplicate",
    scannedCode: "5904567456780",
    location: "A-01-02-04",
    productCode: "PR-004",
    productName: "Klej montażowy 300ml",
    note: "Ten sam kod zeskanowany dwukrotnie",
  },
  {
    id: "S-10",
    taskId: "K-1041",
    positionN: 4,
    time: "07:17:02",
    operator: "Marek Wiśniewski",
    terminal: "T-03",
    kind: "ok",
    scannedCode: "5904567456780",
    location: "A-01-02-04",
    productCode: "PR-004",
    productName: "Klej montażowy 300ml",
    qty: 3,
    unit: "szt",
  },
  {
    id: "S-11",
    taskId: "K-1041",
    positionN: 5,
    time: "07:18:02",
    operator: "Marek Wiśniewski",
    terminal: "T-03",
    kind: "wrong_product",
    scannedCode: "5902345234568",
    location: "B-04-01-02",
    productCode: "PR-002",
    productName: "Zestaw wierteł HSS 25 szt",
    note: "Oczekiwano PR-001",
  },
  {
    id: "S-12",
    taskId: "K-1041",
    positionN: 5,
    time: "07:18:20",
    operator: "Marek Wiśniewski",
    terminal: "T-03",
    kind: "ok",
    scannedCode: "5901234123457",
    location: "B-04-01-02",
    productCode: "PR-001",
    productName: "Wkrętarka akumulatorowa 18V",
    qty: 1,
    unit: "szt",
  },

  // K-1042
  {
    id: "S-13",
    taskId: "K-1042",
    positionN: 1,
    time: "07:20:14",
    operator: "Piotr Nowak",
    terminal: "T-02",
    kind: "ok",
    scannedCode: "A-01-02-03",
    location: "A-01-02-03",
  },
  {
    id: "S-14",
    taskId: "K-1042",
    positionN: 1,
    time: "07:20:28",
    operator: "Piotr Nowak",
    terminal: "T-02",
    kind: "manual",
    scannedCode: "PR-001",
    location: "A-01-02-03",
    productCode: "PR-001",
    productName: "Wkrętarka akumulatorowa 18V",
    qty: 1,
    unit: "szt",
    note: "Wpisano kod ręcznie (uszkodzony EAN)",
  },

  // P-0812 — weryfikacja dostawy
  {
    id: "S-15",
    taskId: "P-0812",
    positionN: 3,
    time: "06:52:11",
    operator: "Katarzyna Zielińska",
    terminal: "T-05",
    kind: "wrong_product",
    scannedCode: "5904567456780",
    location: "PZ/Rampa",
    productCode: "PR-004",
    productName: "Klej montażowy 300ml",
    note: "Niezgodność z pozycją dokumentu",
  },
  {
    id: "S-16",
    taskId: "P-0812",
    positionN: 3,
    time: "06:52:40",
    operator: "Katarzyna Zielińska",
    terminal: "T-05",
    kind: "correction",
    scannedCode: "5904567456780",
    location: "PZ/Rampa",
    productCode: "PR-004",
    productName: "Klej montażowy 300ml",
    qty: 1,
    unit: "szt",
    note: "Zatwierdzono korektę kierownika",
  },
];

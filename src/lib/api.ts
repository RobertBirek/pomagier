import type { ScanResult } from "../erp/types.js";

const BASE = "/api";

export async function scanCode(code: string): Promise<ScanResult> {
  const res = await fetch(`${BASE}/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function healthCheck() {
  const res = await fetch(`${BASE}/health`);
  return res.json();
}

export async function getCompany() {
  const res = await fetch(`${BASE}/company`);
  return res.json() as Promise<{ name: string; nip: string; regon: string }>;
}

export async function getUsers() {
  const res = await fetch(`${BASE}/users`);
  return res.json() as Promise<
    {
      subiektId: number;
      firstName: string;
      lastName: string;
      active: boolean;
      hasPin: boolean;
      role: string;
    }[]
  >;
}

export async function getWarehouses() {
  const res = await fetch(`${BASE}/warehouses`);
  return res.json() as Promise<{ id: number; symbol: string; name: string; isMain: boolean }[]>;
}

export async function login(subiektUzId: number, pin: string) {
  const res = await fetch(`${BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subiektUzId, pin }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Błąd" }));
    throw new Error(err.error || "Błąd logowania");
  }
  return res.json() as Promise<{
    token: string;
    user: { id: string; subiektUzId: number; role: string };
  }>;
}

export async function getStats() {
  const res = await fetch(`${BASE}/stats`);
  return res.json() as Promise<{ products: number; warehouses: number; users: number }>;
}

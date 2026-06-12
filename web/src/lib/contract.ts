import { createClient, createAccount } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

export const CONTRACT = "0x6a028b7BF87F32583eC5f79F12756b6b4ab338eA";
export const CHAIN_ID = 4221;
export const RPC = "https://rpc-bradbury.genlayer.com";
export const EXPLORER = "https://explorer-bradbury.genlayer.com";

export type Case = {
  case_id: number;
  covenant_ref: string;
  clause_text: string;
  claim: string;
  evidence_url: string;
  status: string;
  step: number;
  verdict: string;
  payout_bps: number;
  rationale: string;
};

// Read-only client — works in-browser thanks to the CORS-open RPC (no wallet).
const reader = createClient({ chain: testnetBradbury, account: createAccount() });
const read = (functionName: string, args: any[] = []) =>
  reader.readContract({ address: CONTRACT, functionName, args });

export const caseCount = async (): Promise<number> => Number(await read("case_count"));
export const getCase = (id: number) => read("get_case", [id]) as Promise<Case>;
export const getSettlement = (id: number) => read("get_settlement", [id]);
export const getDoctrine = (clause: string) => read("get_doctrine", [clause]);

async function readCase(id: number, tries = 3): Promise<Case | null> {
  for (let t = 0; t < tries; t++) {
    try { return (await getCase(id)) as Case; } catch { await new Promise((r) => setTimeout(r, 400)); }
  }
  return null;
}

export async function listCases(): Promise<Case[]> {
  const n = await caseCount();
  const out: Case[] = [];
  for (let i = 1; i <= n; i++) { const c = await readCase(i); if (c) out.push(c); }
  return out.reverse();
}

// ---- writes (provider supplied by Privy wallet) ----
import { createClient as _cc } from "genlayer-js";
import { testnetBradbury as _chain } from "genlayer-js/chains";

export async function writeWith(provider: any, account: string, functionName: string, args: any[]): Promise<string> {
  const client = _cc({ chain: _chain, account: account as any, provider } as any);
  const hash = await client.writeContract({ address: CONTRACT, functionName, args });
  // Bradbury consensus can take 1-3 min. Wait generously, but never throw on a
  // wait-timeout — the tx is still confirming and the docket will pick it up.
  try {
    await client.waitForTransactionReceipt({ hash, status: "ACCEPTED", interval: 5000, retries: 60 });
  } catch { /* still confirming on-chain */ }
  return hash as string;
}

// per-case tx links: contract doesn't store tx hashes, so use the seeded crank-tx
// map (real, recovered from chain) plus client-side capture of new UI actions.
import seeded from "./seededTx.json";
const TX_KEY = "lexforge.tx";
export function recordTx(id: number, hash: string) {
  try { const m = JSON.parse(localStorage.getItem(TX_KEY) || "{}"); m[id] = hash; localStorage.setItem(TX_KEY, JSON.stringify(m)); } catch {}
}
export function txOf(id: number): string | null {
  try { const m = JSON.parse(localStorage.getItem(TX_KEY) || "{}"); if (m[id]) return m[id]; } catch {}
  return (seeded as Record<string, string>)[String(id)] || null;
}
export const txUrl = (hash: string) => `${EXPLORER}/tx/${hash}`;

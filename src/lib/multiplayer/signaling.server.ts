import { z } from "zod";
import type { PeerRow, RtcPollResponse, SignalRow } from "./p2p";

const ID = z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/);
const signalSchema = z.object({
  op: z.literal("signal"),
  room: ID,
  from: ID,
  to: ID,
  kind: z.enum(["offer", "answer", "ice"]),
  payload: z.unknown().refine((v) => v !== undefined && JSON.stringify(v).length <= 32_768, {
    message: "payload too large",
  }),
});
const leaveSchema = z.object({ op: z.literal("leave"), room: ID, peer: ID });
const postSchema = z.discriminatedUnion("op", [signalSchema, leaveSchema]);

const PEER_TTL_MS = 30_000;
const SIGNAL_TTL_MS = 60_000;

type PeerRec = { id: string; name: string; lastSeen: number };
type SigRec = { id: number; room: string; to: string; from: string; kind: SignalRow["kind"]; payload: unknown; createdAt: number };

type Memory = {
  nextId: number;
  peers: Map<string, PeerRec>;
  signals: SigRec[];
};

const g = globalThis as typeof globalThis & { __mmRtcMemory__?: Memory };
function mem(): Memory {
  g.__mmRtcMemory__ ??= { nextId: 1, peers: new Map(), signals: [] };
  return g.__mmRtcMemory__;
}

function peerKey(room: string, peer: string) {
  return `${room}\0${peer}`;
}

function prune(now = Date.now()) {
  const m = mem();
  for (const [k, p] of m.peers) {
    if (now - p.lastSeen > PEER_TTL_MS) m.peers.delete(k);
  }
  m.signals = m.signals.filter((s) => now - s.createdAt <= SIGNAL_TTL_MS);
}

function roster(room: string): PeerRow[] {
  const now = Date.now();
  const out: PeerRow[] = [];
  for (const [k, p] of mem().peers) {
    if (!k.startsWith(`${room}\0`)) continue;
    if (now - p.lastSeen > PEER_TTL_MS) continue;
    out.push({ id: p.id, name: p.name });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id)).slice(0, 32);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

async function handleGet(url: URL): Promise<Response> {
  const parsed = z
    .object({
      room: ID,
      peer: ID,
      name: z.string().max(64).default(""),
      since: z.coerce.number().int().min(0).default(0),
    })
    .safeParse({
      room: url.searchParams.get("room"),
      peer: url.searchParams.get("peer"),
      name: url.searchParams.get("name") ?? "",
      since: url.searchParams.get("since") ?? 0,
    });
  if (!parsed.success) return json({ error: "invalid query" }, 400);
  const { room, peer, name, since } = parsed.data;
  prune();
  mem().peers.set(peerKey(room, peer), { id: peer, name, lastSeen: Date.now() });
  const signals = mem()
    .signals.filter((s) => s.room === room && s.to === peer && s.id > since)
    .slice(0, 200)
    .map((s) => ({ id: s.id, from: s.from, kind: s.kind, payload: s.payload }));
  const body: RtcPollResponse = { peers: roster(room), signals };
  return json(body);
}

async function handlePost(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return json({ error: "invalid request" }, 400);
  const msg = parsed.data;
  prune();
  if (msg.op === "signal") {
    const m = mem();
    m.signals.push({
      id: m.nextId++,
      room: msg.room,
      to: msg.to,
      from: msg.from,
      kind: msg.kind,
      payload: msg.payload,
      createdAt: Date.now(),
    });
  } else {
    mem().peers.delete(peerKey(msg.room, msg.peer));
  }
  return json({ ok: true });
}

export async function handleSignaling(request: Request): Promise<Response> {
  try {
    if (request.method === "GET") return await handleGet(new URL(request.url));
    if (request.method === "POST") return await handlePost(request);
    return json({ error: "method not allowed" }, 405);
  } catch (error) {
    console.error("[rtc] signaling error:", error);
    return json({ error: "signaling failed" }, 500);
  }
}

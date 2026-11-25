// members.mjs: chanio member keys and vouching (starter 0.23.25, 2026-11-23).
// Decided in Obsidian Vault/40-Technology/chanio-local-knowledge-attribution-decided-2026-11-23.md, "Credit, consent and
// keys". One file with three readers: the Mac starter (`chanio member`), the notebook in a browser (app/lib/member.ts),
// and the tests (tests/members.test.mjs). Plain JavaScript with no imports, so a browser bundle and Node 18 both load it;
// WebCrypto does the maths.
//
// - A member key never leaves its device.
//   - In a browser it is a WebCrypto P-256 key made with extractable false and kept in IndexedDB, where the browser
//     will sign with it but never hand it out.
//   - On a Mac it is a Secure Enclave key (sc_auth p-256-ne), used through `ssh-keygen -Y sign`; only its public half
//     is ever read.
//   - A person who loses their key makes a new one and is vouched again.
// - A person is a member when a chain of vouches leads to their key from a root key. Each vouch is signed by a member
//   and carries the new member's own signed request, so it binds the one key whose holder asked for it.
// - No name is in any of it: a key, a day, signatures. A name, if a person ever chooses one, lives in a separate credit
//   record (the local entry shape, build step 3).
// - ROOTS holds one root key: Blaine's, made in his Mac's Secure Enclave on 2026-11-25 (m-80d195b9760d0ef0; only its public
//   half is here). A root is where vouching starts; it is a key, not a membership. Another root is his call
//   (90-System/BLAINE-QUEUE.md). Nobody is vouched from it yet that anyone could know of: a vouch is a link no server sees.

export const V = 1;
export const NS = "chanio-member"; // the SSHSIG namespace, and the first word of every signed message
export const ROOTS = Object.freeze([
  Object.freeze({ alg: "sk-p256", pub: "BBj8rKlamqdvAMoV90bGi6ZXmJvJJLeKoxCrK_v3U-fnR5Ib6EpIpmDbTtnjVC3vbxFz_NmAXcHfksl4c_bDJ8g", app: "ssh:" }), // m-80d195b9760d0ef0
]);
export const MAX_CHAIN = 16;
const SK_TYPE = "sk-ecdsa-sha2-nistp256@openssh.com";
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const B64U = /^[A-Za-z0-9_-]+$/;
const APP = /^ssh:[\x21-\x7e]{0,60}$/;
const enc = new TextEncoder();
const subtle = () => {
  const s = globalThis.crypto && globalThis.crypto.subtle;
  if (!s) throw new Error("this runtime has no WebCrypto");
  return s;
};

/* ── bytes ─────────────────────────────────────────────────────────────────────────────────────────── */
export function b64u(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function fromB64u(s) {
  if (typeof s !== "string" || !B64U.test(s)) throw new Error("not base64url");
  const t = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  const out = new Uint8Array(t.length);
  for (let i = 0; i < t.length; i++) out[i] = t.charCodeAt(i);
  return out;
}
const cat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parts) { out.set(p, i); i += p.length; }
  return out;
};
const u32 = (n) => new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
export const sshString = (b) => cat(u32(b.length), typeof b === "string" ? enc.encode(b) : b);
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
async function sha(alg, bytes) { return new Uint8Array(await subtle().digest(alg, bytes)); }
const hex = (b) => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");

/** JSON with sorted keys, the one form every signature is made over. */
export function canon(x) {
  if (x === null || typeof x === "string" || typeof x === "boolean") return JSON.stringify(x);
  if (typeof x === "number") { if (!Number.isSafeInteger(x)) throw new Error("only whole numbers are signed"); return String(x); }
  if (Array.isArray(x)) return `[${x.map(canon).join(",")}]`;
  if (typeof x === "object") return `{${Object.keys(x).sort().map((k) => `${JSON.stringify(k)}:${canon(x[k])}`).join(",")}}`;
  throw new Error("cannot sign this value");
}
/** The bytes a record's signature covers: the namespace, the record type, then the record without its sig. */
export function message(type, record) {
  const body = {};
  for (const k of Object.keys(record)) if (k !== "sig") body[k] = record[k];
  return enc.encode(`${NS} v${V} ${type}\n${canon(body)}`);
}

/* ── keys ──────────────────────────────────────────────────────────────────────────────────────────── */
// { alg: "p256", pub }              a WebCrypto key in a browser: pub is the 65-byte uncompressed point, base64url
// { alg: "sk-p256", pub, app }      a Mac Secure Enclave key used as an ssh security key; app is its application, "ssh:…"
export function keyOk(k) {
  if (!k || typeof k !== "object" || Array.isArray(k)) return false;
  const want = k.alg === "p256" ? ["alg", "pub"] : k.alg === "sk-p256" ? ["alg", "app", "pub"] : null;
  if (!want || Object.keys(k).sort().join() !== want.join()) return false;
  if (k.alg === "sk-p256" && !(typeof k.app === "string" && APP.test(k.app))) return false;
  try { const p = fromB64u(k.pub); return p.length === 65 && p[0] === 4; } catch { return false; }
}
export function sameKey(a, b) { return keyOk(a) && keyOk(b) && a.alg === b.alg && a.pub === b.pub && (a.app || "") === (b.app || ""); }
/** A key's short id, "m-" and 16 hex: what a person sees, never a name. */
export async function keyId(k) {
  if (!keyOk(k)) throw new Error("not a member key");
  return `m-${hex(await sha("SHA-256", enc.encode(`${k.alg}:${k.pub}${k.app ? `:${k.app}` : ""}`))).slice(0, 16)}`;
}
/** The ssh public-key blob of a Secure Enclave key (what `ssh-keygen` prints after the type, base64). */
export function skKeyBlob(k) { return cat(sshString(SK_TYPE), sshString("nistp256"), sshString(fromB64u(k.pub)), sshString(k.app)); }
/** Read an ssh public key line. Only a Secure Enclave (sk-ecdsa P-256) key is a member key; any other gives null. */
export function keyFromSshPub(line) {
  const m = String(line || "").trim().match(/^(\S+) ([A-Za-z0-9+/]+=*)(?: .*)?$/);
  if (!m || m[1] !== SK_TYPE) return null;
  try {
    const r = reader(Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0)));
    if (r.text() !== SK_TYPE || r.text() !== "nistp256") return null;
    const q = r.str(), app = r.text();
    if (!r.done()) return null;
    const k = { alg: "sk-p256", pub: b64u(q), app };
    return keyOk(k) ? k : null;
  } catch { return null; }
}

function reader(b) {
  let i = 0;
  const need = (n) => { if (n < 0 || i + n > b.length) throw new Error("short"); };
  return {
    u8() { need(1); return b[i++]; },
    u32() { need(4); const v = ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3]; i += 4; return v; },
    bytes(n) { need(n); const o = b.subarray(i, i + n); i += n; return o; },
    str() { return this.bytes(this.u32()); },
    text() { const s = this.str(); if (![...s].every((c) => c >= 0x20 && c < 0x7f)) throw new Error("not text"); return String.fromCharCode(...s); },
    done() { return i === b.length; },
  };
}
// An ssh mpint (big-endian, maybe a leading zero) as the 32 bytes WebCrypto wants.
function fixed32(m) {
  let s = m;
  while (s.length > 32 && s[0] === 0) s = s.subarray(1);
  if (s.length > 32 || (m.length && m[0] & 0x80)) throw new Error("not a P-256 scalar");
  return cat(new Uint8Array(32 - s.length), s);
}
/**
 * What OpenSSH's verifier checks for a Secure Enclave signature made by `ssh-keygen -Y sign -n chanio-member`:
 * the SSHSIG wrapper names this exact key and namespace; the signature is sk-ecdsa with the user-present flag; and the
 * ECDSA signature covers sha256(app) || flags || counter || sha256(the SSHSIG data to sign). Returns null otherwise.
 */
async function sshsigData(key, msg, blob, ns0 = NS) {
  const r = reader(blob);
  if (String.fromCharCode(...r.bytes(6)) !== "SSHSIG" || r.u32() !== 1) return null;
  const pk = r.str(), ns = r.str(), reserved = r.str(), halg = r.text(), sig = r.str();
  if (!r.done() || !same(pk, skKeyBlob(key)) || String.fromCharCode(...ns) !== ns0) return null;
  if (halg !== "sha512" && halg !== "sha256") return null;
  const s = reader(sig);
  if (s.text() !== SK_TYPE) return null;
  const rs = reader(s.str());
  const rr = fixed32(rs.str()), ss = fixed32(rs.str());
  if (!rs.done()) return null;
  const flags = s.u8(), counter = s.u32();
  if (!s.done() || !(flags & 0x01)) return null;
  const h = await sha(halg === "sha512" ? "SHA-512" : "SHA-256", msg);
  const toSign = cat(enc.encode("SSHSIG"), sshString(ns), sshString(reserved), sshString(halg), sshString(h));
  const signed = cat(await sha("SHA-256", enc.encode(key.app)), new Uint8Array([flags]), u32(counter), await sha("SHA-256", toSign));
  return { rs: cat(rr, ss), signed };
}
/** Whether `sig` is this key's signature over these bytes. Never throws. (ns is for checking other namespaces' real
 *  signatures in a test; every member record is checked under NS.) */
export async function verifySig(key, msg, sig, ns = NS) {
  if (!keyOk(key) || typeof sig !== "string" || !B64U.test(sig)) return false;
  try {
    const pk = await subtle().importKey("raw", fromB64u(key.pub), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    if (key.alg === "p256") {
      const s = fromB64u(sig);
      return s.length === 64 && (await subtle().verify({ name: "ECDSA", hash: "SHA-256" }, pk, s, msg));
    }
    const d = await sshsigData(key, msg, fromB64u(sig), ns);
    return !!d && (await subtle().verify({ name: "ECDSA", hash: "SHA-256" }, pk, d.rs, d.signed));
  } catch { return false; }
}

/* ── a key in a browser: made so it cannot be exported ─────────────────────────────────────────────── */
export async function makeBrowserKey() {
  const kp = await subtle().generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"]);
  const pub = b64u(new Uint8Array(await subtle().exportKey("raw", kp.publicKey)));
  return { privateKey: kp.privateKey, key: { alg: "p256", pub } };
}
/** A signer for a browser key: bytes in, base64url signature out. */
export const browserSigner = (privateKey) => async (bytes) =>
  b64u(new Uint8Array(await subtle().sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, bytes)));
/** Whether a private key can be read out. The check that a member key cannot be copied. */
export async function exportable(privateKey) {
  if (!privateKey || privateKey.extractable !== false) return true;
  try { await subtle().exportKey("pkcs8", privateKey); return true; } catch { return false; }
}

/* ── records ───────────────────────────────────────────────────────────────────────────────────────── */
// request  { v, type: "request", key, date, sig }               signed by key: "this key asks to be vouched"
// vouch    { v, type: "vouch", request, by, date, sig }         signed by by: "I vouch for the key in this request"
// card     { v, type: "card", key, vouches: [vouch, ...] }      the chain from a root to key; a root's card has none
const exact = (o, keys) => !!o && typeof o === "object" && !Array.isArray(o) && Object.keys(o).sort().join() === [...keys].sort().join();

export async function makeRequest(key, sign, date) {
  const r = { v: V, type: "request", key, date };
  return { ...r, sig: await sign(message("request", r)) };
}
export async function makeVouch(request, by, sign, date) {
  const x = { v: V, type: "vouch", request, by, date };
  return { ...x, sig: await sign(message("vouch", x)) };
}
export const rootCard = (key) => ({ v: V, type: "card", key, vouches: [] });
/** The card a voucher hands back: the voucher's own chain, then the new vouch. */
export const extendCard = (mine, vouch) => ({ v: V, type: "card", key: vouch.request.key, vouches: [...mine.vouches, vouch] });

export async function requestProblems(r) {
  if (!exact(r, ["v", "type", "key", "date", "sig"])) return ["not a vouch request"];
  const out = [];
  if (r.v !== V || r.type !== "request") out.push("not a version 1 request");
  if (!keyOk(r.key)) out.push("the key is not a member key");
  if (!DAY.test(String(r.date))) out.push("no day");
  if (!out.length && !(await verifySig(r.key, message("request", r), r.sig))) out.push("the request is not signed by its own key");
  return out;
}
export async function vouchProblems(x) {
  if (!exact(x, ["v", "type", "request", "by", "date", "sig"])) return ["not a vouch"];
  const out = [];
  if (x.v !== V || x.type !== "vouch") out.push("not a version 1 vouch");
  out.push(...(await requestProblems(x.request)).map((p) => `request: ${p}`));
  if (!keyOk(x.by)) out.push("the voucher's key is not a member key");
  else if (keyOk(x.request && x.request.key) && sameKey(x.by, x.request.key)) out.push("a key cannot vouch for itself");
  if (!DAY.test(String(x.date))) out.push("no day");
  else if (x.request && DAY.test(String(x.request.date)) && x.date < x.request.date) out.push("vouched before it was asked");
  if (!out.length && !(await verifySig(x.by, message("vouch", x), x.sig))) out.push("the vouch is not signed by the voucher");
  return out;
}
/** Whether a card makes its key a member: { ok, why, depth }. Each vouch checked, each link joined, a root at the start. */
export async function checkCard(card, roots = ROOTS) {
  const no = (why) => ({ ok: false, why, depth: null });
  if (!exact(card, ["v", "type", "key", "vouches"]) || card.v !== V || card.type !== "card") return no("not a member card");
  if (!keyOk(card.key)) return no("the card's key is not a member key");
  const vs = card.vouches;
  if (!Array.isArray(vs) || vs.length > MAX_CHAIN) return no(`a chain of at most ${MAX_CHAIN} vouches`);
  if (!vs.length) return roots.some((k) => sameKey(k, card.key)) ? { ok: true, why: "a root key", depth: 0 } : no("not vouched yet");
  if (!roots.some((k) => sameKey(k, vs[0].by))) return no("the chain does not start at a root key");
  const seen = [];
  for (let i = 0; i < vs.length; i++) {
    const p = await vouchProblems(vs[i]);
    if (p.length) return no(`vouch ${i + 1}: ${p[0]}`);
    if (i && !sameKey(vs[i].by, vs[i - 1].request.key)) return no(`vouch ${i + 1} is not signed by the key vouch ${i} made a member`);
    if (i && vs[i].date < vs[i - 1].date) return no(`vouch ${i + 1} is dated before its voucher was vouched`);
    if (seen.some((k) => sameKey(k, vs[i].request.key)) || roots.some((k) => sameKey(k, vs[i].request.key))) return no(`vouch ${i + 1} vouches for a key already in the chain`);
    seen.push(vs[i].request.key);
  }
  if (!sameKey(vs[vs.length - 1].request.key, card.key)) return no("the last vouch is for another key");
  return { ok: true, why: `vouched, ${vs.length} step${vs.length === 1 ? "" : "s"} from a root key`, depth: vs.length };
}

/* ── hand-offs: a link whose fragment carries the record, so no server sees it ─────────────────────── */
export const HAND = { request: "vouch-request", card: "card" };
export const packRecord = (x) => b64u(enc.encode(canon(x)));
export function unpackRecord(s) {
  try { return JSON.parse(new TextDecoder().decode(fromB64u(String(s).trim()))); } catch { return null; }
}
/** The record in a chanio link or a pasted fragment ("…#vouch-request=…" or "…#card=…"), or null. */
export function fromLink(text) {
  const m = String(text || "").match(/#(vouch-request|card)=([A-Za-z0-9_-]{20,})/);
  if (!m) return null;
  const rec = unpackRecord(m[2]);
  return rec && typeof rec === "object" ? { kind: m[1] === "card" ? "card" : "request", rec } : null;
}

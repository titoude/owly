// PIN records are stored as "v2:<salt>:<sha256(salt:pin)>". A per-install
// random salt defeats a shared rainbow table over the 10k PIN keyspace.
// Legacy records (unsalted sha256("owly:"+pin)) still verify and are
// upgraded in place on the next successful unlock.
const LEGACY_PREFIX = "owly:";

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashPin(pin: string, salt?: string): Promise<string> {
  return sha256(`${salt ?? LEGACY_PREFIX}${pin}`);
}

export async function newPinRecord(pin: string): Promise<string> {
  const salt = [...crypto.getRandomValues(new Uint8Array(8))].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `v2:${salt}:${await sha256(`${salt}:${pin}`)}`;
}

// Returns the (possibly upgraded) record to store, or null when the PIN is wrong.
export async function verifyPin(pin: string, stored: string): Promise<string | null> {
  if (stored.startsWith("v2:")) {
    const [, salt, hash] = stored.split(":");
    if (await sha256(`${salt}:${pin}`) === hash) return stored;
    return null;
  }
  if (await hashPin(pin) === stored) return newPinRecord(pin); // legacy → upgrade
  return null;
}

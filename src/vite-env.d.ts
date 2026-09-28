/// <reference types="vite/client" />

// Minimal node-ambient declarations for the report font loader's test path.
// The browser build never reaches these (fetch() succeeds there first).
declare module "node:fs/promises" {
  export function readFile(path: string | URL): Promise<Uint8Array>;
}
declare const process: { cwd(): string };

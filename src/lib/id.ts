/**
 * Stable, collision-resistant short IDs for document entities.
 * No external dependency so the core model stays portable.
 */

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

export const createId = (prefix: string): string => {
  let body = "";
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    const bytes = new Uint8Array(10);
    crypto.getRandomValues(bytes);
    for (const byte of bytes) body += ALPHABET[byte % ALPHABET.length];
  } else {
    for (let i = 0; i < 10; i++) {
      body += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    }
  }
  return `${prefix}_${body}`;
};

export const vertexId = (): string => createId("v");
export const creaseId = (): string => createId("c");

/**
 * 使用 Web Crypto API (AES-GCM) 對 localStorage 儲存內容加密
 * 金鑰可由 VITE_STORAGE_ENCRYPT_KEY 提供，未設定時使用預設衍生金鑰（建議正式環境自行設定）
 */

const SALT = new Uint8Array([
  97, 115, 97, 110, 97, 45, 100, 97, 115, 104, 98, 111, 97, 114, 100, 115,
]);
const ITERATIONS = 100000;
const KEY_LENGTH = 256;

function getSecret(): string {
  return (
    (typeof import.meta !== "undefined" &&
      import.meta.env?.VITE_STORAGE_ENCRYPT_KEY) ||
    "asana-dashboard-default-secret"
  );
}

async function deriveKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: SALT,
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  );
}

let keyCache: Promise<CryptoKey> | null = null;

function getKey(): Promise<CryptoKey> {
  if (!keyCache) keyCache = deriveKey(getSecret());
  return keyCache;
}

/** 加密字串，回傳 base64（IV + ciphertext） */
export async function encrypt(plainText: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, tagLength: 128 },
    key,
    enc.encode(plainText)
  );
  const combined = new Uint8Array(iv.length + cipher.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(cipher), iv.length);
  return btoa(String.fromCharCode(...combined));
}

/** 解密由 encrypt 產生的 base64 字串 */
export async function decrypt(base64: string): Promise<string> {
  const key = await getKey();
  const combined = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const cipher = combined.slice(12);
  const dec = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv, tagLength: 128 },
    key,
    cipher
  );
  return new TextDecoder().decode(dec);
}

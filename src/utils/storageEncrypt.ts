/**
 * 使用 Web Crypto API (AES-GCM) 對 localStorage 儲存內容加密
 * 金鑰可由 VITE_STORAGE_ENCRYPT_KEY 提供，未設定時使用預設衍生金鑰（建議正式環境自行設定）
 * 在非安全環境（例如 http:// 非 localhost）crypto.subtle 不可用，會改為 base64 編碼儲存。
 */

const SALT = new Uint8Array([
  97, 115, 97, 110, 97, 45, 100, 97, 115, 104, 98, 111, 97, 114, 100, 115,
]);
const ITERATIONS = 100000;
const KEY_LENGTH = 256;

/** 僅在 HTTPS 或 localhost 可用；http:// 其他主機時為 undefined */
const subtle = typeof crypto !== "undefined" ? crypto.subtle : undefined;

function getSecret(): string {
  return (
    (typeof import.meta !== "undefined" &&
      import.meta.env?.VITE_STORAGE_ENCRYPT_KEY) ||
    "asana-dashboard-default-secret"
  );
}

async function deriveKey(secret: string): Promise<CryptoKey> {
  if (!subtle) throw new Error("crypto.subtle unavailable");
  const enc = new TextEncoder();
  const keyMaterial = await subtle.importKey(
    "raw",
    enc.encode(secret),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );
  return subtle.deriveKey(
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

/** 非安全環境 fallback：僅 base64 編碼（權杖不以明文存於 localStorage） */
function encodeFallback(plainText: string): string {
  return btoa(unescape(encodeURIComponent(plainText)));
}
function decodeFallback(encoded: string): string {
  return decodeURIComponent(escape(atob(encoded)));
}

/** 加密字串，回傳 base64（IV + ciphertext）；無 crypto.subtle 時改為 base64 編碼 */
export async function encrypt(plainText: string): Promise<string> {
  if (!subtle) {
    if (typeof console !== "undefined" && console.warn) {
      console.warn(
        "[storageEncrypt] 目前為非安全環境（非 HTTPS/localhost），權杖改以 base64 儲存，建議正式環境使用 HTTPS。"
      );
    }
    return encodeFallback(plainText);
  }
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const cipher = await subtle.encrypt(
    { name: "AES-GCM", iv, tagLength: 128 },
    key,
    enc.encode(plainText)
  );
  const combined = new Uint8Array(iv.length + cipher.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(cipher), iv.length);
  return btoa(String.fromCharCode(...combined));
}

/** 解密：先嘗試 AES-GCM，失敗或無 crypto.subtle 時當作 base64 解碼 */
export async function decrypt(base64: string): Promise<string> {
  if (!subtle) {
    return decodeFallback(base64);
  }
  try {
    const key = await getKey();
    const combined = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    if (combined.length < 13) return decodeFallback(base64);
    const iv = combined.slice(0, 12);
    const cipher = combined.slice(12);
    const dec = await subtle.decrypt(
      { name: "AES-GCM", iv, tagLength: 128 },
      key,
      cipher
    );
    return new TextDecoder().decode(dec);
  } catch {
    return decodeFallback(base64);
  }
}

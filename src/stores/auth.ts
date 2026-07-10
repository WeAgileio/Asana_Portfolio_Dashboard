import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { isDemoMode } from "@/demo/isDemoMode";
import { encrypt, decrypt } from "@/utils/storageEncrypt";

const STORAGE_KEY = "asana_pat_enc";
/** Demo 部署用固定 token；不會發送至 Asana */
export const DEMO_TOKEN = "__demo__";
export const DEMO_TOKEN_HASH = "demo";

/** 非安全環境（http 非 localhost）時 crypto.subtle 不可用，改用簡單雜湊區分不同 PAT */
function hashTokenFallback(token: string): string {
  let h = 0;
  const s = token;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) >>> 0;
  }
  return "f_" + h.toString(16);
}

async function hashToken(token: string): Promise<string> {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    return hashTokenFallback(token);
  }
  try {
    const buf = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(token)
    );
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return hashTokenFallback(token);
  }
}

export const useAuthStore = defineStore("auth", () => {
  const token = ref<string | null>(null);
  /** 目前權杖的 SHA-256 雜湊，供「依 PAT 區分」的 localStorage 鍵使用，不暴露權杖本身 */
  const tokenHash = ref<string | null>(null);
  /** 是否已嘗試從 localStorage 還原（避免閃爍） */
  const initialized = ref(false);

  const isLoggedIn = computed(() => !!token.value);

  /** 從 localStorage 讀取並解密後寫入 memory；解密失敗時不刪除儲存內容，避免重新整理誤刪 PAT */
  function applyDemoSession(): void {
    token.value = DEMO_TOKEN;
    tokenHash.value = DEMO_TOKEN_HASH;
  }

  async function loadFromStorage(): Promise<void> {
    if (initialized.value) return;
    if (isDemoMode()) {
      applyDemoSession();
      initialized.value = true;
      return;
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        initialized.value = true;
        return;
      }
      const decrypted = await decrypt(raw);
      if (decrypted && decrypted.trim()) {
        const trimmed = decrypted.trim();
        token.value = trimmed;
        tokenHash.value = await hashToken(trimmed);
      }
      // 解密結果為空時不刪除 localStorage，保留資料供除錯或手動清除
    } catch (e) {
      console.warn("[auth] 還原權杖失敗，請重新登入", e);
      token.value = null;
      tokenHash.value = null;
      // 不再移除 localStorage，避免重新整理或暫時錯誤時誤刪已存 PAT
    } finally {
      initialized.value = true;
    }
  }

  /** 將權杖加密寫入 localStorage 並寫入 memory */
  async function saveToken(pat: string): Promise<void> {
    const trimmed = (pat || "").trim();
    if (!trimmed) return;
    const cipher = await encrypt(trimmed);
    localStorage.setItem(STORAGE_KEY, cipher);
    token.value = trimmed;
    tokenHash.value = await hashToken(trimmed);
  }

  /** 登出：清除 memory 與 localStorage；demo 模式改為重新注入展示 session */
  function clearToken(): void {
    if (isDemoMode()) {
      applyDemoSession();
      return;
    }
    token.value = null;
    tokenHash.value = null;
    localStorage.removeItem(STORAGE_KEY);
  }

  /** 目前權杖的雜湊，用於依 PAT 區分的儲存鍵（例如專案選擇）；未登入為 null */
  function getTokenHash(): string | null {
    return tokenHash.value;
  }

  /** 取得目前權杖（memory），若尚未 load 會先等 loadFromStorage */
  async function getToken(): Promise<string | null> {
    if (!initialized.value) await loadFromStorage();
    return token.value;
  }

  return {
    token,
    tokenHash,
    initialized,
    isLoggedIn,
    loadFromStorage,
    saveToken,
    clearToken,
    getToken,
    getTokenHash,
  };
});

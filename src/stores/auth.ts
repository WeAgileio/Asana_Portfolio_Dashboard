import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { encrypt, decrypt } from "@/utils/storageEncrypt";

const STORAGE_KEY = "asana_pat_enc";

async function hashToken(token: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const useAuthStore = defineStore("auth", () => {
  const token = ref<string | null>(null);
  /** 目前權杖的 SHA-256 雜湊，供「依 PAT 區分」的 localStorage 鍵使用，不暴露權杖本身 */
  const tokenHash = ref<string | null>(null);
  /** 是否已嘗試從 localStorage 還原（避免閃爍） */
  const initialized = ref(false);

  const isLoggedIn = computed(() => !!token.value);

  /** 從 localStorage 讀取並解密後寫入 memory，失敗則清除；完成後才設 initialized */
  async function loadFromStorage(): Promise<void> {
    if (initialized.value) return;
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
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      token.value = null;
      tokenHash.value = null;
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

  /** 登出：清除 memory 與 localStorage */
  function clearToken(): void {
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

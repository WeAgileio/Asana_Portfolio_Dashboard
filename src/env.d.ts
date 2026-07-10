/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEMO_MODE?: string;
  readonly VITE_BILLING_FIELD?: string;
  readonly VITE_BILLING_TASK_FIELD?: string;
  readonly VITE_PROXY_TARGET?: string;
  readonly VITE_STORAGE_ENCRYPT_KEY?: string;
  readonly VITE_DEFAULT_PROJECT_GID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

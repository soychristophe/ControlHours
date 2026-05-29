/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// ── Environment variables (injected by Vite) ─────────────────────────────────
interface ImportMetaEnv {
  /** Base URL of the Cloudflare Pages API (e.g. https://timeireland.pages.dev) */
  readonly VITE_API_BASE: string
  /** Set to "true" to force offline mode regardless of connectivity */
  readonly VITE_FORCE_OFFLINE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

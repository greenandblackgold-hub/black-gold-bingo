/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the Bingo API. When set, the app runs in server mode (real accounts, wallets and payments). */
  readonly VITE_API_URL?: string;
  /** "true" when this site is served by the Bingo server itself (same address, no VITE_API_URL needed). */
  readonly VITE_SERVER_MODE?: string;
}

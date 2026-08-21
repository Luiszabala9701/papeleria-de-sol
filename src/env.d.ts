/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL?: string;
  readonly PUBLIC_SUPABASE_CLAVE_PUBLICA?: string;
  readonly PUBLIC_URL_SITIO?: string;
  readonly PUBLIC_USAR_DATOS_DEMOSTRACION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

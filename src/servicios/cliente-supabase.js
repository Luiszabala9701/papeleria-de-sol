import { createClient } from '@supabase/supabase-js';

let clienteCompartido;

export function configuracionSupabaseDisponible() {
  return Boolean(
    import.meta.env.PUBLIC_SUPABASE_URL &&
      import.meta.env.PUBLIC_SUPABASE_CLAVE_PUBLICA,
  );
}

export function obtenerClienteSupabase() {
  if (!configuracionSupabaseDisponible()) {
    return null;
  }

  if (!clienteCompartido) {
    clienteCompartido = createClient(
      import.meta.env.PUBLIC_SUPABASE_URL,
      import.meta.env.PUBLIC_SUPABASE_CLAVE_PUBLICA,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      },
    );
  }

  return clienteCompartido;
}

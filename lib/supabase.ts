import { createClient, PostgrestError, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

function createSupabaseClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    return createClient('https://placeholder.supabase.co', 'placeholder-key');
  }
  return createClient(supabaseUrl, supabaseAnonKey);
}

export const supabase = createSupabaseClient();

// O PostgREST corta a resposta no `max-rows` do projeto (1000 por padrão no
// Supabase hospedado) sem sinalizar truncamento. Como as consultas de histórico
// ordenam por data decrescente, o corte descarta justamente os meses mais
// antigos — meses inteiros somem do dashboard sem erro nenhum. Este helper
// pagina por `range` até esgotar a tabela.
const PAGE_SIZE = 1000;

type PagedQuery<T> = {
  range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>;
};

export async function fetchAllRows<T>(
  buildQuery: () => PagedQuery<T>
): Promise<{ data: T[]; error: PostgrestError | null }> {
  const rows: T[] = [];

  for (let page = 0; ; page++) {
    const from = page * PAGE_SIZE;
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);

    if (error) return { data: rows, error };
    if (!data || data.length === 0) break;

    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }

  return { data: rows, error: null };
}

export function createServerClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return createClient('https://placeholder.supabase.co', 'placeholder-key');
  }

  return createClient(url, key);
}

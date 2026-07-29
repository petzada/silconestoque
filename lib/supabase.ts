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
const REQUESTED_PAGE_SIZE = 1000;

// Depois da primeira página, as demais vão em paralelo: buscar 5 mil linhas em
// requisições sequenciais somava a latência de ida e volta de cada página, e foi
// isso que deixou dashboard e movimentações visivelmente mais lentos. A janela é
// limitada para não disparar dezenas de requisições simultâneas contra o
// PostgREST.
const MAX_PARALLEL_PAGES = 4;

type PagedQuery<T> = {
  range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>;
};

export async function fetchAllRows<T>(
  buildQuery: () => PagedQuery<T>
): Promise<{ data: T[]; error: PostgrestError | null }> {
  const first = await buildQuery().range(0, REQUESTED_PAGE_SIZE - 1);
  if (first.error) return { data: [], error: first.error };

  const rows: T[] = first.data ?? [];

  // O servidor pode impor um `max-rows` menor que o pedido, então o tamanho real
  // da primeira página é a única referência confiável de passo. Assumir 1000 aqui
  // faria a paginação pular linhas justamente onde ela deveria proteger.
  const stride = rows.length;
  if (stride === 0) return { data: rows, error: null };

  let nextPage = 1;

  if (stride < REQUESTED_PAGE_SIZE) {
    // Página curta significa uma de duas coisas: acabaram os dados, ou o servidor
    // devolve menos do que se pede. Só uma sondagem distingue — e ela custa uma
    // requisição, contra as quatro que uma janela paralela desperdiçaria aqui
    // (este é o caso comum: a maioria das tabelas cabe numa página).
    const probe = await buildQuery().range(stride, stride * 2 - 1);
    if (probe.error) return { data: rows, error: probe.error };

    const probeRows = probe.data ?? [];
    if (probeRows.length === 0) return { data: rows, error: null };

    rows.push(...probeRows);
    if (probeRows.length < stride) return { data: rows, error: null };
    nextPage = 2;
  }

  // Daqui em diante há volume que justifica paralelizar. A parada é sempre por
  // janela incompleta, nunca por comparação com o tamanho pedido.
  for (;;) {
    const window = Array.from({ length: MAX_PARALLEL_PAGES }, (_, offset) => {
      const from = (nextPage + offset) * stride;
      return buildQuery().range(from, from + stride - 1);
    });

    const results = await Promise.all(window);

    let fetched = 0;
    for (const result of results) {
      if (result.error) return { data: rows, error: result.error };
      const page = result.data ?? [];
      rows.push(...page);
      fetched += page.length;
    }

    if (fetched < stride * MAX_PARALLEL_PAGES) break;
    nextPage += MAX_PARALLEL_PAGES;
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

/**
 * supabase-js v2 devolve o erro do PostgREST como **objeto plano** parseado
 * de JSON (`@supabase/postgrest-js/dist/index.cjs`, `error = JSON.parse(body)`),
 * nunca como instância de `Error` — a classe `PostgrestError` só é construída
 * no caminho `shouldThrowOnError`, que nenhum call site deste repo usa.
 *
 * Consequência: `error instanceof Error` é sempre `false` para um erro de
 * banco, então `error instanceof Error ? error.message : ''` sempre resolve
 * para `''` e todo ramo de mensagem específica fica inalcançável.
 *
 * Este helper faz type narrowing de verdade sobre o objeto (`code`,
 * `message`, `details`, `hint`) e chaveia por **código Postgres**, não por
 * substring de mensagem — os códigos divergiam entre arquivos que tentavam
 * a mesma coisa (`'foreign'` vs `'foreign key'`, por exemplo).
 */

export type PostgrestLikeError = {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
};

export function isPostgrestLikeError(error: unknown): error is PostgrestLikeError {
  if (typeof error !== 'object' || error === null) return false;
  return 'code' in error || 'message' in error;
}

/** Mensagem específica por código Postgres, fornecida pelo chamador. */
export type DbErrorOverrides = Partial<Record<string, string>>;

// Mensagens genéricas usadas quando o chamador não passa um override para o
// código encontrado. Ficam propositalmente vagas — quem sabe o vocabulário
// certo para a tela (ex.: "categoria" vs "colaborador") deve passar overrides.
const DEFAULT_MESSAGES: DbErrorOverrides = {
  '23505': 'Já existe um registro com esses dados.',
  '23503': 'Este registro está em uso e não pode ser removido ou alterado.',
  '23514': 'Os valores informados violam uma regra de consistência do cadastro.',
  PGRST116: 'Registro não encontrado.',
};

/**
 * Extrai uma mensagem amigável de um erro de banco (PostgREST ou RPC).
 *
 * - `overrides` tem prioridade sobre qualquer mensagem genérica, por código.
 * - `P0001` (RAISE EXCEPTION de função/trigger nossa) propaga a mensagem do
 *   banco como está, pois já é escrita em português para o usuário final —
 *   a menos que o chamador explicite um override para `P0001`.
 * - Sem `code`/`message` reconhecíveis (não é um erro de banco), devolve o
 *   `fallback`.
 */
export function getDbErrorMessage(error: unknown, fallback: string, overrides?: DbErrorOverrides): string {
  if (!isPostgrestLikeError(error)) return fallback;

  const code = error.code;

  if (code && overrides?.[code]) return overrides[code]!;

  if (code === 'P0001') {
    const message = error.message?.trim();
    return message || fallback;
  }

  if (code && DEFAULT_MESSAGES[code]) return DEFAULT_MESSAGES[code]!;

  return fallback;
}

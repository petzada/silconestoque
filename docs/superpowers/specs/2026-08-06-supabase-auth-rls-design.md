# Design: Supabase Auth + RLS uniforme

**Status:** Aprovado (Opção 1 — auth mínimo + RLS uniforme)  
**Data:** 2026-08-06

## Objetivo

Substituir a senha única visual (cookie constante + `config.access_password`) por Supabase Auth com e-mail/senha individual e políticas RLS que exigem `authenticated`, de modo que a anon key sozinha não leia nem escreva o banco.

## Escopo

- Login e-mail + senha via `signInWithPassword`
- Usuários criados só no painel Supabase (sem cadastro/convite/recuperação na app)
- `proxy.ts` (Next.js 16) com `@supabase/ssr` (refresh de sessão + guarda de rotas)
- RLS `TO authenticated` em todas as tabelas operacionais (15)
- `movements.created_by UUID DEFAULT auth.uid()` (sem UI nesta leva)
- Remoção de `lib/auth.ts`, cookie legado e uso de `NEXT_PUBLIC_FALLBACK_PASSWORD`
- Quiz permanece desativado permanentemente; `quiz_respostas` também exige auth
- `GRANT EXECUTE ... TO authenticated` nos RPCs (hoje só `TO anon`)
- Atualizar ADR-0004 para superseded

## Fora de escopo

- Papéis admin/operador
- Exibir `created_by` na UI
- Recuperação de senha / convite / admin de usuários na app
- Reativar `/quiz-seguranca`

## Arquitetura

1. **Browser:** `createBrowserClient` (`@supabase/ssr`) em `lib/supabase.ts` — sessão em cookies
2. **Proxy (Next.js 16):** `createServerClient` + `getUser()`; redireciona não autenticados para `/login`; autenticados em `/login` → `/dashboard`
3. **AuthProvider:** espelha sessão Supabase (`onAuthStateChange`); `logout` → `signOut`
4. **Banco:** migration `migration_auth_rls.sql` — drop `Allow all`, create `Authenticated`, coluna `created_by`, grants RPC

## Critério de sucesso

- Sem sessão válida, queries PostgREST falham por RLS
- Com login, o app opera como hoje
- Cada insert em `movements` grava `created_by` automaticamente

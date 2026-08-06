---
status: superseded
superseded_by: docs/superpowers/specs/2026-08-06-supabase-auth-rls-design.md
---

# Risco aceito: RLS aberto e senha única visual

**Status: superseded em 2026-08-06.** A migração para Supabase Auth + RLS `TO authenticated` foi implementada (ver `supabase/migration_auth_rls.sql`, `proxy.ts`, login com `signInWithPassword`). Este ADR permanece como registro histórico do risco que existia antes.

---

Todas as tabelas tinham política RLS "Allow all" e o app acessava o Supabase direto do navegador com a chave anônima; a tela de senha era apenas visual. Qualquer pessoa com a URL conseguia ler e escrever no banco via DevTools. Decidimos **aceitar esse risco por ora**: era ferramenta interna, com URL não divulgada e dados de baixa sensibilidade, e a migração para Supabase Auth tinha custo que não se justificava então.

O guard de acesso era um `useEffect` client-side — se `!isLoggedIn`, redirecionava para `/login` depois do primeiro render — e não existia `middleware.ts`. O estado de sessão era um cookie com nome e valor constantes em `lib/auth.ts` (`AUTH_COOKIE_NAME = 'silcon_auth'`, `AUTH_SECRET = 'silcon_authenticated_2024'`). Nenhuma dessas peças verificava identidade — era uma senha única, visual, que não distinguia usuários.

## Nota (2026-07-30): a rota do quiz quebrou a premissa "URL não divulgada" — e foi fechada

`app/quiz-seguranca/**` vivia fora do grupo de rotas `(dashboard)` e, portanto, fora do guard acima — é client component e importa `lib/supabase` diretamente. Qualquer visitante que abrisse `/quiz-seguranca` ou `/quiz-seguranca/painel` recebia o `NEXT_PUBLIC_SUPABASE_ANON_KEY` sem digitar senha nenhuma, e com RLS "Allow all" esse anon key sozinho já bastava para ler e escrever o banco inteiro pelo DevTools — inclusive `config.access_password`. Isso quebrava a premissa central deste ADR.

Essa superfície foi **fechada em 2026-07-30** por `notFound()` em `app/quiz-seguranca/layout.tsx`. Em 2026-08-06 o quiz foi decidido como **permanentemente desativado**, e `quiz_respostas` passou a exigir `authenticated` junto com as demais tabelas.

## O que reabria a decisão (histórico)

- Expor o sistema publicamente na internet ou divulgar a URL além da equipe.
- Guardar dados sensíveis de colaboradores além de nome/setor/função.
- Qualquer incidente de alteração não explicada de dados.

Essas condições motivaram a migração concluída em 2026-08-06.

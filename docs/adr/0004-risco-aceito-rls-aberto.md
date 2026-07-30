---
status: accepted
---

# Risco aceito: RLS aberto e senha única visual

Todas as tabelas têm política RLS "Allow all" e o app acessa o Supabase direto do navegador com a chave anônima; a tela de senha é apenas visual. Qualquer pessoa com a URL consegue ler e escrever no banco via DevTools. Decidimos **aceitar esse risco por ora**: é ferramenta interna, com URL não divulgada e dados de baixa sensibilidade, e a migração para Supabase Auth tem custo que não se justifica hoje.

O guard de acesso é um `useEffect` client-side em `app/(dashboard)/layout.tsx` — se `!isLoggedIn`, redireciona para `/login` depois do primeiro render — e não existe `middleware.ts` no projeto. O estado de sessão é um cookie cujo nome e valor são constantes fixas em `lib/auth.ts` (`AUTH_COOKIE_NAME = 'silcon_auth'`, `AUTH_SECRET = 'silcon_authenticated_2024'`). Nenhuma dessas peças verifica identidade — é uma senha única, visual, que não distingue usuários.

## Nota (2026-07-30): a rota do quiz quebrou a premissa "URL não divulgada" — e foi fechada

`app/quiz-seguranca/**` vivia fora do grupo de rotas `(dashboard)` e, portanto, fora do guard acima — é client component e importa `lib/supabase` diretamente. Qualquer visitante que abrisse `/quiz-seguranca` ou `/quiz-seguranca/painel` recebia o `NEXT_PUBLIC_SUPABASE_ANON_KEY` sem digitar senha nenhuma, e com RLS "Allow all" esse anon key sozinho já basta para ler e escrever o banco inteiro pelo DevTools — inclusive `config.access_password`. Isso quebrava a premissa central deste ADR: bastava alguém achar o link do quiz, sem nem saber que o dashboard existia, para achar a chave.

Essa superfície foi **fechada em 2026-07-30** por `notFound()` em `app/quiz-seguranca/layout.tsx` (novo), aplicado ao segmento inteiro. Nada foi apagado: `app/quiz-seguranca/page.tsx`, `app/quiz-seguranca/painel/page.tsx`, `lib/quiz-seguranca.ts` e a tabela `quiz_respostas` continuam intactos — reativar é reverter esse arquivo.

**Precisão obrigatória, para não superestimar o ganho:** fechar o quiz **não torna o anon key secreto**. A chave continua `NEXT_PUBLIC_SUPABASE_ANON_KEY`, embutida no bundle do dashboard e alcançável por qualquer pessoa que tenha a URL do app — exatamente o risco que este ADR já aceitava antes do quiz existir. O que a mudança fez foi **restaurar** a premissa original ("só quem tem a URL do dashboard"), não superá-la: o quiz era uma segunda porta, sem senha nem visual, que dava a mesma chave a um público mais largo. Com a rota fechada, a superfície volta a ser só o dashboard atrás da senha visual.

Condições que reabrem esta decisão (migrar para Supabase Auth + RLS por usuário autenticado) — seguem valendo integralmente:

- Expor o sistema publicamente na internet ou divulgar a URL além da equipe.
- Guardar dados sensíveis de colaboradores além de nome/setor/função.
- Qualquer incidente de alteração não explicada de dados.
- Reativar `/quiz-seguranca` sem antes resolver auth de verdade (`middleware.ts` + Supabase Auth com RLS por usuário) reabriria o mesmo buraco.

Consequência prática já conhecida: a senha em `config.access_password` está em texto puro no schema versionado — não tratar essa senha como segredo.

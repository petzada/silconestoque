# Passos manuais — Supabase Auth + RLS

Ordem obrigatória: **criar usuários → aplicar migration → deploy do app**.
Se inverter (migration antes dos usuários), o login funciona no código mas ninguém tem conta.

## 1. Painel Supabase — usuários

1. Abra o projeto em [https://supabase.com/dashboard](https://supabase.com/dashboard).
2. **Authentication → Providers**: confirme que **Email** está habilitado.
3. Desative confirmação de e-mail se quiser (equipe interna, e-mails criados por você):
   **Authentication → Providers → Email →** desligar “Confirm email” (opcional, recomendado aqui).
4. **Authentication → Users → Add user → Create new user**.
5. Para cada pessoa (3–5): informe e-mail + senha forte → Create user.
6. Não use “Invite user” (exige fluxo de e-mail que a app não tem).

## 2. SQL Editor — migration

1. **SQL Editor → New query**.
2. Cole o conteúdo de `supabase/migration_auth_rls.sql`.
3. Run.
4. Confirme:

```sql
SELECT filename, applied_at FROM schema_migrations
WHERE filename = 'migration_auth_rls.sql';

SELECT policyname, tablename FROM pg_policies
WHERE policyname = 'Authenticated'
ORDER BY tablename;

SELECT column_name FROM information_schema.columns
WHERE table_name = 'movements' AND column_name = 'created_by';
```

## 3. Se #11 / #13 ainda não rodaram

Aplique `migration_fase0_integridade.sql` e `migration_fase3_analitico.sql` quando for o caso.
Os arquivos já concedem EXECUTE a `authenticated`. Se por algum motivo os RPCs
ficarem só com grant a `anon`, rode de novo o bloco 3 de `migration_auth_rls.sql`
(o `DO $$ … GRANT/REVOKE …`).

## 4. App / deploy

1. Garanta no ambiente (Vercel / `.env.local`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
2. Remova `NEXT_PUBLIC_FALLBACK_PASSWORD` se existir (não é mais usada).
3. Deploy / `npm run dev`.
4. Teste: login com um e-mail criado → dashboard carrega dados.
5. Teste negativo (DevTools ou REST sem Authorization): `GET /rest/v1/products` com só a anon key deve retornar vazio / erro de RLS (não a lista).

## 5. Senha antiga

A coluna `config.access_password` e a senha visual antiga **deixam de valer**. Pode
manter a linha em `config` (não atrapalha) ou limpar depois; o app não consulta mais.

## 6. Novo usuário depois

Sempre pelo painel: **Authentication → Users → Add user**. Sem tela na aplicação.

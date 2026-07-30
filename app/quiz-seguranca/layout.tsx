import { notFound } from 'next/navigation';

// Rota desativada de propósito (Etapa 0b, ver
// docs/superpowers/plans/2026-07-30-backlog-correcoes-plan.md). O quiz vivia
// fora do grupo (dashboard) e portanto fora do guard de
// app/(dashboard)/layout.tsx — não existe middleware.ts no projeto — e como
// as páginas são client components que importam '@/lib/supabase', qualquer
// visitante que abrisse /quiz-seguranca ou /quiz-seguranca/painel recebia o
// anon key do Supabase sem digitar senha nenhuma. Com RLS "Allow all" em
// todas as tabelas (ver supabase/schema.sql), esse anon key sozinho já dá
// leitura/escrita completa no banco pelo DevTools. Isso quebrou a premissa
// central do docs/adr/0004-risco-aceito-rls-aberto.md — "URL não
// divulgada" — porque bastava alguém achar o link do quiz para achar o
// anon key, sem precisar nem saber que o dashboard existia. A §7 do
// docs/superpowers/plans/2026-07-29-dashboard-home-plan.md já registrava
// essa desativação como mitigação prometida.
//
// Importante não confundir: isto NÃO torna o anon key secreto. A chave é
// NEXT_PUBLIC_SUPABASE_ANON_KEY, continua embutida no bundle do dashboard e
// é alcançável por qualquer pessoa que tenha a URL do app, exatamente como
// o ADR-0004 já assumia. O que este layout faz é só remover a porta de
// entrada pública e sem senha que entregava esse key a um visitante casual
// que nem soubesse da senha visual do dashboard — restaurando a premissa
// original do ADR, não substituindo-a.
//
// Este layout aplica notFound() a todo o segmento /quiz-seguranca (a
// própria página e /painel) sem apagar nada: app/quiz-seguranca/page.tsx,
// app/quiz-seguranca/painel/page.tsx, lib/quiz-seguranca.ts e a tabela
// quiz_respostas em supabase/ ficam intactos de propósito, para a
// reativação ser só reverter este arquivo. Reativar de verdade, porém,
// exige resolver auth primeiro (middleware.ts + Supabase Auth com RLS por
// usuário) — não basta apagar este layout, isso reabriria o mesmo buraco.
export default function QuizSegurancaLayout() {
  notFound();
}

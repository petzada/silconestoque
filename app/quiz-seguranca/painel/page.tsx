'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import {
  Lock,
  ArrowLeft,
  FileDown,
  RefreshCw,
  Users,
  Target,
  ChevronDown,
  Loader2,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { drawPdfBrandHeader, PDF_HEAD_STYLES, PDF_ALTERNATE_ROW_STYLES } from '@/lib/pdf';
import {
  QUIZ_QUESTIONS,
  QUIZ_TABLE,
  QUIZ_TOTAL,
  QUIZ_MANAGER_PASSWORD,
  type QuizResponse,
} from '@/lib/quiz-seguranca';

export default function QuizPainelPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState('');

  function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (password === QUIZ_MANAGER_PASSWORD) {
      setUnlocked(true);
    } else {
      toast.error('Senha incorreta.');
      setPassword('');
    }
  }

  if (!unlocked) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 py-10">
          <Link
            href="/quiz-seguranca"
            className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Voltar ao quiz
          </Link>

          <div className="mt-16 flex flex-col items-center text-center">
            <div className="flex size-16 items-center justify-center bg-card border border-border">
              <Lock className="size-7 text-primary" />
            </div>
            <h1 className="text-display mt-6 text-[24px] text-foreground">
              Painel do gestor
            </h1>
            <p className="mt-2 text-[14px] text-body">
              Digite a senha para acessar as respostas do quiz.
            </p>
          </div>

          <form onSubmit={handleUnlock} className="mt-8 flex flex-col gap-3">
            <input
              type="password"
              inputMode="numeric"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Senha"
              autoFocus
              className="h-12 w-full border border-input bg-card px-4 text-center text-lg tracking-[0.3em] text-foreground outline-none transition-colors placeholder:tracking-normal placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/30"
            />
            <button
              type="submit"
              className="flex h-12 items-center justify-center gap-2 bg-primary text-[15px] font-semibold text-primary-foreground transition-colors hover:bg-primary-active"
            >
              Acessar
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <ManagerPanel />;
}

/* -------------------------------------------------------------------------- */
/*  Painel                                                                    */
/* -------------------------------------------------------------------------- */

function ManagerPanel() {
  const [responses, setResponses] = useState<QuizResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from(QUIZ_TABLE)
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      toast.error('Erro ao carregar respostas.');
    } else {
      setResponses((data ?? []) as QuizResponse[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const total = responses.length;
    const avg =
      total === 0
        ? 0
        : responses.reduce((acc, r) => acc + r.score, 0) / total;
    return { total, avg };
  }, [responses]);

  async function handleExportPdf() {
    if (responses.length === 0) {
      toast.error('Não há respostas para exportar.');
      return;
    }
    setExporting(true);
    try {
      const now = new Date();
      const doc = new jsPDF();
      drawPdfBrandHeader(doc, 26);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('Quiz de Segurança do Trabalho', 14, 13);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text('Silcon Ambiental — Respostas dos colaboradores', 14, 20);

      doc.setTextColor(10, 10, 10);
      doc.setFontSize(10);
      doc.text(`Gerado em: ${format(now, 'dd/MM/yyyy HH:mm')}`, 14, 36);
      doc.text(
        `Participantes: ${stats.total}   |   Média de acertos: ${stats.avg.toFixed(1)}/${QUIZ_TOTAL}`,
        14,
        42
      );

      autoTable(doc, {
        startY: 48,
        head: [['#', 'Nome completo', 'Setor / Área', 'Acertos', '%', 'Data']],
        body: responses.map((r, i) => [
          String(i + 1),
          r.full_name,
          r.sector,
          `${r.score}/${r.total}`,
          `${Math.round((r.score / r.total) * 100)}%`,
          format(new Date(r.created_at), 'dd/MM/yyyy HH:mm'),
        ]),
        styles: { fontSize: 9 },
        headStyles: { ...PDF_HEAD_STYLES, fontSize: 9 },
        bodyStyles: { fontSize: 8 },
        alternateRowStyles: PDF_ALTERNATE_ROW_STYLES,
        columnStyles: {
          0: { halign: 'right', cellWidth: 10 },
          3: { halign: 'center' },
          4: { halign: 'right' },
        },
      });

      doc.save(`quiz_seguranca_${format(now, 'yyyyMMdd_HHmm')}.pdf`);
      toast.success('PDF exportado com sucesso.');
    } catch {
      toast.error('Erro ao gerar PDF.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-3xl px-5 py-8">
        {/* Cabeçalho */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link
              href="/quiz-seguranca"
              className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              Voltar ao quiz
            </Link>
            <h1 className="text-display mt-3 text-[26px] text-foreground">
              Respostas do Quiz
            </h1>
            <p className="text-[14px] text-muted-foreground">
              Segurança do Trabalho — Silcon Ambiental
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="flex h-10 items-center justify-center gap-1.5 border border-border bg-card px-3 text-[14px] font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
              Atualizar
            </button>
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={exporting || responses.length === 0}
              className="flex h-10 items-center justify-center gap-1.5 bg-primary px-4 text-[14px] font-semibold text-primary-foreground transition-colors hover:bg-primary-active disabled:opacity-50"
            >
              {exporting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FileDown className="size-4" />
              )}
              Exportar PDF
            </button>
          </div>
        </div>

        {/* Estatísticas */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <StatCard
            icon={<Users className="size-4" />}
            label="Participantes"
            value={String(stats.total)}
          />
          <StatCard
            icon={<Target className="size-4" />}
            label="Média de acertos"
            value={`${stats.avg.toFixed(1)}/${QUIZ_TOTAL}`}
          />
        </div>

        {/* Lista */}
        <div className="mt-6">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
              Carregando respostas...
            </div>
          ) : responses.length === 0 ? (
            <div className="border border-border bg-surface-soft py-16 text-center text-[14px] text-muted-foreground">
              Nenhuma resposta registrada ainda.
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {responses.map((r) => (
                <ResponseRow
                  key={r.id}
                  response={r}
                  open={expanded === r.id}
                  onToggle={() =>
                    setExpanded((cur) => (cur === r.id ? null : r.id))
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="border border-border bg-card p-4">
      <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-[26px] font-bold tracking-tight text-foreground">
        {value}
      </div>
    </div>
  );
}

function ResponseRow({
  response: r,
  open,
  onToggle,
}: {
  response: QuizResponse;
  open: boolean;
  onToggle: () => void;
}) {
  const pct = Math.round((r.score / r.total) * 100);
  return (
    <div className="overflow-hidden border border-border bg-card">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-accent"
      >
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold text-foreground">
            {r.full_name}
          </div>
          <div className="truncate text-[13px] text-muted-foreground">
            {r.sector} · {format(new Date(r.created_at), 'dd/MM/yyyy HH:mm')}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="text-right">
            <div
              className={cn(
                'text-[15px] font-bold tabular-nums',
                pct >= 70 ? 'text-success' : pct >= 50 ? 'text-warning' : 'text-destructive'
              )}
            >
              {r.score}/{r.total}
            </div>
            <div className="text-[11px] text-muted-foreground">{pct}%</div>
          </div>
          <ChevronDown
            className={cn(
              'size-4 text-muted-foreground transition-transform',
              open && 'rotate-180'
            )}
          />
        </div>
      </button>

      {open && (
        <div className="border-t border-border px-4 py-3">
          <div className="flex flex-col gap-2.5">
            {QUIZ_QUESTIONS.map((q, i) => {
              const chosen = r.answers[i];
              const correct = chosen === q.answer;
              const chosenText = q.options.find((o) => o.key === chosen)?.text;
              return (
                <div key={q.id} className="flex items-start gap-2">
                  {correct ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                  ) : (
                    <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                  )}
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium leading-snug text-body-strong">
                      {i + 1}. {q.prompt}
                    </p>
                    <p className="text-[13px] leading-snug text-muted-foreground">
                      {chosen ? `${chosen}) ${chosenText}` : 'Sem resposta'}
                      {!correct && ` · Correta: ${q.answer}`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

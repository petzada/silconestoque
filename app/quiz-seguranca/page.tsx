'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  HardHat,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Check,
  CheckCircle2,
  XCircle,
  Lock,
  RotateCcw,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import {
  QUIZ_QUESTIONS,
  QUIZ_TABLE,
  QUIZ_TOTAL,
  scoreAnswers,
} from '@/lib/quiz-seguranca';

type Stage = 'welcome' | 'quiz' | 'result';

export default function QuizSegurancaPage() {
  const [stage, setStage] = useState<Stage>('welcome');
  const [fullName, setFullName] = useState('');
  const [sector, setSector] = useState('');
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [score, setScore] = useState(0);

  const question = QUIZ_QUESTIONS[current];
  const selected = answers[current];
  const isLast = current === QUIZ_TOTAL - 1;
  const progress = ((current + (selected ? 1 : 0)) / QUIZ_TOTAL) * 100;

  const canStart = fullName.trim().length >= 3 && sector.trim().length >= 1;

  function handleStart() {
    if (!canStart) {
      toast.error('Preencha seu nome completo e o setor/área.');
      return;
    }
    setStage('quiz');
    setCurrent(0);
    setAnswers([]);
  }

  function selectOption(key: string) {
    setAnswers((prev) => {
      const next = [...prev];
      next[current] = key;
      return next;
    });
  }

  async function handleNext() {
    if (!selected) return;
    if (!isLast) {
      setCurrent((c) => c + 1);
      return;
    }
    // Última pergunta: calcula e envia.
    const finalScore = scoreAnswers(answers);
    setSubmitting(true);
    try {
      const { error } = await supabase.from(QUIZ_TABLE).insert({
        full_name: fullName.trim(),
        sector: sector.trim(),
        answers,
        score: finalScore,
        total: QUIZ_TOTAL,
      });
      if (error) throw error;
      setScore(finalScore);
      setStage('result');
    } catch {
      toast.error('Não foi possível enviar suas respostas. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleRestart() {
    setStage('welcome');
    setFullName('');
    setSector('');
    setCurrent(0);
    setAnswers([]);
    setScore(0);
  }

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pt-6 sm:pt-10">
        {stage === 'welcome' && (
          <WelcomeScreen
            fullName={fullName}
            sector={sector}
            canStart={canStart}
            onName={setFullName}
            onSector={setSector}
            onStart={handleStart}
          />
        )}

        {stage === 'quiz' && (
          <QuizScreen
            index={current}
            prompt={question.prompt}
            options={question.options}
            selected={selected}
            progress={progress}
            isLast={isLast}
            submitting={submitting}
            onSelect={selectOption}
            onBack={() => setCurrent((c) => Math.max(0, c - 1))}
            onNext={handleNext}
          />
        )}

        {stage === 'result' && (
          <ResultScreen
            name={fullName}
            score={score}
            answers={answers}
            onRestart={handleRestart}
          />
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Tela inicial                                                               */
/* -------------------------------------------------------------------------- */

function WelcomeScreen({
  fullName,
  sector,
  canStart,
  onName,
  onSector,
  onStart,
}: {
  fullName: string;
  sector: string;
  canStart: boolean;
  onName: (v: string) => void;
  onSector: (v: string) => void;
  onStart: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="text-caption-uppercase text-[12px] text-muted-foreground">
        Silcon Ambiental
      </div>

      <div className="mt-8 flex flex-col items-center text-center">
        <div className="flex size-20 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <HardHat className="size-10" strokeWidth={2} />
        </div>
        <h1 className="text-display mt-6 text-[30px] leading-[1.15] text-foreground">
          Quiz de Segurança do Trabalho
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-body">
          Um teste rápido de conhecimentos promovido pela Segurança do Trabalho.
          São {QUIZ_TOTAL} perguntas — leva menos de 3 minutos. Bora fortalecer a
          prevenção? 👷
        </p>
      </div>

      <form
        className="mt-8 flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          onStart();
        }}
      >
        <Field label="Nome completo">
          <input
            value={fullName}
            onChange={(e) => onName(e.target.value)}
            placeholder="Ex.: Maria da Silva"
            autoComplete="name"
            className="h-12 w-full rounded-md border border-input bg-card px-4 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/30"
          />
        </Field>
        <Field label="Setor / Área">
          <input
            value={sector}
            onChange={(e) => onSector(e.target.value)}
            placeholder="Ex.: Operação, Administrativo, Logística"
            className="h-12 w-full rounded-md border border-input bg-card px-4 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/30"
          />
        </Field>

        <button
          type="submit"
          disabled={!canStart}
          className="mt-2 flex h-12 items-center justify-center gap-2 rounded-md bg-primary text-[15px] font-semibold text-primary-foreground transition-colors hover:bg-primary-active disabled:pointer-events-none disabled:opacity-50"
        >
          Iniciar Quiz
          <ArrowRight className="size-5" />
        </button>
      </form>

      <div className="mt-auto pt-10">
        <Link
          href="/quiz-seguranca/painel"
          className="flex items-center justify-center gap-2 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <Lock className="size-3.5" />
          Painel do gestor
        </Link>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[13px] font-medium text-body-strong">{label}</span>
      {children}
    </label>
  );
}

/* -------------------------------------------------------------------------- */
/*  Tela das perguntas                                                        */
/* -------------------------------------------------------------------------- */

function QuizScreen({
  index,
  prompt,
  options,
  selected,
  progress,
  isLast,
  submitting,
  onSelect,
  onBack,
  onNext,
}: {
  index: number;
  prompt: string;
  options: { key: string; text: string }[];
  selected: string | undefined;
  progress: number;
  isLast: boolean;
  submitting: boolean;
  onSelect: (key: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col pb-28">
      {/* Progresso */}
      <div className="flex items-center justify-between text-[13px]">
        <span className="font-semibold text-foreground">
          Pergunta {index + 1}
          <span className="text-muted-foreground"> de {QUIZ_TOTAL}</span>
        </span>
        <span className="text-caption-uppercase text-[11px] text-muted-foreground">
          Segurança
        </span>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Enunciado */}
      <h2 className="mt-6 text-[22px] font-bold leading-snug tracking-tight text-foreground">
        {prompt}
      </h2>

      {/* Alternativas */}
      <div className="mt-6 flex flex-col gap-3">
        {options.map((opt) => {
          const active = selected === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => onSelect(opt.key)}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-all',
                active
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-card hover:border-hairline-strong'
              )}
            >
              <span
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-md text-sm font-bold transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-body'
                )}
              >
                {active ? <Check className="size-4" strokeWidth={3} /> : opt.key}
              </span>
              <span
                className={cn(
                  'text-[15px] leading-snug',
                  active ? 'font-medium text-foreground' : 'text-body'
                )}
              >
                {opt.text}
              </span>
            </button>
          );
        })}
      </div>

      {/* Navegação fixa no rodapé (bottom-nav) */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-md items-center gap-3 px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onBack}
            disabled={index === 0 || submitting}
            className="flex h-12 items-center justify-center gap-1.5 rounded-md border border-border bg-card px-4 text-[15px] font-semibold text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
          >
            <ArrowLeft className="size-5" />
            Voltar
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={!selected || submitting}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-md bg-primary text-[15px] font-semibold text-primary-foreground transition-colors hover:bg-primary-active disabled:pointer-events-none disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="size-5 animate-spin" />
                Enviando...
              </>
            ) : isLast ? (
              <>
                Finalizar
                <ShieldCheck className="size-5" />
              </>
            ) : (
              <>
                Próxima
                <ArrowRight className="size-5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Tela de resultado                                                         */
/* -------------------------------------------------------------------------- */

function ResultScreen({
  name,
  score,
  answers,
  onRestart,
}: {
  name: string;
  score: number;
  answers: string[];
  onRestart: () => void;
}) {
  const pct = Math.round((score / QUIZ_TOTAL) * 100);
  const message = useMemo(() => {
    if (pct === 100) return 'Perfeito! Você é referência em segurança. 🏆';
    if (pct >= 70) return 'Muito bem! Seu conhecimento em segurança está afiado.';
    if (pct >= 50) return 'Bom começo! Vale revisar alguns pontos importantes.';
    return 'Obrigado por participar! Que tal revisar os temas de segurança?';
  }, [pct]);

  const firstName = name.trim().split(' ')[0];

  return (
    <div className="flex flex-1 flex-col pb-28">
      <div className="flex flex-col items-center text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <CheckCircle2 className="size-8" strokeWidth={2} />
        </div>
        <h1 className="text-display mt-4 text-[26px] leading-tight text-foreground">
          Respostas enviadas!
        </h1>
        <p className="mt-2 text-[15px] text-body">
          Valeu, {firstName}! {message}
        </p>

        <div className="mt-6 w-full rounded-lg border border-border bg-card p-6">
          <div className="text-caption-uppercase text-[11px] text-muted-foreground">
            Sua pontuação
          </div>
          <div className="text-stat-display mt-1 text-[52px]">
            {score}
            <span className="text-[24px] text-muted-foreground">/{QUIZ_TOTAL}</span>
          </div>
          <div className="mt-1 text-[13px] text-body">{pct}% de acertos</div>
        </div>
      </div>

      {/* Gabarito */}
      <div className="mt-6">
        <div className="text-[13px] font-semibold text-body-strong">
          Confira o gabarito
        </div>
        <div className="mt-3 flex flex-col gap-3">
          {QUIZ_QUESTIONS.map((q, i) => {
            const chosen = answers[i];
            const correct = chosen === q.answer;
            const correctOption = q.options.find((o) => o.key === q.answer);
            const chosenOption = q.options.find((o) => o.key === chosen);
            return (
              <div
                key={q.id}
                className="rounded-lg border border-border bg-card p-4"
              >
                <div className="flex items-start gap-2">
                  {correct ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                  ) : (
                    <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                  )}
                  <p className="text-[14px] font-medium leading-snug text-foreground">
                    {q.prompt}
                  </p>
                </div>
                {!correct && (
                  <p className="mt-2 pl-6 text-[13px] leading-snug text-muted-foreground">
                    Sua resposta: {chosen}) {chosenOption?.text}
                  </p>
                )}
                <p className="mt-1 pl-6 text-[13px] leading-snug text-success">
                  Correta: {q.answer}) {correctOption?.text}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Ação fixa no rodapé (bottom-nav) */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur">
        <div className="mx-auto w-full max-w-md px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onRestart}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-md border border-border bg-card text-[15px] font-semibold text-foreground transition-colors hover:bg-muted"
          >
            <RotateCcw className="size-5" />
            Responder como outro colaborador
          </button>
        </div>
      </div>
    </div>
  );
}

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

// Página de campanha "Dia Nacional de Prevenção de Acidentes de Trabalho".
// Paleta própria (fundo branco, texto preto, destaques #0B576F) — exceção
// intencional ao tema dark do DESIGN.md, aplicada só a esta superfície pública.
const ACCENT = '#0B576F';

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
    <div className="min-h-[100dvh] bg-white text-neutral-900 flex flex-col">
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
    <div className="flex flex-1 flex-col pb-10">
      <div className="text-caption-uppercase text-[12px]" style={{ color: ACCENT }}>
        Silcon Ambiental
      </div>

      <div className="mt-6 flex flex-col items-center text-center">
        <div
          className="flex size-20 items-center justify-center text-white"
          style={{ backgroundColor: ACCENT }}
        >
          <HardHat className="size-10" strokeWidth={2} />
        </div>
        <h1 className="text-display mt-6 text-[44px] leading-none text-neutral-900">
          Quiz
        </h1>
        <p
          className="mt-3 text-[16px] font-semibold leading-snug"
          style={{ color: ACCENT }}
        >
          Dia Nacional de Prevenção de Acidentes de Trabalho
        </p>
        <p className="mt-4 text-[15px] leading-relaxed text-neutral-700">
          Em 27 de julho, celebramos o Dia Nacional de Prevenção de Acidentes de
          Trabalho, uma data para conscientizar sobre a importância da segurança,
          da saúde e do cuidado com as pessoas. Juntos, fortalecemos a cultura da
          prevenção e construímos um ambiente onde a vida está sempre em primeiro
          lugar. Responda o quiz com 6 perguntas - leva menos de um minuto -. Bora
          fortalecer a prevenção?
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
            className="h-12 w-full border border-neutral-300 bg-white px-4 text-base text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus-visible:border-[#0B576F] focus-visible:ring-[3px] focus-visible:ring-[#0B576F]/30"
          />
        </Field>
        <Field label="Setor / Área">
          <input
            value={sector}
            onChange={(e) => onSector(e.target.value)}
            placeholder="Ex.: Operação, Administrativo, Logística"
            className="h-12 w-full border border-neutral-300 bg-white px-4 text-base text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus-visible:border-[#0B576F] focus-visible:ring-[3px] focus-visible:ring-[#0B576F]/30"
          />
        </Field>

        <button
          type="submit"
          disabled={!canStart}
          className="mt-2 flex h-12 items-center justify-center gap-2 text-[15px] font-semibold text-white transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
          style={{ backgroundColor: ACCENT }}
        >
          Iniciar Quiz
          <ArrowRight className="size-5" />
        </button>
      </form>

      <div className="mt-auto pt-10">
        <Link
          href="/quiz-seguranca/painel"
          className="flex items-center justify-center gap-2 text-[13px] font-medium text-neutral-500 transition-colors hover:text-neutral-900"
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
      <span className="text-[13px] font-medium text-neutral-800">{label}</span>
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
        <span className="font-semibold text-neutral-900">
          Pergunta {index + 1}
          <span className="text-neutral-500"> de {QUIZ_TOTAL}</span>
        </span>
        <span
          className="text-caption-uppercase text-[11px]"
          style={{ color: ACCENT }}
        >
          Segurança
        </span>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden bg-neutral-200">
        <div
          className="h-full transition-all duration-300 ease-out"
          style={{ width: `${progress}%`, backgroundColor: ACCENT }}
        />
      </div>

      {/* Enunciado */}
      <h2 className="mt-6 text-[22px] font-bold leading-snug tracking-tight text-neutral-900">
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
                'flex w-full items-center gap-3 border p-4 text-left transition-all',
                !active && 'border-neutral-200 bg-white hover:border-neutral-300'
              )}
              style={
                active
                  ? { borderColor: ACCENT, backgroundColor: `${ACCENT}14` }
                  : undefined
              }
            >
              <span
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center text-sm font-bold transition-colors',
                  !active && 'bg-neutral-100 text-neutral-600'
                )}
                style={active ? { backgroundColor: ACCENT, color: '#fff' } : undefined}
              >
                {active ? <Check className="size-4" strokeWidth={3} /> : opt.key}
              </span>
              <span
                className={cn(
                  'text-[15px] leading-snug',
                  active ? 'font-medium text-neutral-900' : 'text-neutral-700'
                )}
              >
                {opt.text}
              </span>
            </button>
          );
        })}
      </div>

      {/* Navegação fixa no rodapé (bottom-nav) */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-neutral-200 bg-white/95">
        <div className="mx-auto flex w-full max-w-md items-center gap-3 px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onBack}
            disabled={index === 0 || submitting}
            className="flex h-12 items-center justify-center gap-1.5 border border-neutral-300 bg-white px-4 text-[15px] font-semibold text-neutral-900 transition-colors hover:bg-neutral-100 disabled:pointer-events-none disabled:opacity-40"
          >
            <ArrowLeft className="size-5" />
            Voltar
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={!selected || submitting}
            className="flex h-12 flex-1 items-center justify-center gap-2 text-[15px] font-semibold text-white transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
            style={{ backgroundColor: ACCENT }}
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
        <div
          className="flex size-16 items-center justify-center text-white"
          style={{ backgroundColor: ACCENT }}
        >
          <CheckCircle2 className="size-8" strokeWidth={2} />
        </div>
        <h1 className="text-display mt-4 text-[26px] leading-tight text-neutral-900">
          Respostas enviadas!
        </h1>
        <p className="mt-2 text-[15px] text-neutral-700">
          Valeu, {firstName}! {message}
        </p>

        <div className="mt-6 w-full border border-neutral-200 bg-white p-6">
          <div className="text-caption-uppercase text-[11px] text-neutral-500">
            Sua pontuação
          </div>
          <div
            className="mt-1 text-[52px] font-bold leading-none tracking-tight tabular-nums"
            style={{ color: ACCENT }}
          >
            {score}
            <span className="text-[24px] text-neutral-400">/{QUIZ_TOTAL}</span>
          </div>
          <div className="mt-1 text-[13px] text-neutral-700">{pct}% de acertos</div>
        </div>
      </div>

      {/* Gabarito */}
      <div className="mt-6">
        <div className="text-[13px] font-semibold text-neutral-800">
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
                className="border border-neutral-200 bg-white p-4"
              >
                <div className="flex items-start gap-2">
                  {correct ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#16a34a]" />
                  ) : (
                    <XCircle className="mt-0.5 size-4 shrink-0 text-[#dc2626]" />
                  )}
                  <p className="text-[14px] font-medium leading-snug text-neutral-900">
                    {q.prompt}
                  </p>
                </div>
                {!correct && (
                  <p className="mt-2 pl-6 text-[13px] leading-snug text-neutral-500">
                    Sua resposta: {chosen}) {chosenOption?.text}
                  </p>
                )}
                <p className="mt-1 pl-6 text-[13px] leading-snug text-[#16a34a]">
                  Correta: {q.answer}) {correctOption?.text}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Ação fixa no rodapé (bottom-nav) */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-neutral-200 bg-white/95">
        <div className="mx-auto w-full max-w-md px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onRestart}
            className="flex h-12 w-full items-center justify-center gap-2 border border-neutral-300 bg-white text-[15px] font-semibold text-neutral-900 transition-colors hover:bg-neutral-100"
          >
            <RotateCcw className="size-5" />
            Responder como outro colaborador
          </button>
        </div>
      </div>
    </div>
  );
}

// Quiz de Segurança do Trabalho — Silcon Ambiental
// Dados compartilhados entre a página pública (/quiz-seguranca) e o painel do gestor.

export const QUIZ_TABLE = 'quiz_respostas';

/** Senha para liberar o painel do gestor. */
export const QUIZ_MANAGER_PASSWORD = '2026';

export interface QuizOption {
  /** Letra da alternativa: 'A' | 'B' | 'C' | 'D'. */
  key: string;
  text: string;
}

export interface QuizQuestion {
  id: number;
  prompt: string;
  options: QuizOption[];
  /** Letra da alternativa correta. */
  answer: string;
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    prompt: 'Qual é o principal objetivo da ergonomia?',
    options: [
      { key: 'A', text: 'Aumentar a produção a qualquer custo.' },
      { key: 'B', text: 'Adaptar o trabalho às características do trabalhador.' },
      { key: 'C', text: 'Reduzir os salários.' },
      { key: 'D', text: 'Diminuir o número de funcionários.' },
    ],
    answer: 'B',
  },
  {
    id: 2,
    prompt: 'O que significa a sigla EPI?',
    options: [
      { key: 'A', text: 'Equipamento de Proteção Individual.' },
      { key: 'B', text: 'Equipamento de Produção Industrial.' },
      { key: 'C', text: 'Equipamento de Prevenção Interna.' },
      { key: 'D', text: 'Equipamento Pessoal Integrado.' },
    ],
    answer: 'A',
  },
  {
    id: 3,
    prompt: 'Antes de iniciar uma atividade, o trabalhador deve:',
    options: [
      { key: 'A', text: 'Começar imediatamente.' },
      { key: 'B', text: 'Verificar os riscos e utilizar os EPIs necessários.' },
      { key: 'C', text: 'Esperar outro colaborador fazer.' },
      { key: 'D', text: 'Retirar os equipamentos de proteção.' },
    ],
    answer: 'B',
  },
  {
    id: 4,
    prompt: 'Uma postura inadequada pode causar:',
    options: [
      { key: 'A', text: 'Apenas cansaço.' },
      { key: 'B', text: 'Lesões musculares e dores na coluna.' },
      { key: 'C', text: 'Melhor desempenho.' },
      { key: 'D', text: 'Nenhum problema.' },
    ],
    answer: 'B',
  },
  {
    id: 5,
    prompt: 'Quem é responsável pela segurança no ambiente de trabalho?',
    options: [
      { key: 'A', text: 'Apenas o técnico de segurança.' },
      { key: 'B', text: 'Apenas a empresa.' },
      { key: 'C', text: 'Todos os colaboradores.' },
      { key: 'D', text: 'Apenas o gestor.' },
    ],
    answer: 'C',
  },
  {
    id: 6,
    prompt: 'Em caso de princípio de incêndio, qual deve ser a primeira ação a ser tomada?',
    options: [
      { key: 'A', text: 'Tentar apagar o fogo sozinho com qualquer extintor próximo.' },
      { key: 'B', text: 'Recolher todos os seus pertences pessoais antes de sair.' },
      {
        key: 'C',
        text: 'Acionar o alarme de incêndio, manter a calma e evacuar o prédio pelas escadas, nunca usando os elevadores.',
      },
      { key: 'D', text: 'Continuar trabalhando até que alguém venha lhe buscar.' },
    ],
    answer: 'C',
  },
];

export const QUIZ_TOTAL = QUIZ_QUESTIONS.length;

/** Registro persistido no Supabase. `answers` guarda as letras marcadas em ordem. */
export interface QuizResponse {
  id: string;
  full_name: string;
  sector: string;
  answers: string[];
  score: number;
  total: number;
  created_at: string;
}

/** Conta os acertos comparando as letras marcadas com o gabarito. */
export function scoreAnswers(answers: string[]): number {
  return QUIZ_QUESTIONS.reduce(
    (acc, question, index) => (answers[index] === question.answer ? acc + 1 : acc),
    0
  );
}

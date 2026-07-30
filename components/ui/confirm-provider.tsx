'use client';

import * as React from 'react';
import { ConfirmDialogShell, type ConfirmVariant } from '@/components/ui/confirm-dialog-shell';

export interface ConfirmOptions {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  /** Ver ConfirmDialogShellProps.nested — normalmente deixado para autodetecção. */
  nested?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = React.createContext<ConfirmFn | null>(null);

/**
 * Hook imperativo, promise-based, equivalente ao `window.confirm` nativo:
 * `const ok = await confirm({ title, description }); if (!ok) return;`
 * É essa forma síncrona-na-leitura (ainda que assíncrona por baixo) que
 * torna a migração dos sítios de "descartar alterações" uma troca de poucas
 * linhas — eles já eram escritos como um `if (!window.confirm(...)) return;`.
 */
export function useConfirm(): ConfirmFn {
  const confirm = React.useContext(ConfirmContext);
  if (!confirm) {
    throw new Error('useConfirm precisa ser chamado dentro de um <ConfirmProvider>.');
  }
  return confirm;
}

/**
 * Monta a ÚNICA instância do ConfirmDialogShell usada pelo caminho
 * imperativo. Deve envolver toda a árvore autenticada (app/layout.tsx) para
 * que `useConfirm()` funcione a partir de qualquer tela.
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  // `state` guarda o conteúdo (title/description/...) da confirmação mais
  // recente; `open` controla a visibilidade. São dois estados separados de
  // propósito: ao fechar, `open` vira false mas `state` não é limpo na
  // hora — o Dialog ainda está tocando a animação de saída (200ms, ver
  // dialog.tsx) e zerar o texto nesse meio tempo faria o título/descrição
  // sumirem no meio do fade-out. `state` só troca quando uma nova
  // confirmação abre.
  const [state, setState] = React.useState<ConfirmOptions | null>(null);
  const [open, setOpen] = React.useState(false);
  // O `resolve` da confirmação pendente vive num ref, e NÃO dentro de
  // `state`. É esse ref que garante que nenhuma Promise fique pendurada, em
  // duas situações distintas — as duas precisam de proteção:
  //
  //  1. Resolver a MESMA Promise duas vezes: o ref é zerado no primeiro
  //     `settle`, então a segunda via de fechamento vira no-op (ex.: clique
  //     em "Cancelar" chama settle(false) e o onOpenChange(false) do Radix
  //     chega logo atrás, no mesmo ciclo).
  //
  //  2. REENTRÂNCIA — uma segunda chamada de `confirm()` antes de a primeira
  //     resolver. Guardar o `resolve` dentro de `state` não cobria este caso:
  //     o `setState` da segunda chamada sobrescrevia o objeto inteiro e o
  //     `resolve` da primeira deixava de ser referenciado por qualquer coisa,
  //     então a Promise 1 pendurava PARA SEMPRE e o `await confirm(...)`
  //     daquele call site nunca prosseguia (silenciosamente: sem erro, sem
  //     travar a UI, só um formulário que não fecha nunca). Como a instância
  //     é única e global (montada em app/layout.tsx), qualquer um dos sítios
  //     que usam useConfirm() podia cair nisso. Agora a confirmação pendente
  //     é resolvida como `false` — foi superada, equivale a cancelar — antes
  //     de dar lugar à nova.
  const pendingResolveRef = React.useRef<((value: boolean) => void) | null>(null);

  const settle = React.useCallback((value: boolean) => {
    const resolve = pendingResolveRef.current;
    if (!resolve) return;
    pendingResolveRef.current = null;
    setOpen(false);
    resolve(value);
  }, []);

  const confirm = React.useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      pendingResolveRef.current?.(false);
      pendingResolveRef.current = resolve;
      setState(options);
      setOpen(true);
    });
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialogShell
        open={open}
        onOpenChange={(nextOpen) => {
          // Cobre Escape, clique no overlay e o botão "X" do close — todos
          // chegam aqui como onOpenChange(false) e resolvem `false`, igual
          // ao window.confirm cancelado.
          if (!nextOpen) settle(false);
        }}
        title={state?.title ?? ''}
        description={state?.description ?? ''}
        confirmLabel={state?.confirmLabel ?? 'Confirmar'}
        cancelLabel={state?.cancelLabel ?? 'Cancelar'}
        variant={state?.variant ?? 'destructive'}
        nested={state?.nested}
        onConfirm={() => settle(true)}
      />
    </ConfirmContext.Provider>
  );
}

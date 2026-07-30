'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export type ConfirmVariant = 'destructive' | 'default';

export interface ConfirmDialogShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  isLoading?: boolean;
  variant?: ConfirmVariant;
  onConfirm: () => void | Promise<void>;
  /**
   * Escape hatch explícito: força (`true`) ou desliga (`false`) a política de
   * aninhamento (sem overlay próprio + retorno de foco ao modal pai) sem
   * depender da autodetecção por DOM abaixo. Deixe `undefined` para
   * autodetectar — é o caminho usado pelos 9 sítios atuais deste app.
   */
  nested?: boolean;
}

// Casa com os dois tipos de "conteúdo de modal" que este app usa: os
// data-slot vêm de components/ui/dialog.tsx e components/ui/sheet.tsx.
// `:not([data-confirm-shell])` exclui o próprio DialogContent deste shell
// da varredura — sem isso, toda confirmação se enxergaria como "aninhada
// em si mesma" assim que seu próprio conteúdo entrasse no DOM.
const OPEN_MODAL_SELECTOR =
  '[data-slot="dialog-content"][data-state="open"]:not([data-confirm-shell]), [data-slot="sheet-content"][data-state="open"]';

/**
 * Implementação única do shell visual/comportamental de confirmação —
 * markup do Dialog, política de scrim aninhado e política de retorno de
 * foco. `ConfirmDialog` (casca declarativa) e `ConfirmProvider` (casca
 * imperativa via `useConfirm()`) renderizam este mesmo componente por
 * dentro; nenhuma das duas reimplementa a lógica abaixo.
 */
export function ConfirmDialogShell({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  isLoading = false,
  variant = 'destructive',
  onConfirm,
  nested,
}: ConfirmDialogShellProps) {
  // Guarda o conteúdo do modal pai (se detectado) para devolver o foco a ele
  // no fechamento, e o elemento que tinha foco antes de abrirmos, para saber
  // se esse gatilho ainda existe no documento quando fecharmos.
  const parentContentRef = React.useRef<HTMLElement | null>(null);
  const previousFocusRef = React.useRef<Element | null>(null);
  const [isNested, setIsNested] = React.useState(false);

  // useLayoutEffect e NÃO useEffect, de propósito: é o que garante que
  // `document.activeElement` lido abaixo ainda seja o gatilho original. O
  // Radix move o foco para dentro do conteúdo do diálogo num useEffect
  // (passivo) do FocusScope, que é filho deste componente; React roda TODOS
  // os layout effects antes de qualquer effect passivo, então este bloco
  // acontece antes de o foco sair do gatilho. Trocar para useEffect faria a
  // gente capturar um elemento de dentro da própria confirmação, e a
  // checagem de `document.contains` no fechamento passaria a ser sempre
  // falsa — o ramo "gatilho ainda existe" nunca mais rodaria.
  React.useLayoutEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement;

    if (nested !== undefined) {
      setIsNested(nested);
      parentContentRef.current = null;
      return;
    }

    // Por que a detecção de aninhamento é feita lendo o DOM em vez de um
    // Context do React — e por que ela vale para TODOS os sítios, não só
    // para alguns:
    //
    // Em SimpleCrudDialog e LockerSheet, o ConfirmDialog é IRMÃO do
    // Dialog/Sheet pai na árvore React: ambos são filhos diretos do mesmo
    // componente, um não está "dentro" do outro. E a instância única do
    // ConfirmProvider fica montada na raiz do app (app/layout.tsx), longe de
    // qualquer modal específico. Em nenhum dos dois casos existe um "estou
    // dentro de um modal aberto" que um Context pudesse prover — não há
    // relação de ancestralidade a explorar. A única fonte de verdade em comum
    // é o próprio DOM, consultado no instante em que esta confirmação abre.
    //
    // Não caia na tentação de achar que só esses dois casos são aninhados e
    // "otimizar" a autodetecção para os outros: as 7 confirmações de
    // "descartar alterações" TAMBÉM abrem aninhadas. Elas rodam justamente
    // porque o usuário tentou fechar um formulário sujo, e o Dialog daquele
    // formulário continua com data-state="open" enquanto a confirmação está
    // na tela — o estado só muda depois que esta Promise resolve `true`.
    // Aninhado é o caso comum aqui, não a exceção.
    const openModals = Array.from(document.querySelectorAll<HTMLElement>(OPEN_MODAL_SELECTOR));
    const ancestor = openModals[0] ?? null;
    parentContentRef.current = ancestor;
    setIsNested(Boolean(ancestor));
  }, [open, nested]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-sm"
        data-confirm-shell=""
        showOverlay={!isNested}
        onCloseAutoFocus={(event) => {
          // Sem modal aninhado: deixa o Radix devolver o foco ao gatilho
          // original (comportamento padrão), que é o caso comum dos 6
          // sítios destrutivos disparados de linha de tabela com o modal
          // pai fechado.
          if (!isNested || !parentContentRef.current) return;

          // Com modal aninhado: se o gatilho que tinha foco antes de abrir
          // esta confirmação ainda existe no documento (ex.: um botão que
          // não some), o padrão do Radix continua correto — ele devolve o
          // foco pra lá. Só quando esse gatilho já não existe mais (ex.: a
          // linha da lista que acabou de ser excluída) é que o Radix cairia
          // no <body>, fora do modal pai que continua aberto — daí a
          // necessidade de interceptar e mover o foco para dentro dele.
          if (!document.contains(previousFocusRef.current)) {
            event.preventDefault();
            parentContentRef.current.focus();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="pt-1">{description}</DialogDescription>
        </DialogHeader>
        {/* Cancelar é sempre o secondary sólido, confirmar é a cor da
            variante — nunca ghost ao lado de uma ação que pode ser
            destrutiva (perda de alterações ou de registro). */}
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button type="button" variant={variant} onClick={() => void onConfirm()} disabled={isLoading}>
            {isLoading ? 'Processando...' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

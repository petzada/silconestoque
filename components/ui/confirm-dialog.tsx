'use client';

import { ConfirmDialogShell } from '@/components/ui/confirm-dialog-shell';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void | Promise<void>;
  confirmLabel?: string;
  cancelLabel?: string;
  isLoading?: boolean;
}

// Casca declarativa fina: mesma assinatura de props de sempre, usada pelos
// 6 sítios destrutivos. Cinco deles disparam de uma linha de tabela, com o
// modal pai fechado (categories, sectors, movements, employees/desligar,
// products/desativar); o sexto, simple-crud-dialog, dispara de DENTRO do
// diálogo de gerenciar Funções/Setores, que continua aberto atrás — é um dos
// sítios empilhados, junto com locker-sheet. Não confie nesta lista para
// decidir se há aninhamento: quem decide é a autodetecção por DOM do shell,
// em runtime. Por dentro, delega markup,
// política de scrim aninhado e retorno de foco ao ConfirmDialogShell — a
// mesma implementação usada por `useConfirm()` (confirm-provider.tsx). Uma
// implementação de scrim/foco, duas cascas.
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  confirmLabel = 'Excluir',
  cancelLabel = 'Cancelar',
  isLoading = false,
}: ConfirmDialogProps) {
  return (
    <ConfirmDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      isLoading={isLoading}
      variant="destructive"
      onConfirm={onConfirm}
    />
  );
}

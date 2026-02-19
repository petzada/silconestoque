'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl p-6 shadow-2xl border-none">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-800">{title}</DialogTitle>
          <DialogDescription className="text-sm text-slate-600 pt-1">
            {description}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            className="h-10 px-6 text-xs font-bold"
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            className="bg-red-600 hover:bg-red-700 h-10 px-8 text-xs font-bold text-white"
            onClick={() => void onConfirm()}
            disabled={isLoading}
          >
            {isLoading ? 'Processando...' : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

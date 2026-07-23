'use client';

import { useCallback, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Upload, CheckCircle2, XCircle, FolderInput } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { LockerSize } from '@/lib/types';
import { LOCKER_SIZES } from '@/lib/types';
import { friendlyDbError, type LockerRow } from './locker-utils';

interface CSVValidRow {
  number: number;
  size: LockerSize;
}

interface CSVErrorRow {
  line: number;
  numero: string;
  tamanho: string;
  reason: string;
}

interface CSVValidationResult {
  valid: CSVValidRow[];
  errors: CSVErrorRow[];
}

interface LockersCsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lockers: LockerRow[];
  onImported: () => Promise<void> | void;
}

export function LockersCsvImportDialog({
  open,
  onOpenChange,
  lockers,
  onImported,
}: LockersCsvImportDialogProps) {
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [validationResult, setValidationResult] = useState<CSVValidationResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateCSV = useCallback(
    async (file: File) => {
      setIsValidating(true);
      setValidationResult(null);
      try {
        const buffer = await file.arrayBuffer();
        let text: string;
        try {
          text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
        } catch {
          text = new TextDecoder('windows-1252').decode(buffer);
        }

        const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
        if (lines.length === 0) {
          toast.error('Arquivo vazio');
          setIsValidating(false);
          return;
        }

        const delimiter = lines[0].includes(';') ? ';' : ',';
        const header = lines[0].split(delimiter).map((h) => h.trim().toLowerCase());
        const numeroIdx = header.findIndex((h) => h === 'numero' || h === 'número');
        const tamanhoIdx = header.indexOf('tamanho');

        if (numeroIdx === -1 || tamanhoIdx === -1) {
          toast.error('Colunas obrigatórias: numero, tamanho');
          setIsValidating(false);
          return;
        }

        const existingNumbers = new Set(lockers.map((locker) => locker.number));
        const seenInFile = new Set<number>();
        const valid: CSVValidRow[] = [];
        const errors: CSVErrorRow[] = [];

        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(delimiter).map((c) => c.trim());
          const numeroRaw = cols[numeroIdx] || '';
          const tamanhoRaw = (cols[tamanhoIdx] || '').toUpperCase();
          const number = /^\d+$/.test(numeroRaw) ? Number(numeroRaw) : NaN;

          if (!numeroRaw || Number.isNaN(number) || number <= 0) {
            errors.push({ line: i + 1, numero: numeroRaw || '(vazio)', tamanho: tamanhoRaw, reason: 'Número inválido' });
            continue;
          }
          if (!LOCKER_SIZES.includes(tamanhoRaw as LockerSize)) {
            errors.push({
              line: i + 1,
              numero: numeroRaw,
              tamanho: tamanhoRaw || '(vazio)',
              reason: `Tamanho "${tamanhoRaw}" inválido`,
            });
            continue;
          }
          if (existingNumbers.has(number)) {
            errors.push({ line: i + 1, numero: numeroRaw, tamanho: tamanhoRaw, reason: 'Número já existente' });
            continue;
          }
          if (seenInFile.has(number)) {
            errors.push({ line: i + 1, numero: numeroRaw, tamanho: tamanhoRaw, reason: 'Duplicado no arquivo' });
            continue;
          }

          seenInFile.add(number);
          valid.push({ number, size: tamanhoRaw as LockerSize });
        }

        setValidationResult({ valid, errors });
      } catch {
        toast.error('Erro ao processar arquivo CSV');
      } finally {
        setIsValidating(false);
      }
    },
    [lockers]
  );

  const handleFileSelect = (file: File | null) => {
    setImportFile(file);
    setValidationResult(null);
    if (file) void validateCSV(file);
  };

  const handleClose = () => {
    onOpenChange(false);
    setImportFile(null);
    setValidationResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImportValidRows = async () => {
    if (!validationResult || validationResult.valid.length === 0) {
      toast.error('Nenhum armário válido para importar');
      return;
    }

    setIsImporting(true);
    try {
      const { error } = await supabase.from('lockers').insert(
        validationResult.valid.map((row) => ({ kind: 'uniforme', number: row.number, size: row.size }))
      );
      if (error) throw error;

      toast.success(`${validationResult.valid.length} armário(s) importado(s) com sucesso.`);
      handleClose();
      await onImported();
    } catch (error: unknown) {
      toast.error(friendlyDbError(error, 'Erro ao importar armários. Nenhum registro foi importado.'));
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? onOpenChange(true) : handleClose())}>
      <DialogContent className={cn(validationResult ? 'max-w-2xl' : 'max-w-md')}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderInput className="h-4 w-4 text-primary" /> Importar armários via CSV
          </DialogTitle>
          <DialogDescription>Colunas obrigatórias: numero, tamanho.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="rounded-lg border-2 border-dashed border-border bg-muted p-4 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={(event) => handleFileSelect(event.target.files?.[0] || null)}
              className="hidden"
              id="lockers-csv-upload"
            />
            <label htmlFor="lockers-csv-upload" className="cursor-pointer">
              <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">
                {importFile ? importFile.name : 'Clique para selecionar arquivo'}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">Formato CSV separado por vírgula ou ponto e vírgula</p>
            </label>
          </div>

          {isValidating && (
            <p className="animate-pulse py-2 text-center text-sm font-medium text-muted-foreground">Validando arquivo...</p>
          )}

          {validationResult && (
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex flex-1 items-center gap-2 rounded-lg bg-success-muted p-3">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                  <div>
                    <p className="text-sm font-semibold text-success">{validationResult.valid.length} válidos</p>
                    <p className="text-[10px] text-success">Prontos para importar</p>
                  </div>
                </div>
                <div className="flex flex-1 items-center gap-2 rounded-lg bg-destructive/10 p-3">
                  <XCircle className="h-5 w-5 text-destructive" />
                  <div>
                    <p className="text-sm font-semibold text-destructive">{validationResult.errors.length} com erro</p>
                    <p className="text-[10px] text-destructive">Verifique abaixo</p>
                  </div>
                </div>
              </div>

              {validationResult.errors.length > 0 && (
                <div className="overflow-hidden rounded-lg border border-border">
                  <div className="bg-destructive/10 px-3 py-2">
                    <span className="text-xs font-semibold text-destructive">Linhas com erro</span>
                  </div>
                  <div className="max-h-[220px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted">
                          <TableHead className="w-[60px] px-3 py-2 text-[10px] font-semibold">Linha</TableHead>
                          <TableHead className="px-3 py-2 text-[10px] font-semibold">Número</TableHead>
                          <TableHead className="px-3 py-2 text-[10px] font-semibold">Tamanho</TableHead>
                          <TableHead className="px-3 py-2 text-[10px] font-semibold">Erro</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {validationResult.errors.slice(0, 30).map((error, index) => (
                          <TableRow key={index} className="border-border">
                            <TableCell className="px-3 py-1.5 font-mono text-xs">{error.line}</TableCell>
                            <TableCell className="px-3 py-1.5 text-xs">{error.numero}</TableCell>
                            <TableCell className="px-3 py-1.5 text-xs">{error.tamanho}</TableCell>
                            <TableCell className="px-3 py-1.5 text-xs font-medium text-destructive">{error.reason}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {validationResult.errors.length > 30 && (
                      <p className="py-2 text-center text-[10px] text-muted-foreground">
                        ... e mais {validationResult.errors.length - 30} erros.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={handleClose}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void handleImportValidRows()}
              disabled={isImporting || !validationResult || validationResult.valid.length === 0}
            >
              {isImporting ? 'Importando...' : `Importar ${validationResult?.valid.length || 0} válidos`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

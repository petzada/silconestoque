'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getDbErrorMessage, isPostgrestLikeError } from '@/lib/db-error';
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
import { Upload, Users, CheckCircle2, XCircle, FileDown, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn } from '@/lib/utils';
import {
  CsvFormatError,
  decodeCsvBuffer,
  parseEmployeeCsv,
  validateEmployeeRows,
  type ImportLookupItem,
  type MissingValue,
  type ValidationResult,
} from '@/lib/employee-import';

type ImportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departments: ImportLookupItem[];
  roles: ImportLookupItem[];
  /** Nomes já cadastrados, para acusar "Já cadastrado" antes de bater no banco. */
  existingNames: string[];
  /** Chamado após uma importação bem-sucedida, para o pai recarregar a lista. */
  onImported: () => Promise<void> | void;
  /** Abre o diálogo de cadastro de setores a partir da prévia. */
  onManageDepartments: () => void;
  /** Abre o diálogo de cadastro de funções a partir da prévia. */
  onManageRoles: () => void;
};

function MissingList({
  title,
  items,
  onManage,
  manageLabel,
}: {
  title: string;
  items: MissingValue[];
  onManage: () => void;
  manageLabel: string;
}) {
  if (items.length === 0) return null;

  return (
    <div className="flex-1 space-y-2 border border-warning/40 bg-warning-muted p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-warning">
        <AlertTriangle className="h-3.5 w-3.5" />
        {title}
      </p>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.name} className="flex items-baseline justify-between gap-2 text-xs">
            <span className="font-medium text-foreground">{item.name}</span>
            <span className="whitespace-nowrap text-muted-foreground">
              {item.count} {item.count === 1 ? 'linha' : 'linhas'}
            </span>
          </li>
        ))}
      </ul>
      <Button type="button" variant="outline" size="sm" className="h-7 w-full text-xs" onClick={onManage}>
        {manageLabel}
      </Button>
    </div>
  );
}

export function EmployeeImportDialog({
  open,
  onOpenChange,
  departments,
  roles,
  existingNames,
  onImported,
  onManageDepartments,
  onManageRoles,
}: ImportDialogProps) {
  const [fileName, setFileName] = useState<string | null>(null);
  // Guardamos o TEXTO do arquivo, não o File: permite revalidar depois que o
  // usuário cadastra um setor/função que faltava, sem exigir novo upload.
  const [fileText, setFileText] = useState<string | null>(null);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const runValidation = useCallback(
    (text: string) => {
      try {
        const rows = parseEmployeeCsv(text);
        setResult(validateEmployeeRows(rows, { departments, roles, existingNames }));
      } catch (error: unknown) {
        setResult(null);
        toast.error(
          error instanceof CsvFormatError ? error.message : 'Erro ao processar o arquivo CSV.'
        );
      }
    },
    [departments, roles, existingNames]
  );

  // Revalida quando setores/funções mudam (usuário cadastrou o que faltava) ou
  // quando a lista de nomes existentes muda. Os blocos de faltantes encolhem sozinhos.
  useEffect(() => {
    if (!open || !fileText) return;
    runValidation(fileText);
  }, [open, fileText, runValidation]);

  const handleFileSelect = async (file: File | null) => {
    if (!file) return;

    try {
      const text = decodeCsvBuffer(await file.arrayBuffer());
      setFileName(file.name);
      setFileText(text);
    } catch {
      toast.error('Não foi possível ler o arquivo.');
    } finally {
      // Sem isso, corrigir o CSV no Excel e reselecionar o MESMO arquivo não
      // dispara o onChange (o value do input não mudou) e a prévia fica velha.
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const resetState = () => {
    setFileName(null);
    setFileText(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) resetState();
    onOpenChange(nextOpen);
  };

  const exportErrorsPdf = () => {
    if (!result || result.errors.length === 0) return;

    const doc = new jsPDF();
    const now = format(new Date(), 'dd/MM/yyyy HH:mm');

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('SILCON AMBIENTAL', 14, 20);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('Relatório de Erros - Importação de Colaboradores', 14, 28);
    doc.setFontSize(9);
    doc.text(`Data: ${now}`, 14, 35);

    doc.setFontSize(10);
    doc.text(`Total de linhas: ${result.valid.length + result.errors.length}`, 14, 45);
    doc.text(`Válidas: ${result.valid.length}`, 14, 51);
    doc.setTextColor(220, 38, 38);
    doc.text(`Com erro: ${result.errors.length}`, 14, 57);
    doc.setTextColor(0, 0, 0);

    autoTable(doc, {
      startY: 65,
      head: [['Linha', 'Colaborador', 'Erro']],
      body: result.errors.map((error) => [
        error.line.toString(),
        error.name.length > 40 ? `${error.name.substring(0, 40)}...` : error.name,
        error.reason,
      ]),
      headStyles: { fillColor: [15, 23, 42], fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    doc.save(`erros_importacao_colaboradores_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
    toast.success('PDF de erros exportado');
  };

  const handleImport = async () => {
    if (!result || result.valid.length === 0) return;

    setIsImporting(true);
    try {
      // Insert único com o array inteiro: ou entram todos os válidos, ou nenhum.
      const { error } = await supabase.from('employees').insert(result.valid);
      if (error) throw error;

      toast.success(
        `${result.valid.length} ${result.valid.length === 1 ? 'colaborador importado' : 'colaboradores importados'}`
      );
      resetState();
      onOpenChange(false);
      await onImported();
    } catch (error: unknown) {
      if (isPostgrestLikeError(error) && error.code === '23505') {
        // Alguém cadastrou o mesmo nome entre a validação e o insert.
        toast.error('Alguns nomes já foram cadastrados. Revalidando o arquivo...');
        await onImported();
      } else {
        toast.error(getDbErrorMessage(error, 'Erro ao importar colaboradores'));
      }
    } finally {
      setIsImporting(false);
    }
  };

  const hasMissing = Boolean(result && (result.missingDepartments.length > 0 || result.missingRoles.length > 0));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={cn('max-h-[90vh] overflow-y-auto', result ? 'max-w-2xl' : 'max-w-md')}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-primary" /> Importar colaboradores via CSV
          </DialogTitle>
          <DialogDescription className="text-xs">
            Colunas obrigatórias: nome, setor, funcao — separadas por ponto e vírgula (;). O setor e a
            função precisam estar cadastrados antes da importação.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="border border-border bg-surface-soft p-4 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={(event) => void handleFileSelect(event.target.files?.[0] || null)}
              className="hidden"
              id="employee-csv-upload"
            />
            <label htmlFor="employee-csv-upload" className="cursor-pointer">
              <Users className="mx-auto mb-2 h-10 w-10 text-muted-foreground" />
              <p className="text-sm font-semibold text-muted-foreground">
                {fileName || 'Clique para selecionar o arquivo'}
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Formato CSV separado por ponto e vírgula (;)
              </p>
            </label>
          </div>

          {result && (
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex flex-1 items-center gap-2 bg-success-muted p-3">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                  <div>
                    <p className="text-sm font-semibold text-success">{result.valid.length} válidos</p>
                    <p className="text-[10px] text-success">Prontos para importar</p>
                  </div>
                </div>
                <div className="flex flex-1 items-center gap-2 bg-danger-muted p-3">
                  <XCircle className="h-5 w-5 text-destructive" />
                  <div>
                    <p className="text-sm font-semibold text-destructive">{result.errors.length} com erro</p>
                    <p className="text-[10px] text-destructive">Não serão importados</p>
                  </div>
                </div>
              </div>

              {hasMissing && (
                <div className="flex flex-col gap-3 sm:flex-row">
                  <MissingList
                    title="Setores não cadastrados"
                    items={result.missingDepartments}
                    onManage={onManageDepartments}
                    manageLabel="Cadastrar setores"
                  />
                  <MissingList
                    title="Funções não cadastradas"
                    items={result.missingRoles}
                    onManage={onManageRoles}
                    manageLabel="Cadastrar funções"
                  />
                </div>
              )}

              {result.errors.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-foreground">Erros por linha</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={exportErrorsPdf}
                    >
                      <FileDown className="h-3.5 w-3.5" /> Exportar PDF
                    </Button>
                  </div>
                  <div className="max-h-[220px] overflow-y-auto border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs font-semibold">Linha</TableHead>
                          <TableHead className="text-xs font-semibold">Colaborador</TableHead>
                          <TableHead className="text-xs font-semibold">Erro</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {result.errors.map((error) => (
                          <TableRow key={`${error.line}-${error.reason}`}>
                            <TableCell className="text-xs text-muted-foreground">{error.line}</TableCell>
                            <TableCell className="text-xs text-foreground">{error.name}</TableCell>
                            <TableCell className="text-xs text-destructive">{error.reason}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  disabled={isImporting || result.valid.length === 0}
                  onClick={() => void handleImport()}
                >
                  {isImporting
                    ? 'Importando...'
                    : `Importar ${result.valid.length} ${result.valid.length === 1 ? 'colaborador' : 'colaboradores'}`}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

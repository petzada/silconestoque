'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ClipboardList,
  Plus,
  Truck,
  PackageCheck,
  FileText,
  Trash2,
  ChevronDown,
  ChevronUp,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type {
  FollowUpSolicitation,
  FollowUpReceipt,
  FollowUpStatus,
  SolicitationFormData,
  PurchaseOrderFormData,
  ReceiptFormData,
} from '@/lib/types';

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
}

function applyDateMask(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
}

function parseDateInput(value: string): string {
  const parts = value.split('/');
  if (parts.length === 3 && parts[0].length === 2 && parts[1].length === 2 && parts[2].length === 4) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return '';
}

function statusBadge(status: FollowUpStatus) {
  const config = {
    pendente: { label: 'PENDENTE', className: 'bg-warning hover:bg-warning text-warning-foreground' },
    em_andamento: { label: 'EM ANDAMENTO', className: 'bg-primary hover:bg-primary text-primary-foreground' },
    recebido: { label: 'RECEBIDO', className: 'bg-success hover:bg-success text-success-foreground' },
  };
  const c = config[status];
  return <Badge className={cn('text-[10px] font-bold tracking-wider', c.className)}>{c.label}</Badge>;
}

function computeStatus(solicitation: FollowUpSolicitation): FollowUpStatus {
  const orders = solicitation.purchase_orders || [];
  if (orders.length === 0) return 'pendente';
  const allReceived = orders.every(o => o.receipt && o.receipt.length > 0);
  return allReceived ? 'recebido' : 'em_andamento';
}

export default function FollowUpPage() {
  const [solicitations, setSolicitations] = useState<FollowUpSolicitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Modal states
  const [solicitationModalOpen, setSolicitationModalOpen] = useState(false);
  const [poModalOpen, setPoModalOpen] = useState(false);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Form data
  const [solicitationForm, setSolicitationForm] = useState<SolicitationFormData>({
    request_number: '',
    request_date: '',
    description: '',
  });
  const [dateDisplay, setDateDisplay] = useState('');
  const [poForm, setPoForm] = useState<PurchaseOrderFormData>({
    po_number: '',
    supplier_name: '',
    estimated_delivery: '',
  });
  const [poDateDisplay, setPoDateDisplay] = useState('');
  const [receiptForm, setReceiptForm] = useState<ReceiptFormData>({
    supplier_name: '',
    invoice_value: undefined,
  });

  // Submitting state to prevent double-clicks
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Context for modals
  const [activeSolicitationId, setActiveSolicitationId] = useState<string | null>(null);
  const [activePurchaseOrderId, setActivePurchaseOrderId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'solicitation' | 'purchase_order'; id: string } | null>(null);

  const refreshSolicitations = useCallback(async () => {
    // Step 1: Fetch solicitations with purchase orders (single-level embed)
    const { data: solsData, error: solsError } = await supabase
      .from('follow_up_solicitations')
      .select('*, purchase_orders:follow_up_purchase_orders(*)')
      .order('created_at', { ascending: false });

    if (solsError) {
      console.error(solsError);
      return;
    }

    const sols = solsData || [];

    // Step 2: Collect all PO IDs and fetch their receipts separately
    const allPoIds: string[] = [];
    for (const sol of sols) {
      for (const po of (sol.purchase_orders || [])) {
        allPoIds.push(po.id);
      }
    }

    const receiptsMap: Record<string, FollowUpReceipt[]> = {};
    if (allPoIds.length > 0) {
      const { data: receiptsData, error: receiptsError } = await supabase
        .from('follow_up_receipts')
        .select('*')
        .in('purchase_order_id', allPoIds);

      if (!receiptsError && receiptsData) {
        for (const r of receiptsData) {
          if (!receiptsMap[r.purchase_order_id]) {
            receiptsMap[r.purchase_order_id] = [];
          }
          receiptsMap[r.purchase_order_id].push(r as FollowUpReceipt);
        }
      }
    }

    // Step 3: Merge receipts into purchase orders
    const merged: FollowUpSolicitation[] = sols.map((sol: any) => ({
      ...sol,
      purchase_orders: (sol.purchase_orders || []).map((po: any) => ({
        ...po,
        receipt: receiptsMap[po.id] || [],
      })),
    }));

    setSolicitations(merged);
  }, []);

  const fetchSolicitations = useCallback(async () => {
    setIsLoading(true);
    await refreshSolicitations();
    setIsLoading(false);
  }, [refreshSolicitations]);

  useEffect(() => {
    fetchSolicitations();
  }, [fetchSolicitations]);

  // Status sync helper
  const syncStatus = async (solicitationId: string) => {
    try {
      // Fetch solicitation with POs (single-level)
      const { data: solData, error: solError } = await supabase
        .from('follow_up_solicitations')
        .select('*, purchase_orders:follow_up_purchase_orders(*)')
        .eq('id', solicitationId)
        .single();

      if (solError || !solData) {
        console.error('syncStatus fetch error:', solError);
        await refreshSolicitations();
        return;
      }

      // Compute status by checking receipts separately
      const poIds: string[] = (solData.purchase_orders || []).map((po: any) => po.id);
      let newStatus: FollowUpStatus = 'pendente';

      if (poIds.length > 0) {
        const { data: receiptsData } = await supabase
          .from('follow_up_receipts')
          .select('purchase_order_id')
          .in('purchase_order_id', poIds);

        const receivedCount = receiptsData?.length || 0;
        newStatus = receivedCount >= poIds.length ? 'recebido' : 'em_andamento';
      }

      if (solData.status !== newStatus) {
        await supabase
          .from('follow_up_solicitations')
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq('id', solicitationId);
      }
    } catch (err) {
      console.error('syncStatus error:', err);
    }
    await refreshSolicitations();
  };

  // --- CRUD: Solicitação ---
  const handleCreateSolicitation = async () => {
    if (isSubmitting) return;
    const isoDate = parseDateInput(dateDisplay);
    if (!solicitationForm.request_number || !isoDate || !solicitationForm.description) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('follow_up_solicitations').insert({
        request_number: solicitationForm.request_number,
        request_date: isoDate,
        description: solicitationForm.description,
        status: 'pendente',
      });

      if (error) {
        toast.error('Erro ao criar solicitação');
        console.error(error);
      } else {
        toast.success('Solicitação criada com sucesso');
        setSolicitationModalOpen(false);
        setSolicitationForm({ request_number: '', request_date: '', description: '' });
        setDateDisplay('');
        await refreshSolicitations();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSolicitation = async (id: string) => {
    const { error } = await supabase.from('follow_up_solicitations').delete().eq('id', id);
    if (error) {
      toast.error('Erro ao deletar solicitação');
    } else {
      toast.success('Solicitação removida');
      if (expandedId === id) setExpandedId(null);
      await refreshSolicitations();
    }
  };

  // --- CRUD: Pedido de Compra ---
  const handleCreatePurchaseOrder = async () => {
    if (isSubmitting) return;
    if (!activeSolicitationId || !poForm.po_number || !poForm.supplier_name) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    const isoDate = poDateDisplay ? parseDateInput(poDateDisplay) : null;

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('follow_up_purchase_orders').insert({
        solicitation_id: activeSolicitationId,
        po_number: poForm.po_number,
        supplier_name: poForm.supplier_name,
        estimated_delivery: isoDate || null,
      });

      if (error) {
        toast.error('Erro ao criar pedido de compra');
        console.error(error);
      } else {
        toast.success('Pedido de compra adicionado');
        setPoModalOpen(false);
        setPoForm({ po_number: '', supplier_name: '', estimated_delivery: '' });
        setPoDateDisplay('');
        await syncStatus(activeSolicitationId);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePurchaseOrder = async (id: string, solicitationId: string) => {
    const { error } = await supabase.from('follow_up_purchase_orders').delete().eq('id', id);
    if (error) {
      toast.error('Erro ao deletar pedido');
    } else {
      toast.success('Pedido removido');
      await syncStatus(solicitationId);
    }
  };

  // --- CRUD: Recebimento ---
  const handleCreateReceipt = async () => {
    if (isSubmitting) return;
    if (!activePurchaseOrderId || !receiptForm.supplier_name) {
      toast.error('Preencha o fornecedor');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('follow_up_receipts').insert({
        purchase_order_id: activePurchaseOrderId,
        supplier_name: receiptForm.supplier_name,
        invoice_value: receiptForm.invoice_value || null,
      });

      if (error) {
        // Handle duplicate receipt (UNIQUE constraint violation)
        if (error.code === '23505') {
          toast.error('Este pedido já possui um recebimento registrado');
          setReceiptModalOpen(false);
          await refreshSolicitations();
        } else {
          toast.error('Erro ao confirmar recebimento');
          console.error(error);
        }
        return;
      }

      toast.success('Recebimento confirmado');
      setReceiptModalOpen(false);
      setReceiptForm({ supplier_name: '', invoice_value: undefined });

      // Find the solicitation for this PO and sync status
      const sol = solicitations.find(s =>
        s.purchase_orders?.some(po => po.id === activePurchaseOrderId)
      );
      if (sol) {
        await syncStatus(sol.id);
      } else {
        // Fallback: refresh all data even if solicitation lookup fails
        await refreshSolicitations();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteReceipt = async (receiptId: string, solicitationId: string) => {
    const { error } = await supabase.from('follow_up_receipts').delete().eq('id', receiptId);
    if (error) {
      toast.error('Erro ao remover recebimento');
    } else {
      toast.success('Recebimento removido');
      await syncStatus(solicitationId);
    }
  };

  // Confirm delete handler
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteConfirmOpen(false);
    if (deleteTarget.type === 'solicitation') {
      await handleDeleteSolicitation(deleteTarget.id);
    } else {
      const sol = solicitations.find(s =>
        s.purchase_orders?.some(po => po.id === deleteTarget.id)
      );
      await handleDeletePurchaseOrder(deleteTarget.id, sol?.id || '');
    }
    setDeleteTarget(null);
  };

  // Filter solicitations by search
  const filtered = solicitations.filter(s => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      s.request_number.toLowerCase().includes(term) ||
      s.description.toLowerCase().includes(term)
    );
  });

  return (
    <PageContainer>
      <PageHeader
        title="Follow-up"
        description="Acompanhamento de solicitações e recebimentos"
        actions={
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setSolicitationForm({ request_number: '', request_date: '', description: '' });
              setDateDisplay('');
              setSolicitationModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Inserir Solicitação
          </Button>
        }
      />

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por número ou descrição..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="pl-10 h-9 text-sm"
        />
      </div>

      {/* Solicitations List */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Carregando solicitações...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">
            {searchTerm ? 'Nenhuma solicitação encontrada' : 'Nenhuma solicitação cadastrada'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(sol => {
            const isExpanded = expandedId === sol.id;
            const orders = sol.purchase_orders || [];

            return (
              <div key={sol.id} className="bg-card rounded-lg border border-border overflow-hidden">
                {/* Row header */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : sol.id)}
                  className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    )}
                    <span className="font-bold text-sm text-foreground">{sol.request_number}</span>
                    <span className="text-xs text-muted-foreground">|</span>
                    <span className="text-xs text-muted-foreground">{formatDate(sol.request_date)}</span>
                    <span className="text-xs text-muted-foreground">|</span>
                    <span className="text-xs text-muted-foreground truncate max-w-[300px]">{sol.description}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    {statusBadge(computeStatus(sol))}
                  </div>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-border px-5 py-4 bg-muted/50">
                    {/* Solicitation card */}
                    <div className="bg-card rounded-lg border border-border p-4 mb-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <div>
                            <Label className="uppercase text-[10px] font-bold text-muted-foreground tracking-widest">Nº Solicitação</Label>
                            <p className="text-sm font-semibold text-foreground">{sol.request_number}</p>
                          </div>
                          <div>
                            <Label className="uppercase text-[10px] font-bold text-muted-foreground tracking-widest">Data</Label>
                            <p className="text-sm text-foreground">{formatDate(sol.request_date)}</p>
                          </div>
                          <div>
                            <Label className="uppercase text-[10px] font-bold text-muted-foreground tracking-widest">Descrição</Label>
                            <p className="text-sm text-foreground">{sol.description}</p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Excluir solicitacao"
                          aria-label="Excluir solicitacao"
                          className="h-8 w-8 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            setDeleteTarget({ type: 'solicitation', id: sol.id });
                            setDeleteConfirmOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Purchase Orders section */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="uppercase text-[10px] font-bold text-muted-foreground tracking-widest">Pedidos de Compra</h3>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px] font-bold"
                          onClick={() => {
                            setActiveSolicitationId(sol.id);
                            setPoForm({ po_number: '', supplier_name: '', estimated_delivery: '' });
                            setPoDateDisplay('');
                            setPoModalOpen(true);
                          }}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Novo Pedido
                        </Button>
                      </div>

                      {orders.length === 0 ? (
                        <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                          <p className="text-sm text-muted-foreground mb-2">Nenhum pedido de compra adicionado</p>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[11px] font-bold"
                            onClick={() => {
                              setActiveSolicitationId(sol.id);
                              setPoForm({ po_number: '', supplier_name: '', estimated_delivery: '' });
                              setPoDateDisplay('');
                              setPoModalOpen(true);
                            }}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Novo Pedido
                          </Button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {orders.map(po => {
                            const hasReceipt = po.receipt && po.receipt.length > 0;
                            const receipt = hasReceipt ? po.receipt![0] : null;

                            return (
                              <div
                                key={po.id}
                                className={cn(
                                  'group relative rounded-lg border p-4 transition-all',
                                  hasReceipt
                                    ? 'bg-success-muted border-success/30'
                                    : 'bg-accent border-primary/30'
                                )}
                              >
                                {/* Delete button */}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title={hasReceipt && receipt ? 'Remover recebimento' : 'Excluir pedido'}
                                  aria-label={hasReceipt && receipt ? 'Remover recebimento' : 'Excluir pedido'}
                                  className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => {
                                    if (hasReceipt && receipt) {
                                      handleDeleteReceipt(receipt.id, sol.id);
                                    } else {
                                      setDeleteTarget({ type: 'purchase_order', id: po.id });
                                      setDeleteConfirmOpen(true);
                                    }
                                  }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>

                                <div className="flex items-center gap-2 mb-2">
                                  {hasReceipt ? (
                                    <PackageCheck className="h-4 w-4 text-success" />
                                  ) : (
                                    <Truck className="h-4 w-4 text-primary" />
                                  )}
                                  <span className="font-bold text-sm text-foreground">{po.po_number}</span>
                                </div>

                                <div className="space-y-1 text-xs text-muted-foreground">
                                  <p><span className="font-semibold">Fornecedor:</span> {po.supplier_name}</p>
                                  {po.estimated_delivery && (
                                    <p><span className="font-semibold">Prazo:</span> {formatDate(po.estimated_delivery)}</p>
                                  )}
                                </div>

                                {hasReceipt && receipt ? (
                                  <div className="mt-3 pt-2 border-t border-success/30 space-y-1">
                                    <Badge className="bg-success hover:bg-success text-success-foreground text-[9px] font-bold">RECEBIDO</Badge>
                                    <p className="text-xs text-muted-foreground">
                                      <span className="font-semibold">Fornecedor NF:</span> {receipt.supplier_name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      <span className="font-semibold">Valor NF:</span> {formatCurrency(receipt.invoice_value)}
                                    </p>
                                  </div>
                                ) : (
                                  <div className="mt-3">
                                    <Button
                                      size="sm"
                                      className="w-full h-7 text-[11px] font-bold"
                                      onClick={() => {
                                        setActivePurchaseOrderId(po.id);
                                        setReceiptForm({ supplier_name: po.supplier_name, invoice_value: undefined });
                                        setReceiptModalOpen(true);
                                      }}
                                    >
                                      <PackageCheck className="h-3 w-3 mr-1" />
                                      Confirmar Recebimento
                                    </Button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Nova Solicitação */}
      <Dialog open={solicitationModalOpen} onOpenChange={setSolicitationModalOpen}>
        <DialogContent className="max-w-md p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
              <FileText className="h-5 w-5 text-primary" />
              Nova Solicitação
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="uppercase text-[10px] font-bold text-muted-foreground tracking-widest">Nº da Solicitação *</Label>
              <Input
                value={solicitationForm.request_number}
                onChange={e => setSolicitationForm(f => ({ ...f, request_number: e.target.value }))}
                placeholder="Ex: SOL-001"
                className="mt-1 h-9 text-sm"
              />
            </div>
            <div>
              <Label className="uppercase text-[10px] font-bold text-muted-foreground tracking-widest">Data da Solicitação *</Label>
              <Input
                value={dateDisplay}
                onChange={e => setDateDisplay(applyDateMask(e.target.value))}
                placeholder="DD/MM/AAAA"
                maxLength={10}
                className="mt-1 h-9 text-sm"
              />
            </div>
            <div>
              <Label className="uppercase text-[10px] font-bold text-muted-foreground tracking-widest">Descrição *</Label>
              <Input
                value={solicitationForm.description}
                onChange={e => setSolicitationForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Descrição da solicitação"
                className="mt-1 h-9 text-sm"
              />
            </div>
            <Button
              onClick={handleCreateSolicitation}
              disabled={isSubmitting}
              className="w-full h-9 text-xs font-bold"
            >
              {isSubmitting ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Novo Pedido de Compra */}
      <Dialog open={poModalOpen} onOpenChange={setPoModalOpen}>
        <DialogContent className="max-w-md p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
              <Truck className="h-5 w-5 text-primary" />
              Novo Pedido de Compra
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="uppercase text-[10px] font-bold text-muted-foreground tracking-widest">Nº do Pedido *</Label>
              <Input
                value={poForm.po_number}
                onChange={e => setPoForm(f => ({ ...f, po_number: e.target.value }))}
                placeholder="Ex: PC-001"
                className="mt-1 h-9 text-sm"
              />
            </div>
            <div>
              <Label className="uppercase text-[10px] font-bold text-muted-foreground tracking-widest">Fornecedor *</Label>
              <Input
                value={poForm.supplier_name}
                onChange={e => setPoForm(f => ({ ...f, supplier_name: e.target.value }))}
                placeholder="Nome do fornecedor"
                className="mt-1 h-9 text-sm"
              />
            </div>
            <div>
              <Label className="uppercase text-[10px] font-bold text-muted-foreground tracking-widest">Prazo de Entrega</Label>
              <Input
                value={poDateDisplay}
                onChange={e => setPoDateDisplay(applyDateMask(e.target.value))}
                placeholder="DD/MM/AAAA"
                maxLength={10}
                className="mt-1 h-9 text-sm"
              />
            </div>
            <Button
              onClick={handleCreatePurchaseOrder}
              disabled={isSubmitting}
              className="w-full h-9 text-xs font-bold text-primary-foreground"
            >
              {isSubmitting ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Confirmar Recebimento */}
      <Dialog open={receiptModalOpen} onOpenChange={setReceiptModalOpen}>
        <DialogContent className="max-w-md p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
              <PackageCheck className="h-5 w-5 text-success" />
              Confirmar Recebimento
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="uppercase text-[10px] font-bold text-muted-foreground tracking-widest">Fornecedor *</Label>
              <Input
                value={receiptForm.supplier_name}
                onChange={e => setReceiptForm(f => ({ ...f, supplier_name: e.target.value }))}
                placeholder="Fornecedor que entregou"
                className="mt-1 h-9 text-sm"
              />
            </div>
            <div>
              <Label className="uppercase text-[10px] font-bold text-muted-foreground tracking-widest">Valor da NF (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={receiptForm.invoice_value ?? ''}
                onChange={e => setReceiptForm(f => ({ ...f, invoice_value: e.target.value ? parseFloat(e.target.value) : undefined }))}
                placeholder="0,00"
                className="mt-1 h-9 text-sm"
              />
            </div>
            <Button
              onClick={handleCreateReceipt}
              disabled={isSubmitting}
              className="w-full bg-success hover:bg-success/90 h-9 text-xs font-bold text-success-foreground"
            >
              {isSubmitting ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Confirmação de Exclusão */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="max-w-sm p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mt-2">
            {deleteTarget?.type === 'solicitation'
              ? 'Deseja remover esta solicitação e todos os pedidos e recebimentos vinculados?'
              : 'Deseja remover este pedido de compra e seu recebimento (se houver)?'}
          </p>
          <div className="flex gap-2 mt-4">
            <Button
              variant="outline"
              className="flex-1 h-9 text-xs font-bold"
              onClick={() => setDeleteConfirmOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1 h-9 text-xs font-bold bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={confirmDelete}
            >
              Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

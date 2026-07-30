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
import { PageLoading } from '@/components/layout/page-loading';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Plus,
  Truck,
  PackageCheck,
  FileText,
  Trash2,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useConfirm } from '@/components/ui/confirm-provider';
import type {
  FollowUpSolicitation,
  FollowUpPurchaseOrder,
  FollowUpReceipt,
  FollowUpStatus,
  SolicitationFormData,
  PurchaseOrderFormData,
  ReceiptFormData,
} from '@/lib/types';

/**
 * Linha crua de `follow_up_solicitations` com os pedidos de compra embutidos,
 * como a consulta `select('*, purchase_orders:follow_up_purchase_orders(*)')`
 * devolve: os pedidos ainda **sem** `receipt`, porque os recebimentos vêm numa
 * segunda consulta e são costurados depois.
 *
 * Existe para tipar esse passo intermediário em vez de usar `any`, que
 * escondia justamente a diferença entre o formato cru e o `FollowUpSolicitation`
 * final — a distinção que faz o merge abaixo ser necessário.
 */
type SolicitationRow = Omit<FollowUpSolicitation, 'purchase_orders'> & {
  purchase_orders: Omit<FollowUpPurchaseOrder, 'receipt'>[] | null;
};

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
  // Carbon Tag (V4): pale fill + dark text of the same color family, never a
  // solid fill with light text. Status is not a CTA, so `em_andamento` moves
  // off bg-primary onto --info (blue-70), which is visually distinct from
  // the interactive brand blue reserved for CTAs/links (DESIGN.md:227).
  const config = {
    pendente: { label: 'Pendente', className: 'bg-warning-muted text-warning' },
    em_andamento: { label: 'Em andamento', className: 'bg-info-muted text-info' },
    recebido: { label: 'Recebido', className: 'bg-success-muted text-success' },
  };
  const c = config[status];
  return <Badge className={c.className}>{c.label}</Badge>;
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

  // Caminho único de confirmação (Etapa 1 do plano de correções). Os três
  // alvos de exclusão desta tela — solicitação, pedido, recebimento —
  // chamam `await confirm(...)` inline no próprio handler, em vez do par de
  // estado genérico "qual card e qual dialog estão abertos" que existia
  // antes para alimentar um `Dialog` de confirmação ad-hoc só deste
  // arquivo. Isso é mais simples do que dar a esse estado genérico um
  // terceiro caso para o recebimento, que era a ideia original do plano:
  // com a API imperativa não há necessidade de guardar "o que falta
  // excluir" em estado — o handler já sabe, é só aguardar a resposta antes
  // de agir.
  const confirm = useConfirm();

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

    // `as unknown as`: o supabase-js infere o embed aninhado de forma mais
    // frouxa do que o formato real em runtime. Mesmo padrao de conversao ja
    // usado em movements/page.tsx e employees/page.tsx.
    const sols = (solsData ?? []) as unknown as SolicitationRow[];

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
    const merged: FollowUpSolicitation[] = sols.map((sol) => ({
      ...sol,
      purchase_orders: (sol.purchase_orders ?? []).map((po) => ({
        ...po,
        receipt: receiptsMap[po.id] ?? [],
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
    // Excluir a solicitação leva junto, por FK (`ON DELETE CASCADE` em
    // schema.sql), todos os pedidos de compra E recebimentos vinculados a
    // ela — por isso a descrição avisa a cascata completa, não só "a
    // solicitação".
    const ok = await confirm({
      title: 'Excluir solicitação',
      description: 'Deseja remover esta solicitação e todos os pedidos e recebimentos vinculados? Esta ação não pode ser desfeita.',
      confirmLabel: 'Excluir',
    });
    if (!ok) return;

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
        await refreshSolicitations();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePurchaseOrder = async (id: string, hasReceipt: boolean) => {
    // Quando o pedido já tem recebimento confirmado, excluí-lo também
    // apaga o recebimento por cascata (`follow_up_receipts.purchase_order_id
    // ON DELETE CASCADE`, ver supabase/schema.sql) — a descrição muda
    // conforme `hasReceipt` para deixar essa consequência explícita em vez
    // de um aviso genérico igual nos dois casos.
    const ok = await confirm({
      title: 'Excluir pedido',
      description: hasReceipt
        ? 'Este pedido já tem um recebimento confirmado. Excluir o pedido remove também esse recebimento (a NF vinculada). Esta ação não pode ser desfeita.'
        : 'Deseja excluir este pedido de compra? Esta ação não pode ser desfeita.',
      confirmLabel: 'Excluir',
    });
    if (!ok) return;

    const { error } = await supabase.from('follow_up_purchase_orders').delete().eq('id', id);
    if (error) {
      toast.error('Erro ao deletar pedido');
    } else {
      toast.success('Pedido removido');
      await refreshSolicitations();
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
      await refreshSolicitations();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteReceipt = async (receiptId: string) => {
    // Esta era a ação que, antes deste conserto, disparava sem NENHUMA
    // confirmação — apesar de ser irreversível — porque estava escondida
    // atrás do mesmo botão/lixeira usado para "Excluir pedido" (ver plano
    // de correções §5). O pedido de compra em si não é afetado: continua
    // registrado e pode ser marcado como recebido de novo depois.
    const ok = await confirm({
      title: 'Remover recebimento',
      description: 'Deseja remover o recebimento confirmado deste pedido? O pedido de compra continua registrado e pode ser marcado como recebido novamente depois.',
      confirmLabel: 'Remover',
    });
    if (!ok) return;

    const { error } = await supabase.from('follow_up_receipts').delete().eq('id', receiptId);
    if (error) {
      toast.error('Erro ao remover recebimento');
    } else {
      toast.success('Recebimento removido');
      await refreshSolicitations();
    }
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

  if (isLoading) return <PageLoading label="Carregando solicitações..." />;

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
          className="pl-10 h-10 text-sm"
        />
      </div>

      {/* Solicitations List */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-base font-normal text-foreground">
            {searchTerm ? 'Nenhuma solicitação encontrada' : 'Nenhuma solicitação cadastrada'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(sol => {
            const isExpanded = expandedId === sol.id;
            const orders = sol.purchase_orders || [];

            return (
              <div key={sol.id} className="bg-card border border-border overflow-hidden">
                {/* Row header */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : sol.id)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    )}
                    <span className="text-sm text-foreground">{sol.request_number}</span>
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
                  <div className="border-t border-border px-5 py-4 bg-surface-soft">
                    {/* Solicitation card */}
                    <div className="bg-card border border-border p-4 mb-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <div>
                            <Label className="text-muted-foreground">Nº Solicitação</Label>
                            <p className="text-sm text-foreground">{sol.request_number}</p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">Data</Label>
                            <p className="text-sm text-foreground">{formatDate(sol.request_date)}</p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">Descrição</Label>
                            <p className="text-sm text-foreground">{sol.description}</p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Excluir solicitação"
                          aria-label="Excluir solicitação"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-danger-muted"
                          onClick={() => void handleDeleteSolicitation(sol.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Purchase Orders section */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs tracking-[0.32px] text-muted-foreground">Pedidos de Compra</h3>
                        <Button
                          size="sm"
                          variant="outline"
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
                        <div className="py-6 text-center">
                          <p className="text-sm text-muted-foreground mb-2">Nenhum pedido de compra adicionado</p>
                          <Button
                            size="sm"
                            variant="outline"
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
                                  'group relative border border-border p-4 transition-all',
                                  hasReceipt ? 'bg-success-muted' : 'bg-accent'
                                )}
                              >
                                {/*
                                  Ações do card. Antes deste conserto havia UM botão de
                                  lixeira cujo clique fazia uma coisa OU outra dependendo
                                  de `hasReceipt` — e a ação irreversível (remover
                                  recebimento) era a que disparava sem confirmação nenhuma,
                                  enquanto a reversível (excluir pedido) confirmava. Estava
                                  invertido, e o `title`/`aria-label` mudava de texto
                                  conforme o estado, então nada no botão revelava ao
                                  usuário que existia um caminho pra excluir um pedido já
                                  recebido. Agora são duas ações sempre visíveis (quando
                                  aplicável) com rótulo fixo e confirmação própria — ver
                                  plano de correções §5. Dois botões de ícone em vez de um
                                  DropdownMenu porque são no máximo 2 ações, o padrão de
                                  revelação por hover/focus já existe no card e cabe sem
                                  apertar; um menu suspenso seria uma indireção a mais para
                                  o mesmo resultado.
                                */}
                                <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                                  {hasReceipt && receipt && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      title="Remover recebimento"
                                      aria-label="Remover recebimento"
                                      className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-danger-muted"
                                      onClick={() => void handleDeleteReceipt(receipt.id)}
                                    >
                                      <RotateCcw className="h-3 w-3" />
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    title="Excluir pedido"
                                    aria-label="Excluir pedido"
                                    className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-danger-muted"
                                    onClick={() => void handleDeletePurchaseOrder(po.id, Boolean(hasReceipt))}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>

                                <div className="flex items-center gap-2 mb-2">
                                  {hasReceipt ? (
                                    <PackageCheck className="h-4 w-4 text-success" />
                                  ) : (
                                    <Truck className="h-4 w-4 text-muted-foreground" />
                                  )}
                                  <span className="text-sm text-foreground">{po.po_number}</span>
                                </div>

                                <div className="space-y-1 text-xs text-muted-foreground">
                                  <p><span className="text-foreground">Fornecedor:</span> {po.supplier_name}</p>
                                  {po.estimated_delivery && (
                                    <p><span className="text-foreground">Prazo:</span> {formatDate(po.estimated_delivery)}</p>
                                  )}
                                </div>

                                {hasReceipt && receipt ? (
                                  <div className="mt-3 pt-2 border-t border-border space-y-1">
                                    <Badge className="bg-success-muted text-success">Recebido</Badge>
                                    <p className="text-xs text-muted-foreground">
                                      <span className="text-foreground">Fornecedor NF:</span> {receipt.supplier_name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      <span className="text-foreground">Valor NF:</span> {formatCurrency(receipt.invoice_value)}
                                    </p>
                                  </div>
                                ) : (
                                  <div className="mt-3">
                                    <Button
                                      size="sm"
                                      className="w-full"
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
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              Nova Solicitação
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-muted-foreground">Nº da Solicitação *</Label>
              <Input
                value={solicitationForm.request_number}
                onChange={e => setSolicitationForm(f => ({ ...f, request_number: e.target.value }))}
                placeholder="Ex: SOL-001"
                className="mt-1 h-10 text-sm"
              />
            </div>
            <div>
              <Label className="text-muted-foreground">Data da Solicitação *</Label>
              <Input
                value={dateDisplay}
                onChange={e => setDateDisplay(applyDateMask(e.target.value))}
                placeholder="DD/MM/AAAA"
                maxLength={10}
                className="mt-1 h-10 text-sm"
              />
            </div>
            <div>
              <Label className="text-muted-foreground">Descrição *</Label>
              <Input
                value={solicitationForm.description}
                onChange={e => setSolicitationForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Descrição da solicitação"
                className="mt-1 h-10 text-sm"
              />
            </div>
            <Button
              onClick={handleCreateSolicitation}
              disabled={isSubmitting}
              className="w-full h-10"
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
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-muted-foreground" />
              Novo Pedido de Compra
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-muted-foreground">Nº do Pedido *</Label>
              <Input
                value={poForm.po_number}
                onChange={e => setPoForm(f => ({ ...f, po_number: e.target.value }))}
                placeholder="Ex: PC-001"
                className="mt-1 h-10 text-sm"
              />
            </div>
            <div>
              <Label className="text-muted-foreground">Fornecedor *</Label>
              <Input
                value={poForm.supplier_name}
                onChange={e => setPoForm(f => ({ ...f, supplier_name: e.target.value }))}
                placeholder="Nome do fornecedor"
                className="mt-1 h-10 text-sm"
              />
            </div>
            <div>
              <Label className="text-muted-foreground">Prazo de Entrega</Label>
              <Input
                value={poDateDisplay}
                onChange={e => setPoDateDisplay(applyDateMask(e.target.value))}
                placeholder="DD/MM/AAAA"
                maxLength={10}
                className="mt-1 h-10 text-sm"
              />
            </div>
            <Button
              onClick={handleCreatePurchaseOrder}
              disabled={isSubmitting}
              className="w-full h-10"
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
            <DialogTitle className="flex items-center gap-2">
              <PackageCheck className="h-5 w-5 text-success" />
              Confirmar Recebimento
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-muted-foreground">Fornecedor *</Label>
              <Input
                value={receiptForm.supplier_name}
                onChange={e => setReceiptForm(f => ({ ...f, supplier_name: e.target.value }))}
                placeholder="Fornecedor que entregou"
                className="mt-1 h-10 text-sm"
              />
            </div>
            <div>
              <Label className="text-muted-foreground">Valor da NF (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={receiptForm.invoice_value ?? ''}
                onChange={e => setReceiptForm(f => ({ ...f, invoice_value: e.target.value ? parseFloat(e.target.value) : undefined }))}
                placeholder="0,00"
                className="mt-1 h-10 text-sm"
              />
            </div>
            <Button
              onClick={handleCreateReceipt}
              disabled={isSubmitting}
              className="w-full bg-success hover:bg-success-active h-10 text-success-foreground"
            >
              {isSubmitting ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

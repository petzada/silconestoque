'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Sector } from '@/lib/types';

export default function SectorsPage() {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSector, setEditingSector] = useState<Sector | null>(null);
  const [sectorName, setSectorName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchSectors();
  }, []);

  const fetchSectors = async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase.from('sectors').select('*').order('name');
      setSectors(data || []);
    } catch (e) {
      toast.error('Erro ao carregar setores');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDialog = (sector?: Sector) => {
    if (sector) {
      setEditingSector(sector);
      setSectorName(sector.name);
    } else {
      setEditingSector(null);
      setSectorName('');
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!sectorName.trim()) return;
    setIsSaving(true);
    try {
      if (editingSector) {
        await supabase.from('sectors').update({ name: sectorName.trim() }).eq('id', editingSector.id);
      } else {
        await supabase.from('sectors').insert({ name: sectorName.trim() });
      }
      toast.success('Salvo com sucesso');
      setIsDialogOpen(false);
      fetchSectors();
    } catch (e) {
      toast.error('Erro ao salvar');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (sector: Sector) => {
    if (!confirm(`Excluir setor "${sector.name}"?`)) return;
    try {
      const { error } = await supabase.from('sectors').delete().eq('id', sector.id);
      if (error) throw error;
      toast.success('Excluído');
      fetchSectors();
    } catch (e: any) {
      toast.error(e.message.includes('foreign') ? 'Existem produtos vinculados' : 'Erro ao excluir');
    }
  };

  if (isLoading) return <div className="text-center py-20 text-slate-400 font-bold">Carregando setores...</div>;

  return (
    <div className="max-w-[1200px] mx-auto space-y-4 px-4 md:px-6 pt-2 pb-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Estrutura de Setores</h1>
          <p className="text-xs text-slate-500 font-medium">Organização dos departamentos e centros de custo.</p>
        </div>
        <Button className="bg-[#387146] hover:bg-[#2b5836] h-9 text-xs font-bold px-4 shadow-sm" onClick={() => handleOpenDialog()}>
          <Plus className="h-3.5 w-3.5 mr-2" /> Novo Setor
        </Button>
      </div>

      <Card className="border-none shadow-sm rounded-xl bg-white overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow className="border-slate-100 hover:bg-transparent">
              <TableHead className="py-3 px-8 font-bold text-slate-500 uppercase text-[10px] tracking-wider">Identificação do Setor</TableHead>
              <TableHead className="py-3 px-8 text-right font-bold text-slate-500 uppercase text-[10px] tracking-wider">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sectors.map((s) => (
              <TableRow key={s.id} className="group hover:bg-slate-50/50 transition-all border-slate-100">
                <TableCell className="py-3 px-8"><span className="font-bold text-slate-800 text-sm tracking-tight">{s.name}</span></TableCell>
                <TableCell className="py-3 px-8 text-right">
                  <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:bg-slate-100 rounded-lg" onClick={() => handleOpenDialog(s)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:bg-red-50 rounded-lg" onClick={() => handleDelete(s)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-sm rounded-2xl p-6 shadow-2xl border-none">
          <DialogHeader><DialogTitle className="text-lg font-bold">Setor</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-1.5 uppercase text-[10px] font-bold text-slate-500 tracking-widest px-1">
              <Label htmlFor="name">Nome do Setor</Label>
              <Input id="name" className="h-10 bg-slate-50 border-slate-200 rounded-lg font-bold" value={sectorName} onChange={(e) => setSectorName(e.target.value)} placeholder="Ex: Produção, EPIs..." autoFocus />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" className="h-10 text-xs font-bold" onClick={() => setIsDialogOpen(false)}>Sair</Button>
              <Button className="bg-[#387146] hover:bg-[#2b5836] h-10 px-8 text-xs font-bold rounded-lg shadow-sm" onClick={handleSave} disabled={isSaving}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

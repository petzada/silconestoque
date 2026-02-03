'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { RotateCcw, ShieldCheck, Database, CheckCircle2 } from 'lucide-react';

export default function SettingsPage() {
  const [isRecalculating, setIsRecalculating] = useState(false);

  const handleRecalculateStock = async () => {
    setIsRecalculating(true);
    try {
      const { data: products, error: prodError } = await supabase
        .from('products')
        .select('id, name, current_qty, cost_price');

      if (prodError) throw prodError;

      const { data: movements, error: movError } = await supabase
        .from('movements')
        .select('product_id, type, quantity, created_at, unit_value');

      if (movError) throw movError;

      const calculatedStock = new Map<string, number>();
      const latestCosts = new Map<string, number | null>();

      // Initialize map
      products.forEach(p => {
        calculatedStock.set(p.id, 0);
        latestCosts.set(p.id, null);
      });

      // Sum movements & Find latest cost
      // Sort movements by date ASC to process correctly
      const sortedMovements = movements.sort((a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      sortedMovements.forEach(m => {
        const current = calculatedStock.get(m.product_id) || 0;
        if (m.type === 'IN') {
          calculatedStock.set(m.product_id, current + m.quantity);
          if (m.unit_value && m.unit_value > 0) {
            latestCosts.set(m.product_id, m.unit_value);
          }
        } else {
          calculatedStock.set(m.product_id, current - m.quantity);
        }
      });

      // Find discrepancies
      const updates = [];
      for (const product of products) {
        const expectedStock = Math.max(0, calculatedStock.get(product.id) || 0); // Safety floor 0
        const expectedCost = latestCosts.get(product.id) || null; // Can be null

        // Check stock OR cost mismatch
        // Note: product.cost_price might be undefined/null, handle carefully
        const currentCost = product.cost_price || null;

        if (product.current_qty !== expectedStock || currentCost !== expectedCost) {
          updates.push({
            id: product.id,
            name: product.name,
            current_qty: expectedStock,
            cost_price: expectedCost
          });
        }
      }

      if (updates.length === 0) {
        toast.success('Todos os saldos e custos estão corretos!');
        return;
      }

      // Apply updates
      let errorCount = 0;
      for (const update of updates) {
        const { error } = await supabase
          .from('products')
          .update({
            current_qty: update.current_qty,
            cost_price: update.cost_price
          })
          .eq('id', update.id);

        if (error) errorCount++;
      }

      if (errorCount > 0) {
        toast.warning(`Correção parcial. ${updates.length - errorCount} corrigidos, ${errorCount} falharam.`);
      } else {
        toast.success(`${updates.length} produtos corrigidos (Estoque e Custo).`);
      }

    } catch (error) {
      console.error(error);
      toast.error('Erro ao recalcular dados.');
    } finally {
      setIsRecalculating(false);
    }
  };

  return (
    <div className="max-w-[1000px] mx-auto space-y-6 px-4 md:px-6 pt-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Configurações e Ajustes</h1>
        <p className="text-slate-500 font-medium">Ferramentas administrativas do sistema.</p>
      </div>

      <div className="grid gap-6">
        <Card className="border-none shadow-sm rounded-xl bg-white overflow-hidden">
          <CardHeader className="bg-slate-50/50 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <Database className="h-5 w-5 text-emerald-700" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-slate-900">Integridade de Dados</CardTitle>
                <CardDescription className="text-xs">Ferramentas para correção e manutenção do banco de dados.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between p-4 border border-slate-100 rounded-xl bg-slate-50/30">
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-700">Sincronizar Estoques e Custos</p>
                <p className="text-xs text-slate-500 max-w-[500px]">
                  Executa uma varredura completa. Recalcula o saldo de estoque e restaura o preço de custo baseado na última entrada válida de cada produto.
                </p>
              </div>
              <Button
                onClick={handleRecalculateStock}
                disabled={isRecalculating}
                variant="outline"
                className="font-bold text-xs h-9 bg-white border-slate-200 hover:bg-slate-50 hover:text-emerald-700"
              >
                {isRecalculating ? (
                  <>Verificando...</>
                ) : (
                  <>
                    <RotateCcw className="h-3.5 w-3.5 mr-2" />
                    Sincronizar Agora
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-xl bg-white overflow-hidden opacity-80 pointer-events-none grayscale">
          <CardHeader className="bg-slate-50/50 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-100 rounded-lg">
                <ShieldCheck className="h-5 w-5 text-slate-500" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-slate-900">Segurança (Em breve)</CardTitle>
                <CardDescription className="text-xs">Gerenciamento de acesso e logs.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-slate-400 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4" /> Autenticação via Senha Única ativa.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

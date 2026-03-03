import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Trash2, Save, Edit2, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface ApprovalMarginRule {
  id: string;
  min_margin_cents: number;
  max_margin_cents: number | null;
  required_profiles: string[];
  escalation_profiles: string[];
  rule_name: string | null;
  is_active: boolean;
  priority_order: number;
}

const AVAILABLE_PROFILES = [
  'supervisor_comercial',
  'diretor_comercial',
  'diretor_pricing',
  'analista_pricing',
  'gerente_comercial'
];

export default function ApprovalMarginConfig() {
  const { user } = useAuth();
  const [rules, setRules] = useState<ApprovalMarginRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRule, setEditingRule] = useState<ApprovalMarginRule | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const loadRules = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('approval_margin_rules' as any)
        .select('*')
        .order('priority_order', { ascending: false })
        .order('min_margin_cents', { ascending: true });

      if (error) throw error;
      setRules((data as any) || []);
    } catch (error: any) {
      console.error('Erro ao carregar regras:', error);
      toast({
        title: "Erro",
        description: 'Erro ao carregar regras de aprovação: ' + (error.message || 'Erro desconhecido'),
        variant: "destructive"
      });
      setRules([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  const handleSave = async (rule: Partial<ApprovalMarginRule>) => {
    try {
      // Validar dados obrigatórios
      if (!rule.required_profiles || rule.required_profiles.length === 0) {
        toast({
          title: "Erro",
          description: 'Selecione pelo menos um perfil requerido',
          variant: "destructive"
        });
        return;
      }

      if (rule.min_margin_cents === undefined || rule.min_margin_cents === null) {
        toast({
          title: "Erro",
          description: 'Informe a margem mínima',
          variant: "destructive"
        });
        return;
      }

      // Preparar dados para salvar
      const ruleData: any = {
        min_margin_cents: rule.min_margin_cents,
        max_margin_cents: rule.max_margin_cents ?? null,
        required_profiles: rule.required_profiles,
        escalation_profiles: rule.escalation_profiles || [],
        rule_name: rule.rule_name || null,
        is_active: rule.is_active ?? true,
        priority_order: rule.priority_order ?? 0
      };

      console.log('💾 Salvando regra:', ruleData);

      if (editingRule?.id) {
        // Atualizar regra existente
        const { error } = await supabase
          .from('approval_margin_rules' as any)
          .update(ruleData)
          .eq('id', editingRule.id);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: 'Regra atualizada com sucesso',
        });
      } else {
        // Criar nova regra
        const { error } = await supabase
          .from('approval_margin_rules' as any)
          .insert([ruleData]);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: 'Regra criada com sucesso',
        });
      }

      setEditingRule(null);
      setIsCreating(false);
      loadRules();
    } catch (error: any) {
      console.error('❌ Erro completo ao salvar regra:', error);
      console.error('❌ Código do erro:', error.code);
      console.error('❌ Mensagem:', error.message);
      console.error('❌ Detalhes:', error.details);
      console.error('❌ Hint:', error.hint);
      toast({
        title: "Erro",
        description: 'Erro ao salvar regra: ' + (error.message || 'Erro desconhecido'),
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('approval_margin_rules' as any)
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: 'Regra excluída com sucesso',
      });

      loadRules();
    } catch (error: any) {
      console.error('Erro ao excluir regra:', error);
      toast({
        title: "Erro",
        description: 'Erro ao excluir regra: ' + (error.message || 'Erro desconhecido'),
        variant: "destructive"
      });
    }
  };

  const toggleActive = async (rule: ApprovalMarginRule) => {
    try {
      const { error } = await supabase
        .from('approval_margin_rules' as any)
        .update({ is_active: !rule.is_active })
        .eq('id', rule.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: `Regra ${!rule.is_active ? 'ativada' : 'desativada'} com sucesso`,
      });

      loadRules();
    } catch (error: any) {
      console.error('Erro ao alterar status da regra:', error);
      toast({
        title: "Erro",
        description: 'Erro ao alterar status da regra: ' + (error.message || 'Erro desconhecido'),
        variant: "destructive"
      });
    }
  };

  const formatMargin = (cents: number) => {
    return (cents / 100).toFixed(2).replace('.', ',');
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-slate-300 border-t-slate-600 rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Configurações de Aprovação por Margem</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure quais perfis devem aprovar baseado na margem de lucro
          </p>
        </div>
        <Button
          onClick={() => {
            setIsCreating(true);
            setEditingRule({
              id: '',
              min_margin_cents: 0,
              max_margin_cents: null,
              required_profiles: [],
              escalation_profiles: [],
              rule_name: '',
              is_active: true,
              priority_order: 0
            } as ApprovalMarginRule);
          }}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Nova Regra
        </Button>
      </div>

      {/* Formulário de Edição/Criação */}
      {(editingRule || isCreating) && (
        <Card className="border-blue-200 dark:border-blue-800">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                {editingRule?.id ? 'Editar Regra' : 'Nova Regra'}
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditingRule(null);
                  setIsCreating(false);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="rule_name">Nome da Regra</Label>
                <Input
                  id="rule_name"
                  value={editingRule?.rule_name || ''}
                  onChange={(e) => setEditingRule({ ...editingRule!, rule_name: e.target.value })}
                  placeholder="Ex: Margem baixa - requer diretores"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="priority_order">Ordem de Prioridade</Label>
                <Input
                  id="priority_order"
                  type="number"
                  value={editingRule?.priority_order || 0}
                  onChange={(e) => setEditingRule({ ...editingRule!, priority_order: parseInt(e.target.value) || 0 })}
                  placeholder="Maior número = maior prioridade"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="min_margin">Margem Mínima (R$)</Label>
                <Input
                  id="min_margin"
                  type="number"
                  step="0.01"
                  value={editingRule ? (editingRule.min_margin_cents / 100).toFixed(2) : '0.00'}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value) || 0;
                    setEditingRule({ ...editingRule!, min_margin_cents: Math.round(value * 100) });
                  }}
                  placeholder="0.35"
                />
                <p className="text-xs text-slate-500">Ex: 0.35 = 35 centavos</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="max_margin">Margem Máxima (R$)</Label>
                <Input
                  id="max_margin"
                  type="number"
                  step="0.01"
                  value={editingRule?.max_margin_cents ? (editingRule.max_margin_cents / 100).toFixed(2) : ''}
                  onChange={(e) => {
                    const value = e.target.value === '' ? null : (parseFloat(e.target.value) || 0);
                    setEditingRule({ ...editingRule!, max_margin_cents: value === null ? null : Math.round(value * 100) });
                  }}
                  placeholder="Deixe vazio para sem limite"
                />
                <p className="text-xs text-slate-500">Deixe vazio = sem limite superior</p>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <div className="flex items-center gap-2 pt-2">
                  <Switch
                    checked={editingRule?.is_active ?? true}
                    onCheckedChange={(checked) => setEditingRule({ ...editingRule!, is_active: checked })}
                  />
                  <span className="text-sm">{editingRule?.is_active ? 'Ativa' : 'Inativa'}</span>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Perfis Requeridos</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {AVAILABLE_PROFILES.map((profile) => {
                  const isSelected = editingRule?.required_profiles?.includes(profile) || false;
                  return (
                    <div key={profile} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`profile_${profile}`}
                        checked={isSelected}
                        onChange={(e) => {
                          const currentProfiles = editingRule?.required_profiles || [];
                          if (e.target.checked) {
                            setEditingRule({
                              ...editingRule!,
                              required_profiles: [...currentProfiles, profile]
                            });
                          } else {
                            setEditingRule({
                              ...editingRule!,
                              required_profiles: currentProfiles.filter(p => p !== profile)
                            });
                          }
                        }}
                        className="rounded border-slate-300"
                      />
                      <Label htmlFor={`profile_${profile}`} className="text-sm font-normal cursor-pointer">
                        {profile.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Label>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Selecione os perfis que devem aprovar quando a margem estiver neste intervalo
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Perfis de Escalonamento (Em caso de rejeição)</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {AVAILABLE_PROFILES.map((profile) => {
                  const isSelected = editingRule?.escalation_profiles?.includes(profile) || false;
                  return (
                    <div key={`escalation_${profile}`} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`escalation_${profile}`}
                        checked={isSelected}
                        onChange={(e) => {
                          const currentProfiles = editingRule?.escalation_profiles || [];
                          if (e.target.checked) {
                            setEditingRule({
                              ...editingRule!,
                              escalation_profiles: [...currentProfiles, profile]
                            });
                          } else {
                            setEditingRule({
                              ...editingRule!,
                              escalation_profiles: currentProfiles.filter(p => p !== profile)
                            });
                          }
                        }}
                        className="rounded border-slate-300"
                      />
                      <Label htmlFor={`escalation_${profile}`} className="text-sm font-normal cursor-pointer">
                        {profile.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Label>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Perfis que a solicitação deve seguir caso seja <b>REJEITADA</b> pelos perfis requeridos originais. (Deixe vazio para finalizar a solicitação).
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => {
                  if (!editingRule) return;

                  // Validar antes de salvar
                  if (!editingRule.required_profiles || editingRule.required_profiles.length === 0) {
                    toast({
                      title: "Erro",
                      description: 'Selecione pelo menos um perfil requerido',
                      variant: "destructive"
                    });
                    return;
                  }

                  handleSave(editingRule);
                }}
                disabled={!editingRule?.required_profiles?.length || editingRule.required_profiles.length === 0}
                className="flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                Salvar
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setEditingRule(null);
                  setIsCreating(false);
                }}
              >
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de Regras */}
      <div className="space-y-3">
        {rules.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-slate-600 dark:text-slate-400">Nenhuma regra configurada</p>
            </CardContent>
          </Card>
        ) : (
          rules.map((rule) => (
            <Card key={rule.id} className={!rule.is_active ? 'opacity-60' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-base flex items-center gap-2">
                      {rule.rule_name || 'Regra sem nome'}
                      {!rule.is_active && (
                        <span className="text-xs font-normal text-slate-500">(Inativa)</span>
                      )}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Margem: R$ {formatMargin(rule.min_margin_cents)} até{' '}
                      {rule.max_margin_cents ? `R$ ${formatMargin(rule.max_margin_cents)}` : 'sem limite'}
                      {' • '}Prioridade: {rule.priority_order}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={rule.is_active}
                      onCheckedChange={() => toggleActive(rule)}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingRule(rule)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(rule.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">Requeridos:</span>
                    {rule.required_profiles.map((profile) => (
                      <span
                        key={`req_${profile}`}
                        className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs rounded"
                      >
                        {profile.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">Escalonamento:</span>
                    {rule.escalation_profiles && rule.escalation_profiles.length > 0 ? (
                      rule.escalation_profiles.map((profile) => (
                        <span
                          key={`esc_${profile}`}
                          className="px-2 py-1 bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 text-xs rounded"
                        >
                          {profile.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-500 italic">Nenhum</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}


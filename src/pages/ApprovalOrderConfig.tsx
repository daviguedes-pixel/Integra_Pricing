import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { ArrowUp, ArrowDown, Save, Plus } from 'lucide-react';

interface ApprovalProfileOrder {
  id: string;
  perfil: string;
  order_position: number;
  is_active: boolean;
}

const PROFILE_LABELS: Record<string, string> = {
  'supervisor_comercial': 'Supervisor Comercial',
  'diretor_comercial': 'Diretor Comercial',
  'diretor_pricing': 'Diretor Pricing',
  'analista_pricing': 'Analista Pricing',
  'gerente_comercial': 'Gerente Comercial',
  'gerente': 'Gerente',
  'assessor_comercial': 'Assessor Comercial',
};

export default function ApprovalOrderConfig() {
  const { user } = useAuth();
  const { permissions } = usePermissions();
  const [profiles, setProfiles] = useState<ApprovalProfileOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);


  const loadProfiles = async (retryCount = 0) => {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000; // 1 segundo

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('approval_profile_order' as any)
        .select('*')
        .order('order_position', { ascending: true });

      if (error) {
        // Se for erro de rede, tentar novamente
        if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
          if (retryCount < MAX_RETRIES) {
            console.log(`Tentativa ${retryCount + 1} de ${MAX_RETRIES}...`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
            return loadProfiles(retryCount + 1);
          }
          throw new Error('Erro de conexão com o servidor. Verifique sua conexão com a internet.');
        }
        throw error;
      }

      // Se não houver dados, criar ordem padrão
      if (!data || data.length === 0) {
        const defaultProfiles = [
          { perfil: 'supervisor_comercial', order_position: 1, is_active: true },
          { perfil: 'diretor_comercial', order_position: 2, is_active: true },
          { perfil: 'diretor_pricing', order_position: 3, is_active: true },
        ];

        const inserts = defaultProfiles.map(p => ({
          perfil: p.perfil,
          order_position: p.order_position,
          is_active: p.is_active,
          created_by: user?.email || 'system',
        }));

        const { error: insertError } = await supabase
          .from('approval_profile_order' as any)
          .insert(inserts);

        if (insertError) {
          // Se for erro de rede, tentar novamente
          if (insertError.message?.includes('Failed to fetch') || insertError.message?.includes('NetworkError')) {
            if (retryCount < MAX_RETRIES) {
              console.log(`Tentativa ${retryCount + 1} de ${MAX_RETRIES}...`);
              await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
              return loadProfiles(retryCount + 1);
            }
            throw new Error('Erro de conexão com o servidor. Verifique sua conexão com a internet.');
          }
          throw insertError;
        }

        setProfiles(defaultProfiles.map((p, idx) => ({
          id: `temp-${idx}`,
          ...p,
        })));
      } else {
        setProfiles(data as any);
      }

      setHasChanges(false);
    } catch (error: any) {
      console.error('Erro ao carregar perfis:', error);

      // Mensagem de erro mais amigável
      let errorMessage = 'Erro desconhecido';
      if (error?.message) {
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
          errorMessage = 'Erro de conexão com o servidor. Verifique sua conexão com a internet e tente novamente.';
        } else if (error.message.includes('JWT')) {
          errorMessage = 'Sessão expirada. Por favor, faça login novamente.';
        } else if (error.message.includes('permission') || error.message.includes('permissão')) {
          errorMessage = 'Você não tem permissão para acessar esta página.';
        } else {
          errorMessage = error.message;
        }
      }

      toast.error('Erro ao carregar ordem de aprovação: ' + errorMessage);

      // Se ainda não tentou todas as vezes, tentar novamente após um delay maior
      if (retryCount < MAX_RETRIES && (error?.message?.includes('Failed to fetch') || error?.message?.includes('NetworkError'))) {
        setTimeout(() => {
          loadProfiles(retryCount + 1);
        }, RETRY_DELAY * (retryCount + 2));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  const handleMoveUp = (index: number) => {
    if (index === 0) return;

    setProfiles((items) => {
      const newItems = [...items];
      [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];

      // Atualizar order_position
      const updatedItems = newItems.map((item, idx) => ({
        ...item,
        order_position: idx + 1,
      }));

      setHasChanges(true);
      return updatedItems;
    });
  };

  const handleMoveDown = (index: number) => {
    if (index === profiles.length - 1) return;

    setProfiles((items) => {
      const newItems = [...items];
      [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];

      // Atualizar order_position
      const updatedItems = newItems.map((item, idx) => ({
        ...item,
        order_position: idx + 1,
      }));

      setHasChanges(true);
      return updatedItems;
    });
  };

  const handleToggleActive = (id: string) => {
    setProfiles((items) => {
      const updated = items.map((item) =>
        item.id === id ? { ...item, is_active: !item.is_active } : item
      );
      setHasChanges(true);
      return updated;
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Atualizar cada perfil
      for (const profile of profiles) {
        const { error } = await supabase
          .from('approval_profile_order' as any)
          .update({
            order_position: profile.order_position,
            is_active: profile.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq('id', profile.id);

        if (error) throw error;
      }

      toast.success('Ordem de aprovação salva com sucesso!');
      setHasChanges(false);

      // Invalidar cache de aprovadores em todas as páginas
      try {
        localStorage.removeItem('approvals_approvers_cache');
        localStorage.removeItem('approvals_approvers_cache_timestamp');
        localStorage.removeItem('approvals_suggestions_cache_v2');
        localStorage.removeItem('approvals_suggestions_cache_v2_timestamp');
      } catch { }

      await loadProfiles();
    } catch (error: any) {
      console.error('Erro ao salvar ordem:', error);
      toast.error('Erro ao salvar ordem de aprovação: ' + (error?.message || 'Erro desconhecido'));
    } finally {
      setSaving(false);
    }
  };

  const handleAddProfile = async () => {
    const profileName = prompt('Digite o nome do perfil:');
    if (!profileName || !profileName.trim()) return;

    try {
      const maxPosition = Math.max(...profiles.map(p => p.order_position), 0);
      const { data, error } = await supabase
        .from('approval_profile_order' as any)
        .insert({
          perfil: profileName.trim(),
          order_position: maxPosition + 1,
          is_active: true,
          created_by: user?.email || 'system',
        })
        .select()
        .single();

      if (error) throw error;

      setProfiles([...profiles, data as any]);
      setHasChanges(true);
      toast.success('Perfil adicionado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao adicionar perfil:', error);
      toast.error('Erro ao adicionar perfil: ' + (error?.message || 'Erro desconhecido'));
    }
  };

  const canEdit = permissions?.permissions?.admin || false;

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="p-8 text-center">
            <p>Carregando...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Ordem de Aprovação</CardTitle>
          <CardDescription>
            Defina a ordem hierárquica em que os perfis devem aprovar as solicitações de preço.
            Use os botões de seta para reorganizar a ordem.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!canEdit && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                Você não tem permissão para editar a ordem de aprovação. Apenas administradores podem fazer alterações.
              </p>
            </div>
          )}

          <div className="space-y-2">
            {profiles.map((profile, index) => (
              <div
                key={profile.id}
                className={`flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 ${!profile.is_active ? 'opacity-50' : ''
                  }`}
              >
                <div className="flex flex-col gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0 || saving}
                    className="h-7 w-7 p-0"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleMoveDown(index)}
                    disabled={index === profiles.length - 1 || saving}
                    className="h-7 w-7 p-0"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex-1">
                  <Label className="text-sm font-semibold">
                    {PROFILE_LABELS[profile.perfil] || profile.perfil}
                  </Label>
                  <p className="text-xs text-slate-500">Posição: {profile.order_position}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor={`active-${profile.id}`} className="text-xs">
                    Ativo
                  </Label>
                  <Switch
                    id={`active-${profile.id}`}
                    checked={profile.is_active}
                    onCheckedChange={() => handleToggleActive(profile.id)}
                    disabled={saving || !canEdit}
                  />
                </div>
              </div>
            ))}
          </div>

          {canEdit && (
            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleAddProfile}
                variant="outline"
                disabled={saving}
              >
                Adicionar Perfil
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className="flex-1"
              >
                <Save className="h-4 w-4 mr-2" />
                Salvar Alterações
              </Button>
            </div>
          )}

          {hasChanges && (
            <p className="text-xs text-slate-500 text-center">
              Você tem alterações não salvas
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


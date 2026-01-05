// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Search, Edit, Save, Package, Plus } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Station {
  id: number;
  id_empresa?: string;
  cnpj_cpf?: string;
  nome_empresa: string;
  brinde_enabled?: boolean;
  brinde_value?: number;
}

interface Client {
  id_cliente: string;
  nome: string;
}

interface PaymentMethod {
  id: number;
  CARTAO: string;
  TAXA: number;
  PRAZO: string;
  ID_POSTO: number;
}

export default function Gestao() {
  const { canAccess } = usePermissions();
  const [activeTab, setActiveTab] = useState<string>('');

  // Verificar quais subabas o usuário tem acesso
  const hasStationsAccess = canAccess('gestao_stations');
  const hasClientsAccess = canAccess('gestao_clients');
  const hasPaymentMethodsAccess = canAccess('gestao_payment_methods');

  // Verificar se tem acesso a pelo menos uma subaba
  const hasAnyAccess = hasStationsAccess || hasClientsAccess || hasPaymentMethodsAccess;

  // Debug: log das permissões
  useEffect(() => {
    console.log('🔍 Gestão - Verificando permissões:', {
      hasStationsAccess,
      hasClientsAccess,
      hasPaymentMethodsAccess,
      hasAnyAccess,
      activeTab
    });
  }, [hasStationsAccess, hasClientsAccess, hasPaymentMethodsAccess, hasAnyAccess, activeTab]);

  // Definir aba inicial quando as permissões estiverem disponíveis
  useEffect(() => {
    if (!activeTab && hasAnyAccess) {
      if (hasStationsAccess) {
        setActiveTab('stations');
      } else if (hasClientsAccess) {
        setActiveTab('clients');
      } else if (hasPaymentMethodsAccess) {
        setActiveTab('payment-methods');
      }
    }
  }, [hasStationsAccess, hasClientsAccess, hasPaymentMethodsAccess, hasAnyAccess, activeTab]);

  // Estado para Stations
  const [stations, setStations] = useState<Station[]>([]);
  const [loadingStations, setLoadingStations] = useState(false);
  const [searchStation, setSearchStation] = useState('');

  // Estado para Clients
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [searchClient, setSearchClient] = useState('');

  // Estado para Payment Methods
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(false);
  const [searchPaymentMethod, setSearchPaymentMethod] = useState('');

  // Estados para dialog de edição
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editStation, setEditStation] = useState<Station | null>(null);
  const [brindeEnabled, setBrindeEnabled] = useState(false);
  const [brindeValue, setBrindeValue] = useState('');

  // Estados para dialogs de adição
  const [addClientDialogOpen, setAddClientDialogOpen] = useState(false);
  const [addPaymentMethodDialogOpen, setAddPaymentMethodDialogOpen] = useState(false);
  const [editPaymentMethodDialogOpen, setEditPaymentMethodDialogOpen] = useState(false);
  const [clientDetailsDialogOpen, setClientDetailsDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);

  // Estados para formulários
  const [newClientName, setNewClientName] = useState('');
  const [newClientId, setNewClientId] = useState('');

  const [newPaymentCard, setNewPaymentCard] = useState('');
  const [newPaymentTaxa, setNewPaymentTaxa] = useState('');
  const [newPaymentPrazo, setNewPaymentPrazo] = useState('');
  const [newPaymentPostoId, setNewPaymentPostoId] = useState('');
  const [applyToAllStations, setApplyToAllStations] = useState(false);

  // Estados para edição de método de pagamento
  const [editPaymentCard, setEditPaymentCard] = useState('');
  const [editPaymentTaxa, setEditPaymentTaxa] = useState('');
  const [editPaymentPrazo, setEditPaymentPrazo] = useState('');

  // Carregar postos
  const loadStations = async () => {
    setLoadingStations(true);
    try {
      const { data, error } = await supabase.rpc('get_sis_empresa_stations');
      if (error) throw error;
      setStations(data || []);
    } catch (error) {
      console.error('Erro ao carregar postos:', error);
      toast.error('Erro ao carregar postos');
    } finally {
      setLoadingStations(false);
    }
  };

  // Carregar clientes
  const loadClients = async () => {
    setLoadingClients(true);
    try {
      const { data, error } = await supabase.from('clientes').select('id_cliente, nome');
      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      toast.error('Erro ao carregar clientes');
    } finally {
      setLoadingClients(false);
    }
  };

  // Carregar tipos de pagamento
  const loadPaymentMethods = async () => {
    setLoadingPaymentMethods(true);
    try {
      const { data, error } = await supabase.from('tipos_pagamento').select('*');
      if (error) throw error;
      setPaymentMethods(data || []);
    } catch (error) {
      console.error('Erro ao carregar tipos de pagamento:', error);
      toast.error('Erro ao carregar tipos de pagamento');
    } finally {
      setLoadingPaymentMethods(false);
    }
  };

  // Abrir dialog de detalhes do cliente
  const openClientDetails = (client: Client) => {
    setSelectedClient(client);
    setClientDetailsDialogOpen(true);
  };

  // Abrir dialog de edição de método de pagamento
  const openEditPaymentMethod = (pm: PaymentMethod) => {
    setSelectedPaymentMethod(pm);
    setEditPaymentCard(pm.CARTAO);
    setEditPaymentTaxa(String(pm.TAXA || 0));
    setEditPaymentPrazo(pm.PRAZO || '');
    setEditPaymentMethodDialogOpen(true);
  };

  // Salvar edição de método de pagamento
  const saveEditPaymentMethod = async () => {
    if (!selectedPaymentMethod) return;

    try {
      const { error } = await supabase
        .from('tipos_pagamento')
        .update({
          CARTAO: editPaymentCard,
          TAXA: parseFloat(editPaymentTaxa) || 0,
          PRAZO: editPaymentPrazo || ''
        })
        .eq('id', selectedPaymentMethod.id);

      if (error) throw error;

      toast.success('Método de pagamento atualizado com sucesso!');
      setEditPaymentMethodDialogOpen(false);
      setSelectedPaymentMethod(null);
      loadPaymentMethods();
    } catch (error) {
      console.error('Erro ao atualizar método de pagamento:', error);
      toast.error('Erro ao atualizar método de pagamento');
    }
  };

  // Obter nome do posto pelo ID_POSTO
  const getStationName = (idPosto: number | string) => {
    const station = stations.find(s =>
      String(s.id_empresa || s.id) === String(idPosto)
    );
    return station?.nome_empresa || `Posto ${idPosto}`;
  };

  useEffect(() => {
    loadStations();
    loadClients();
    loadPaymentMethods();
  }, []);

  // Filtrar postos
  const filteredStations = stations.filter(station =>
    station.nome_empresa?.toLowerCase().includes(searchStation.toLowerCase()) ||
    station.cnpj_cpf?.includes(searchStation) ||
    station.id_empresa?.includes(searchStation)
  );

  // Filtrar clientes
  const filteredClients = clients.filter(client =>
    client.nome?.toLowerCase().includes(searchClient.toLowerCase()) ||
    client.id_cliente?.includes(searchClient)
  );

  // Filtrar tipos de pagamento
  const filteredPaymentMethods = paymentMethods.filter(pm =>
    pm.CARTAO?.toLowerCase().includes(searchPaymentMethod.toLowerCase())
  );

  // Abrir dialog de edição de brinde
  const openEditDialog = (station: Station) => {
    setEditStation(station);
    setBrindeEnabled(station.brinde_enabled || false);
    setBrindeValue(String(station.brinde_value || 0));
    setEditDialogOpen(true);
  };

  // Salvar brinde
  const saveBrinde = async () => {
    if (!editStation) return;

    try {
      const { error } = await supabase
        .from('sis_empresa')
        .update({
          brinde_enabled: brindeEnabled,
          brinde_value: parseFloat(brindeValue) || 0
        })
        .eq('id', editStation.id);

      if (error) throw error;

      toast.success('Brinde atualizado com sucesso!');
      setEditDialogOpen(false);
      loadStations();
    } catch (error) {
      console.error('Erro ao salvar brinde:', error);
      toast.error('Erro ao salvar brinde');
    }
  };

  // Adicionar cliente
  const addClient = async () => {
    if (!newClientName || !newClientId) {
      toast.error('Preencha todos os campos');
      return;
    }

    try {
      const { error } = await supabase
        .from('clientes')
        .insert({
          id_cliente: newClientId,
          nome: newClientName
        });

      if (error) throw error;

      toast.success('Cliente adicionado com sucesso!');
      setAddClientDialogOpen(false);
      setNewClientName('');
      setNewClientId('');
      loadClients();
    } catch (error) {
      console.error('Erro ao adicionar cliente:', error);
      toast.error('Erro ao adicionar cliente');
    }
  };

  // Adicionar tipo de pagamento
  const addPaymentMethod = async () => {
    if (!newPaymentCard || !newPaymentTaxa) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    if (!applyToAllStations && !newPaymentPostoId) {
      toast.error('Selecione um posto ou marque "Aplicar para todos os postos"');
      return;
    }

    try {
      if (applyToAllStations) {
        // Inserir para todos os postos
        const insertData = stations
          .filter(station => station.id_empresa) // Filtrar apenas postos com id_empresa
          .map(station => ({
            CARTAO: newPaymentCard,
            TAXA: parseFloat(newPaymentTaxa) || 0,
            PRAZO: newPaymentPrazo || '',
            ID_POSTO: String(station.id_empresa || station.id) // Usar id_empresa se disponível, senão usar id
          }));

        console.log('Inserindo dados:', insertData);

        // Inserir um por vez para evitar conflitos de chave
        let successCount = 0;
        let errorCount = 0;

        for (const data of insertData) {
          // Verificar se já existe
          const { data: existing } = await supabase
            .from('tipos_pagamento')
            .select('CARTAO')
            .eq('ID_POSTO', data.ID_POSTO)
            .eq('CARTAO', data.CARTAO)
            .maybeSingle();

          if (existing) {
            console.log('Já existe:', data);
            errorCount++;
          } else {
            const { error } = await supabase
              .from('tipos_pagamento')
              .insert(data);

            if (error) {
              console.error('Erro ao inserir:', data, error);
              errorCount++;
            } else {
              successCount++;
            }
          }
        }

        if (errorCount > 0 && successCount === 0) {
          toast.error('Erro ao adicionar tipo de pagamento. Este tipo já pode existir para todos os postos.');
        } else if (errorCount > 0) {
          toast.warning(`Tipo de pagamento adicionado para ${successCount} postos. ${errorCount} postos já possuem este tipo.`);
        } else {
          toast.success(`Tipo de pagamento adicionado para ${successCount} postos!`);
        }
      } else {
        // Inserir para um posto específico
        const selectedStation = stations.find(s => s.id.toString() === newPaymentPostoId);
        const idPosto = selectedStation?.id_empresa || newPaymentPostoId;

        console.log('Inserindo dados:', {
          CARTAO: newPaymentCard,
          TAXA: parseFloat(newPaymentTaxa) || 0,
          PRAZO: newPaymentPrazo || '',
          ID_POSTO: String(idPosto)
        });

        // Verificar se já existe
        const { data: existing } = await supabase
          .from('tipos_pagamento')
          .select('CARTAO')
          .eq('ID_POSTO', String(idPosto))
          .eq('CARTAO', newPaymentCard)
          .maybeSingle();

        if (existing) {
          toast.error('Este tipo de pagamento já existe para este posto');
          return;
        }

        const { error } = await supabase
          .from('tipos_pagamento')
          .insert({
            CARTAO: newPaymentCard,
            TAXA: parseFloat(newPaymentTaxa) || 0,
            PRAZO: newPaymentPrazo || '',
            ID_POSTO: String(idPosto)
          });

        if (error) {
          console.error('Erro detalhado ao inserir para um posto:', error);
          toast.error(`Erro: ${error.message || 'Erro ao adicionar tipo de pagamento'}`);
          return;
        }

        toast.success('Tipo de pagamento adicionado com sucesso!');
      }

      setAddPaymentMethodDialogOpen(false);
      setNewPaymentCard('');
      setNewPaymentTaxa('');
      setNewPaymentPrazo('');
      setNewPaymentPostoId('');
      setApplyToAllStations(false);
      loadPaymentMethods();
    } catch (error) {
      console.error('Erro ao adicionar tipo de pagamento:', error);
      toast.error('Erro ao adicionar tipo de pagamento');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-3 space-y-3">
        {/* Header */}
        <div className="relative overflow-hidden rounded-lg bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 p-3 text-white shadow-lg">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div>
                <h1 className="text-lg font-bold mb-0.5">Gestão de Dados</h1>
                <p className="text-slate-200 text-xs">Gerencie postos, clientes e tipos de pagamento</p>
              </div>
            </div>
          </div>
        </div>

        {!hasAnyAccess ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground text-lg">
                Você não tem permissão para acessar nenhuma funcionalidade de gestão.
              </p>
              <p className="text-muted-foreground text-sm mt-2">
                Entre em contato com o administrador para solicitar as permissões necessárias.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className={`grid w-full ${hasStationsAccess && hasClientsAccess && hasPaymentMethodsAccess ? 'grid-cols-3' : (hasStationsAccess && hasClientsAccess) || (hasStationsAccess && hasPaymentMethodsAccess) || (hasClientsAccess && hasPaymentMethodsAccess) ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {hasStationsAccess && (
                <TabsTrigger value="stations">Postos</TabsTrigger>
              )}
              {hasClientsAccess && (
                <TabsTrigger value="clients">Clientes</TabsTrigger>
              )}
              {hasPaymentMethodsAccess && (
                <TabsTrigger value="payment-methods">Tipos de Pagamento</TabsTrigger>
              )}
            </TabsList>

            {hasStationsAccess && (
              <TabsContent value="stations" className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Postos</CardTitle>
                        <CardDescription>Gerencie os postos de combustível</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                          <Input
                            placeholder="Buscar postos..."
                            value={searchStation}
                            onChange={(e) => setSearchStation(e.target.value)}
                            className="pl-10 w-64"
                          />
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {loadingStations ? (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground">Carregando...</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {filteredStations.map((station) => (
                          <div
                            key={station.id}
                            className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
                          >
                            <div className="flex items-center gap-4 flex-1">
                              <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg">
                                <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                              </div>
                              <div className="flex-1">
                                <h3 className="font-semibold">{station.nome_empresa}</h3>
                                <div className="text-sm text-muted-foreground space-y-1">
                                  {station.cnpj_cpf && <p>CNPJ/CPF: {station.cnpj_cpf}</p>}
                                  <div className="flex items-center gap-4 mt-2">
                                    <span className={`px-2 py-1 rounded text-xs ${station.brinde_enabled
                                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                        : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                                      }`}>
                                      Brinde: {station.brinde_enabled ? 'Ativo' : 'Inativo'}
                                    </span>
                                    {station.brinde_enabled && station.brinde_value && (
                                      <span className="text-xs font-medium">
                                        Valor: R$ {parseFloat(String(station.brinde_value)).toFixed(4)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditDialog(station)}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Editar Brinde
                            </Button>
                          </div>
                        ))}
                        {filteredStations.length === 0 && (
                          <div className="text-center py-8 text-muted-foreground">
                            Nenhum posto encontrado
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {hasClientsAccess && (
              <TabsContent value="clients" className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Clientes</CardTitle>
                        <CardDescription>Gerencie os clientes</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                          <Input
                            placeholder="Buscar clientes..."
                            value={searchClient}
                            onChange={(e) => setSearchClient(e.target.value)}
                            className="pl-10 w-64"
                          />
                        </div>
                        <Button
                          variant="default"
                          onClick={() => setAddClientDialogOpen(true)}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Adicionar
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {loadingClients ? (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground">Carregando...</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {filteredClients.map((client) => (
                          <div
                            key={client.id_cliente}
                            className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors cursor-pointer"
                            onClick={() => openClientDetails(client)}
                          >
                            <div className="flex items-center gap-4 flex-1">
                              <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-lg">
                                <Package className="h-5 w-5 text-green-600 dark:text-green-400" />
                              </div>
                              <div className="flex-1">
                                <h3 className="font-semibold">{client.nome}</h3>
                              </div>
                            </div>
                          </div>
                        ))}
                        {filteredClients.length === 0 && (
                          <div className="text-center py-8 text-muted-foreground">
                            Nenhum cliente encontrado
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {hasPaymentMethodsAccess && (
              <TabsContent value="payment-methods" className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Tipos de Pagamento</CardTitle>
                        <CardDescription>Gerencie os tipos de pagamento</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                          <Input
                            placeholder="Buscar tipos de pagamento..."
                            value={searchPaymentMethod}
                            onChange={(e) => setSearchPaymentMethod(e.target.value)}
                            className="pl-10 w-64"
                          />
                        </div>
                        <Button
                          variant="default"
                          onClick={() => setAddPaymentMethodDialogOpen(true)}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Adicionar
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {loadingPaymentMethods ? (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground">Carregando...</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {filteredPaymentMethods.map((pm) => (
                          <div
                            key={pm.id}
                            className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
                          >
                            <div className="flex items-center gap-4 flex-1">
                              <div className="bg-orange-100 dark:bg-orange-900/30 p-2 rounded-lg">
                                <Package className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                              </div>
                              <div className="flex-1">
                                <h3 className="font-semibold">{pm.CARTAO}</h3>
                                <div className="text-sm text-muted-foreground space-y-1">
                                  <p>Taxa: {pm.TAXA}%</p>
                                  {pm.PRAZO && <p>Prazo: {pm.PRAZO}</p>}
                                  <p>Posto: {getStationName(pm.ID_POSTO)}</p>
                                </div>
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditPaymentMethod(pm)}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Editar
                            </Button>
                          </div>
                        ))}
                        {filteredPaymentMethods.length === 0 && (
                          <div className="text-center py-8 text-muted-foreground">
                            Nenhum tipo de pagamento encontrado
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        )}

        {/* Dialog de edição de brinde */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Brinde - {editStation?.nome_empresa}</DialogTitle>
              <DialogDescription>
                Configure o brinde para este posto
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="brinde-enabled">Habilitar Brinde</Label>
                <Switch
                  id="brinde-enabled"
                  checked={brindeEnabled}
                  onCheckedChange={setBrindeEnabled}
                />
              </div>

              {brindeEnabled && (
                <div>
                  <Label htmlFor="brinde-value">Valor do Brinde (R$)</Label>
                  <Input
                    id="brinde-value"
                    type="number"
                    step="0.0001"
                    value={brindeValue}
                    onChange={(e) => setBrindeValue(e.target.value)}
                    placeholder="0.0000"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Valor fixo em reais (até 4 casas decimais)
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={saveBrinde}>
                <Save className="h-4 w-4 mr-2" />
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de adicionar cliente */}
        <Dialog open={addClientDialogOpen} onOpenChange={setAddClientDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Novo Cliente</DialogTitle>
              <DialogDescription>
                Preencha os dados do cliente
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="client-id">ID do Cliente</Label>
                <Input
                  id="client-id"
                  value={newClientId}
                  onChange={(e) => setNewClientId(e.target.value)}
                  placeholder="Ex: 123456"
                />
              </div>

              <div>
                <Label htmlFor="client-name">Nome</Label>
                <Input
                  id="client-name"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="Nome do cliente"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setAddClientDialogOpen(false);
                setNewClientName('');
                setNewClientId('');
              }}>
                Cancelar
              </Button>
              <Button onClick={addClient}>
                <Save className="h-4 w-4 mr-2" />
                Adicionar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de adicionar tipo de pagamento */}
        <Dialog open={addPaymentMethodDialogOpen} onOpenChange={setAddPaymentMethodDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Novo Tipo de Pagamento</DialogTitle>
              <DialogDescription>
                Preencha os dados do tipo de pagamento
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="payment-card">Nome</Label>
                <Input
                  id="payment-card"
                  value={newPaymentCard}
                  onChange={(e) => setNewPaymentCard(e.target.value)}
                  placeholder="Ex: Pro Frotas"
                />
              </div>

              <div>
                <Label htmlFor="payment-taxa">Taxa (%)</Label>
                <Input
                  id="payment-taxa"
                  type="number"
                  step="0.01"
                  value={newPaymentTaxa}
                  onChange={(e) => setNewPaymentTaxa(e.target.value)}
                  placeholder="Ex: 2.5"
                />
              </div>

              <div>
                <Label htmlFor="payment-prazo">Prazo (dias)</Label>
                <Input
                  id="payment-prazo"
                  value={newPaymentPrazo}
                  onChange={(e) => setNewPaymentPrazo(e.target.value)}
                  placeholder="Ex: 28"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="apply-all"
                    checked={!!applyToAllStations}
                    onCheckedChange={(checked) => setApplyToAllStations(checked === true)}
                  />
                  <Label
                    htmlFor="apply-all"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Aplicar para todos os postos
                  </Label>
                </div>

                {!applyToAllStations && (
                  <div>
                    <Label htmlFor="payment-posto">Selecione o Posto</Label>
                    <Select value={newPaymentPostoId} onValueChange={setNewPaymentPostoId}>
                      <SelectTrigger id="payment-posto">
                        <SelectValue placeholder="Selecione um posto" />
                      </SelectTrigger>
                      <SelectContent>
                        {stations.map((station, index) => {
                          const key = station.id || station.cnpj_cpf || index;
                          return (
                            <SelectItem key={key} value={String(station.id)}>
                              {station.nome_empresa} {station.cnpj_cpf ? `(${station.cnpj_cpf})` : ''}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setAddPaymentMethodDialogOpen(false);
                setNewPaymentCard('');
                setNewPaymentTaxa('');
                setNewPaymentPrazo('');
                setNewPaymentPostoId('');
                setApplyToAllStations(false);
              }}>
                Cancelar
              </Button>
              <Button onClick={addPaymentMethod}>
                <Save className="h-4 w-4 mr-2" />
                Adicionar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de detalhes do cliente */}
        <Dialog open={clientDetailsDialogOpen} onOpenChange={setClientDetailsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Detalhes do Cliente</DialogTitle>
              <DialogDescription>
                Informações completas do cliente
              </DialogDescription>
            </DialogHeader>

            {selectedClient && (
              <div className="space-y-4 py-4">
                <div>
                  <Label className="text-sm font-semibold">Nome</Label>
                  <p className="text-base">{selectedClient.nome}</p>
                </div>
                <div>
                  <Label className="text-sm font-semibold">ID do Cliente</Label>
                  <p className="text-base">{selectedClient.id_cliente}</p>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setClientDetailsDialogOpen(false);
                setSelectedClient(null);
              }}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de edição de método de pagamento */}
        <Dialog open={editPaymentMethodDialogOpen} onOpenChange={setEditPaymentMethodDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Método de Pagamento</DialogTitle>
              <DialogDescription>
                Atualize os dados do método de pagamento
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="edit-payment-card">Nome</Label>
                <Input
                  id="edit-payment-card"
                  value={editPaymentCard}
                  onChange={(e) => setEditPaymentCard(e.target.value)}
                  placeholder="Ex: Pro Frotas"
                />
              </div>

              <div>
                <Label htmlFor="edit-payment-taxa">Taxa (%)</Label>
                <Input
                  id="edit-payment-taxa"
                  type="number"
                  step="0.01"
                  value={editPaymentTaxa}
                  onChange={(e) => setEditPaymentTaxa(e.target.value)}
                  placeholder="Ex: 2.5"
                />
              </div>

              <div>
                <Label htmlFor="edit-payment-prazo">Prazo (dias)</Label>
                <Input
                  id="edit-payment-prazo"
                  value={editPaymentPrazo}
                  onChange={(e) => setEditPaymentPrazo(e.target.value)}
                  placeholder="Ex: 28"
                />
              </div>

              {selectedPaymentMethod && (
                <div>
                  <Label className="text-sm font-semibold">Posto</Label>
                  <p className="text-base">{getStationName(selectedPaymentMethod.ID_POSTO)}</p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setEditPaymentMethodDialogOpen(false);
                setSelectedPaymentMethod(null);
                setEditPaymentCard('');
                setEditPaymentTaxa('');
                setEditPaymentPrazo('');
              }}>
                Cancelar
              </Button>
              <Button onClick={saveEditPaymentMethod}>
                <Save className="h-4 w-4 mr-2" />
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}


// StationManagement - Gestão de Postos
import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Building2, 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Filter,
  MapPin,
  Phone,
  Mail,
  CheckCircle,
  XCircle,
  AlertCircle,
  Fuel,
  Users,
  Map
} from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

interface Posto {
  id: string
  nome: string
  tipo: 'proprio' | 'concorrente'
  endereco?: string
  cidade?: string
  estado?: string
  cep?: string
  telefone?: string
  email?: string
  bandeira?: string
  rede?: string
  latitude?: number
  longitude?: number
  ativo: boolean
  created_at: string
  updated_at: string
}

export default function StationManagementWithTabs() {
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [postos, setPostos] = useState<Posto[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all')
  const [filterTipo, setFilterTipo] = useState<'all' | 'proprio' | 'concorrente'>('all')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingPosto, setEditingPosto] = useState<Posto | null>(null)
  const [activeTab, setActiveTab] = useState('proprios')
  
  // Estados do formulário
  const [formData, setFormData] = useState({
    nome: '',
    tipo: 'proprio' as 'proprio' | 'concorrente',
    endereco: '',
    cidade: '',
    estado: '',
    cep: '',
    telefone: '',
    email: '',
    bandeira: '',
    rede: '',
    latitude: '',
    longitude: '',
    ativo: true
  })

  // Carregar postos
  const loadPostos = async () => {
    try {
      setLoading(true)
      
      // Carregar postos próprios
      const { data: proprios, error: errorProprios } = await supabase
        .from('sis_empresa')
        .select('*')
        .order('created_at', { ascending: false })

      if (errorProprios) {
        console.error('Erro ao carregar postos próprios:', errorProprios)
        toast.error('Erro ao carregar postos próprios')
        return
      }

      // Carregar concorrentes
      const { data: concorrentes, error: errorConcorrentes } = await supabase
        .from('concorrentes')
        .select('*')
        .order('created_at', { ascending: false })

      if (errorConcorrentes) {
        console.error('Erro ao carregar concorrentes:', errorConcorrentes)
        toast.error('Erro ao carregar concorrentes')
        return
      }

      // Combinar os dados
      const postosProprios = (proprios || []).map(p => ({ ...p, tipo: 'proprio' as const }))
      const postosConcorrentes = (concorrentes || []).map(p => ({ ...p, tipo: 'concorrente' as const }))
      
      setPostos([...postosProprios, ...postosConcorrentes] as Posto[])
    } catch (error) {
      console.error('Erro ao carregar postos:', error)
      toast.error('Erro ao carregar postos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPostos()
  }, [])

  // Filtrar postos
  const filteredPostos = postos.filter(posto => {
    const matchesSearch = posto.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         posto.cidade?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         posto.bandeira?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         posto.rede?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesActive = filterActive === 'all' || 
                         (filterActive === 'active' && posto.ativo) ||
                         (filterActive === 'inactive' && !posto.ativo)
    
    const matchesTipo = filterTipo === 'all' || posto.tipo === filterTipo
    
    return matchesSearch && matchesActive && matchesTipo
  })

  // Limpar formulário
  const clearForm = () => {
    setFormData({
      nome: '',
      tipo: 'proprio',
      endereco: '',
      cidade: '',
      estado: '',
      cep: '',
      telefone: '',
      email: '',
      bandeira: '',
      rede: '',
      latitude: '',
      longitude: '',
      ativo: true
    })
    setEditingPosto(null)
  }

  // Editar posto
  const handleEdit = (posto: Posto) => {
    setFormData({
      nome: posto.nome,
      tipo: posto.tipo,
      endereco: posto.endereco || '',
      cidade: posto.cidade || '',
      estado: posto.estado || '',
      cep: posto.cep || '',
      telefone: posto.telefone || '',
      email: posto.email || '',
      bandeira: posto.bandeira || '',
      rede: posto.rede || '',
      latitude: posto.latitude?.toString() || '',
      longitude: posto.longitude?.toString() || '',
      ativo: posto.ativo
    })
    setEditingPosto(posto)
    setIsDialogOpen(true)
  }

  // Salvar posto
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.nome.trim()) {
      toast.error('Nome é obrigatório')
      return
    }

    try {
      setSubmitting(true)
      
      const dataToSave = {
        nome: formData.nome.trim(),
        endereco: formData.endereco.trim() || null,
        cidade: formData.cidade.trim() || null,
        estado: formData.estado.trim() || null,
        cep: formData.cep.trim() || null,
        telefone: formData.telefone.trim() || null,
        email: formData.email.trim() || null,
        bandeira: formData.bandeira.trim() || null,
        rede: formData.rede.trim() || null,
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
        ativo: formData.ativo,
        updated_at: new Date().toISOString()
      }

      if (editingPosto) {
        // Atualizar
        const tableName = editingPosto.tipo === 'proprio' ? 'sis_empresa' : 'concorrentes'
        const { error } = await supabase
          .from(tableName as any)
          .update(dataToSave as any)
          .eq('id', editingPosto.id)

        if (error) {
          console.error('Erro ao atualizar posto:', error)
          toast.error('Erro ao atualizar posto')
          return
        }

        toast.success('Posto atualizado com sucesso!')
      } else {
        // Criar
        const tableName = formData.tipo === 'proprio' ? 'sis_empresa' : 'concorrentes'
        const { error } = await supabase
          .from(tableName as any)
          .insert([dataToSave] as any)

        if (error) {
          console.error('Erro ao criar posto:', error)
          toast.error('Erro ao criar posto')
          return
        }

        toast.success('Posto criado com sucesso!')
      }

      setIsDialogOpen(false)
      clearForm()
      loadPostos()
    } catch (error) {
      console.error('Erro ao salvar posto:', error)
      toast.error('Erro ao salvar posto')
    } finally {
      setSubmitting(false)
    }
  }

  // Excluir posto
  const handleDelete = async (id: string, tipo: 'proprio' | 'concorrente') => {
    if (!confirm('Tem certeza que deseja excluir este posto?')) {
      return
    }

    try {
      const tableName = tipo === 'proprio' ? 'sis_empresa' : 'concorrentes'
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', id)

      if (error) {
        console.error('Erro ao excluir posto:', error)
        toast.error('Erro ao excluir posto')
        return
      }

      toast.success('Posto excluído com sucesso!')
      loadPostos()
    } catch (error) {
      console.error('Erro ao excluir posto:', error)
      toast.error('Erro ao excluir posto')
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Gestão de Postos</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Gerencie postos próprios e concorrentes
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={clearForm} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Adicionar Posto
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingPosto ? 'Editar Posto' : 'Adicionar Posto'}
              </DialogTitle>
              <DialogDescription>
                {editingPosto ? 'Atualize as informações do posto' : 'Preencha as informações do novo posto'}
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="nome">Nome *</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="Nome do posto"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="tipo">Tipo</Label>
                  <Select value={formData.tipo} onValueChange={(value: any) => setFormData({ ...formData, tipo: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="proprio">Próprio</SelectItem>
                      <SelectItem value="concorrente">Concorrente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="endereco">Endereço</Label>
                  <Input
                    id="endereco"
                    value={formData.endereco}
                    onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                    placeholder="Endereço completo"
                  />
                </div>
                
                <div>
                  <Label htmlFor="cidade">Cidade</Label>
                  <Input
                    id="cidade"
                    value={formData.cidade}
                    onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                    placeholder="Cidade"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="estado">Estado</Label>
                  <Input
                    id="estado"
                    value={formData.estado}
                    onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                    placeholder="UF"
                  />
                </div>
                
                <div>
                  <Label htmlFor="cep">CEP</Label>
                  <Input
                    id="cep"
                    value={formData.cep}
                    onChange={(e) => setFormData({ ...formData, cep: e.target.value })}
                    placeholder="00000-000"
                  />
                </div>
                
                <div>
                  <Label htmlFor="telefone">Telefone</Label>
                  <Input
                    id="telefone"
                    value={formData.telefone}
                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@exemplo.com"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="bandeira">Bandeira</Label>
                  <Input
                    id="bandeira"
                    value={formData.bandeira}
                    onChange={(e) => setFormData({ ...formData, bandeira: e.target.value })}
                    placeholder="Ex: Shell, Petrobras"
                  />
                </div>
                
                <div>
                  <Label htmlFor="rede">Rede</Label>
                  <Input
                    id="rede"
                    value={formData.rede}
                    onChange={(e) => setFormData({ ...formData, rede: e.target.value })}
                    placeholder="Ex: Rede Nacional"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="latitude">Latitude</Label>
                  <Input
                    id="latitude"
                    type="number"
                    step="any"
                    value={formData.latitude}
                    onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                    placeholder="-23.5505"
                  />
                </div>
                
                <div>
                  <Label htmlFor="longitude">Longitude</Label>
                  <Input
                    id="longitude"
                    type="number"
                    step="any"
                    value={formData.longitude}
                    onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                    placeholder="-46.6333"
                  />
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="ativo"
                  checked={formData.ativo}
                  onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="ativo">Ativo</Label>
              </div>
              
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Salvando...' : editingPosto ? 'Atualizar' : 'Criar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Label htmlFor="search">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="search"
                  placeholder="Buscar por nome, cidade, bandeira ou rede..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="sm:w-48">
              <Label htmlFor="filter">Filtrar por Status</Label>
              <Select value={filterActive} onValueChange={(value: any) => setFilterActive(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Ativos</SelectItem>
                  <SelectItem value="inactive">Inativos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="sm:w-48">
              <Label htmlFor="tipo">Filtrar por Tipo</Label>
              <Select value={filterTipo} onValueChange={(value: any) => setFilterTipo(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="proprio">Próprios</SelectItem>
                  <SelectItem value="concorrente">Concorrentes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Guias */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="proprios" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Postos Próprios
          </TabsTrigger>
          <TabsTrigger value="concorrentes" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Concorrentes
          </TabsTrigger>
        </TabsList>

        {/* Guia Postos Próprios */}
        <TabsContent value="proprios">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Postos Próprios
              </CardTitle>
              <CardDescription>
                Lista dos postos próprios cadastrados
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Localização</TableHead>
                      <TableHead>Contato</TableHead>
                      <TableHead>Bandeira/Rede</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Criado em</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPostos.filter(posto => posto.tipo === 'proprio').map((posto) => (
                      <TableRow key={`${posto.tipo}-${posto.id}`}>
                        <TableCell className="font-medium">{posto.nome}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {posto.endereco && (
                              <div className="flex items-center gap-1 text-sm">
                                <MapPin className="h-3 w-3" />
                                {posto.endereco}
                              </div>
                            )}
                            {posto.cidade && posto.estado && (
                              <div className="text-sm text-gray-500">
                                {posto.cidade}, {posto.estado}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {posto.telefone && (
                              <div className="flex items-center gap-1 text-sm">
                                <Phone className="h-3 w-3" />
                                {posto.telefone}
                              </div>
                            )}
                            {posto.email && (
                              <div className="flex items-center gap-1 text-sm">
                                <Mail className="h-3 w-3" />
                                {posto.email}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {posto.bandeira && (
                              <div className="text-sm font-medium">{posto.bandeira}</div>
                            )}
                            {posto.rede && (
                              <div className="text-sm text-gray-500">{posto.rede}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={posto.ativo ? "default" : "secondary"}>
                            {posto.ativo ? (
                              <div className="flex items-center gap-1">
                                <CheckCircle className="h-3 w-3" />
                                Ativo
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                <XCircle className="h-3 w-3" />
                                Inativo
                              </div>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(posto.created_at).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(posto)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(posto.id, posto.tipo)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Guia Concorrentes */}
        <TabsContent value="concorrentes">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Concorrentes
              </CardTitle>
              <CardDescription>
                Lista dos postos concorrentes cadastrados
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Localização</TableHead>
                      <TableHead>Contato</TableHead>
                      <TableHead>Bandeira/Rede</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Criado em</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPostos.filter(posto => posto.tipo === 'concorrente').map((posto) => (
                      <TableRow key={`${posto.tipo}-${posto.id}`}>
                        <TableCell className="font-medium">{posto.nome}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {posto.endereco && (
                              <div className="flex items-center gap-1 text-sm">
                                <MapPin className="h-3 w-3" />
                                {posto.endereco}
                              </div>
                            )}
                            {posto.cidade && posto.estado && (
                              <div className="text-sm text-gray-500">
                                {posto.cidade}, {posto.estado}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {posto.telefone && (
                              <div className="flex items-center gap-1 text-sm">
                                <Phone className="h-3 w-3" />
                                {posto.telefone}
                              </div>
                            )}
                            {posto.email && (
                              <div className="flex items-center gap-1 text-sm">
                                <Mail className="h-3 w-3" />
                                {posto.email}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {posto.bandeira && (
                              <div className="text-sm font-medium">{posto.bandeira}</div>
                            )}
                            {posto.rede && (
                              <div className="text-sm text-gray-500">{posto.rede}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={posto.ativo ? "default" : "secondary"}>
                            {posto.ativo ? (
                              <div className="flex items-center gap-1">
                                <CheckCircle className="h-3 w-3" />
                                Ativo
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                <XCircle className="h-3 w-3" />
                                Inativo
                              </div>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(posto.created_at).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(posto)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(posto.id, posto.tipo)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

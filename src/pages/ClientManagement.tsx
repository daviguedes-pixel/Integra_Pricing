// ClientManagement - Gestão de Clientes
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
  Users, 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Filter,
  Building2,
  Mail,
  Phone,
  MapPin,
  CheckCircle,
  XCircle,
  AlertCircle,
  User
} from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

interface Cliente {
  id: string
  nome: string
  cnpj?: string
  contato_email?: string
  contato_telefone?: string
  endereco?: string
  cidade?: string
  estado?: string
  cep?: string
  ativo: boolean
  created_at: string
  updated_at: string
}

export default function ClientManagementWithTabs() {
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null)
  const [activeTab, setActiveTab] = useState('ativos')
  
  // Estados do formulário
  const [formData, setFormData] = useState({
    nome: '',
    cnpj: '',
    contato_email: '',
    contato_telefone: '',
    endereco: '',
    cidade: '',
    estado: '',
    cep: '',
    ativo: true
  })

  // Carregar clientes
  const loadClientes = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('cliente' as any)
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Erro ao carregar clientes:', error)
        toast.error('Erro ao carregar clientes')
        return
      }

      setClientes((data || []) as Cliente[])
    } catch (error) {
      console.error('Erro ao carregar clientes:', error)
      toast.error('Erro ao carregar clientes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadClientes()
  }, [])

  // Filtrar clientes
  const filteredClientes = clientes.filter(cliente => {
    const matchesSearch = cliente.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         cliente.cnpj?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         cliente.cidade?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         cliente.contato_email?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesActive = filterActive === 'all' || 
                         (filterActive === 'active' && cliente.ativo) ||
                         (filterActive === 'inactive' && !cliente.ativo)
    
    return matchesSearch && matchesActive
  })

  // Formatar CNPJ
  const formatCNPJ = (cnpj: string) => {
    return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  }

  // Validar CNPJ
  const validateCNPJ = (cnpj: string) => {
    const cleanCNPJ = cnpj.replace(/\D/g, '')
    
    if (cleanCNPJ.length !== 14) return false
    
    // Verificar se todos os dígitos são iguais
    if (/^(\d)\1+$/.test(cleanCNPJ)) return false
    
    // Calcular primeiro dígito verificador
    let sum = 0
    let weight = 5
    
    for (let i = 0; i < 12; i++) {
      sum += parseInt(cleanCNPJ[i]) * weight
      weight = weight === 2 ? 9 : weight - 1
    }
    
    const firstDigit = sum % 11 < 2 ? 0 : 11 - (sum % 11)
    
    if (parseInt(cleanCNPJ[12]) !== firstDigit) return false
    
    // Calcular segundo dígito verificador
    sum = 0
    weight = 6
    
    for (let i = 0; i < 13; i++) {
      sum += parseInt(cleanCNPJ[i]) * weight
      weight = weight === 2 ? 9 : weight - 1
    }
    
    const secondDigit = sum % 11 < 2 ? 0 : 11 - (sum % 11)
    
    return parseInt(cleanCNPJ[13]) === secondDigit
  }

  // Limpar formulário
  const clearForm = () => {
    setFormData({
      nome: '',
      cnpj: '',
      contato_email: '',
      contato_telefone: '',
      endereco: '',
      cidade: '',
      estado: '',
      cep: '',
      ativo: true
    })
    setEditingCliente(null)
  }

  // Editar cliente
  const handleEdit = (cliente: Cliente) => {
      setFormData({
        nome: cliente.nome,
        cnpj: cliente.cnpj || '',
        contato_email: cliente.contato_email || '',
        contato_telefone: cliente.contato_telefone || '',
        endereco: cliente.endereco || '',
        cidade: cliente.cidade || '',
        estado: cliente.estado || '',
        cep: cliente.cep || '',
        ativo: cliente.ativo
      })
    setEditingCliente(cliente)
    setIsDialogOpen(true)
  }

  // Salvar cliente
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validação com Zod
    const { validateWithSchema, getValidationErrors, clientSchema } = await import('@/lib/validations');
    const validation = validateWithSchema(clientSchema, {
      nome: formData.nome,
      cnpj: formData.cnpj,
      email: formData.contato_email,
      telefone: formData.contato_telefone,
      endereco: formData.endereco,
    });
    
    if (!validation.success) {
      const errors = getValidationErrors(validation.errors);
      const firstError = Object.values(errors)[0];
      toast.error(firstError || 'Por favor, corrija os erros no formulário');
      return;
    }

    if (formData.cnpj && !validateCNPJ(formData.cnpj)) {
      toast.error('CNPJ inválido')
      return
    }

    try {
      setSubmitting(true)
      
      const dataToSave = {
        nome: formData.nome.trim(),
        cnpj: formData.cnpj.trim() || null,
        contato_email: formData.contato_email.trim() || null,
        contato_telefone: formData.contato_telefone.trim() || null,
        endereco: formData.endereco.trim() || null,
        cidade: formData.cidade.trim() || null,
        estado: formData.estado.trim() || null,
        cep: formData.cep.trim() || null,
        ativo: formData.ativo,
        updated_at: new Date().toISOString()
      }

      if (editingCliente) {
        // Atualizar
        const { error } = await supabase
          .from('cliente' as any)
          .update(dataToSave as any)
          .eq('id', editingCliente.id)

        if (error) {
          console.error('Erro ao atualizar cliente:', error)
          toast.error('Erro ao atualizar cliente')
          return
        }

        toast.success('Cliente atualizado com sucesso!')
      } else {
        // Criar
        const { error } = await supabase
          .from('cliente' as any)
          .insert([dataToSave] as any)

        if (error) {
          console.error('Erro ao criar cliente:', error)
          toast.error('Erro ao criar cliente')
          return
        }

        toast.success('Cliente criado com sucesso!')
      }

      setIsDialogOpen(false)
      clearForm()
      loadClientes()
    } catch (error) {
      console.error('Erro ao salvar cliente:', error)
      toast.error('Erro ao salvar cliente')
    } finally {
      setSubmitting(false)
    }
  }

  // Excluir cliente
  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este cliente?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('cliente' as any)
        .delete()
        .eq('id', id)

      if (error) {
        console.error('Erro ao excluir cliente:', error)
        toast.error('Erro ao excluir cliente')
        return
      }

      toast.success('Cliente excluído com sucesso!')
      loadClientes()
    } catch (error) {
      console.error('Erro ao excluir cliente:', error)
      toast.error('Erro ao excluir cliente')
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Gestão de Clientes</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Gerencie clientes cadastrados
          </p>
        </div>

        <Button onClick={() => handleEdit({} as Cliente)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Adicionar Cliente
        </Button>
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
                  placeholder="Buscar por nome, CNPJ, cidade ou email..."
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
            </div>
          </CardContent>
        </Card>

      {/* Guias */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="ativos" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Ativos
          </TabsTrigger>
          <TabsTrigger value="inativos" className="flex items-center gap-2">
            <XCircle className="h-4 w-4" />
            Inativos
          </TabsTrigger>
        </TabsList>

        {/* Guia Ativos */}
        <TabsContent value="ativos">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Clientes Ativos
            </CardTitle>
            <CardDescription>
                Lista dos clientes ativos
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
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Localização</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredClientes.filter(cliente => cliente.ativo).map((cliente) => (
                    <TableRow key={cliente.id}>
                      <TableCell className="font-medium">{cliente.nome}</TableCell>
                      <TableCell>{cliente.cnpj ? formatCNPJ(cliente.cnpj) : '-'}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {cliente.contato_email && (
                            <div className="flex items-center gap-1 text-sm">
                              <Mail className="h-3 w-3" />
                              {cliente.contato_email}
                            </div>
                          )}
                          {cliente.contato_telefone && (
                            <div className="flex items-center gap-1 text-sm">
                              <Phone className="h-3 w-3" />
                              {cliente.contato_telefone}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                            {cliente.endereco && (
                            <div className="flex items-center gap-1 text-sm">
                              <MapPin className="h-3 w-3" />
                                {cliente.endereco}
                            </div>
                          )}
                            {cliente.cidade && cliente.estado && (
                            <div className="text-sm text-gray-500">
                                {cliente.cidade}, {cliente.estado}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                          <Badge variant="default">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Ativo
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(cliente.created_at).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                              onClick={() => handleEdit(cliente)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                              onClick={() => handleDelete(cliente.id)}
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
              
              {!loading && filteredClientes.filter(cliente => cliente.ativo).length === 0 && (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">Nenhum cliente ativo encontrado</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Guia Inativos */}
        <TabsContent value="inativos">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <XCircle className="h-5 w-5" />
                Clientes Inativos
              </CardTitle>
              <CardDescription>
                Lista dos clientes inativos
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
                      <TableHead>CNPJ</TableHead>
                      <TableHead>Contato</TableHead>
                      <TableHead>Localização</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Criado em</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClientes.filter(cliente => !cliente.ativo).map((cliente) => (
                      <TableRow key={cliente.id}>
                        <TableCell className="font-medium">{cliente.nome}</TableCell>
                        <TableCell>{cliente.cnpj ? formatCNPJ(cliente.cnpj) : '-'}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {cliente.contato_email && (
                              <div className="flex items-center gap-1 text-sm">
                                <Mail className="h-3 w-3" />
                                {cliente.contato_email}
                              </div>
                            )}
                            {cliente.contato_telefone && (
                              <div className="flex items-center gap-1 text-sm">
                                <Phone className="h-3 w-3" />
                                {cliente.contato_telefone}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {cliente.endereco && (
                              <div className="flex items-center gap-1 text-sm">
                                <MapPin className="h-3 w-3" />
                                {cliente.endereco}
                              </div>
                            )}
                            {cliente.cidade && cliente.estado && (
                              <div className="text-sm text-gray-500">
                                {cliente.cidade}, {cliente.estado}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            <XCircle className="h-3 w-3 mr-1" />
                            Inativo
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(cliente.created_at).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(cliente)}
                            >
                              <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(cliente.id)}
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
            
              {!loading && filteredClientes.filter(cliente => !cliente.ativo).length === 0 && (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">Nenhum cliente inativo encontrado</p>
              </div>
            )}
          </CardContent>
        </Card>
        </TabsContent>
      </Tabs>

        {/* Dialog para criar/editar */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
              {editingCliente ? 'Editar Cliente' : 'Adicionar Cliente'}
              </DialogTitle>
              <DialogDescription>
              {editingCliente ? 'Atualize as informações do cliente' : 'Preencha as informações do novo cliente'}
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
                    placeholder="Nome do cliente"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="cnpj">CNPJ</Label>
                  <Input
                    id="cnpj"
                    value={formData.cnpj}
                    onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                    placeholder="00.000.000/0000-00"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                <Label htmlFor="email">Email</Label>
                  <Input
                  id="email"
                    type="email"
                    value={formData.contato_email}
                    onChange={(e) => setFormData({ ...formData, contato_email: e.target.value })}
                    placeholder="email@exemplo.com"
                  />
                </div>
                
                <div>
                <Label htmlFor="telefone">Telefone</Label>
                  <Input
                  id="telefone"
                    value={formData.contato_telefone}
                    onChange={(e) => setFormData({ ...formData, contato_telefone: e.target.value })}
                  placeholder="(00) 00000-0000"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="endereco">Endereço</Label>
                <Input
                  id="endereco"
                  value={formData.endereco}
                  onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                placeholder="Endereço completo"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="cidade">Cidade</Label>
                  <Input
                    id="cidade"
                    value={formData.cidade}
                    onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                    placeholder="Cidade"
                  />
                </div>
                
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
                  {submitting ? 'Salvando...' : editingCliente ? 'Atualizar' : 'Criar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
    </div>
  )
}

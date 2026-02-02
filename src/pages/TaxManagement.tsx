// TaxManagement - Gestão de Impostos e Taxas
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
  CreditCard, 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Filter,
  DollarSign,
  Calendar,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { formatBrazilianCurrency } from '@/lib/utils'

interface TipoPagamento {
  id: string
  nome: string
  descricao?: string
  taxa_percentual: number
  dias_pagamento: number
  ativo: boolean
  created_at: string
  updated_at: string
}

export default function TaxManagementWithTabs() {
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [tiposPagamento, setTiposPagamento] = useState<TipoPagamento[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingTipo, setEditingTipo] = useState<TipoPagamento | null>(null)
  const [activeTab, setActiveTab] = useState('ativos')
  
  // Estados do formulário
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    taxa_percentual: '',
    dias_pagamento: '',
    ativo: true
  })

  // Carregar tipos de pagamento
  const loadTiposPagamento = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('tipos_pagamento')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Erro ao carregar tipos de pagamento:', error)
        toast.error('Erro ao carregar tipos de pagamento')
        return
      }

      // Map database fields to TipoPagamento interface
      const mapped = (data || []).map((item: Record<string, unknown>) => ({
        id: String(item.id || ''),
        nome: String(item.CARTAO || item.nome || ''),
        descricao: String(item.POSTO || item.descricao || ''),
        taxa_percentual: Number(item.TAXA || item.taxa_percentual || 0),
        dias_pagamento: Number(item.PRAZO || item.dias_pagamento || 0),
        ativo: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })) as TipoPagamento[];
      setTiposPagamento(mapped)
    } catch (error) {
      console.error('Erro ao carregar tipos de pagamento:', error)
      toast.error('Erro ao carregar tipos de pagamento')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTiposPagamento()
  }, [])

  // Filtrar tipos de pagamento
  const filteredTipos = tiposPagamento.filter(tipo => {
    const matchesSearch = tipo.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         tipo.descricao?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesActive = filterActive === 'all' || 
                         (filterActive === 'active' && tipo.ativo) ||
                         (filterActive === 'inactive' && !tipo.ativo)
    
    return matchesSearch && matchesActive
  })

  // Limpar formulário
  const clearForm = () => {
    setFormData({
      nome: '',
      descricao: '',
      taxa_percentual: '',
      dias_pagamento: '',
      ativo: true
    })
    setEditingTipo(null)
  }

  // Abrir dialog
  const openDialog = (tipo?: TipoPagamento) => {
    if (tipo) {
      setFormData({
        nome: tipo.nome,
        descricao: tipo.descricao || '',
        taxa_percentual: tipo.taxa_percentual.toString(),
        dias_pagamento: tipo.dias_pagamento.toString(),
        ativo: tipo.ativo
      })
      setEditingTipo(tipo)
    } else {
      clearForm()
    }
    setIsDialogOpen(true)
  }

  // Salvar tipo de pagamento
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.nome.trim()) {
      toast.error('Nome é obrigatório')
      return
    }

    if (!formData.taxa_percentual || parseFloat(formData.taxa_percentual) < 0) {
      toast.error('Taxa percentual deve ser um número válido')
      return
    }

    if (!formData.dias_pagamento || parseInt(formData.dias_pagamento) < 0) {
      toast.error('Prazo de pagamento deve ser um número válido')
      return
    }

    try {
      setSubmitting(true)
      
      const dataToSave = {
        nome: formData.nome.trim(),
        descricao: formData.descricao.trim() || null,
        taxa_percentual: parseFloat(formData.taxa_percentual),
        dias_pagamento: parseInt(formData.dias_pagamento),
        ativo: formData.ativo,
        updated_at: new Date().toISOString()
      }

      if (editingTipo) {
        // Atualizar
        const { error } = await supabase
          .from('tipos_pagamento' as any)
          .update(dataToSave as any)
          .eq('id', editingTipo.id)

        if (error) {
          console.error('Erro ao atualizar tipo de pagamento:', error)
          toast.error('Erro ao atualizar tipo de pagamento')
          return
        }

        toast.success('Tipo de pagamento atualizado com sucesso!')
      } else {
        // Criar
        const { error } = await supabase
          .from('tipos_pagamento' as any)
          .insert([dataToSave] as any)

        if (error) {
          console.error('Erro ao criar tipo de pagamento:', error)
          toast.error('Erro ao criar tipo de pagamento')
          return
        }

        toast.success('Tipo de pagamento criado com sucesso!')
      }

      setIsDialogOpen(false)
      clearForm()
      loadTiposPagamento()
    } catch (error) {
      console.error('Erro ao salvar tipo de pagamento:', error)
      toast.error('Erro ao salvar tipo de pagamento')
    } finally {
      setSubmitting(false)
    }
  }

  // Alternar status
  const toggleStatus = async (tipo: TipoPagamento) => {
    try {
      const { error } = await supabase
        .from('tipos_pagamento' as any)
        .update({ ativo: !tipo.ativo, updated_at: new Date().toISOString() } as any)
        .eq('id', tipo.id as any)

      if (error) {
        console.error('Erro ao alterar status:', error)
        toast.error('Erro ao alterar status')
        return
      }

      toast.success(`Tipo de pagamento ${!tipo.ativo ? 'ativado' : 'desativado'} com sucesso!`)
      loadTiposPagamento()
    } catch (error) {
      console.error('Erro ao alterar status:', error)
      toast.error('Erro ao alterar status')
    }
  }

  // Excluir tipo de pagamento
  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este tipo de pagamento?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('tipos_pagamento')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('Erro ao excluir tipo de pagamento:', error)
        toast.error('Erro ao excluir tipo de pagamento')
        return
      }

      toast.success('Tipo de pagamento excluído com sucesso!')
      loadTiposPagamento()
    } catch (error) {
      console.error('Erro ao excluir tipo de pagamento:', error)
      toast.error('Erro ao excluir tipo de pagamento')
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Gestão de Taxas</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Gerencie tipos de pagamento e suas taxas
          </p>
        </div>
        
        <Button onClick={() => openDialog()} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Adicionar Tipo
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
                  placeholder="Buscar por nome ou descrição..."
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
                Tipos de Pagamento Ativos
              </CardTitle>
              <CardDescription>
                Lista dos tipos de pagamento ativos
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
                      <TableHead>Descrição</TableHead>
                      <TableHead>Taxa (%)</TableHead>
                      <TableHead>Prazo (dias)</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Criado em</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTipos.filter(tipo => tipo.ativo).map((tipo) => (
                      <TableRow key={tipo.id}>
                        <TableCell className="font-medium">{tipo.nome}</TableCell>
                        <TableCell>{tipo.descricao || '-'}</TableCell>
                        <TableCell>{tipo.taxa_percentual.toFixed(2)}%</TableCell>
                        <TableCell>{tipo.dias_pagamento}</TableCell>
                        <TableCell>
                          <Badge variant="default">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Ativo
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(tipo.created_at).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openDialog(tipo)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleStatus(tipo)}
                            >
                              <XCircle className="h-4 w-4 text-red-600" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(tipo.id)}
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
              
              {!loading && filteredTipos.filter(tipo => tipo.ativo).length === 0 && (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">Nenhum tipo de pagamento ativo encontrado</p>
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
                Tipos de Pagamento Inativos
              </CardTitle>
              <CardDescription>
                Lista dos tipos de pagamento inativos
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
                      <TableHead>Descrição</TableHead>
                      <TableHead>Taxa (%)</TableHead>
                      <TableHead>Prazo (dias)</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Criado em</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTipos.filter(tipo => !tipo.ativo).map((tipo) => (
                      <TableRow key={tipo.id}>
                        <TableCell className="font-medium">{tipo.nome}</TableCell>
                        <TableCell>{tipo.descricao || '-'}</TableCell>
                        <TableCell>{tipo.taxa_percentual.toFixed(2)}%</TableCell>
                        <TableCell>{tipo.dias_pagamento}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            <XCircle className="h-3 w-3 mr-1" />
                            Inativo
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(tipo.created_at).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openDialog(tipo)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleStatus(tipo)}
                            >
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(tipo.id)}
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
              
              {!loading && filteredTipos.filter(tipo => !tipo.ativo).length === 0 && (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">Nenhum tipo de pagamento inativo encontrado</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog para criar/editar */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingTipo ? 'Editar Tipo de Pagamento' : 'Adicionar Tipo de Pagamento'}
            </DialogTitle>
            <DialogDescription>
              {editingTipo ? 'Atualize as informações do tipo de pagamento' : 'Preencha as informações do novo tipo de pagamento'}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Ex: Cartão de Crédito"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                placeholder="Descrição do tipo de pagamento"
                rows={3}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="taxa">Taxa (%) *</Label>
                <Input
                  id="taxa"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.taxa_percentual}
                  onChange={(e) => setFormData({ ...formData, taxa_percentual: e.target.value })}
                  placeholder="0.00"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="prazo">Prazo (dias) *</Label>
                <Input
                  id="prazo"
                  type="number"
                  min="0"
                  value={formData.dias_pagamento}
                  onChange={(e) => setFormData({ ...formData, dias_pagamento: e.target.value })}
                  placeholder="0"
                  required
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
                {submitting ? 'Salvando...' : editingTipo ? 'Atualizar' : 'Criar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

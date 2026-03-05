import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ChevronDown, ChevronUp, Search, Filter, RefreshCw, MapPin, Clock, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { formatBrazilianCurrency } from '@/lib/utils'

interface CotacaoItem {
  id: string
  posto_nome: string
  posto_tipo: 'proprio' | 'concorrente'
  produto: string
  produto_normalizado?: string
  preco_referencia: number
  preco_pesquisa: number
  cidade: string
  estado: string
  latitude: number
  longitude: number
  data_atualizacao: string
  fonte: 'referencia' | 'pesquisa'
  expirado: boolean
}

interface QuotationTableProps {
  className?: string
  mode?: 'pesquisas' | 'referencias'
  sortByPrice?: 'asc' | 'desc' | null
  sortByUF?: 'asc' | 'desc' | null
  onSortPrice?: (order: 'asc' | 'desc' | null) => void
  onSortUF?: (order: 'asc' | 'desc' | null) => void
}

type SortField = 'posto_nome' | 'preco_pesquisa' | 'data_atualizacao'
type SortOrder = 'asc' | 'desc'

export default function QuotationTable({
  className,
  mode = 'pesquisas',
  sortByPrice,
  sortByUF,
  onSortPrice,
  onSortUF
}: QuotationTableProps) {
  const [loading, setLoading] = useState(false)
  const [cotacoes, setCotacoes] = useState<CotacaoItem[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRegion, setFilterRegion] = useState<string>('all')
  const [filterProduct, setFilterProduct] = useState<string>('all')
  const [showExpired, setShowExpired] = useState(false)
  const [sortField, setSortField] = useState<SortField>('data_atualizacao')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  // Carregar cotações
  const loadCotacoes = async () => {
    try {
      setLoading(true)

      console.log('🔍 Iniciando carregamento...', { mode })

      let cotacoesArray: any[] = []

      if (mode === 'referencias') {
        // Modo referências: buscar da tabela price_references (novo padrão)
        console.log('🔍 Modo referências - buscando da tabela price_references')

        const { data: referencias, error: refError } = await supabase
          .from('price_references')
          .select('*')
          .eq('ativo', true)
          .order('created_at', { ascending: false })

        console.log('🔍 Referências encontradas:', referencias?.length || 0, 'erro:', refError)

        if (refError) {
          console.error('Erro ao carregar referências:', refError)
          toast.error('Erro ao carregar referências')
        }

        // Processar mesmo se houver erro (pode ter dados parciais)
        if (referencias && referencias.length > 0) {
          // Buscar nomes dos postos dos concorrentes (mesmo padrão do mapa)
          const uniqueIds = Array.from(new Set(referencias.map((r: any) => r.posto_id))).filter(Boolean)

          let postoMap = new Map<string, string>()
          let ufMap = new Map<string, string>()
          let cidadeMap = new Map<string, string>()

          if (uniqueIds.length > 0) {
            // Tentar converter para números se necessário (id_posto pode ser numérico ou texto dependendo da fonte)
            const numericIds = uniqueIds.map((id: any) => Number(id)).filter((n: any) => !isNaN(n))

            // Buscar em concorrentes (mesmo padrão do mapa)
            const { data: concorrentes, error: concErr } = await supabase
              .from('concorrentes')
              .select('id_posto, razao_social, municipio, uf')
              .in('id_posto', (numericIds.length > 0 ? numericIds : uniqueIds) as any[])

            if (!concErr && concorrentes) {
              console.log('🔍 Concorrentes encontrados:', concorrentes.length)
              concorrentes.forEach((conc: any) => {
                const idKey = String(conc.id_posto)
                postoMap.set(idKey, conc.razao_social || 'Posto Desconhecido')
                if (conc.uf) ufMap.set(idKey, conc.uf)
                if (conc.municipio) cidadeMap.set(idKey, conc.municipio)
              })
            }

            // Buscar em sis_empresa (nossa rede) via RPC - retorna id_empresa, municipio, uf
            const { data: sisEmpresas } = await supabase.rpc('get_sis_empresa_stations')

            if (sisEmpresas) {
              (sisEmpresas as any[]).forEach((se: any) => {
                // Mapear por id_empresa e cnpj_cpf (ambos podem ser usados como posto_id)
                const possibleIds = [String(se.id_empresa), se.cnpj_cpf].filter(Boolean)
                possibleIds.forEach((seId: string) => {
                  if (uniqueIds.includes(seId)) {
                    const idKey = String(seId)
                    if (!postoMap.has(idKey)) postoMap.set(idKey, se.nome_empresa || 'Posto')
                    if (se.uf && !ufMap.has(idKey)) ufMap.set(idKey, se.uf)
                    if (se.municipio && !cidadeMap.has(idKey)) cidadeMap.set(idKey, se.municipio)
                  }
                })
              })
            }
          }

          // Buscar nomes dos clientes - buscar em AMBAS as tabelas (clients por UUID e clientes por id_cliente)
          const uniqueClientIds = Array.from(new Set(referencias.map((r: any) => r.cliente_id).filter(Boolean)));
          let clienteMap = new Map<string, string>();

          if (uniqueClientIds.length > 0) {
            // Buscar na tabela clients (pelo campo id - UUID)
            const { data: clientsList } = await supabase
              .from('clients')
              .select('id, name, id_cliente')
              .in('id', uniqueClientIds as any[]);

            if (clientsList) {
              clientsList.forEach((cl: any) => {
                clienteMap.set(String(cl.id), cl.name || cl.id_cliente || 'Cliente');
                if (cl.id_cliente) clienteMap.set(String(cl.id_cliente), cl.name || cl.id_cliente);
              });
            }

            // Buscar também na tabela clientes (pelo campo id_cliente - numérico)
            // Os IDs como 1360610682 são id_cliente da tabela clientes
            const numericIds = uniqueClientIds.filter(id => /^\d+$/.test(String(id)));
            if (numericIds.length > 0) {
              const { data: clientesList } = await supabase
                .from('clientes')
                .select('id_cliente, nome')
                .in('id_cliente', numericIds.map(Number) as any[]);

              if (clientesList) {
                clientesList.forEach((cl: any) => {
                  clienteMap.set(String(cl.id_cliente), cl.nome || 'Cliente');
                });
              }
            }
          }

          // Processar referências com lógica de substituição (apenas a mais recente por Cliente + Produto + Município)
          const substitutedMap = new Map<string, any>();

          referencias.forEach((ref: any) => {
            const idKey = String(ref.posto_id);
            const postoNome = postoMap.get(idKey) || ref.posto_id || 'Posto Desconhecido';
            const clienteNome = (ref.cliente_id && clienteMap.get(String(ref.cliente_id))) || postoNome;

            // Chave de substituição: Cliente (ou Posto se nulo) + Produto + Município
            const rawMunicipio = (ref.municipio || ref.cidade || cidadeMap.get(idKey) || '').trim().toLowerCase();
            const isValidMunicipio = rawMunicipio && rawMunicipio !== 'não identificado' && rawMunicipio !== 'sem_municipio';
            const municipioKey = isValidMunicipio ? rawMunicipio : `_unique_${ref.id}`;
            const substKey = `${ref.cliente_id || ref.posto_id}-${ref.produto}-${municipioKey}`;

            if (!substitutedMap.has(substKey)) {
              const estado = ref.uf || ufMap.get(idKey) || '';
              const cidade = ref.municipio || ref.cidade || cidadeMap.get(idKey) || '';

              substitutedMap.set(substKey, {
                id: ref.id,
                posto_nome: clienteNome, // Preferir nome do cliente
                posto_tipo: ref.cliente_id ? 'cliente' : 'concorrente' as const,
                produto: ref.produto,
                produto_normalizado: normalizeProduct(ref.produto),
                preco_referencia: Number(ref.preco) || 0,
                preco_pesquisa: Number(ref.preco) || 0,
                cidade: cidade,
                estado: estado,
                latitude: ref.latitude || 0,
                longitude: ref.longitude || 0,
                data_atualizacao: ref.created_at,
                fonte: 'referencia' as const,
                expirado: false
              });
            }
          });

          cotacoesArray = Array.from(substitutedMap.values());
        }
      } else {
        // Modo pesquisas: buscar de competitor_research
        console.log('🔍 Modo pesquisas - buscando de competitor_research')

        const { data: pesquisas, error: pesqError } = await supabase
          .from('competitor_research')
          .select(`
            id,
            product,
            price,
            created_at,
            station_name,
            address,
            station_type,
            notes,
            attachments,
            created_by
          `)
          .order('created_at', { ascending: false })

        console.log('🔍 Pesquisas:', pesquisas?.length || 0, 'erro:', pesqError)

        if (pesqError) {
          console.error('Erro ao carregar pesquisas:', pesqError)
          toast.error('Erro ao carregar pesquisas')
          return
        }

        // Processar pesquisas - manter apenas a mais recente por posto+produto
        const cotacoesPesq = (pesquisas || [])
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .reduce((acc, pesq) => {
            const cidade = pesq.address ? pesq.address.split(',')[0]?.trim() : ''
            const estado = pesq.address ? pesq.address.split(',')[1]?.trim() : ''

            const key = `${pesq.station_name}-${pesq.product}`

            if (!acc[key]) {
              // Normalizar nome do produto usando a função normalizeProduct
              const produtoNormalizado = normalizeProduct(pesq.product)

              acc[key] = {
                id: pesq.id,
                posto_nome: pesq.station_name || 'Posto Desconhecido',
                posto_tipo: (pesq.station_type === 'concorrente' ? 'concorrente' : 'proprio') as 'proprio' | 'concorrente',
                produto: pesq.product, // Manter original
                produto_normalizado: produtoNormalizado, // Versão normalizada
                preco_referencia: 0,
                preco_pesquisa: pesq.price,
                cidade,
                estado,
                latitude: 0,
                longitude: 0,
                data_atualizacao: pesq.created_at,
                fonte: 'pesquisa' as const,
                expirado: false
              }
            }

            return acc
          }, {} as Record<string, any>)

        cotacoesArray = Object.values(cotacoesPesq)
        console.log('🔍 Cotações de pesquisa processadas:', cotacoesArray.length)
      }

      console.log('🔍 Total de cotações:', cotacoesArray.length)

      setCotacoes(cotacoesArray)
    } catch (error) {
      console.error('Erro ao carregar cotações:', error)
      toast.error('Erro ao carregar cotações')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCotacoes()
  }, [mode])

  // Normalizar produtos nas cotações antes de filtrar
  const cotacoesComNormalizacao = cotacoes.map(c => ({
    ...c,
    produto_normalizado: c.produto_normalizado || normalizeProduct(c.produto)
  }))

  // Filtrar cotações com busca dinâmica (palavras parciais em qualquer ordem)
  const filteredCotacoes = cotacoesComNormalizacao.filter(cotacao => {
    // Busca flexível: aceita palavras parciais em qualquer ordem
    if (searchTerm) {
      const searchWords = searchTerm.toLowerCase().split(/\s+/).filter(w => w.length > 0);
      const searchText = `${cotacao.posto_nome} ${cotacao.cidade} ${cotacao.produto}`.toLowerCase();

      // Todas as palavras devem estar presentes (em qualquer ordem)
      const matchesSearch = searchWords.every(word => searchText.includes(word));
      if (!matchesSearch) return false;
    }

    const matchesRegion = filterRegion === 'all' ||
      (cotacao.estado || 'Sem UF').toLowerCase().includes(filterRegion.toLowerCase())

    // Usar produto_normalizado para filtro
    const matchesProduct = filterProduct === 'all' ||
      cotacao.produto_normalizado === filterProduct ||
      cotacao.produto === filterProduct

    const matchesExpired = showExpired || !cotacao.expirado

    return matchesRegion && matchesProduct && matchesExpired
  })

  // Ordenar cotações
  const sortedCotacoes = [...filteredCotacoes].sort((a, b) => {
    // Primeiro ordenar por preço se especificado
    if (sortByPrice) {
      const aValue = a.preco_pesquisa || a.preco_referencia || 0
      const bValue = b.preco_pesquisa || b.preco_referencia || 0
      if (sortByPrice === 'asc') {
        if (aValue !== bValue) return aValue - bValue
      } else {
        if (aValue !== bValue) return bValue - aValue
      }
    }

    // Depois ordenar por UF se especificado
    if (sortByUF) {
      const aValue = a.estado || 'Sem UF'
      const bValue = b.estado || 'Sem UF'
      if (sortByUF === 'asc') {
        if (aValue !== bValue) return aValue.localeCompare(bValue)
      } else {
        if (aValue !== bValue) return bValue.localeCompare(aValue)
      }
    }

    // Ordenação padrão por data
    return new Date(b.data_atualizacao).getTime() - new Date(a.data_atualizacao).getTime()
  })

  // Mapear produtos para nomes normalizados (baseado nos produtos da aba referências)
  const normalizeProduct = (product: string): string => {
    if (!product) return product
    const productLower = product.toLowerCase().trim()
    // Mapear variações para nomes padronizados da aba referências (valores exatos salvos)
    if (productLower === 's10' || productLower === 'diesel_s10' || productLower === 's-10') return 's10'
    if (productLower === 's10_aditivado' || productLower === 's10 aditivado' || productLower === 'diesel_s10_aditivado' || productLower === 's10-aditivado') return 's10_aditivado'
    if (productLower === 'diesel_s500' || productLower === 's500' || productLower === 's-500') return 'diesel_s500'
    if (productLower === 'diesel_s500_aditivado' || productLower === 's500_aditivado' || productLower === 's500 aditivado' || productLower === 's500-aditivado') return 'diesel_s500_aditivado'
    if (productLower === 'arla32_granel' || productLower === 'arla' || productLower === 'arla 32' || productLower === 'arla32' || productLower === 'arla_32') return 'arla32_granel'
    // Manter compatibilidade com produtos antigos (para modo pesquisas)
    if (productLower === 'gasolina_comum' || productLower === 'gc') return 'gasolina_comum'
    if (productLower === 'gasolina_aditivada' || productLower === 'ga') return 'gasolina_aditivada'
    if (productLower === 'etanol' || productLower === 'et') return 'etanol'
    return productLower
  }

  // Obter produtos únicos para colunas - ordem específica baseada na aba referências
  // S10, S10 Aditivado, S500, S500 Aditivado, ARLA
  // IMPORTANTE: Usar os valores exatos que são salvos na tabela referencias
  const productOrder = ['s10', 's10_aditivado', 'diesel_s500', 'diesel_s500_aditivado', 'arla32_granel']

  // Normalizar produtos nas cotações antes de filtrar
  // Se já tiver produto_normalizado, usar ele; senão, normalizar
  const normalizedCotacoes = sortedCotacoes.map(c => ({
    ...c,
    produto_normalizado: c.produto_normalizado || normalizeProduct(c.produto)
  }))

  // Produtos únicos encontrados (para filtro)
  const uniqueProducts = productOrder.filter(product =>
    normalizedCotacoes.some(c => c.produto_normalizado === product)
  )

  // Obter postos únicos para linhas
  const uniquePostos = Array.from(new Set(sortedCotacoes.map(c => c.posto_nome))).sort()

  // Agrupar por posto para as linhas (usando produtos normalizados)
  const groupedByPosto = normalizedCotacoes.reduce((acc, cotacao) => {
    if (!acc[cotacao.posto_nome]) {
      acc[cotacao.posto_nome] = []
    }
    acc[cotacao.posto_nome].push(cotacao)
    return acc
  }, {} as Record<string, any[]>)

  // Função para ordenar
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  // Obter data e hora atual
  const getCurrentDateTime = () => {
    const now = new Date()
    return now.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Obter UFs únicas para filtro
  const uniqueUFs = Array.from(new Set(cotacoes.map(c => c.estado || 'Sem UF'))).sort()

  // Agrupar por UF > Município usando produtos normalizados
  const groupedByLocation = normalizedCotacoes.reduce((acc, cotacao) => {
    const uf = cotacao.estado || 'SEM UF';
    const municipio = cotacao.cidade || 'SEM MUNICÍPIO';

    if (!acc[uf]) acc[uf] = {};
    if (!acc[uf][municipio]) acc[uf][municipio] = [];

    acc[uf][municipio].push(cotacao);
    return acc;
  }, {} as Record<string, Record<string, any[]>>);

  console.log('🔍 Renderizando QuotationTable:', {
    loading,
    cotacoes: cotacoes.length,
    filteredCotacoes: filteredCotacoes.length,
    uniqueProducts: uniqueProducts.length,
    uniquePostos: uniquePostos.length
  })

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Legenda conforme o print */}
      <div className="flex items-center gap-6 px-1">
        <span className="text-xs font-bold text-slate-500 mr-2">LEGENDA:</span>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-600"></div>
            <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">Nossa Rede</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-600"></div>
            <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">Concorrentes</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-600"></div>
            <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">Clientes (NF)</span>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="search"
                  placeholder="Posto, cidade ou produto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="region">UF</Label>
              <Select value={filterRegion} onValueChange={setFilterRegion}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a UF" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as UFs</SelectItem>
                  {uniqueUFs.map(uf => (
                    <SelectItem key={uf} value={uf}>
                      {uf}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="product">Produto</Label>
              <Select value={filterProduct} onValueChange={setFilterProduct}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o produto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os produtos</SelectItem>
                  {uniqueProducts.map(product => (
                    <SelectItem key={product} value={product}>
                      {product}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expired">Status</Label>
              <Select value={showExpired ? 'expired' : 'active'} onValueChange={(value) => setShowExpired(value === 'expired')}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativos</SelectItem>
                  <SelectItem value="expired">Expirados</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Cotações */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-600">Carregando cotações...</span>
            </div>
          ) : Object.keys(groupedByPosto).length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <AlertCircle className="h-8 w-8 text-gray-400" />
              <span className="ml-2 text-gray-600">Nenhuma cotação encontrada</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 dark:bg-gray-800">
                    {productOrder.map(product => (
                      <TableHead key={product} className="text-center font-semibold min-w-[200px] p-3">
                        <div className="space-y-2">
                          <div className="text-lg font-bold" style={{ textDecoration: 'none' }}>
                            {product === 's10' ? 'S10' :
                              product === 's10_aditivado' ? 'S10 Aditivado' :
                                product === 'diesel_s500' ? 'S500' :
                                  product === 'diesel_s500_aditivado' ? 'S500 Aditivado' :
                                    product === 'arla32_granel' ? 'ARLA 32' :
                                      product.toUpperCase()}
                          </div>
                          <div className="text-sm text-gray-600" style={{ textDecoration: 'none' }}>
                            {product === 's10' ? 'S10' :
                              product === 's10_aditivado' ? 'S10 Aditivado' :
                                product === 'diesel_s500' ? 'S500' :
                                  product === 'diesel_s500_aditivado' ? 'S500 Aditivado' :
                                    product === 'arla32_granel' ? 'ARLA' :
                                      product === 'gasolina_comum' ? 'GC' :
                                        product === 'gasolina_aditivada' ? 'GA' :
                                          product === 'etanol' ? 'ET' : product}
                          </div>
                          <div className="flex justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => {
                                if (onSortPrice) {
                                  const newOrder = sortByPrice === 'asc' ? 'desc' : sortByPrice === 'desc' ? null : 'asc'
                                  onSortPrice(newOrder)
                                }
                              }}
                            >
                              {sortByPrice === 'asc' ? <ChevronUp className="h-3 w-3" /> :
                                sortByPrice === 'desc' ? <ChevronDown className="h-3 w-3" /> :
                                  <div className="h-3 w-3" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => {
                                if (onSortUF) {
                                  const newOrder = sortByUF === 'asc' ? 'desc' : sortByUF === 'desc' ? null : 'asc'
                                  onSortUF(newOrder)
                                }
                              }}
                            >
                              {sortByUF === 'asc' ? <ChevronUp className="h-3 w-3" /> :
                                sortByUF === 'desc' ? <ChevronDown className="h-3 w-3" /> :
                                  <div className="h-3 w-3" />}
                            </Button>
                          </div>
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    {productOrder.map(product => {
                      return (
                        <TableCell key={product} className="text-left p-0 align-top border-x border-slate-100 dark:border-slate-800">
                          <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {Object.entries(groupedByLocation).map(([uf, municipios]) => (
                              <React.Fragment key={uf}>
                                <div className="bg-slate-50/50 dark:bg-slate-800/20 px-3 py-1 text-[10px] font-bold text-slate-500 uppercase">
                                  {uf}
                                </div>
                                {Object.entries(municipios).map(([municipio, muCotacoes]) => {
                                  const productCotacoes = muCotacoes
                                    .filter(c => c.produto_normalizado === product)
                                    .sort((a, b) => (a.preco_pesquisa || a.preco_referencia || 0) - (b.preco_pesquisa || b.preco_referencia || 0));

                                  if (productCotacoes.length === 0) return null;

                                  return (
                                    <div key={`${uf}-${municipio}`} className="bg-white dark:bg-transparent">
                                      {/* Opcional: remover nome do município para economizar espaço se houver muitos, 
                                                    mas o usuário pediu para separar por município. */}
                                      <div className="px-3 py-0.5 text-[9px] font-medium text-slate-400 border-b border-slate-50 dark:border-slate-900 bg-slate-50/30">
                                        {municipio}
                                      </div>
                                      {productCotacoes.map(cotacao => (
                                        <div key={cotacao.id} className="flex items-center justify-between py-2 px-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                          <div className="flex items-center gap-2 min-w-0 flex-1">
                                            <div
                                              className={`w-3 h-3 rounded-sm flex-shrink-0 ${cotacao.posto_tipo === 'proprio' ? 'bg-blue-600' :
                                                cotacao.posto_tipo === 'cliente' ? 'bg-green-600' : 'bg-red-600'
                                                }`}
                                            />
                                            <span className="text-[11px] font-bold truncate text-slate-700 dark:text-slate-300 uppercase">
                                              {cotacao.posto_nome}
                                            </span>
                                          </div>
                                          <span className="text-[11px] font-black text-slate-900 dark:text-slate-100 ml-2">
                                            R$ {(cotacao.preco_pesquisa || cotacao.preco_referencia || 0).toFixed(4)}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  );
                                })}
                              </React.Fragment>
                            ))}
                          </div>
                        </TableCell>
                      )
                    })}
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
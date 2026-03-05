import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
    BookOpen,
    RefreshCcw,
    Search,
    CalendarDays,
    MapPin,
    Fuel,
    Clock,
    CheckCircle,
    AlertTriangle,
    XCircle,
    Loader2,
    Eye
} from "lucide-react";
import { ImageViewerModal } from "@/components/ImageViewerModal";

interface PriceRef {
    id: string;
    produto: string;
    municipio: string;
    uf: string;
    preco: number;
    fonte: string;
    anexo_url: string | null;
    validade: string;
    criado_por: string | null;
    created_at: string;
    ativo: boolean;
    is_valid: boolean;
}

const PRODUCT_LABELS: Record<string, string> = {
    s10: 'Diesel S-10',
    s10_aditivado: 'Diesel S-10 Aditivado',
    diesel_s500: 'Diesel S-500',
    diesel_s500_aditivado: 'Diesel S-500 Aditivado',
    arla32_granel: 'Arla 32 Granel',
};

const FONT_LABELS: Record<string, string> = {
    ocr: 'OCR',
    manual: 'Manual',
    anp: 'ANP',
};

export default function PriceReferences() {
    const [references, setReferences] = useState<PriceRef[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterProduto, setFilterProduto] = useState<string>("all");
    const [filterMunicipio, setFilterMunicipio] = useState("");
    const [filterUf, setFilterUf] = useState<string>("all");
    const [viewingImage, setViewingImage] = useState<{ url: string; name: string } | null>(null);

    const fetchReferences = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await (supabase.rpc as any)('list_price_references', {
                p_produto: filterProduto !== 'all' ? filterProduto : null,
                p_municipio: filterMunicipio || null,
                p_uf: filterUf !== 'all' ? filterUf : null,
            });

            if (error) throw error;
            setReferences((data as any[]) || []);
        } catch (err: any) {
            toast.error('Erro ao carregar referências: ' + err.message);
            // Fallback: query table directly
            try {
                let query = supabase.from('price_references' as any).select('*').order('created_at', { ascending: false }).limit(200);
                if (filterProduto !== 'all') query = query.eq('produto', filterProduto);
                if (filterMunicipio) query = query.ilike('municipio', `%${filterMunicipio}%`);
                if (filterUf !== 'all') query = query.ilike('uf', filterUf);

                const { data: fallbackData, error: fallbackErr } = await query;
                if (!fallbackErr && fallbackData) {
                    setReferences((fallbackData as any[]).map((r: any) => ({
                        ...r,
                        is_valid: r.ativo && new Date(r.validade) >= new Date(new Date().toISOString().split('T')[0]),
                    })));
                }
            } catch { /* ignore fallback error */ }
        } finally {
            setLoading(false);
        }
    }, [filterProduto, filterMunicipio, filterUf]);

    useEffect(() => {
        fetchReferences();
    }, [fetchReferences]);

    const getValidityBadge = (ref: PriceRef) => {
        if (!ref.ativo) {
            return <Badge variant="outline" className="text-xs text-slate-500"><XCircle className="h-3 w-3 mr-1" />Inativo</Badge>;
        }
        const today = new Date();
        const validade = new Date(ref.validade);
        const daysLeft = Math.ceil((validade.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (daysLeft < 0) {
            return <Badge variant="destructive" className="text-xs"><XCircle className="h-3 w-3 mr-1" />Expirado</Badge>;
        }
        if (daysLeft <= 2) {
            return <Badge className="bg-amber-500 text-white text-xs"><AlertTriangle className="h-3 w-3 mr-1" />{daysLeft}d restante(s)</Badge>;
        }
        return <Badge className="bg-emerald-600 text-white text-xs"><CheckCircle className="h-3 w-3 mr-1" />Válido ({daysLeft}d)</Badge>;
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    // Unique UFs from data for filter
    const uniqueUfs = [...new Set(references.map(r => r.uf))].sort();

    return (
        <div className="space-y-6 p-4 md:p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
                            <BookOpen className="h-5 w-5 text-white" />
                        </div>
                        Referências de Preço
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Cotações de mercado por produto, município e UF — validade de 7 dias
                    </p>
                </div>
                <Button
                    onClick={fetchReferences}
                    variant="outline"
                    size="sm"
                    disabled={loading}
                    className="gap-2"
                >
                    <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    Atualizar
                </Button>
            </div>

            {/* Filters */}
            <Card className="shadow-sm border-slate-200 dark:border-border">
                <CardContent className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Produto</label>
                            <Select value={filterProduto} onValueChange={setFilterProduto}>
                                <SelectTrigger className="h-9">
                                    <SelectValue placeholder="Todos" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos os produtos</SelectItem>
                                    <SelectItem value="s10">Diesel S-10</SelectItem>
                                    <SelectItem value="s10_aditivado">Diesel S-10 Aditivado</SelectItem>
                                    <SelectItem value="diesel_s500">Diesel S-500</SelectItem>
                                    <SelectItem value="diesel_s500_aditivado">Diesel S-500 Aditivado</SelectItem>
                                    <SelectItem value="arla32_granel">Arla 32 Granel</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Município</label>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                <Input
                                    placeholder="Buscar município..."
                                    value={filterMunicipio}
                                    onChange={(e) => setFilterMunicipio(e.target.value)}
                                    className="h-9 pl-8 text-sm"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">UF</label>
                            <Select value={filterUf} onValueChange={setFilterUf}>
                                <SelectTrigger className="h-9">
                                    <SelectValue placeholder="Todos" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos</SelectItem>
                                    {uniqueUfs.map(uf => (
                                        <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex items-end">
                            <Button
                                onClick={() => { setFilterProduto("all"); setFilterMunicipio(""); setFilterUf("all"); }}
                                variant="ghost"
                                size="sm"
                                className="text-xs"
                            >
                                Limpar filtros
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="shadow-sm">
                    <CardContent className="p-3 text-center">
                        <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{references.length}</p>
                        <p className="text-xs text-slate-500">Total</p>
                    </CardContent>
                </Card>
                <Card className="shadow-sm">
                    <CardContent className="p-3 text-center">
                        <p className="text-2xl font-bold text-emerald-600">{references.filter(r => r.is_valid).length}</p>
                        <p className="text-xs text-slate-500">Válidas</p>
                    </CardContent>
                </Card>
                <Card className="shadow-sm">
                    <CardContent className="p-3 text-center">
                        <p className="text-2xl font-bold text-amber-600">
                            {references.filter(r => {
                                const daysLeft = Math.ceil((new Date(r.validade).getTime() - Date.now()) / 86400000);
                                return r.ativo && daysLeft >= 0 && daysLeft <= 2;
                            }).length}
                        </p>
                        <p className="text-xs text-slate-500">Vencendo</p>
                    </CardContent>
                </Card>
                <Card className="shadow-sm">
                    <CardContent className="p-3 text-center">
                        <p className="text-2xl font-bold text-red-600">
                            {references.filter(r => !r.is_valid).length}
                        </p>
                        <p className="text-xs text-slate-500">Expiradas</p>
                    </CardContent>
                </Card>
            </div>

            {/* References List */}
            <Card className="shadow-sm">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold">Referências</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                        </div>
                    ) : references.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            <BookOpen className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                            <p className="text-sm">Nenhuma referência encontrada</p>
                            <p className="text-xs mt-1">Envie uma imagem na solicitação de preço para extrair preços via OCR</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100 dark:divide-border">
                            {references.map((ref) => (
                                <div key={ref.id} className="p-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0 space-y-1.5">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <Badge variant="secondary" className="text-xs font-semibold">
                                                    <Fuel className="h-3 w-3 mr-1" />
                                                    {PRODUCT_LABELS[ref.produto] || ref.produto}
                                                </Badge>
                                                <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
                                                    R$ {Number(ref.preco).toFixed(4)}
                                                </span>
                                                {getValidityBadge(ref)}
                                            </div>

                                            <div className="flex items-center gap-3 text-xs text-slate-500">
                                                <span className="flex items-center gap-1">
                                                    <MapPin className="h-3 w-3" />
                                                    {ref.municipio}/{ref.uf}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    {formatDate(ref.created_at)}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <CalendarDays className="h-3 w-3" />
                                                    Até {new Date(ref.validade).toLocaleDateString('pt-BR')}
                                                </span>
                                                <Badge variant="outline" className="text-[10px]">
                                                    {FONT_LABELS[ref.fonte] || ref.fonte}
                                                </Badge>
                                            </div>
                                        </div>

                                        {ref.anexo_url && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setViewingImage({ url: ref.anexo_url!, name: `Referência ${ref.municipio}/${ref.uf}` })}
                                                className="h-8 px-2"
                                            >
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Image Viewer Modal */}
            {viewingImage && (
                <ImageViewerModal
                    isOpen={!!viewingImage}
                    onClose={() => setViewingImage(null)}
                    imageUrl={viewingImage.url}
                    imageName={viewingImage.name}
                />
            )}
        </div>
    );
}

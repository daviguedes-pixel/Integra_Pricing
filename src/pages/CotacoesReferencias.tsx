import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Filter, Clock, Check, X, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

// ── Interfaces ──
interface ReferenceItem {
    id: string;
    produto: string;
    preco: number;
    municipio: string;
    uf: string;
    cliente_id: string | null;
    posto_id: string | null;
    created_at: string;
    fonte: string;
    // Resolved names
    display_name: string;
    tipo: 'cliente' | 'concorrente' | 'proprio';
}

// ── Product config ──
const products = [
    { key: "s10", label: "DIESEL S10", short: "S10" },
    { key: "s10_aditivado", label: "S10 ADITIVADO", short: "S10 ADIT" },
    { key: "diesel_s500", label: "DIESEL S500", short: "S500" },
    { key: "diesel_s500_aditivado", label: "S500 ADITIVADO", short: "S500 ADIT" },
    { key: "arla32_granel", label: "ARLA 32", short: "ARLA" },
];

// ── Normalize product names ──
const normalizeProduct = (product: string): string => {
    if (!product) return product;
    const p = product.toLowerCase().trim();
    if (p === 's10' || p === 'diesel_s10' || p === 's-10') return 's10';
    if (p === 's10_aditivado' || p === 's10 aditivado' || p === 'diesel_s10_aditivado' || p === 's10-aditivado') return 's10_aditivado';
    if (p === 'diesel_s500' || p === 's500' || p === 's-500') return 'diesel_s500';
    if (p === 'diesel_s500_aditivado' || p === 's500_aditivado' || p === 's500 aditivado' || p === 's500-aditivado') return 'diesel_s500_aditivado';
    if (p === 'arla32_granel' || p === 'arla' || p === 'arla 32' || p === 'arla32' || p === 'arla_32') return 'arla32_granel';
    return p;
};

// ── Price Item Component (identical to Quotations) ──
const PriceItem = ({ name, price, subtext, daysLeft, className }: { name: string; price: string; subtext?: string; daysLeft?: number; className?: string }) => {
    if (price === '-' || !price || !name) return null;

    const getDaysLeftColor = (days?: number) => {
        if (days === undefined) return '';
        if (days <= 1) return 'text-red-600';
        if (days <= 3) return 'text-amber-600';
        return 'text-green-600';
    };

    return (
        <div className={cn(
            "flex justify-between items-center text-xs p-1.5 rounded mb-0.5 border-b border-slate-100 last:border-0 transition-all",
            className
        )}>
            <div className="flex flex-col">
                <span className="font-bold truncate max-w-[140px]" title={name}>{name.toUpperCase()}</span>
                <div className="flex items-center gap-1.5">
                    {subtext && <span className="text-[10px] opacity-80">{subtext.toUpperCase()}</span>}
                    {daysLeft !== undefined && (
                        <span className={`text-[9px] font-medium ${getDaysLeftColor(daysLeft)}`}>
                            {daysLeft <= 0 ? 'EXPIRADO' : `${daysLeft}d restante${daysLeft > 1 ? 's' : ''}`}
                        </span>
                    )}
                </div>
            </div>
            <div className="flex flex-col items-end">
                <span className="font-mono font-bold">{price}</span>
            </div>
        </div>
    );
};

// ── MultiSelect (identical to Quotations) ──
interface MultiSelectProps {
    title: string;
    options: string[];
    selected: string[];
    onChange: (selected: string[]) => void;
    placeholder?: string;
}

const MultiSelect = ({ title, options, selected, onChange, placeholder = "Selecione..." }: MultiSelectProps) => {
    const [open, setOpen] = useState(false);

    const handleSelect = (option: string) => {
        const isSelected = selected.includes(option);
        if (isSelected) {
            onChange(selected.filter((item) => item !== option));
        } else {
            onChange([...selected, option]);
        }
    };

    const handleClear = () => onChange([]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 border-dashed">
                    <Filter className="mr-2 h-4 w-4" />
                    {title}
                    {selected.length > 0 && (
                        <>
                            <Separator orientation="vertical" className="mx-2 h-4" />
                            <Badge variant="secondary" className="rounded-sm px-1 font-normal lg:hidden">
                                {selected.length}
                            </Badge>
                            <div className="hidden space-x-1 lg:flex">
                                {selected.length > 2 ? (
                                    <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                                        {selected.length} selecionados
                                    </Badge>
                                ) : (
                                    options
                                        .filter((option) => selected.includes(option))
                                        .map((option) => (
                                            <Badge variant="secondary" key={option} className="rounded-sm px-1 font-normal">
                                                {option}
                                            </Badge>
                                        ))
                                )}
                            </div>
                        </>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0" align="start">
                <Command>
                    <CommandInput placeholder={placeholder} />
                    <CommandList>
                        <CommandEmpty>Não encontrado.</CommandEmpty>
                        <CommandGroup>
                            {options.map((option) => {
                                const isSelected = selected.includes(option);
                                return (
                                    <CommandItem key={option} onSelect={() => handleSelect(option)}>
                                        <div className={cn(
                                            "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                            isSelected ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible"
                                        )}>
                                            <Check className={cn("h-4 w-4")} />
                                        </div>
                                        <span>{option}</span>
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                        {selected.length > 0 && (
                            <>
                                <CommandSeparator />
                                <CommandGroup>
                                    <CommandItem onSelect={handleClear} className="justify-center text-center">
                                        Limpar Filtros
                                    </CommandItem>
                                </CommandGroup>
                            </>
                        )}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
};


// ── Main Component ──
export default function CotacoesReferencias() {
    const [loading, setLoading] = useState(false);
    const [references, setReferences] = useState<ReferenceItem[]>([]);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

    // Filters
    const [selectedUFs, setSelectedUFs] = useState<string[]>([]);
    const [selectedMunicipios, setSelectedMunicipios] = useState<string[]>([]);

    // ── Load Data ──
    const fetchData = async () => {
        setLoading(true);
        try {
            // 1) Fetch active references
            const { data: refs, error: refError } = await supabase
                .from('price_references')
                .select('*')
                .eq('ativo', true)
                .order('created_at', { ascending: false });

            if (refError) {
                console.error('Erro ao carregar referências:', refError);
                toast.error('Erro ao carregar referências');
                return;
            }

            if (!refs || refs.length === 0) {
                setReferences([]);
                setLastUpdated(new Date());
                return;
            }

            // 2) Resolve names: clients
            const clientIds = Array.from(new Set(refs.map((r: any) => r.cliente_id).filter(Boolean)));
            const clienteMap = new Map<string, string>();

            if (clientIds.length > 0) {
                const { data: clientsList } = await supabase
                    .from('clients')
                    .select('id, name, id_cliente')
                    .in('id', clientIds as any[]);

                if (clientsList) {
                    clientsList.forEach((cl: any) => {
                        clienteMap.set(String(cl.id), cl.name || cl.id_cliente || 'Cliente');
                        if (cl.id_cliente) clienteMap.set(String(cl.id_cliente), cl.name || cl.id_cliente);
                    });
                }

                const numericIds = clientIds.filter(id => /^\d+$/.test(String(id)));
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

            // 3) Resolve names: stations (postos)
            const postoIds = Array.from(new Set(refs.map((r: any) => r.posto_id).filter(Boolean)));
            const postoMap = new Map<string, string>();
            const postoUfMap = new Map<string, string>();
            const postoCidadeMap = new Map<string, string>();

            if (postoIds.length > 0) {
                const numericPostoIds = postoIds.map((id: any) => Number(id)).filter((n: any) => !isNaN(n));

                const { data: concorrentes } = await supabase
                    .from('concorrentes')
                    .select('id_posto, razao_social, municipio, uf')
                    .in('id_posto', (numericPostoIds.length > 0 ? numericPostoIds : postoIds) as any[]);

                if (concorrentes) {
                    concorrentes.forEach((conc: any) => {
                        const idKey = String(conc.id_posto);
                        postoMap.set(idKey, conc.razao_social || 'Posto');
                        if (conc.uf) postoUfMap.set(idKey, conc.uf);
                        if (conc.municipio) postoCidadeMap.set(idKey, conc.municipio);
                    });
                }

                const { data: sisEmpresas } = await supabase.rpc('get_sis_empresa_stations');
                if (sisEmpresas) {
                    (sisEmpresas as any[]).forEach((se: any) => {
                        const possibleIds = [String(se.id_empresa), se.cnpj_cpf].filter(Boolean);
                        possibleIds.forEach((seId: string) => {
                            if (postoIds.includes(seId)) {
                                const idKey = String(seId);
                                if (!postoMap.has(idKey)) postoMap.set(idKey, se.nome_empresa || 'Posto');
                                if (se.uf && !postoUfMap.has(idKey)) postoUfMap.set(idKey, se.uf);
                                if (se.municipio && !postoCidadeMap.has(idKey)) postoCidadeMap.set(idKey, se.municipio);
                            }
                        });
                    });
                }
            }

            // 4) Build items with substitution logic (same client+product+município = keep latest only)
            const substitutionMap = new Map<string, ReferenceItem>();

            refs.forEach((ref: any) => {
                const idKey = String(ref.posto_id);
                const produto = normalizeProduct(ref.produto);
                const municipio = ref.municipio || postoCidadeMap.get(idKey) || '';
                const uf = ref.uf || postoUfMap.get(idKey) || '';
                const displayName = (ref.cliente_id && clienteMap.get(String(ref.cliente_id)))
                    || postoMap.get(idKey)
                    || ref.posto_id
                    || 'Desconhecido';

                const tipo = ref.cliente_id ? 'cliente' : 'concorrente';

                // Substitution key
                const rawMun = municipio.trim().toLowerCase();
                const isValidMun = rawMun && rawMun !== 'não identificado' && rawMun !== 'sem_municipio';
                const munKey = isValidMun ? rawMun : `_unique_${ref.id}`;
                const substKey = `${ref.cliente_id || ref.posto_id}-${produto}-${munKey}`;

                if (!substitutionMap.has(substKey)) {
                    substitutionMap.set(substKey, {
                        id: ref.id,
                        produto,
                        preco: Number(ref.preco) || 0,
                        municipio: municipio || 'SEM MUNICÍPIO',
                        uf: uf || 'SEM UF',
                        cliente_id: ref.cliente_id,
                        posto_id: ref.posto_id,
                        created_at: ref.created_at,
                        fonte: ref.fonte || 'manual',
                        display_name: displayName,
                        tipo: tipo as 'cliente' | 'concorrente',
                    });
                }
            });

            setReferences(Array.from(substitutionMap.values()));
            setLastUpdated(new Date());
        } catch (err: any) {
            console.error("Error fetching references:", err);
            toast.error("Erro ao carregar referências: " + (err.message || "Erro desconhecido"));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // ── Filter options ──
    const filterOptions = useMemo(() => {
        const ufs = new Set<string>();
        const municipios = new Set<string>();
        references.forEach(ref => {
            if (ref.uf) ufs.add(ref.uf.toUpperCase());
            if (ref.municipio) municipios.add(ref.municipio.toUpperCase());
        });
        return {
            ufs: Array.from(ufs).sort(),
            municipios: Array.from(municipios).sort(),
        };
    }, [references]);

    // ── Filtered data ──
    const filteredData = useMemo(() => {
        let data = references;
        if (selectedUFs.length > 0) {
            data = data.filter(ref => selectedUFs.includes(ref.uf.toUpperCase()));
        }
        if (selectedMunicipios.length > 0) {
            data = data.filter(ref => selectedMunicipios.includes(ref.municipio.toUpperCase()));
        }
        return data;
    }, [references, selectedUFs, selectedMunicipios]);

    // ── Group by UF > Município for a given product ──
    const getGroupedData = (productKey: string) => {
        const groups: Record<string, ReferenceItem[]> = {};

        filteredData
            .filter(ref => ref.produto === productKey)
            .forEach(ref => {
                const groupKey = `${ref.uf.toUpperCase()}|${ref.municipio.toUpperCase()}`;
                if (!groups[groupKey]) groups[groupKey] = [];
                groups[groupKey].push(ref);
            });

        // Sort within each group by price ascending
        Object.keys(groups).forEach(key => {
            groups[key].sort((a, b) => a.preco - b.preco);
        });

        return groups;
    };

    // ── Title suffix ──
    const titleSuffix = useMemo(() => {
        const parts = [];
        if (selectedUFs.length > 0) {
            if (selectedUFs.length > 3) parts.push(`${selectedUFs.length} UFs`);
            else parts.push(selectedUFs.join(", "));
        }
        if (selectedMunicipios.length > 0) {
            if (selectedMunicipios.length > 3) parts.push(`${selectedMunicipios.length} Municípios`);
            else parts.push(selectedMunicipios.join(", "));
        }
        if (parts.length === 0) return "";
        return " - " + parts.join(" | ");
    }, [selectedUFs, selectedMunicipios]);

    return (
        <div className="h-full flex flex-col space-y-4 p-4 md:p-6 bg-slate-50/50">
            {/* ── Top Bar: Filters & Controls ── */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-white p-4 rounded-lg border shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                    <MultiSelect
                        title="UF"
                        options={filterOptions.ufs}
                        selected={selectedUFs}
                        onChange={setSelectedUFs}
                        placeholder="Buscar UF..."
                    />
                    <MultiSelect
                        title="Município"
                        options={filterOptions.municipios}
                        selected={selectedMunicipios}
                        onChange={setSelectedMunicipios}
                        placeholder="Buscar Município..."
                    />
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                    <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>

            {/* ── Title Section ── */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-2 px-1">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-800 flex items-center flex-wrap gap-2">
                        Cotações Referências
                        <span className="font-normal text-slate-500 text-lg">
                            {titleSuffix}
                        </span>
                    </h1>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                        <Badge variant="secondary" className="font-medium text-slate-600">
                            {references.length} referência{references.length !== 1 ? 's' : ''} ativa{references.length !== 1 ? 's' : ''}
                        </Badge>
                        <Badge variant="outline" className="font-medium text-amber-700 border-amber-300 bg-amber-50">
                            ⏱ Validade: 7 dias
                        </Badge>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-slate-100 px-2 py-1 rounded-md">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Última atualização: <span className="font-medium text-slate-700">{format(lastUpdated, "HH:mm:ss")}</span></span>
                </div>
            </div>

            {/* ── Main Grid (identical layout to Quotations) ── */}
            <div className="flex-1 overflow-x-auto pb-4">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
                        <span className="ml-2 text-gray-600">Carregando referências...</span>
                    </div>
                ) : (
                    <div className="flex gap-4 min-w-[1200px] h-full">
                        {products.map((product) => {
                            const groupedData = getGroupedData(product.key);
                            const sortedGroups = Object.entries(groupedData).sort(([a], [b]) => a.localeCompare(b));
                            const hasData = sortedGroups.length > 0;

                            return (
                                <Card key={product.key} className="flex-1 min-w-[240px] flex flex-col border-none shadow-md bg-white">
                                    <CardHeader className="py-3 px-4 bg-slate-100 border-b">
                                        <CardTitle className="text-sm font-bold text-center text-slate-700 uppercase flex flex-col items-center">
                                            {product.label}
                                            <span className="text-[10px] text-slate-400 font-normal mt-0.5">{product.short}</span>
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-2 overflow-y-auto flex-1 max-h-[calc(100vh-280px)] space-y-3 bg-white">
                                        {!hasData ? (
                                            <div className="text-center py-8 text-muted-foreground text-xs">
                                                Sem dados
                                            </div>
                                        ) : (
                                            sortedGroups.map(([groupKey, items]) => {
                                                const [uf, municipio] = groupKey.split('|');
                                                return (
                                                    <div key={groupKey} className="border-b last:border-0 pb-2 mb-2">
                                                        {/* Group Header */}
                                                        <div className="flex items-center gap-1.5 mb-1.5 bg-slate-50 p-1 rounded">
                                                            <Badge variant="outline" className="text-[10px] h-5 bg-white px-1 font-bold text-slate-600 border-slate-300">
                                                                {uf}
                                                            </Badge>
                                                            <span className="text-[10px] font-bold text-slate-600 truncate" title={municipio}>
                                                                {municipio}
                                                            </span>
                                                        </div>

                                                        {/* Items */}
                                                        <div className="space-y-0.5">
                                                            {items.map((item) => {
                                                                const createdAt = new Date(item.created_at);
                                                                const expiresAt = new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000);
                                                                const now = new Date();
                                                                const daysLeft = Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
                                                                return (
                                                                    <PriceItem
                                                                        key={item.id}
                                                                        name={item.display_name}
                                                                        price={`R$ ${item.preco.toFixed(4)}`}
                                                                        subtext={item.fonte === 'ocr' ? 'OCR' : item.fonte === 'manual' ? 'MANUAL' : undefined}
                                                                        daysLeft={daysLeft}
                                                                        className="text-slate-700 hover:bg-slate-50"
                                                                    />
                                                                );
                                                            })}
                                                        </div>

                                                        {/* Média */}
                                                        {(() => {
                                                            const prices = items.map(i => i.preco).filter(p => p > 0);
                                                            if (prices.length === 0) return null;

                                                            let filtered = prices;
                                                            if (prices.length >= 4) {
                                                                const sorted = [...prices].sort((a, b) => a - b);
                                                                const q1 = sorted[Math.floor(sorted.length * 0.25)];
                                                                const q3 = sorted[Math.floor(sorted.length * 0.75)];
                                                                const iqr = q3 - q1;
                                                                filtered = sorted.filter(p => p >= q1 - 1.5 * iqr && p <= q3 + 1.5 * iqr);
                                                            }
                                                            if (filtered.length === 0) filtered = prices;

                                                            const avg = filtered.reduce((a, b) => a + b, 0) / filtered.length;
                                                            const excluded = prices.length - filtered.length;
                                                            return (
                                                                <div className="flex justify-between items-center text-[10px] p-1.5 mt-1 bg-blue-50 rounded border border-blue-100">
                                                                    <span className="font-bold text-blue-700">
                                                                        MÉDIA ({filtered.length})
                                                                        {excluded > 0 && <span className="text-slate-400 font-normal ml-1">-{excluded} outlier{excluded > 1 ? 's' : ''}</span>}
                                                                    </span>
                                                                    <span className="font-mono font-bold text-blue-700">R$ {avg.toFixed(4)}</span>
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                );
                                            })
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

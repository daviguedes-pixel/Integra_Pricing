
import { useState, useEffect, useMemo } from "react";
import { format, subDays, parseISO, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
    Calendar as CalendarIcon,
    ChevronDown,
    ChevronRight,
    ArrowUp,
    ArrowDown,
    Minus,
    Loader2,
    Search
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// --- Types ---

interface MarketQuotation {
    "UF Destino": string;
    "Base Origem": string;
    "UF Origem": string;
    "Distribuidora": string;
    "Preço Etanol": string | number;
    "Preço Gasolina C": string | number;
    "Preço Gasolina Adit": string | number;
    "Preço Diesel S10": string | number;
    "Preço Diesel S500": string | number;
    "Produto"?: string;
    "Preço"?: number;
}

interface TankValidation {
    id_empresa: number;
    nome_posto: string;
    municipio_posto: string;
    uf_posto: string;
    produto: string;
    bandeira_validada: string;
    cnpj_distribuidora: string;
    municipio_distribuidora: string;
    uf_distribuidora: string;
    data_ultima_compra: string;
    status_tanque: string;
}

interface CompanyMetadata {
    id_empresa: number;
    Empresa: string;
    Bandeira: string;
    "UF Posto": string;
    "Município Posto": string;
}

interface VariationNode {
    id: string; // Unique ID for the node
    label: string;
    type: 'praca' | 'base' | 'distributor' | 'terminal';
    currentPrice?: number;
    previousPrice?: number;
    variation?: number;
    children?: VariationNode[];
    isExpanded?: boolean;
}

// --- Helper Components ---

const parsePrice = (val: any): number | undefined => {
    if (val === null || val === undefined || val === '-') return undefined;
    if (typeof val === 'number') return val;
    if (typeof val !== 'string') return undefined;
    const clean = val.replace(/[R$\s]/g, '').replace(',', '.');
    const num = parseFloat(clean);
    return isNaN(num) ? undefined : num;
}

const VariationValue = ({ value }: { value?: number }) => {
    if (value === undefined || value === null || isNaN(value)) return <span className="text-muted-foreground">-</span>;

    // Green for PRICE DROP (Negative variation), Red for PRICE RISE (Positive variation)
    const isPositive = value > 0;
    const isNegative = value < 0;
    const isZero = value === 0;

    // Logic: 
    // Price Drop (Negative) -> GOOD -> Green
    // Price Rise (Positive) -> BAD -> Red
    // (This is standard for consumer/buyer perspective. For a seller, it might be opposite. I'll follow standard financial "Green = Good" for buyer)
    // Wait, the user image shows:
    // -0.0200 (Green)
    // 0.0100 (Red)
    // So YES: Negative = Green, Positive = Red.

    const colorClass = isNegative ? "text-green-600" : isPositive ? "text-red-600" : "text-muted-foreground";
    const Icon = isNegative ? ArrowDown : isPositive ? ArrowUp : Minus;

    return (
        <div className={cn("flex items-center justify-end gap-1 font-medium", colorClass)}>
            <Icon className="h-3 w-3" />
            {Math.abs(value).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
        </div>
    );
};

const PriceValue = ({ value }: { value?: number }) => {
    if (value === undefined || value === null || isNaN(value)) return <span className="text-muted-foreground">-</span>;
    return <span>{value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4, maximumFractionDigits: 4 })}</span>;
}

const IntegratedTable = ({ title, data }: { title: string, data: any }) => {
    if (!data || !data.ufs.length) return null;
    return (
        <Card className="mb-4">
            <CardHeader className="py-3">
                <CardTitle className="text-md">{title}</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b bg-muted/30">
                            <th className="text-left font-semibold py-2 px-4">UF</th>
                            {data.brands.map((b: string) => (
                                <th key={b} className="text-center font-semibold py-2 px-4">{b}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.ufs.map((uf: string) => (
                            <tr key={uf} className="border-b hover:bg-muted/50 transition-colors">
                                <td className="font-medium py-2 px-4">{uf}</td>
                                {data.brands.map((b: string) => {
                                    const val = data.values.get(`${uf}|${b}`);
                                    return (
                                        <td key={b} className="text-center py-2 px-4">
                                            <VariationValue value={val} />
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </CardContent>
        </Card>
    );
};

// --- Page Component ---

export default function Variations() {
    const [date, setDate] = useState<Date>(new Date());
    const [loading, setLoading] = useState(false);

    // Raw Data
    const [currentData, setCurrentData] = useState<MarketQuotation[]>([]);
    const [previousData, setPreviousData] = useState<MarketQuotation[]>([]);
    const [tankValidationData, setTankValidationData] = useState<TankValidation[]>([]);
    const [companyData, setCompanyData] = useState<CompanyMetadata[]>([]);
    const [validationLoading, setValidationLoading] = useState(false);

    // Expanded State for List View
    const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

    const toggleNode = (nodeId: string) => {
        setExpandedNodes(prev => ({ ...prev, [nodeId]: !prev[nodeId] }));
    };

    // --- Fetch Data ---

    const fetchData = async () => {
        setLoading(true);
        try {
            const dateStr = format(date, 'yyyy-MM-dd');
            const prevDate = subDays(date, 1);
            const prevDateStr = format(prevDate, 'yyyy-MM-dd');

            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            // Fetch Current, Previous Day and Company Metadata in parallel
            const [currRes, prevRes, compRes] = await Promise.all([
                fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/quotations-api?date=${dateStr}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/quotations-api?date=${prevDateStr}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/quotations-api?action=company&date=${dateStr}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
            ]);

            if (!currRes.ok) {
                const errData = await currRes.json().catch(() => ({}));
                console.error("Current data fetch failed:", errData);
                throw new Error(errData.error || `Erro ao buscar dados atuais (${currRes.status})`);
            }
            if (!prevRes.ok) {
                const errData = await prevRes.json().catch(() => ({}));
                console.error("Previous data fetch failed:", errData);
                throw new Error(errData.error || `Erro ao buscar dados anteriores (${prevRes.status})`);
            }
            if (!compRes.ok) {
                const errData = await compRes.json().catch(() => ({}));
                console.error("Company metadata fetch failed:", errData);
                throw new Error(errData.error || `Erro ao buscar metadados de empresas (${compRes.status})`);
            }

            const currJson = await currRes.json();
            const prevJson = await prevRes.json();
            const compJson = await compRes.json();

            setCurrentData(currJson || []);
            setPreviousData(prevJson || []);
            setCompanyData(compJson || []);

        } catch (err) {
            console.error("Error fetching variations:", err);
            toast.error("Erro ao buscar dados de variação.");
        } finally {
            setLoading(false);
        }
    };

    const fetchTankValidation = async () => {
        setValidationLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/petros-api`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                console.error("Tank validation fetch failed:", errData);
                throw new Error(errData.error || `Erro ao buscar validação de tanques (${response.status})`);
            }

            const json = await response.json();
            setTankValidationData(json || []);
        } catch (err) {
            console.error("Error fetching tank validation:", err);
            toast.error("Erro ao buscar dados de validação.");
        } finally {
            setValidationLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        fetchTankValidation();
    }, [date]);

    // --- Processing Data for List View ---

    const treeData = useMemo(() => {
        const grouped: Record<string, any> = {};

        const prevMap = new Map<string, number>();
        previousData.forEach(item => {
            const key = `${item["UF Origem"]}|${item["UF Destino"]}|${item["Base Origem"]}|${item["Distribuidora"]}|${item["Produto"]}`;
            const price = parsePrice(item["Preço"]);
            if (price !== undefined) prevMap.set(key, price);
        });

        currentData.forEach((item, index) => {
            const praca = `${item["UF Origem"]}/${item["UF Destino"]}`;
            const base = (item["Base Origem"] || "").trim();
            const dist = (item["Distribuidora"] || "").trim();
            const product = item["Produto"];
            const price = parsePrice(item["Preço"]);

            if (price === undefined) return;

            const key = `${item["UF Origem"]}|${item["UF Destino"]}|${item["Base Origem"]}|${item["Distribuidora"]}|${item["Produto"]}`;
            const prevPrice = prevMap.get(key);
            const variation = prevPrice !== undefined ? price - prevPrice : undefined;

            if (!grouped[praca]) grouped[praca] = { id: praca, label: praca, type: 'praca', children: {} };
            if (!grouped[praca].children[base]) grouped[praca].children[base] = { id: `${praca}|${base}`, label: base, type: 'base', children: {} };
            if (!grouped[praca].children[base].children[dist]) grouped[praca].children[base].children[dist] = { id: `${praca}|${base}|${dist}`, label: dist, type: 'distributor', children: [] };

            grouped[praca].children[base].children[dist].children.push({
                id: `${praca}|${base}|${dist}|${index}`,
                label: product,
                type: 'terminal',
                currentPrice: price,
                previousPrice: prevPrice,
                variation: variation
            });
        });

        const processNode = (node: any): VariationNode => {
            if (Array.isArray(node.children)) {
                let sV = 0, cV = 0, sC = 0, sP = 0;
                node.children.forEach((c: any) => {
                    if (c.variation !== undefined) { sV += c.variation; cV++; }
                    if (c.currentPrice !== undefined) sC += c.currentPrice;
                    if (c.previousPrice !== undefined) sP += c.previousPrice;
                });
                return {
                    ...node,
                    currentPrice: node.children.length ? sC / node.children.length : undefined,
                    previousPrice: cV ? sP / cV : undefined,
                    variation: cV ? sV / cV : undefined
                };
            } else {
                const cArr = Object.values(node.children).map((c: any) => processNode(c));
                let sV = 0, cV = 0, sC = 0, sP = 0;
                cArr.forEach(c => {
                    if (c.variation !== undefined) { sV += c.variation; cV++; }
                    if (c.currentPrice !== undefined) sC += c.currentPrice;
                    if (c.previousPrice !== undefined) sP += c.previousPrice;
                });
                return {
                    ...node,
                    children: cArr,
                    currentPrice: cArr.length ? sC / cArr.length : undefined,
                    previousPrice: cV ? sP / cV : undefined,
                    variation: cV ? sV / cV : undefined
                };
            }
        };

        return Object.values(grouped).map(g => processNode(g));
    }, [currentData, previousData]);

    // --- Processing Data for Matrix View ---

    const matrixData = useMemo(() => {
        const ufs = new Set<string>();
        const dList = ["VIBRA", "SHELL", "IPIRANGA"];
        const vMap = new Map<string, { sum: number, count: number }>();

        const pMap = new Map<string, number>();
        previousData.forEach(item => {
            const prods = [
                { cat: 'ET', val: item["Preço Etanol"] },
                { cat: 'GC', val: item["Preço Gasolina C"] },
                { cat: 'GA', val: item["Preço Gasolina Adit"] },
                { cat: 'S10', val: item["Preço Diesel S10"] },
                { cat: 'S500', val: item["Preço Diesel S500"] }
            ];
            prods.forEach(p => {
                const pr = parsePrice(p.val);
                if (pr !== undefined) pMap.set(`${(item["Base Origem"] || "").toUpperCase()}|${(item["UF Destino"] || "").toUpperCase()}|${p.cat}|${(item["Distribuidora"] || "").toUpperCase()}`, pr);
            });
        });

        currentData.forEach(item => {
            const uf = (item["UF Destino"] || "N/A").toUpperCase();
            let d = (item["Distribuidora"] || "").toUpperCase();
            if (d.includes("VIBRA")) d = "VIBRA";
            else if (d.includes("IPIRANGA")) d = "IPIRANGA";
            else if (d.includes("RAIZEN") || d.includes("SHELL")) d = "SHELL";

            if (dList.includes(d)) {
                ufs.add(uf);
                const prods = [
                    { cat: 'ET', val: item["Preço Etanol"] },
                    { cat: 'GC', val: item["Preço Gasolina C"] },
                    { cat: 'GA', val: item["Preço Gasolina Adit"] },
                    { cat: 'S10', val: item["Preço Diesel S10"] },
                    { cat: 'S500', val: item["Preço Diesel S500"] }
                ];

                prods.forEach(p => {
                    const cP = parsePrice(p.val);
                    const k = `${(item["Base Origem"] || "").toUpperCase()}|${uf}|${p.cat}|${(item["Distribuidora"] || "").toUpperCase()}`;
                    const pP = pMap.get(k);

                    if (cP !== undefined && pP !== undefined) {
                        const v = cP - pP;
                        const mK = `${uf}|${d}`;
                        const cur = vMap.get(mK) || { sum: 0, count: 0 };
                        vMap.set(mK, { sum: cur.sum + v, count: cur.count + 1 });
                    }
                });
            }
        });

        return { rows: Array.from(ufs).sort(), cols: dList, values: vMap };
    }, [currentData, previousData]);

    // --- Processing Data for Integrated Validation View ---

    const integratedVariationData = useMemo(() => {
        if (!tankValidationData.length || !currentData.length || !previousData.length || !companyData.length) return null;

        const infoMap = new Map<number, { uf: string, brand: string }>();
        companyData.forEach(c => {
            if (c.id_empresa) infoMap.set(c.id_empresa, { uf: c["UF Posto"], brand: c["Bandeira"] });
        });

        const getPrices = (data: MarketQuotation[]) => {
            const m = new Map<string, number>();
            data.forEach(item => {
                const b = (item["Base Origem"] || "").trim().toUpperCase();
                const dU = (item["UF Destino"] || "").trim().toUpperCase();
                const dN = (item["Distribuidora"] || "").trim().toUpperCase();
                [{ c: 'ET', v: item["Preço Etanol"] }, { c: 'GC', v: item["Preço Gasolina C"] }, { c: 'GA', v: item["Preço Gasolina Adit"] }, { c: 'S10', v: item["Preço Diesel S10"] }, { c: 'S500', v: item["Preço Diesel S500"] }].forEach(p => {
                    const pr = parsePrice(p.v);
                    if (pr !== undefined) m.set(`${b}|${dU}|${p.c}|${dN}`, pr);
                });
            });
            return m;
        };

        const cMarket = getPrices(currentData);
        const pM = getPrices(previousData);

        const groups: Record<string, Map<string, number>> = { 'ET': new Map(), 'GC': new Map(), 'DIESEL': new Map() };

        tankValidationData.forEach(t => {
            const s = infoMap.get(t.id_empresa);
            if (!s) return;
            const u = s.uf, b = s.brand, gK = `${u}|${b}`;

            let c = '';
            const p = (t.produto || "").toUpperCase();
            if (p.includes('ETANOL')) c = 'ET';
            else if (p.includes('GASOLINA')) c = 'GC';
            else if (p.includes('S10')) c = 'S10';
            else if (p.includes('S500')) c = 'S500';
            if (!c) return;

            const bN = (t.municipio_distribuidora || "").trim().toUpperCase();
            const sU = (t.uf_distribuidora || "").trim().toUpperCase();
            const keys = [`${bN}|${u}|${c}|${t.bandeira_validada.trim().toUpperCase()}`, `${bN} - ${sU}|${u}|${c}|${t.bandeira_validada.trim().toUpperCase()}`];

            let curr, prev;
            for (const k of keys) { if (cMarket.has(k)) { curr = cMarket.get(k); prev = pM.get(k); break; } }

            if (curr !== undefined && prev !== undefined) {
                const v = curr - prev;
                const tC = (c === 'S10' || c === 'S500') ? 'DIESEL' : c;
                const cM = groups[tC].get(gK);
                if (cM === undefined || Math.abs(v) > Math.abs(cM)) groups[tC].set(gK, v);
            }
        });

        const fmt = (map: Map<string, number>) => {
            const uS = new Set<string>(), bS = new Set<string>();
            map.forEach((_, k) => { const [u, b] = k.split('|'); uS.add(u); bS.add(b); });
            return { ufs: Array.from(uS).sort(), brands: Array.from(bS).sort(), values: map };
        };

        return { etanol: fmt(groups['ET']), gasolina: fmt(groups['GC']), diesel: fmt(groups['DIESEL']) };
    }, [tankValidationData, currentData, previousData, companyData]);

    // --- Render List View Node ---

    const renderNode = (node: VariationNode, level: number = 0) => {
        const hasChildren = node.children && node.children.length > 0;
        const isExpanded = expandedNodes[node.id];
        const paddingLeft = level * 20 + 8; // Indentation

        return (
            <div key={node.id} className="border-b last:border-0 border-border/50">
                <div
                    className={cn(
                        "grid grid-cols-12 gap-2 py-2 text-sm hover:bg-muted/50 transition-colors items-center",
                        level === 0 && "bg-muted/20 font-semibold",
                        level > 0 && "text-muted-foreground"
                    )}
                >
                    {/* Label / Tree Toggle */}
                    <div className="col-span-6 flex items-center pr-2" style={{ paddingLeft }}>
                        {hasChildren && (
                            <button
                                onClick={() => toggleNode(node.id)}
                                className="p-1 mr-1 rounded-sm hover:bg-muted"
                            >
                                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>
                        )}
                        <span className="truncate">{node.label}</span>
                    </div>

                    {/* Values */}
                    <div className="col-span-2 text-right">
                        <PriceValue value={node.currentPrice} />
                    </div>
                    <div className="col-span-2 text-right">
                        <PriceValue value={node.previousPrice} />
                    </div>
                    <div className="col-span-2 text-right pr-4">
                        <VariationValue value={node.variation} />
                    </div>
                </div>

                {/* Children */}
                {hasChildren && isExpanded && (
                    <div className="animate-in slide-in-from-top-1 duration-200">
                        {node.children!.map(child => renderNode(child, level + 1))}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Variações de Preço</h1>
                    <p className="text-muted-foreground">Comparativo de preços entre datas.</p>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Comparar:</span>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant={"outline"}
                                className={cn(
                                    "w-[240px] justify-start text-left font-normal",
                                    !date && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {date ? format(date, "PPP", { locale: ptBR }) : <span>Selecione a data</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                            <Calendar
                                mode="single"
                                selected={date}
                                onSelect={(d) => d && setDate(d)}
                                initialFocus
                            />
                        </PopoverContent>
                    </Popover>
                    <span className="text-sm text-muted-foreground mx-1">vs</span>
                    <Badge variant="outline">{format(subDays(date, 1), "dd/MM")}</Badge>
                </div>
            </div>

            {/* Content Tabs */}
            <Tabs defaultValue="list" className="w-full">
                <TabsList>
                    <TabsTrigger value="list">Lista Detalhada</TabsTrigger>
                    <TabsTrigger value="matrix">Heatmap Geral</TabsTrigger>
                    <TabsTrigger value="validated">Variações Validadas (3 Tabelas)</TabsTrigger>
                    <TabsTrigger value="petros">LOG Validação</TabsTrigger>
                </TabsList>

                <TabsContent value="validated" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Variações de Produtos Validados</CardTitle>
                            <CardDescription>
                                Exibindo a maior variação observada para cada UF e Bandeira, filtrado por postos com tanques validados.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {!integratedVariationData ? (
                                <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
                                    <Loader2 className="h-8 w-8 animate-spin mb-4" />
                                    <p>Processando variações validadas...</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <IntegratedTable title="ETANOL" data={integratedVariationData.etanol} />
                                    <IntegratedTable title="GASOLINA" data={integratedVariationData.gasolina} />
                                    <IntegratedTable title="DIESEL (S10 / S500)" data={integratedVariationData.diesel} />

                                    {(!integratedVariationData.etanol.ufs.length &&
                                        !integratedVariationData.gasolina.ufs.length &&
                                        !integratedVariationData.diesel.ufs.length) && (
                                            <div className="text-center py-12 text-muted-foreground">
                                                Nenhuma variação correspondente encontrada para os produtos e municípios validados.
                                            </div>
                                        )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="petros" className="mt-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-lg">Validação de Tanques (Petros)</CardTitle>
                                {validationLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                            </div>
                            <CardDescription>
                                Dados validados de compras nos últimos 14 dias.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                            <th className="py-3 px-4 text-left">Posto</th>
                                            <th className="py-3 px-4 text-left">Produto</th>
                                            <th className="py-3 px-4 text-left">Bandeira</th>
                                            <th className="py-3 px-4 text-left">Município (Dist)</th>
                                            <th className="py-3 px-4 text-right">Data Compra</th>
                                            <th className="py-3 px-4 text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tankValidationData.map((item, idx) => (
                                            <tr key={idx} className="border-b hover:bg-muted/50 transition-colors">
                                                <td className="py-3 px-4">{item.nome_posto}</td>
                                                <td className="py-3 px-4">{item.produto}</td>
                                                <td className="py-3 px-4">{item.bandeira_validada}</td>
                                                <td className="py-3 px-4">{item.municipio_distribuidora} - {item.uf_distribuidora}</td>
                                                <td className="py-3 px-4 text-right">{format(parseISO(item.data_ultima_compra), "dd/MM/yyyy")}</td>
                                                <td className="py-3 px-4 text-center">
                                                    <Badge className="bg-green-100 text-green-800 border-green-200">
                                                        {item.status_tanque}
                                                    </Badge>
                                                </td>
                                            </tr>
                                        ))}
                                        {tankValidationData.length === 0 && !validationLoading && (
                                            <tr>
                                                <td colSpan={6} className="text-center py-8 text-muted-foreground">
                                                    Nenhum dado de validação encontrado.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* List View */}
                <TabsContent value="list" className="mt-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-lg">Análise Detalhada</CardTitle>
                                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                            </div>
                            <CardDescription>
                                Expanda os grupos para ver detalhes de Praça, Base, Distribuidora e Terminais.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>

                            {/* Table Header */}
                            <div className="grid grid-cols-12 gap-2 pb-2 border-b text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                <div className="col-span-6 pl-4">Estrutura</div>
                                <div className="col-span-2 text-right">Atual</div>
                                <div className="col-span-2 text-right">Ontem</div>
                                <div className="col-span-2 text-right pr-4">Variação</div>
                            </div>

                            {/* Table Body */}
                            <div className="mt-2 text-sm">
                                {loading ? (
                                    <div className="flex justify-center p-8 text-muted-foreground">Carregando dados...</div>
                                ) : treeData.length === 0 ? (
                                    <div className="flex justify-center p-8 text-muted-foreground">Nenhum dado encontrado para esta data.</div>
                                ) : (
                                    treeData.map(node => renderNode(node))
                                )}
                            </div>

                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Matrix View */}
                <TabsContent value="matrix" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Matriz de Variações por Estado</CardTitle>
                            <CardDescription>
                                Variação média agrupada por UF de Destino e Distribuidora principal.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="text-left font-semibold py-3 px-4">UF</th>
                                            {matrixData.cols.map(col => (
                                                <th key={col} className="text-center font-semibold py-3 px-4">{col}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {matrixData.rows.map(uf => (
                                            <tr key={uf} className="border-b hover:bg-muted/50">
                                                <td className="font-medium py-3 px-4">{uf}</td>
                                                {matrixData.cols.map(col => {
                                                    const key = `${uf}|${col}`;
                                                    const data = matrixData.values.get(key);
                                                    const avgVar = data && data.count > 0 ? data.sum / data.count : undefined;

                                                    return (
                                                        <td key={col} className="text-center py-3 px-4">
                                                            {avgVar !== undefined ? (
                                                                <div className="flex items-center justify-center">
                                                                    <VariationValue value={avgVar} />
                                                                </div>
                                                            ) : (
                                                                <span className="text-muted-foreground">-</span>
                                                            )}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                        {matrixData.rows.length === 0 && !loading && (
                                            <tr>
                                                <td colSpan={matrixData.cols.length + 1} className="text-center py-8 text-muted-foreground">
                                                    Sem dados suficientes para gerar a matriz.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}

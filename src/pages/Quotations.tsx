import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, RefreshCw, Filter, Clock, Check, ChevronsUpDown, X } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { format, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";
import { Separator } from "@/components/ui/separator";

// Interfaces baseadas no retorno das funções RPC
interface MarketQuotation {
    "UF Destino": string;
    "Município Destino": string;
    "Base Origem": string;
    "UF Origem": string;
    "Distribuidora": string;
    "Preço Etanol": string;
    "Preço Gasolina C": string;
    "Preço Gasolina Adit": string;
    "Preço Diesel S10": string;
    "Preço Diesel S500": string;
}

interface CompanyQuotation {
    "Empresa": string;
    "Bandeira": string;
    "UF Posto": string;
    "Município Posto": string;
    "Base Origem": string;
    "UF Origem": string;
    "Distribuidora": string;
    "Preço Etanol": string;
    "Preço Gasolina C": string;
    "Preço Gasolina Adit": string;
    "Preço Diesel S10": string;
    "Preço Diesel S500": string;
}

type ViewMode = "market" | "company";

// Helper para extrair valor numérico de string formatada (ex: "R$ 3.8700") para ordenação
const parsePrice = (priceStr: string): number => {
    if (!priceStr || priceStr === '-') return Infinity;
    const clean = priceStr.replace('R$', '').trim();
    const num = parseFloat(clean);
    return isNaN(num) ? Infinity : num;
};

// Helper para cores das distribuidoras
const getDistributorColor = (name: string): string => {
    if (!name) return "text-slate-700";
    const n = name.toUpperCase();
    if (n.includes("RAIZEN") || n.includes("RAÍZEN") || n.includes("SHELL")) return "text-red-700 bg-red-50";
    if (n.includes("IPIRANGA")) return "text-yellow-700 bg-yellow-50";
    if (n.includes("VIBRA") || n.includes("PETROBRAS")) return "text-green-700 bg-green-50";
    if (n.includes("PETROBAHIA")) return "text-purple-700 bg-purple-50";
    if (n.includes("ALESAT")) return "text-blue-700 bg-blue-50";
    return "text-slate-700 hover:bg-slate-50";
};

// Card de Preço Individual
const PriceItem = ({ name, price, subtext, className }: { name: string, price: string, subtext?: string, className?: string }) => {
    if (price === '-' || !price) return null;

    return (
        <div className={cn(
            "flex justify-between items-center text-xs p-1.5 rounded mb-0.5 border-b border-slate-100 last:border-0 transition-all",
            className
        )}>
            <div className="flex flex-col">
                <span className="font-bold truncate max-w-[140px]" title={name}>{name.toUpperCase()}</span>
                {subtext && <span className="text-[10px] opacity-80">{subtext.toUpperCase()}</span>}
            </div>
            <span className="font-mono font-bold">{price}</span>
        </div>
    );
};

// Componente MultiSelect Genérico
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

    const handleClear = () => {
        onChange([]);
    };

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
                                            <Badge
                                                variant="secondary"
                                                key={option}
                                                className="rounded-sm px-1 font-normal"
                                            >
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
                                    <CommandItem
                                        key={option}
                                        onSelect={() => handleSelect(option)}
                                    >
                                        <div
                                            className={cn(
                                                "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                                isSelected
                                                    ? "bg-primary text-primary-foreground"
                                                    : "opacity-50 [&_svg]:invisible"
                                            )}
                                        >
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
                                    <CommandItem
                                        onSelect={handleClear}
                                        className="justify-center text-center"
                                    >
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


export default function Quotations() {
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>("market");

    // Date State
    const [selectedDate, setSelectedDate] = useState<Date>(() => {
        const params = new URLSearchParams(window.location.search);
        const dateParam = params.get('date');
        if (dateParam) {
            const [year, month, day] = dateParam.split('-').map(Number);
            if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
                return new Date(year, month - 1, day);
            }
        }
        // Fallback: Ontem
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return d;
    });

    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

    // Data State
    const [marketData, setMarketData] = useState<MarketQuotation[]>([]);
    const [companyData, setCompanyData] = useState<CompanyQuotation[]>([]);

    // Filter Options
    const [filterOptions, setFilterOptions] = useState<{ ufs: string[], bases: string[] }>({ ufs: [], bases: [] });

    // Multi-Select States
    const [selectedPlaces, setSelectedPlaces] = useState<string[]>([]);
    const [selectedBases, setSelectedBases] = useState<string[]>([]);

    // URL Logic for Screenshot Service (keep backward compatibility or adapt)
    // If URL has 'pracas', set selectedPlaces initially
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const pracasParam = params.get('pracas');
        if (pracasParam) {
            const pracas = pracasParam.split(',').map(p => p.trim().toUpperCase());
            setSelectedPlaces(pracas);
        }
    }, []); // Run once on mount

    const fetchData = async () => {
        setLoading(true);
        try {
            const dateStr = format(selectedDate, 'yyyy-MM-dd');
            const action = viewMode === "market" ? "market" : "company";

            const { data, error } = await supabase.functions.invoke('quotations-api', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                // Passing params as query parameters in the URL
                query: {
                    action,
                    date: dateStr
                }
            });

            if (error) throw error;

            if (viewMode === "market") {
                setMarketData(data || []);
            } else {
                setCompanyData(data || []);
            }
            setLastUpdated(new Date());
        } catch (err: any) {
            console.error("Error fetching quotations:", err);
            toast.error("Erro ao buscar cotações: " + (err.message || "Erro desconhecido"));
        } finally {
            setLoading(false);
        }
    };

    const fetchFilterOptions = async () => {
        try {
            const dateStr = format(selectedDate, 'yyyy-MM-dd');

            const { data, error } = await supabase.functions.invoke('quotations-api', {
                method: 'GET',
                query: {
                    action: 'filters',
                    date: dateStr,
                    view: viewMode
                }
            });

            if (error) throw error;

            if (data) {
                const ufs = new Set<string>();
                const bases = new Set<string>();

                data.forEach((item: any) => {
                    if (item.praca && item.praca !== '--/--') ufs.add(item.praca);
                    if (item.base_origem && item.base_origem !== '--') bases.add(item.base_origem);
                });

                setFilterOptions({
                    ufs: Array.from(ufs).sort(),
                    bases: Array.from(bases).sort()
                });
            }
        } catch (err) {
            console.error("Error fetching options:", err);
        }
    };

    // Atualizar dados quando filtros globais mudam (Data ou Modo)
    useEffect(() => {
        fetchData();
        fetchFilterOptions();
        // Reset local filters when view changes? Maybe keep them if possible. 
        // Clearing is safer to avoid invalid states.
        setSelectedPlaces([]);
        setSelectedBases([]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [viewMode, selectedDate]);


    const filteredData = useMemo(() => {
        let data = viewMode === "market" ? marketData : companyData;

        // Client-side Filtering
        if (selectedPlaces.length > 0) {
            data = data.filter(item => {
                const ufDest = (viewMode === "market" ? (item as MarketQuotation)["UF Destino"] : (item as CompanyQuotation)["UF Posto"])?.toString().trim().toUpperCase() || '--';
                const ufOrig = (item as any)["UF Origem"]?.toString().trim().toUpperCase() || '--';
                const itemPraca = `${ufOrig}/${ufDest}`; // Consistency with options format

                // Allow exact match or if user selected just one UF (backwards compat if needed, but MultiSelect uses options)
                return selectedPlaces.includes(itemPraca);
            });
        }

        if (selectedBases.length > 0) {
            data = data.filter(item => {
                const base = (item as any)["Base Origem"];
                return selectedBases.includes(base);
            });
        }

        return data;
    }, [marketData, companyData, viewMode, selectedPlaces, selectedBases]);

    const titleSuffix = useMemo(() => {
        const parts = [];
        if (selectedPlaces.length > 0) {
            if (selectedPlaces.length > 3) parts.push(`${selectedPlaces.length} Praças`);
            else parts.push(selectedPlaces.join(", "));
        }
        if (selectedBases.length > 0) {
            if (selectedBases.length > 3) parts.push(`${selectedBases.length} Bases`);
            else parts.push(selectedBases.join(", "));
        }
        if (parts.length === 0) return "";
        return " - " + parts.join(" | ");
    }, [selectedPlaces, selectedBases]);

    const isToday = useMemo(() => isSameDay(selectedDate, new Date()), [selectedDate]);

    // Grouping Logic
    const products = [
        { key: "Preço Etanol", label: "ETANOL", short: "ET" },
        { key: "Preço Gasolina C", label: "GASOLINA COMUM", short: "GC" },
        { key: "Preço Gasolina Adit", label: "GASOLINA ADITIVADA", short: "GA" },
        { key: "Preço Diesel S10", label: "DIESEL S10", short: "S10" },
        { key: "Preço Diesel S500", label: "DIESEL S500", short: "S500" }
    ];

    const getGroupedData = (productKey: string) => {
        const groups: Record<string, any[]> = {};

        filteredData.forEach(item => {
            // @ts-ignore
            const price = item[productKey];
            if (price && price !== '-') {
                const ufDest = viewMode === "market" ? (item as MarketQuotation)["UF Destino"] : (item as CompanyQuotation)["UF Posto"];
                const ufOrig = (item as any)["UF Origem"];
                const baseName = (item as any)["Base Origem"];
                const groupKey = `${ufOrig}/${ufDest}|${baseName}`;

                if (!groups[groupKey]) groups[groupKey] = [];
                groups[groupKey].push(item);
            }
        });

        // Sort items within groups
        Object.keys(groups).forEach(key => {
            groups[key].sort((a, b) => {
                // @ts-ignore
                const pA = parsePrice(a[productKey]);
                // @ts-ignore
                const pB = parsePrice(b[productKey]);
                return pA - pB;
            });
        });

        return groups;
    };

    return (
        <div className="h-full flex flex-col space-y-4 p-4 md:p-6 bg-slate-50/50">
            {/* Top Bar: Filters & Controls */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-white p-4 rounded-lg border shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant={"outline"}
                                className={cn(
                                    "w-[200px] justify-start text-left font-normal",
                                    !selectedDate && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {selectedDate ? format(selectedDate, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                mode="single"
                                selected={selectedDate}
                                onSelect={(date) => date && setSelectedDate(date)}
                                initialFocus
                            />
                        </PopoverContent>
                    </Popover>

                    <MultiSelect
                        title="Praças"
                        options={filterOptions.ufs}
                        selected={selectedPlaces}
                        onChange={setSelectedPlaces}
                        placeholder="Buscar Praça..."
                    />

                    <MultiSelect
                        title="Bases"
                        options={filterOptions.bases}
                        selected={selectedBases}
                        onChange={setSelectedBases}
                        placeholder="Buscar Base..."
                    />
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                    <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)} className="w-full md:w-[300px]">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="market">Visão Mercado</TabsTrigger>
                            <TabsTrigger value="company">Visão Empresa</TabsTrigger>
                        </TabsList>
                    </Tabs>
                    <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>

            {/* Title Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-2 px-1">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-800 flex items-center flex-wrap gap-2">
                        Cotações de Combustíveis
                        <span className="font-normal text-slate-500 text-lg">
                            {titleSuffix}
                        </span>
                    </h1>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                        <Badge variant="secondary" className="font-medium text-slate-600">Informativo Resumido</Badge>
                    </div>
                </div>

                {/* Last Update - Only show if Today */}
                {isToday && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-slate-100 px-2 py-1 rounded-md">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Última atualização: <span className="font-medium text-slate-700">{format(lastUpdated, "HH:mm:ss")}</span></span>
                    </div>
                )}
            </div>

            {/* Main Grid */}
            <div className="flex-1 overflow-x-auto pb-4">
                <div className="flex gap-4 min-w-[1200px] h-full">
                    {products.map((product) => {
                        const groupedData = getGroupedData(product.key);
                        const hasData = Object.keys(groupedData).length > 0;

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
                                        Object.entries(groupedData).map(([groupKey, items]) => {
                                            const [ufs, baseName] = groupKey.split('|');
                                            return (
                                                <div key={groupKey} className="border-b last:border-0 pb-2 mb-2">
                                                    {/* Group Header */}
                                                    <div className="flex items-center gap-1.5 mb-1.5 bg-slate-50 p-1 rounded">
                                                        <Badge variant="outline" className="text-[10px] h-5 bg-white px-1 font-bold text-slate-600 border-slate-300">
                                                            {ufs}
                                                        </Badge>
                                                        <span className="text-[10px] font-bold text-slate-600 truncate" title={baseName}>
                                                            {baseName}
                                                        </span>
                                                    </div>

                                                    {/* Items List */}
                                                    <div className="space-y-0.5">
                                                        {items.map((item, idx) => {
                                                            // Determine Name to display
                                                            const nameDisplay = viewMode === "market"
                                                                ? (item as MarketQuotation)["Distribuidora"]
                                                                : (item as CompanyQuotation)["Empresa"];

                                                            // Subtext logic
                                                            let subtext: string | undefined;
                                                            if (viewMode === "company") {
                                                                subtext = `${(item as CompanyQuotation)["Bandeira"]}`;
                                                                if ((item as CompanyQuotation)["Distribuidora"] !== (item as CompanyQuotation)["Empresa"]) {
                                                                    subtext += ` - ${(item as CompanyQuotation)["Distribuidora"]}`;
                                                                }
                                                            }

                                                            const distributorName = (item as any)["Distribuidora"] || (item as any)["Bandeira"];
                                                            const colorClass = getDistributorColor(distributorName);

                                                            return (
                                                                <PriceItem
                                                                    key={idx}
                                                                    name={nameDisplay}
                                                                    // @ts-ignore
                                                                    price={item[product.key]}
                                                                    subtext={subtext}
                                                                    className={colorClass}
                                                                />
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

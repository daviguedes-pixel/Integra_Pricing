import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SisEmpresaCombobox } from "@/components/SisEmpresaCombobox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Calendar as CalendarIcon, Search } from "lucide-react";
import { format } from "date-fns";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";

const PRODUCTS = [
    { id: "GASOLINA COMUM", label: "Gasolina Comum" },
    { id: "GASOLINA ADITIVADA", label: "Gasolina Aditivada" },
    { id: "ETANOL HIDRATADO", label: "Etanol Hidratado" },
    { id: "DIESEL S10", label: "Diesel S-10" },
    { id: "DIESEL S10 ADITIVADO", label: "Diesel S-10 Aditivado" },
    { id: "DIESEL S500", label: "Diesel S-500" },
    { id: "DIESEL S500 ADITIVADO", label: "Diesel S-500 Aditivado" },
];

interface CostResult {
    product: string;
    base_id: string;
    base_nome: string;
    base_codigo: string;
    base_uf: string;
    custo: number;
    frete: number;
    custo_total: number;
    forma_entrega: string;
    data_referencia: string;
    base_bandeira: string;
}

export default function DailyCost() {
    const [date, setDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
    const [selectedStation, setSelectedStation] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<CostResult[]>([]);
    const [hasSearched, setHasSearched] = useState(false);

    const handleSearch = async () => {
        if (!selectedStation) {
            toast.error("Selecione um posto");
            return;
        }
        if (!date) {
            toast.error("Selecione uma data");
            return;
        }

        setLoading(true);
        setResults([]);
        setHasSearched(true);

        try {
            const promises = PRODUCTS.map(async (prod) => {
                const { data, error } = await supabase.rpc("get_lowest_cost_freight", {
                    p_posto_id: selectedStation,
                    p_produto: prod.id,
                    p_date: date,
                });

                if (error) {
                    console.error(`Erro ao buscar custo para ${prod.label}:`, error);
                    return null;
                }

                if (data && data.length > 0) {
                    const result = data[0];
                    const refDate = result.data_referencia ? format(new Date(result.data_referencia), "yyyy-MM-dd") : null;

                    console.log(`📋 [Custo do Dia] Cálculo para ${prod.label}:`);
                    console.log(`   Posto: ${selectedStation}`);
                    console.log(`   Data Ref: ${result.data_referencia} ${refDate && date && refDate !== date ? '(Último disponível)' : ''}`);
                    if (result.debug_info) {
                        console.warn(`   ⚠️ DEBUG: ${result.debug_info}`);
                    }
                    console.log(`   Custo Base (Compra): R$ ${result.custo}`);
                    console.log(`   Frete: R$ ${result.frete}`);
                    console.log(`   = Total: R$ ${result.custo + result.frete} (RPC retornou: ${result.custo_total})`);

                    return { ...result, product: prod.label };
                }
                return null;
            });

            const resultsData = await Promise.all(promises);
            const validResults = resultsData.filter((r): r is CostResult => r !== null);
            setResults(validResults);

            if (validResults.length === 0) {
                toast.info("Nenhum custo encontrado para a data selecionada.");
            } else {
                toast.success("Custos atualizados com sucesso!");
            }
        } catch (error) {
            console.error("Erro geral:", error);
            toast.error("Erro ao buscar custos. Tente novamente.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container mx-auto p-6 space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Custo do Dia</h1>
                <p className="text-muted-foreground">
                    Consulte o menor custo de combustível para um posto em uma data específica.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2">
                        <Search className="h-5 w-5" />
                        Filtros de Busca
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                        <div className="space-y-2">
                            <Label>Posto</Label>
                            <SisEmpresaCombobox
                                value={selectedStation}
                                onSelect={(_id, name) => setSelectedStation(name)}
                                className="w-full"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Data</Label>
                            <div className="relative">
                                <Input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-full"
                                />
                            </div>
                        </div>

                        <Button
                            onClick={handleSearch}
                            disabled={loading || !selectedStation || !date}
                            className="w-full md:w-auto"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Buscando...
                                </>
                            ) : (
                                <>
                                    <Search className="mr-2 h-4 w-4" />
                                    Consultar Custos
                                </>
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {hasSearched && (
                <Card>
                    <CardHeader>
                        <CardTitle>Resultados</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {results.length > 0 ? (
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Produto</TableHead>
                                            <TableHead>Base</TableHead>
                                            <TableHead>Bandeira</TableHead>
                                            <TableHead>Data Ref.</TableHead>
                                            <TableHead className="text-right">Custo Base</TableHead>
                                            <TableHead className="text-right">Frete</TableHead>
                                            <TableHead className="text-right">Custo Total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {results.map((item, index) => (
                                            <TableRow key={index}>
                                                <TableCell className="font-medium">{item.product}</TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span>{item.base_nome}</span>
                                                        <span className="text-xs text-muted-foreground">{item.base_uf}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                        {item.base_bandeira || "N/A"}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span>
                                                            {item.data_referencia
                                                                ? format(new Date(item.data_referencia), "dd/MM/yyyy HH:mm")
                                                                : "N/A"}
                                                        </span>
                                                        {item.data_referencia && format(new Date(item.data_referencia), "yyyy-MM-dd") !== date && (
                                                            <span className="text-xs text-amber-600 font-medium">
                                                                (Último disponível)
                                                            </span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {item.custo.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {item.frete.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                                                </TableCell>
                                                <TableCell className="text-right font-bold text-green-600">
                                                    {item.custo_total.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        ) : (
                            <div className="text-center py-10 text-muted-foreground">
                                Nenhum resultado encontrado para os critérios selecionados.
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

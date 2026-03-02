import { Badge } from "@/components/ui/badge";
import { Clock, Check, X, DollarSign, MessageSquarePlus, FileQuestion } from "lucide-react";
import { formatBrazilianCurrency } from "@/lib/utils";

/**
 * Utilitários para a página de Aprovações
 */

/** Formata preço em moeda brasileira */
export const formatPrice = (price: number): string => {
    return formatBrazilianCurrency(price);
};

/** Formata data no padrão brasileiro */
export const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('pt-BR');
};

/** Formata data e hora no padrão brasileiro */
export const formatDateTime = (dateString: string): string => {
    return new Date(dateString).toLocaleString('pt-BR');
};

/** Retorna o Badge de status apropriado */
export const getStatusBadge = (status: string) => {
    switch (status) {
        case 'pending':
            return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
        case 'approved':
            return <Badge variant="default" className="bg-green-100 text-green-800"><Check className="h-3 w-3 mr-1" />Aprovado</Badge>;
        case 'rejected':
            return <Badge variant="destructive"><X className="h-3 w-3 mr-1" />Rejeitado</Badge>;
        case 'price_suggested':
            return <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300"><DollarSign className="h-3 w-3 mr-1" />Preço Sugerido</Badge>;
        case 'awaiting_justification':
            return <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300"><MessageSquarePlus className="h-3 w-3 mr-1" />Aguardando Justificativa</Badge>;
        case 'awaiting_evidence':
            return <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-300"><FileQuestion className="h-3 w-3 mr-1" />Aguardando Referência</Badge>;
        case 'appealed':
            return <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300"><MessageSquarePlus className="h-3 w-3 mr-1" />Recurso</Badge>;
        default:
            return <Badge variant="outline">{status}</Badge>;
    }
};

/** Mapa de nomes de produtos */
const productNames: Record<string, string> = {
    's10': 'Diesel S-10',
    's10_aditivado': 'Diesel S-10 Aditivado',
    'diesel_s500': 'Diesel S-500',
    'diesel_s500_aditivado': 'Diesel S-500 Aditivado',
    'arla32_granel': 'Arla 32 Granel',
    // Compatibilidade com valores antigos
    'gasolina_comum': 'Gasolina Comum',
    'gasolina_aditivada': 'Gasolina Aditivada',
    'etanol': 'Etanol',
    'diesel_comum': 'Diesel Comum',
    'diesel_s10': 'Diesel S-10',
    's500': 'Diesel S-500',
    'diesel_s10_aditivado': 'Diesel S-10 Aditivado',
    's500_aditivado': 'Diesel S-500 Aditivado',
    'arla': 'ARLA 32'
};

/** Retorna nome amigável do produto */
export const getProductName = (product: string): string => {
    return productNames[product] || product;
};

/** Converte centavos para reais */
export const centsToReais = (cents: number | null | undefined): string => {
    if (cents === null || cents === undefined) return 'N/A';
    return formatBrazilianCurrency(cents / 100);
};

/** Valida se é um UUID válido */
export const isValidUUID = (str: any): boolean => {
    if (typeof str !== 'string') {
        console.warn(`[isValidUUID] Valor não é string:`, str);
        return false;
    }
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isValid = uuidRegex.test(str);
    if (!isValid) {
        console.warn(`[isValidUUID] UUID inválido detectado: "${str}"`);
    }
    return isValid;
};

/** Formata preço com 4 casas decimais (para valores unitários como custo/L) */
export const formatPrice4Decimals = (price: number): string => {
    if (typeof price !== 'number' || isNaN(price)) return 'R$ 0,0000';
    return price.toLocaleString('pt-BR', {
        minimumFractionDigits: 4,
        maximumFractionDigits: 4,
        style: 'currency',
        currency: 'BRL'
    });
};

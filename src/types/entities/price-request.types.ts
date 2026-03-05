/**
 * Tipos para PriceRequest.tsx
 */

/** Status de busca de custos */
export type FetchStatusType = 'today' | 'latest' | 'reference' | 'none' | 'error';

export interface FetchStatus {
    type: FetchStatusType;
    date?: string | null;
    message?: string;
}

/** Origem do preço (base fornecedora) */
export interface PriceOrigin {
    base_nome: string;
    base_bandeira: string;
    forma_entrega: string;
    base_codigo?: string;
}

/** Custo por posto - dados de custo e frete */
export interface StationCost {
    purchase_cost: number;
    freight_cost: number;
    final_cost?: number;
    margin_cents?: number;
    station_name: string;
    total_revenue?: number;
    total_cost?: number;
    gross_profit?: number;
    profit_per_liter?: number;
    arla_compensation?: number;
    net_result?: number;
    feePercentage?: number;
    base_nome?: string;
    base_bandeira?: string;
    forma_entrega?: string;
    data_referencia?: string;
    arla_cost?: number;
}

/** Card adicionado na tela (resultado individual por posto) */
export interface AddedCard {
    id: string;
    stationName: string;
    stationCode: string;
    location: string;
    bandeira?: string;
    netResult: number;
    suggestionId: string;
    expanded: boolean;
    costAnalysis?: CostAnalysis;
    attachments?: string[];
    clientName?: string;
    ocrResults?: any[];
}

/** Análise de custo para exibição */
export interface CostAnalysis {
    finalCost: number;
    totalRevenue: number;
    totalCost: number;
    grossProfit: number;
    profitPerLiter: number;
    arlaCompensation: number;
    netResult: number;
    taxRate?: number;
    taxValue?: number;
    volumeMade?: number;
    volumeProjected?: number;
    marginCents?: number;
}

/** Dados do formulário de solicitação */
export interface PriceRequestFormData {
    station_id: string;
    station_ids: string[];
    client_id: string;
    product: string;
    current_price: string;
    reference_id: string;
    suggested_price: string;
    payment_method_id: string;
    observations: string;
    attachments: string[];
    purchase_cost: string;
    freight_cost: string;
    volume_made: string;
    volume_projected: string;
    arla_purchase_price: string;
    arla_cost_price: string;
}

/** Solicitação enriquecida com dados de relacionamentos */
export interface EnrichedPriceRequest {
    id: string;
    station_id?: string | null;
    station_ids?: string[];
    client_id?: string | null;
    product: string;
    status: string;
    suggested_price?: number | null;
    current_price?: number | null;
    cost_price?: number | null;
    final_price?: number | null;
    margin_cents?: number | null;
    payment_method_id?: string | null;
    batch_id?: string | null;
    batch_name?: string | null;
    requested_by?: string | null;
    created_by?: string | null;
    created_at: string;
    updated_at?: string | null;
    observations?: string | null;
    attachments?: string[] | null;
    /** Contagem de recursos */
    appeal_count?: number;
    /** Indica se já houve recurso */
    has_appealed?: boolean;
    /** Produto evidenciado (para referência) */
    evidence_product?: string | null;
    /** Quem realizou a última ação */
    last_approver_action_by?: string | null;
    /** Nome do aprovador atual */
    current_approver_name?: string | null;
    /** ID do aprovador atual */
    current_approver_id?: string | null;
    // Relacionamentos

    stations?: { name: string; code: string; municipio?: string; uf?: string } | null;
    stations_list?: Array<{ name: string; code: string; municipio?: string; uf?: string }>;
    clients?: { name: string; code: string } | null;
    payment_methods?: { name: string; CARTAO?: string; TAXA?: number; PRAZO?: number | string } | null;
}

/** Lote de propostas */
export interface ProposalBatch {
    type: 'batch';
    batchKey: string;
    requests: EnrichedPriceRequest[];
    created_at: string;
    client?: { name: string; code?: string } | null;
    clients?: ({ name: string; code?: string } | null)[];
    hasMultipleClients: boolean;
    created_by?: string | null;
    batch_name?: string | null;
}

/** Item de proposta (pode ser batch ou individual) */
export type ProposalItem = ProposalBatch | EnrichedPriceRequest;

/** Método de pagamento do posto */
export interface StationPaymentMethod {
    id?: number | string;
    CARTAO: string;
    TAXA?: number;
    PRAZO?: number | string;
    ID_POSTO?: string;
    POSTO?: string;
}

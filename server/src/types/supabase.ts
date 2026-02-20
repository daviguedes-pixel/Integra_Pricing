export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export type Database = {
    public: {
        Tables: {
            price_suggestions: {
                Row: {
                    id: string
                    station_id: string | null
                    client_id: string | null
                    product: 's10' | 's10_aditivado' | 'diesel_b' | 'diesel_b_aditivado' | 'gasolina_c' | 'gasolina_c_aditivada' | 'etanol' | 'arla32_granel'
                    requested_by: string | null
                    created_by: string | null
                    status: string | null
                    approval_level: number | null
                    approvals_count: number | null
                    total_approvers: number | null
                    final_price: number
                    margin_cents: number
                    cost_price: number
                    current_approver_id: string | null
                    current_approver_name: string | null
                    rejections_count: number | null
                    approved_by: string | null
                    approved_at: string | null
                    created_at: string | null
                    updated_at: string | null
                    // Add other fields as needed from the full types.ts if necessary
                }
                Insert: {
                    id?: string
                    station_id?: string | null
                    client_id?: string | null
                    product: 's10' | 's10_aditivado' | 'diesel_b' | 'diesel_b_aditivado' | 'gasolina_c' | 'gasolina_c_aditivada' | 'etanol' | 'arla32_granel'
                    requested_by?: string | null
                    created_by?: string | null
                    status?: string | null
                    approval_level?: number | null
                    approvals_count?: number | null
                    total_approvers?: number | null
                    final_price: number
                    margin_cents: number
                    cost_price: number
                    current_approver_id?: string | null
                    current_approver_name?: string | null
                    rejections_count?: number | null
                    approved_by?: string | null
                    approved_at?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Update: {
                    id?: string
                    station_id?: string | null
                    client_id?: string | null
                    product?: 's10' | 's10_aditivado' | 'diesel_b' | 'diesel_b_aditivado' | 'gasolina_c' | 'gasolina_c_aditivada' | 'etanol' | 'arla32_granel'
                    requested_by?: string | null
                    created_by?: string | null
                    status?: string | null
                    approval_level?: number | null
                    approvals_count?: number | null
                    total_approvers?: number | null
                    final_price?: number
                    margin_cents?: number
                    cost_price?: number
                    current_approver_id?: string | null
                    current_approver_name?: string | null
                    rejections_count?: number | null
                    approved_by?: string | null
                    approved_at?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                }
            }
            user_profiles: {
                Row: {
                    user_id: string
                    email: string
                    nome: string | null
                    perfil: string | null
                    ativo: boolean | null
                }
            }
            profile_permissions: {
                Row: {
                    id: string
                    can_approve: boolean
                }
            }
            approval_margin_rules: {
                Row: {
                    id: string
                    min_margin_cents: number
                    required_profiles: string[]
                    is_active: boolean
                    priority_order: number | null
                }
            }
            approval_profile_order: {
                Row: {
                    perfil: string
                    order_position: number
                    is_active: boolean
                }
            }
            approval_history: {
                Insert: {
                    suggestion_id: string
                    approver_id: string
                    approver_name: string
                    action: string
                    approval_level: number
                    observations?: string | null
                }
            }
            notifications: {
                Insert: {
                    user_id: string
                    title: string
                    message: string
                    type: string
                    suggestion_id: string
                    read: boolean
                }
            }
            approval_settings: {
                Row: {
                    key: string
                    value: string
                }
            }
        }
        Enums: {
            product_type: 's10' | 's10_aditivado' | 'diesel_b' | 'diesel_b_aditivado' | 'gasolina_c' | 'gasolina_c_aditivada' | 'etanol' | 'arla32_granel'
            reference_type: 'competitor' | 'custom'
        }
    }
}

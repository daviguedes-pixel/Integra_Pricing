export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      approval_history: {
        Row: {
          action: string
          approval_level: number
          approver_id: string | null
          approver_name: string
          created_at: string | null
          id: string
          observations: string | null
          suggestion_id: string
          updated_at: string | null
        }
        Insert: {
          action: string
          approval_level?: number
          approver_id?: string | null
          approver_name: string
          created_at?: string | null
          id?: string
          observations?: string | null
          suggestion_id: string
          updated_at?: string | null
        }
        Update: {
          action?: string
          approval_level?: number
          approver_id?: string | null
          approver_name?: string
          created_at?: string | null
          id?: string
          observations?: string | null
          suggestion_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_history_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "price_suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_margin_rules: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          max_margin_cents: number | null
          min_margin_cents: number
          priority_order: number | null
          required_profiles: string[]
          rule_name: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          max_margin_cents?: number | null
          min_margin_cents: number
          priority_order?: number | null
          required_profiles: string[]
          rule_name?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          max_margin_cents?: number | null
          min_margin_cents?: number
          priority_order?: number | null
          required_profiles?: string[]
          rule_name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      approval_profile_order: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          order_position: number
          perfil: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          order_position: number
          perfil: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          order_position?: number
          perfil?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      clientes: {
        Row: {
          id: number
          id_cliente: number
          nome: string
        }
        Insert: {
          id?: number
          id_cliente: number
          nome: string
        }
        Update: {
          id?: number
          id_cliente?: number
          nome?: string
        }
        Relationships: []
      }
      commercial_proposals: {
        Row: {
          client_id: string | null
          created_at: string
          created_by: string | null
          id: string
          metadata: Json | null
          observations: string | null
          proposal_number: number
          status: string
          total_value: number | null
          total_volume: number | null
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json | null
          observations?: string | null
          proposal_number?: number
          status?: string
          total_value?: number | null
          total_volume?: number | null
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json | null
          observations?: string | null
          proposal_number?: number
          status?: string
          total_value?: number | null
          total_volume?: number | null
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      competitor_research: {
        Row: {
          address: string | null
          attachments: string[] | null
          created_at: string | null
          created_by: string | null
          date_observed: string
          id: string
          latitude: number | null
          longitude: number | null
          notes: string | null
          price: number
          product: Database["public"]["Enums"]["product_type"]
          station_name: string
          station_type: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          attachments?: string[] | null
          created_at?: string | null
          created_by?: string | null
          date_observed: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          price: number
          product: Database["public"]["Enums"]["product_type"]
          station_name: string
          station_type?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          attachments?: string[] | null
          created_at?: string | null
          created_by?: string | null
          date_observed?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          price?: number
          product?: Database["public"]["Enums"]["product_type"]
          station_name?: string
          station_type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      concorrentes: {
        Row: {
          autorizacao: string | null
          bairro: string | null
          bandeira: string | null
          cep: string | null
          classe: string | null
          cnpj: string
          codigo_simp: number | null
          complemento: string | null
          data_obtencao: string | null
          data_publicacao: string | null
          data_vinculacao: string | null
          distruibuidora: string | null
          endereco: string | null
          estimativa_acuracia: string | null
          id_posto: number
          latitude: number | null
          latitude_anpac: number | null
          longitude: number | null
          longitude_anpac: number | null
          municipio: string | null
          observacao: string | null
          origem_informacao: string | null
          razao_social: string
          situacao_constatada: string | null
          src: string | null
          srid: number | null
          status_sigaf: string | null
          uf: string | null
          validacao: string | null
        }
        Insert: {
          autorizacao?: string | null
          bairro?: string | null
          bandeira?: string | null
          cep?: string | null
          classe?: string | null
          cnpj: string
          codigo_simp?: number | null
          complemento?: string | null
          data_obtencao?: string | null
          data_publicacao?: string | null
          data_vinculacao?: string | null
          distruibuidora?: string | null
          endereco?: string | null
          estimativa_acuracia?: string | null
          id_posto?: number
          latitude?: number | null
          latitude_anpac?: number | null
          longitude?: number | null
          longitude_anpac?: number | null
          municipio?: string | null
          observacao?: string | null
          origem_informacao?: string | null
          razao_social: string
          situacao_constatada?: string | null
          src?: string | null
          srid?: number | null
          status_sigaf?: string | null
          uf?: string | null
          validacao?: string | null
        }
        Update: {
          autorizacao?: string | null
          bairro?: string | null
          bandeira?: string | null
          cep?: string | null
          classe?: string | null
          cnpj?: string
          codigo_simp?: number | null
          complemento?: string | null
          data_obtencao?: string | null
          data_publicacao?: string | null
          data_vinculacao?: string | null
          distruibuidora?: string | null
          endereco?: string | null
          estimativa_acuracia?: string | null
          id_posto?: number
          latitude?: number | null
          latitude_anpac?: number | null
          longitude?: number | null
          longitude_anpac?: number | null
          municipio?: string | null
          observacao?: string | null
          origem_informacao?: string | null
          razao_social?: string
          situacao_constatada?: string | null
          src?: string | null
          srid?: number | null
          status_sigaf?: string | null
          uf?: string | null
          validacao?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string | null
          data: Json | null
          id: string
          message: string
          read: boolean | null
          suggestion_id: string
          title: string
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          data?: Json | null
          id?: string
          message: string
          read?: boolean | null
          suggestion_id: string
          title: string
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          data?: Json | null
          id?: string
          message?: string
          read?: boolean | null
          suggestion_id?: string
          title?: string
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      price_suggestions: {
        Row: {
          approval_level: number | null
          approvals_count: number | null
          approved_at: string | null
          approved_by: string | null
          arla_cost_price: number | null
          arla_purchase_price: number | null
          attachments: string[] | null
          batch_id: string | null
          batch_name: string | null
          client_id: string | null
          cost_price: number
          created_at: string | null
          created_by: string | null
          current_approver_id: string | null
          current_approver_name: string | null
          current_price: number | null
          final_price: number
          freight_cost: number | null
          id: string
          margin_cents: number
          observations: string | null
          payment_method_id: string | null
          price_origin_bandeira: string | null
          price_origin_base: string | null
          price_origin_code: string | null
          price_origin_delivery: string | null
          price_origin_uf: string | null
          product: Database["public"]["Enums"]["product_type"]
          proposal_id: string | null
          purchase_cost: number | null
          reference_id: string | null
          reference_type: Database["public"]["Enums"]["reference_type"] | null
          rejections_count: number | null
          requested_by: string | null
          station_id: string | null
          status: string | null
          suggested_price: number | null
          total_approvers: number | null
          updated_at: string | null
          volume_made: number | null
          volume_projected: number | null
        }
        Insert: {
          approval_level?: number | null
          approvals_count?: number | null
          approved_at?: string | null
          approved_by?: string | null
          arla_cost_price?: number | null
          arla_purchase_price?: number | null
          attachments?: string[] | null
          batch_id?: string | null
          batch_name?: string | null
          client_id?: string | null
          cost_price: number
          created_at?: string | null
          created_by?: string | null
          current_approver_id?: string | null
          current_approver_name?: string | null
          current_price?: number | null
          final_price: number
          freight_cost?: number | null
          id?: string
          margin_cents: number
          observations?: string | null
          payment_method_id?: string | null
          price_origin_bandeira?: string | null
          price_origin_base?: string | null
          price_origin_code?: string | null
          price_origin_delivery?: string | null
          price_origin_uf?: string | null
          product: Database["public"]["Enums"]["product_type"]
          proposal_id?: string | null
          purchase_cost?: number | null
          reference_id?: string | null
          reference_type?: Database["public"]["Enums"]["reference_type"] | null
          rejections_count?: number | null
          requested_by?: string | null
          station_id?: string | null
          status?: string | null
          suggested_price?: number | null
          total_approvers?: number | null
          updated_at?: string | null
          volume_made?: number | null
          volume_projected?: number | null
        }
        Update: {
          approval_level?: number | null
          approvals_count?: number | null
          approved_at?: string | null
          approved_by?: string | null
          arla_cost_price?: number | null
          arla_purchase_price?: number | null
          attachments?: string[] | null
          batch_id?: string | null
          batch_name?: string | null
          client_id?: string | null
          cost_price?: number
          created_at?: string | null
          created_by?: string | null
          current_approver_id?: string | null
          current_approver_name?: string | null
          current_price?: number | null
          final_price?: number
          freight_cost?: number | null
          id?: string
          margin_cents?: number
          observations?: string | null
          payment_method_id?: string | null
          price_origin_bandeira?: string | null
          price_origin_base?: string | null
          price_origin_code?: string | null
          price_origin_delivery?: string | null
          price_origin_uf?: string | null
          product?: Database["public"]["Enums"]["product_type"]
          proposal_id?: string | null
          purchase_cost?: number | null
          reference_id?: string | null
          reference_type?: Database["public"]["Enums"]["reference_type"] | null
          rejections_count?: number | null
          requested_by?: string | null
          station_id?: string | null
          status?: string | null
          suggested_price?: number | null
          total_approvers?: number | null
          updated_at?: string | null
          volume_made?: number | null
          volume_projected?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "price_suggestions_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "commercial_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_permissions: {
        Row: {
          admin: boolean
          approval_margin_config: boolean
          approvals: boolean
          audit_logs: boolean
          can_approve: boolean
          can_delete: boolean
          can_edit: boolean
          can_manage_notifications: boolean
          can_register: boolean
          can_view_all_proposals: boolean | null
          can_view_history: boolean
          client_management: boolean
          created_at: string | null
          dashboard: boolean
          gestao: boolean
          gestao_clients: boolean
          gestao_payment_methods: boolean
          gestao_stations: boolean
          id: string
          map: boolean
          perfil: string
          price_history: boolean
          price_request: boolean
          reference_registration: boolean
          research: boolean
          settings: boolean
          station_management: boolean
          tax_management: boolean
          updated_at: string | null
        }
        Insert: {
          admin?: boolean
          approval_margin_config?: boolean
          approvals?: boolean
          audit_logs?: boolean
          can_approve?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_manage_notifications?: boolean
          can_register?: boolean
          can_view_all_proposals?: boolean | null
          can_view_history?: boolean
          client_management?: boolean
          created_at?: string | null
          dashboard?: boolean
          gestao?: boolean
          gestao_clients?: boolean
          gestao_payment_methods?: boolean
          gestao_stations?: boolean
          id?: string
          map?: boolean
          perfil: string
          price_history?: boolean
          price_request?: boolean
          reference_registration?: boolean
          research?: boolean
          settings?: boolean
          station_management?: boolean
          tax_management?: boolean
          updated_at?: string | null
        }
        Update: {
          admin?: boolean
          approval_margin_config?: boolean
          approvals?: boolean
          audit_logs?: boolean
          can_approve?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_manage_notifications?: boolean
          can_register?: boolean
          can_view_all_proposals?: boolean | null
          can_view_history?: boolean
          client_management?: boolean
          created_at?: string | null
          dashboard?: boolean
          gestao?: boolean
          gestao_clients?: boolean
          gestao_payment_methods?: boolean
          gestao_stations?: boolean
          id?: string
          map?: boolean
          perfil?: string
          price_history?: boolean
          price_request?: boolean
          reference_registration?: boolean
          research?: boolean
          settings?: boolean
          station_management?: boolean
          tax_management?: boolean
          updated_at?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          created_at: string | null
          device_info: Json | null
          fcm_token: string
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device_info?: Json | null
          fcm_token: string
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          device_info?: Json | null
          fcm_token?: string
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      referencias: {
        Row: {
          anexo: string | null
          cliente_id: string
          codigo_referencia: string
          created_at: string | null
          criado_por: string | null
          id: string
          latitude: number | null
          longitude: number | null
          observacoes: string | null
          posto_id: string
          preco_referencia: number
          produto: string
          tipo_pagamento_id: string | null
          updated_at: string | null
        }
        Insert: {
          anexo?: string | null
          cliente_id: string
          codigo_referencia?: string
          created_at?: string | null
          criado_por?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          observacoes?: string | null
          posto_id: string
          preco_referencia: number
          produto: string
          tipo_pagamento_id?: string | null
          updated_at?: string | null
        }
        Update: {
          anexo?: string | null
          cliente_id?: string
          codigo_referencia?: string
          created_at?: string | null
          criado_por?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          observacoes?: string | null
          posto_id?: string
          preco_referencia?: number
          produto?: string
          tipo_pagamento_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      sis_empresa: {
        Row: {
          bandeira: string | null
          brinde_enabled: boolean | null
          brinde_value: number | null
          cluster: string | null
          cnpj_cpf: string | null
          ipp_code: string | null
          latitude: number | null
          longitude: number | null
          municipio: string | null
          nome: string | null
          nome_empresa: string | null
          raizen_code: string | null
          rede: string | null
          regiao: string | null
          registro_ativo: string | null
          squad: string | null
          supervisor: string | null
          tipo: string | null
          uf: string | null
          vibra_code: string | null
        }
        Insert: {
          bandeira?: string | null
          brinde_enabled?: boolean | null
          brinde_value?: number | null
          cluster?: string | null
          cnpj_cpf?: string | null
          ipp_code?: string | null
          latitude?: number | null
          longitude?: number | null
          municipio?: string | null
          nome?: string | null
          nome_empresa?: string | null
          raizen_code?: string | null
          rede?: string | null
          regiao?: string | null
          registro_ativo?: string | null
          squad?: string | null
          supervisor?: string | null
          tipo?: string | null
          uf?: string | null
          vibra_code?: string | null
        }
        Update: {
          bandeira?: string | null
          brinde_enabled?: boolean | null
          brinde_value?: number | null
          cluster?: string | null
          cnpj_cpf?: string | null
          ipp_code?: string | null
          latitude?: number | null
          longitude?: number | null
          municipio?: string | null
          nome?: string | null
          nome_empresa?: string | null
          raizen_code?: string | null
          rede?: string | null
          regiao?: string | null
          registro_ativo?: string | null
          squad?: string | null
          supervisor?: string | null
          tipo?: string | null
          uf?: string | null
          vibra_code?: string | null
        }
        Relationships: []
      }
      stations: {
        Row: {
          active: boolean | null
          address: string | null
          code: string
          created_at: string | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          address?: string | null
          code: string
          created_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          address?: string | null
          code?: string
          created_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      system_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          resource_type: string | null
          user_email: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          resource_type?: string | null
          user_email?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          resource_type?: string | null
          user_email?: string | null
        }
        Relationships: []
      }
      tipos_pagamento: {
        Row: {
          CARTAO: string | null
          id: number
          ID_POSTO: string | null
          POSTO: string | null
          PRAZO: string | null
          TAXA: number | null
        }
        Insert: {
          CARTAO?: string | null
          id?: number
          ID_POSTO?: string | null
          POSTO?: string | null
          PRAZO?: string | null
          TAXA?: number | null
        }
        Update: {
          CARTAO?: string | null
          id?: number
          ID_POSTO?: string | null
          POSTO?: string | null
          PRAZO?: string | null
          TAXA?: number | null
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          ativo: boolean
          avatar_url: string | null
          cargo: string | null
          created_at: string | null
          email: string
          id: string
          max_approval_margin: number | null
          nome: string
          perfil: string | null
          role: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          ativo?: boolean
          avatar_url?: string | null
          cargo?: string | null
          created_at?: string | null
          email: string
          id?: string
          max_approval_margin?: number | null
          nome: string
          perfil?: string | null
          role?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          ativo?: boolean
          avatar_url?: string | null
          cargo?: string | null
          created_at?: string | null
          email?: string
          id?: string
          max_approval_margin?: number | null
          nome?: string
          perfil?: string | null
          role?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_update_approval_costs: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: Json
      }
      get_all_costs_for_station: {
        Args: { p_date?: string; p_posto_id: string; p_produto: string }
        Returns: {
          base_codigo: string
          base_id: string
          base_nome: string
          base_uf: string
          custo: number
          custo_total: number
          data_referencia: string
          forma_entrega: string
          frete: number
          origem: string
        }[]
      }
      get_approval_margin_rule: {
        Args: { margin_cents: number }
        Returns: {
          id: string
          max_margin_cents: number
          min_margin_cents: number
          priority_order: number
          required_profiles: string[]
          rule_name: string
        }[]
      }
      get_approval_profile_order: {
        Args: never
        Returns: {
          order_position: number
          perfil: string
        }[]
      }
      get_contatos: {
        Args: never
        Returns: {
          base: string
          cidade: string
          data_contato: string
          distribuidora: string
          estado: string
          pego: boolean
          regiao: string
          responsavel: string
          status: string
          uf: string
        }[]
      }
      get_descontos_indevidos: {
        Args: { p_data_fim?: string; p_data_inicio?: string }
        Returns: {
          cliente_id: number
          custo_dia: number
          data_transacao: string
          diferenca: number
          id_transacao: number
          negativado: boolean
          nome_cliente: string
          nome_posto: string
          observacoes: string
          percentual_desconto: number
          posto_id: number
          preco_calculado: number
          produto: string
        }[]
      }
      get_lowest_cost_freight: {
        Args: { p_date?: string; p_posto_id: string; p_produto: string }
        Returns: {
          base_bandeira: string
          base_codigo: string
          base_id: string
          base_nome: string
          base_uf: string
          custo: number
          custo_total: number
          data_referencia: string
          debug_info: string
          forma_entrega: string
          frete: number
        }[]
      }
      get_nf_transacoes: {
        Args: { limit_count?: number }
        Returns: {
          row_data: Json
        }[]
      }
      get_sis_empresa_by_ids: {
        Args: { p_ids: string[] }
        Returns: {
          bandeira: string
          cnpj_cpf: string
          id_empresa: string
          latitude: number
          longitude: number
          nome_empresa: string
          rede: string
        }[]
      }
      get_sis_empresa_stations: {
        Args: never
        Returns: {
          bandeira: string
          cnpj_cpf: string
          id_empresa: string
          latitude: number
          longitude: number
          nome_empresa: string
          rede: string
          registro_ativo: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      load_site_config: { Args: never; Returns: Json }
      log_system_action: {
        Args: { p_action: string; p_details?: Json; p_resource_type?: string }
        Returns: undefined
      }
      postgres_fdw_disconnect: { Args: { "": string }; Returns: boolean }
      postgres_fdw_disconnect_all: { Args: never; Returns: boolean }
      postgres_fdw_get_connections: {
        Args: never
        Returns: Record<string, unknown>[]
      }
      postgres_fdw_handler: { Args: never; Returns: unknown }
      safe_numeric_convert: { Args: { val: string }; Returns: number }
      save_site_config: { Args: { config_json: Json }; Returns: boolean }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "supervisor" | "analista"
      approval_status: "pending" | "approved" | "rejected" | "draft"
      payment_type: "vista" | "cartao_28" | "cartao_35"
      product_type:
        | "etanol"
        | "gasolina_comum"
        | "gasolina_aditivada"
        | "s10"
        | "s500"
      reference_type:
        | "nf"
        | "print_portal"
        | "print_conversa"
        | "sem_referencia"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["super_admin", "admin", "supervisor", "analista"],
      approval_status: ["pending", "approved", "rejected", "draft"],
      payment_type: ["vista", "cartao_28", "cartao_35"],
      product_type: [
        "etanol",
        "gasolina_comum",
        "gasolina_aditivada",
        "s10",
        "s500",
      ],
      reference_type: [
        "nf",
        "print_portal",
        "print_conversa",
        "sem_referencia",
      ],
    },
  },
} as const

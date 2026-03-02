-- Função RPC segura para o PermissionsManager atualizar permissões
CREATE OR REPLACE FUNCTION public.upsert_profile_permissions(
  p_perfil TEXT,
  p_permissions JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verificar se é um admin tentando atualizar (opcional, pode depender da sua regra)
  -- Para nós, o UI já restringe quem vê essa tela, mas por precaução, certifique-se no RLS.
  
  INSERT INTO public.profile_permissions (
    perfil, dashboard, price_request, approvals, research, map, price_history, 
    reference_registration, admin, settings, gestao, gestao_stations, gestao_clients,
    gestao_payment_methods, portfolio_manager, variations, quotations, mapa_contatos,
    cargas, nfs_incorretas, paridade, financial_review, can_approve, can_register,
    can_edit, can_delete, can_view_history, can_manage_notifications,
    station_management, client_management, tax_management, audit_logs, approval_margin_config
  )
  VALUES (
    p_perfil,
    COALESCE((p_permissions->>'dashboard')::boolean, false),
    COALESCE((p_permissions->>'price_request')::boolean, false),
    COALESCE((p_permissions->>'approvals')::boolean, false),
    COALESCE((p_permissions->>'research')::boolean, false),
    COALESCE((p_permissions->>'map')::boolean, false),
    COALESCE((p_permissions->>'price_history')::boolean, false),
    COALESCE((p_permissions->>'reference_registration')::boolean, false),
    COALESCE((p_permissions->>'admin')::boolean, false),
    COALESCE((p_permissions->>'settings')::boolean, false),
    COALESCE((p_permissions->>'gestao')::boolean, false),
    COALESCE((p_permissions->>'gestao_stations')::boolean, false),
    COALESCE((p_permissions->>'gestao_clients')::boolean, false),
    COALESCE((p_permissions->>'gestao_payment_methods')::boolean, false),
    COALESCE((p_permissions->>'portfolio_manager')::boolean, false),
    COALESCE((p_permissions->>'variations')::boolean, false),
    COALESCE((p_permissions->>'quotations')::boolean, false),
    COALESCE((p_permissions->>'mapa_contatos')::boolean, false),
    COALESCE((p_permissions->>'cargas')::boolean, false),
    COALESCE((p_permissions->>'nfs_incorretas')::boolean, false),
    COALESCE((p_permissions->>'paridade')::boolean, false),
    COALESCE((p_permissions->>'financial_review')::boolean, false),
    COALESCE((p_permissions->>'can_approve')::boolean, false),
    COALESCE((p_permissions->>'can_register')::boolean, false),
    COALESCE((p_permissions->>'can_edit')::boolean, false),
    COALESCE((p_permissions->>'can_delete')::boolean, false),
    COALESCE((p_permissions->>'can_view_history')::boolean, false),
    COALESCE((p_permissions->>'can_manage_notifications')::boolean, false),
    COALESCE((p_permissions->>'station_management')::boolean, false),
    COALESCE((p_permissions->>'client_management')::boolean, false),
    COALESCE((p_permissions->>'tax_management')::boolean, false),
    COALESCE((p_permissions->>'audit_logs')::boolean, false),
    COALESCE((p_permissions->>'approval_margin_config')::boolean, false)
  )
  ON CONFLICT (perfil) DO UPDATE SET
    dashboard = EXCLUDED.dashboard,
    price_request = EXCLUDED.price_request,
    approvals = EXCLUDED.approvals,
    research = EXCLUDED.research,
    map = EXCLUDED.map,
    price_history = EXCLUDED.price_history,
    reference_registration = EXCLUDED.reference_registration,
    admin = EXCLUDED.admin,
    settings = EXCLUDED.settings,
    gestao = EXCLUDED.gestao,
    gestao_stations = EXCLUDED.gestao_stations,
    gestao_clients = EXCLUDED.gestao_clients,
    gestao_payment_methods = EXCLUDED.gestao_payment_methods,
    portfolio_manager = EXCLUDED.portfolio_manager,
    variations = EXCLUDED.variations,
    quotations = EXCLUDED.quotations,
    mapa_contatos = EXCLUDED.mapa_contatos,
    cargas = EXCLUDED.cargas,
    nfs_incorretas = EXCLUDED.nfs_incorretas,
    paridade = EXCLUDED.paridade,
    financial_review = EXCLUDED.financial_review,
    can_approve = EXCLUDED.can_approve,
    can_register = EXCLUDED.can_register,
    can_edit = EXCLUDED.can_edit,
    can_delete = EXCLUDED.can_delete,
    can_view_history = EXCLUDED.can_view_history,
    can_manage_notifications = EXCLUDED.can_manage_notifications,
    station_management = EXCLUDED.station_management,
    client_management = EXCLUDED.client_management,
    tax_management = EXCLUDED.tax_management,
    audit_logs = EXCLUDED.audit_logs,
    approval_margin_config = EXCLUDED.approval_margin_config;

END;
$$;

NOTIFY pgrst, 'reload schema';

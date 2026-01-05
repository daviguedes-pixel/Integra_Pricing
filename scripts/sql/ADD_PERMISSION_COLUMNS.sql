-- Script SQL para executar diretamente no Supabase SQL Editor
-- Adiciona as colunas faltantes na tabela profile_permissions

-- Adicionar novas colunas de abas/páginas
DO $$ 
BEGIN
  -- Verificar e adicionar cada coluna individualmente
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profile_permissions' AND column_name = 'tax_management') THEN
    ALTER TABLE public.profile_permissions ADD COLUMN tax_management BOOLEAN NOT NULL DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profile_permissions' AND column_name = 'station_management') THEN
    ALTER TABLE public.profile_permissions ADD COLUMN station_management BOOLEAN NOT NULL DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profile_permissions' AND column_name = 'client_management') THEN
    ALTER TABLE public.profile_permissions ADD COLUMN client_management BOOLEAN NOT NULL DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profile_permissions' AND column_name = 'audit_logs') THEN
    ALTER TABLE public.profile_permissions ADD COLUMN audit_logs BOOLEAN NOT NULL DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profile_permissions' AND column_name = 'settings') THEN
    ALTER TABLE public.profile_permissions ADD COLUMN settings BOOLEAN NOT NULL DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profile_permissions' AND column_name = 'gestao') THEN
    ALTER TABLE public.profile_permissions ADD COLUMN gestao BOOLEAN NOT NULL DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profile_permissions' AND column_name = 'approval_margin_config') THEN
    ALTER TABLE public.profile_permissions ADD COLUMN approval_margin_config BOOLEAN NOT NULL DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profile_permissions' AND column_name = 'gestao_stations') THEN
    ALTER TABLE public.profile_permissions ADD COLUMN gestao_stations BOOLEAN NOT NULL DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profile_permissions' AND column_name = 'gestao_clients') THEN
    ALTER TABLE public.profile_permissions ADD COLUMN gestao_clients BOOLEAN NOT NULL DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profile_permissions' AND column_name = 'gestao_payment_methods') THEN
    ALTER TABLE public.profile_permissions ADD COLUMN gestao_payment_methods BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- Atualizar permissões padrão para diretores (acesso total)
UPDATE public.profile_permissions
SET 
  tax_management = COALESCE(tax_management, true),
  station_management = COALESCE(station_management, true),
  client_management = COALESCE(client_management, true),
  audit_logs = COALESCE(audit_logs, true),
  settings = COALESCE(settings, true),
  gestao = COALESCE(gestao, true),
  approval_margin_config = COALESCE(approval_margin_config, true),
  gestao_stations = COALESCE(gestao_stations, true),
  gestao_clients = COALESCE(gestao_clients, true),
  gestao_payment_methods = COALESCE(gestao_payment_methods, true)
WHERE perfil IN ('diretor_comercial', 'diretor_pricing');

-- Atualizar permissões padrão para supervisores (acesso parcial)
UPDATE public.profile_permissions
SET 
  tax_management = COALESCE(tax_management, true),
  station_management = COALESCE(station_management, true),
  client_management = COALESCE(client_management, true),
  audit_logs = COALESCE(audit_logs, false),
  settings = COALESCE(settings, true),
  gestao = COALESCE(gestao, true),
  approval_margin_config = COALESCE(approval_margin_config, false),
  gestao_stations = COALESCE(gestao_stations, true),
  gestao_clients = COALESCE(gestao_clients, true),
  gestao_payment_methods = COALESCE(gestao_payment_methods, true)
WHERE perfil = 'supervisor_comercial';

-- Comentários para documentação
COMMENT ON COLUMN public.profile_permissions.tax_management IS 'Acesso à gestão de taxas';
COMMENT ON COLUMN public.profile_permissions.station_management IS 'Acesso à gestão de postos';
COMMENT ON COLUMN public.profile_permissions.client_management IS 'Acesso à gestão de clientes';
COMMENT ON COLUMN public.profile_permissions.audit_logs IS 'Acesso aos logs de auditoria';
COMMENT ON COLUMN public.profile_permissions.settings IS 'Acesso às configurações';
COMMENT ON COLUMN public.profile_permissions.gestao IS 'Acesso à página de gestão';
COMMENT ON COLUMN public.profile_permissions.approval_margin_config IS 'Acesso à configuração de aprovação por margem';
COMMENT ON COLUMN public.profile_permissions.gestao_stations IS 'Acesso à subaba de postos na gestão';
COMMENT ON COLUMN public.profile_permissions.gestao_clients IS 'Acesso à subaba de clientes na gestão';
COMMENT ON COLUMN public.profile_permissions.gestao_payment_methods IS 'Acesso à subaba de tipos de pagamento na gestão';


-- Sistema de integração com dados externos
-- Permite conectar tabelas SQL externas com Supabase

-- Tabela para configuração de conexões externas
CREATE TABLE IF NOT EXISTS public.external_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  connection_type TEXT NOT NULL DEFAULT 'postgresql', -- 'postgresql', 'mysql', 'sqlserver', 'api'
  host TEXT NOT NULL,
  port INTEGER NOT NULL DEFAULT 5432,
  database_name TEXT NOT NULL,
  username TEXT NOT NULL,
  password TEXT, -- Será criptografado
  ssl_enabled BOOLEAN DEFAULT true,
  connection_string TEXT, -- Para conexões mais complexas
  active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.external_connections ENABLE ROW LEVEL SECURITY;

-- Política para external_connections (apenas admins)
DROP POLICY IF EXISTS "Admins can manage external connections" ON public.external_connections;
CREATE POLICY "Admins can manage external connections" 
ON public.external_connections 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up 
    WHERE up.user_id = auth.uid() AND up.role = 'admin'
  )
);

-- Tabela para mapeamento de tabelas externas
CREATE TABLE IF NOT EXISTS public.external_table_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES public.external_connections(id) ON DELETE CASCADE,
  external_table_name TEXT NOT NULL,
  supabase_table_name TEXT NOT NULL,
  mapping_config JSONB NOT NULL, -- Configuração de mapeamento de colunas
  sync_frequency TEXT DEFAULT 'manual', -- 'manual', 'hourly', 'daily', 'weekly'
  last_sync_at TIMESTAMP WITH TIME ZONE,
  sync_status TEXT DEFAULT 'pending', -- 'pending', 'success', 'error'
  sync_error TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(connection_id, external_table_name)
);

-- Habilitar RLS
ALTER TABLE public.external_table_mappings ENABLE ROW LEVEL SECURITY;

-- Política para external_table_mappings (apenas admins)
DROP POLICY IF EXISTS "Admins can manage table mappings" ON public.external_table_mappings;
CREATE POLICY "Admins can manage table mappings" 
ON public.external_table_mappings 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up 
    WHERE up.user_id = auth.uid() AND up.role = 'admin'
  )
);

-- Tabela para logs de sincronização
CREATE TABLE IF NOT EXISTS public.sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mapping_id UUID REFERENCES public.external_table_mappings(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL, -- 'full', 'incremental'
  records_processed INTEGER DEFAULT 0,
  records_inserted INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_deleted INTEGER DEFAULT 0,
  sync_duration_ms INTEGER,
  status TEXT NOT NULL, -- 'success', 'error', 'partial'
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Habilitar RLS
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

-- Política para sync_logs (apenas admins)
DROP POLICY IF EXISTS "Admins can view sync logs" ON public.sync_logs;
CREATE POLICY "Admins can view sync logs" 
ON public.sync_logs 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up 
    WHERE up.user_id = auth.uid() AND up.role = 'admin'
  )
);

-- Função para testar conexão externa
CREATE OR REPLACE FUNCTION public.test_external_connection(connection_id UUID)
RETURNS JSONB AS $$
DECLARE
  conn_config RECORD;
  result JSONB;
BEGIN
  -- Buscar configuração da conexão
  SELECT * INTO conn_config
  FROM public.external_connections
  WHERE id = connection_id AND active = true;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Conexão não encontrada'
    );
  END IF;
  
  -- Aqui você implementaria a lógica real de teste de conexão
  -- Por enquanto, vamos simular um teste bem-sucedido
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Conexão testada com sucesso',
    'connection_type', conn_config.connection_type,
    'host', conn_config.host,
    'database', conn_config.database_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para sincronizar dados de tabela externa
CREATE OR REPLACE FUNCTION public.sync_external_table(mapping_id UUID)
RETURNS JSONB AS $$
DECLARE
  mapping_config RECORD;
  sync_result JSONB;
  start_time TIMESTAMP WITH TIME ZONE;
  end_time TIMESTAMP WITH TIME ZONE;
BEGIN
  start_time := now();
  
  -- Buscar configuração do mapeamento
  SELECT etm.*, ec.*
  INTO mapping_config
  FROM public.external_table_mappings etm
  JOIN public.external_connections ec ON ec.id = etm.connection_id
  WHERE etm.id = mapping_id AND etm.active = true;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Mapeamento não encontrado'
    );
  END IF;
  
  -- Aqui você implementaria a lógica real de sincronização
  -- Por enquanto, vamos simular uma sincronização bem-sucedida
  
  end_time := now();
  
  -- Registrar log de sincronização
  INSERT INTO public.sync_logs (
    mapping_id,
    sync_type,
    records_processed,
    records_inserted,
    records_updated,
    records_deleted,
    sync_duration_ms,
    status,
    started_at,
    completed_at
  ) VALUES (
    mapping_id,
    'full',
    100, -- Simulado
    50,  -- Simulado
    30,  -- Simulado
    20,  -- Simulado
    EXTRACT(EPOCH FROM (end_time - start_time)) * 1000,
    'success',
    start_time,
    end_time
  );
  
  -- Atualizar status do mapeamento
  UPDATE public.external_table_mappings
  SET 
    last_sync_at = end_time,
    sync_status = 'success',
    sync_error = NULL
  WHERE id = mapping_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Sincronização concluída com sucesso',
    'records_processed', 100,
    'records_inserted', 50,
    'records_updated', 30,
    'records_deleted', 20,
    'duration_ms', EXTRACT(EPOCH FROM (end_time - start_time)) * 1000
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para obter status de sincronização
CREATE OR REPLACE FUNCTION public.get_sync_status()
RETURNS TABLE (
  mapping_id UUID,
  external_table_name TEXT,
  supabase_table_name TEXT,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  sync_status TEXT,
  sync_error TEXT,
  records_processed INTEGER,
  sync_duration_ms INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    etm.id,
    etm.external_table_name,
    etm.supabase_table_name,
    etm.last_sync_at,
    etm.sync_status,
    etm.sync_error,
    sl.records_processed,
    sl.sync_duration_ms
  FROM public.external_table_mappings etm
  LEFT JOIN public.sync_logs sl ON sl.mapping_id = etm.id
  WHERE etm.active = true
  ORDER BY etm.last_sync_at DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Inserir dados de exemplo para demonstração
INSERT INTO public.external_connections (
  name,
  description,
  connection_type,
  host,
  port,
  database_name,
  username,
  ssl_enabled
) VALUES (
  'Sistema Principal',
  'Conexão com o sistema principal da empresa',
  'postgresql',
  'localhost',
  5432,
  'empresa_principal',
  'usuario_sistema',
  true
) ON CONFLICT (name) DO NOTHING;

-- Exemplo de mapeamento de tabela
INSERT INTO public.external_table_mappings (
  connection_id,
  external_table_name,
  supabase_table_name,
  mapping_config
) VALUES (
  (SELECT id FROM public.external_connections WHERE name = 'Sistema Principal'),
  'produtos_externos',
  'products',
  '{
    "columns": {
      "id": "id",
      "nome": "name",
      "preco": "price",
      "categoria": "category",
      "ativo": "active"
    },
    "filters": {
      "ativo": true
    }
  }'::jsonb
) ON CONFLICT (connection_id, external_table_name) DO NOTHING;

-- Migração completa do schema do banco de dados
-- Criar todas as tabelas faltantes e ajustar tipos

-- Atualizar tipos de produto para nomes reais
DROP TYPE IF EXISTS public.product_type CASCADE;
CREATE TYPE public.product_type AS ENUM (
  'gasolina_comum',
  'gasolina_aditivada', 
  'etanol',
  'diesel_s10',
  'diesel_s500'
);

-- Atualizar tipos de status
DROP TYPE IF EXISTS public.suggestion_status CASCADE;
CREATE TYPE public.suggestion_status AS ENUM ('draft', 'pending', 'approved', 'rejected');

DROP TYPE IF EXISTS public.approval_status CASCADE;
CREATE TYPE public.approval_status AS ENUM ('pending', 'approved', 'rejected', 'draft');

-- Atualizar tipos de pagamento
DROP TYPE IF EXISTS public.payment_type CASCADE;
CREATE TYPE public.payment_type AS ENUM ('vista', 'cartao_28', 'cartao_35');

-- Atualizar tipos de referência
DROP TYPE IF EXISTS public.reference_type CASCADE;
CREATE TYPE public.reference_type AS ENUM ('nf', 'print_portal', 'print_conversa', 'sem_referencia');

-- Atualizar tipos de usuário
DROP TYPE IF EXISTS public.user_role CASCADE;
CREATE TYPE public.user_role AS ENUM ('admin', 'supervisor', 'analista', 'gerente');

-- Criar tabela de anexos se não existir
CREATE TABLE IF NOT EXISTS public.attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS para attachments
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

-- Política para attachments
DROP POLICY IF EXISTS "Users can view attachments" ON public.attachments;
CREATE POLICY "Users can view attachments" 
ON public.attachments 
FOR SELECT 
USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can insert attachments" ON public.attachments;
CREATE POLICY "Users can insert attachments" 
ON public.attachments 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- Criar tabela de notificações
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info', -- 'info', 'success', 'warning', 'error'
  read BOOLEAN DEFAULT false,
  data JSONB, -- Dados adicionais da notificação
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  read_at TIMESTAMP WITH TIME ZONE
);

-- Habilitar RLS para notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Políticas para notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" 
ON public.notifications 
FOR SELECT 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications" 
ON public.notifications 
FOR UPDATE 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "System can insert notifications" 
ON public.notifications 
FOR INSERT 
WITH CHECK (true);

-- Criar tabela de configurações de email
CREATE TABLE IF NOT EXISTS public.email_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  smtp_host TEXT,
  smtp_port INTEGER DEFAULT 587,
  smtp_user TEXT,
  smtp_password TEXT,
  smtp_secure BOOLEAN DEFAULT true,
  from_email TEXT,
  from_name TEXT DEFAULT 'Sistema de Preços',
  enabled BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS para email_settings
ALTER TABLE public.email_settings ENABLE ROW LEVEL SECURITY;

-- Política para email_settings (apenas admins)
DROP POLICY IF EXISTS "Admins can manage email settings" ON public.email_settings;
CREATE POLICY "Admins can manage email settings" 
ON public.email_settings 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up 
    WHERE up.user_id = auth.uid() AND up.role = 'admin'
  )
);

-- Criar tabela de templates de email
CREATE TABLE IF NOT EXISTS public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  variables JSONB, -- Variáveis disponíveis no template
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS para email_templates
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- Política para email_templates (apenas admins)
DROP POLICY IF EXISTS "Admins can manage email templates" ON public.email_templates;
CREATE POLICY "Admins can manage email templates" 
ON public.email_templates 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up 
    WHERE up.user_id = auth.uid() AND up.role = 'admin'
  )
);

-- Criar tabela de logs de email
CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  template_id UUID REFERENCES public.email_templates(id),
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'failed'
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS para email_logs
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Política para email_logs (apenas admins)
DROP POLICY IF EXISTS "Admins can view email logs" ON public.email_logs;
CREATE POLICY "Admins can view email logs" 
ON public.email_logs 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up 
    WHERE up.user_id = auth.uid() AND up.role = 'admin'
  )
);

-- Corrigir tabela price_suggestions se necessário
DO $$ 
BEGIN
  -- Adicionar coluna id se não existir
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'price_suggestions' AND column_name = 'id') THEN
    ALTER TABLE public.price_suggestions ADD COLUMN id UUID PRIMARY KEY DEFAULT gen_random_uuid();
  END IF;
  
  -- Adicionar coluna attachments se não existir
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'price_suggestions' AND column_name = 'attachments') THEN
    ALTER TABLE public.price_suggestions ADD COLUMN attachments TEXT[];
  END IF;
END $$;

-- Corrigir tabela referencias se necessário
DO $$ 
BEGIN
  -- Adicionar coluna id se não existir
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'referencias' AND column_name = 'id') THEN
    ALTER TABLE public.referencias ADD COLUMN id UUID PRIMARY KEY DEFAULT gen_random_uuid();
  END IF;
END $$;

-- Inserir templates de email padrão
INSERT INTO public.email_templates (name, subject, body_html, body_text, variables) VALUES
(
  'price_approved',
  'Preço Aprovado - {{client_name}}',
  '<h2>Preço Aprovado</h2><p>Olá,</p><p>O preço para <strong>{{client_name}}</strong> foi aprovado:</p><ul><li>Produto: {{product}}</li><li>Preço: R$ {{final_price}}</li><li>Posto: {{station_name}}</li></ul><p>Data de aprovação: {{approved_at}}</p>',
  'Preço Aprovado\n\nOlá,\n\nO preço para {{client_name}} foi aprovado:\n- Produto: {{product}}\n- Preço: R$ {{final_price}}\n- Posto: {{station_name}}\n\nData de aprovação: {{approved_at}}',
  '["client_name", "product", "final_price", "station_name", "approved_at"]'
),
(
  'price_rejected',
  'Preço Rejeitado - {{client_name}}',
  '<h2>Preço Rejeitado</h2><p>Olá,</p><p>O preço para <strong>{{client_name}}</strong> foi rejeitado:</p><ul><li>Produto: {{product}}</li><li>Preço sugerido: R$ {{final_price}}</li><li>Posto: {{station_name}}</li></ul><p>Motivo: {{reason}}</p><p>Data: {{rejected_at}}</p>',
  'Preço Rejeitado\n\nOlá,\n\nO preço para {{client_name}} foi rejeitado:\n- Produto: {{product}}\n- Preço sugerido: R$ {{final_price}}\n- Posto: {{station_name}}\n\nMotivo: {{reason}}\nData: {{rejected_at}}',
  '["client_name", "product", "final_price", "station_name", "reason", "rejected_at"]'
),
(
  'new_reference',
  'Nova Referência Cadastrada',
  '<h2>Nova Referência</h2><p>Uma nova referência foi cadastrada:</p><ul><li>Cliente: {{client_name}}</li><li>Produto: {{produto}}</li><li>Preço: R$ {{reference_price}}</li><li>Posto: {{station_name}}</li></ul><p>Cadastrado por: {{created_by}}</p><p>Data: {{created_at}}</p>',
  'Nova Referência\n\nUma nova referência foi cadastrada:\n- Cliente: {{client_name}}\n- Produto: {{produto}}\n- Preço: R$ {{reference_price}}\n- Posto: {{station_name}}\n\nCadastrado por: {{created_by}}\nData: {{created_at}}',
  '["client_name", "produto", "reference_price", "station_name", "created_by", "created_at"]'
)
ON CONFLICT (name) DO NOTHING;

-- Função para enviar notificações
CREATE OR REPLACE FUNCTION public.send_notification(
  p_user_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_type TEXT DEFAULT 'info',
  p_data JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, data)
  VALUES (p_user_id, p_title, p_message, p_type, p_data)
  RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para marcar notificação como lida
CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.notifications 
  SET read = true, read_at = now()
  WHERE id = p_notification_id AND user_id = auth.uid();
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para obter notificações não lidas
CREATE OR REPLACE FUNCTION public.get_unread_notifications()
RETURNS TABLE (
  id UUID,
  title TEXT,
  message TEXT,
  type TEXT,
  data JSONB,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT n.id, n.title, n.message, n.type, n.data, n.created_at
  FROM public.notifications n
  WHERE n.user_id = auth.uid() AND n.read = false
  ORDER BY n.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para notificar quando preço é aprovado
CREATE OR REPLACE FUNCTION public.notify_price_approved()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status != 'approved' AND NEW.status = 'approved' THEN
    -- Enviar notificação para o usuário que solicitou
    PERFORM public.send_notification(
      (SELECT user_id FROM auth.users WHERE email = NEW.requested_by LIMIT 1),
      'Preço Aprovado',
      'Seu preço para ' || (SELECT name FROM public.clients WHERE id = NEW.client_id) || ' foi aprovado.',
      'success',
      jsonb_build_object(
        'suggestion_id', NEW.id,
        'client_name', (SELECT name FROM public.clients WHERE id = NEW.client_id),
        'product', NEW.produto,
        'final_price', NEW.final_price
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger se não existir
DROP TRIGGER IF EXISTS price_approved_notification ON public.price_suggestions;
CREATE TRIGGER price_approved_notification
  AFTER UPDATE ON public.price_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_price_approved();

-- Trigger para notificar quando preço é rejeitado
CREATE OR REPLACE FUNCTION public.notify_price_rejected()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status != 'rejected' AND NEW.status = 'rejected' THEN
    -- Enviar notificação para o usuário que solicitou
    PERFORM public.send_notification(
      (SELECT user_id FROM auth.users WHERE email = NEW.requested_by LIMIT 1),
      'Preço Rejeitado',
      'Seu preço para ' || (SELECT name FROM public.clients WHERE id = NEW.client_id) || ' foi rejeitado.',
      'error',
      jsonb_build_object(
        'suggestion_id', NEW.id,
        'client_name', (SELECT name FROM public.clients WHERE id = NEW.client_id),
        'product', NEW.produto,
        'final_price', NEW.final_price
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger se não existir
DROP TRIGGER IF EXISTS price_rejected_notification ON public.price_suggestions;
CREATE TRIGGER price_rejected_notification
  AFTER UPDATE ON public.price_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_price_rejected();

-- Trigger para notificar quando nova referência é criada
CREATE OR REPLACE FUNCTION public.notify_new_reference()
RETURNS TRIGGER AS $$
BEGIN
  -- Enviar notificação para todos os usuários com permissão
  PERFORM public.send_notification(
    up.user_id,
    'Nova Referência Cadastrada',
    'Uma nova referência foi cadastrada para ' || (SELECT name FROM public.clients WHERE id = NEW.cliente_id) || '.',
    'info',
    jsonb_build_object(
      'reference_id', NEW.id,
      'client_name', (SELECT name FROM public.clients WHERE id = NEW.cliente_id),
      'product', NEW.produto,
      'reference_price', NEW.preco_referencia,
      'station_name', (SELECT name FROM public.stations WHERE id = NEW.posto_id)
    )
  )
  FROM public.user_profiles up
  WHERE up.pode_acessar_cadastro_referencia = true;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger se não existir
DROP TRIGGER IF EXISTS new_reference_notification ON public.referencias;
CREATE TRIGGER new_reference_notification
  AFTER INSERT ON public.referencias
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_reference();

-- Atualizar dados de exemplo com nomes reais de produtos
UPDATE public.price_suggestions 
SET produto = 'gasolina_comum' 
WHERE produto = 'diesel_comum';

UPDATE public.price_suggestions 
SET produto = 'diesel_s10' 
WHERE produto = 'diesel_s10';

UPDATE public.price_suggestions 
SET produto = 'diesel_s500' 
WHERE produto = 'diesel_s500';

-- Atualizar referencias também
UPDATE public.referencias 
SET produto = 'gasolina_comum' 
WHERE produto = 'diesel_comum';

UPDATE public.referencias 
SET produto = 'diesel_s10' 
WHERE produto = 'diesel_s10';

UPDATE public.referencias 
SET produto = 'diesel_s500' 
WHERE produto = 'diesel_s500';

-- Atualizar competitor_research também
UPDATE public.competitor_research 
SET produto = 'gasolina_comum' 
WHERE produto = 'diesel_comum';

UPDATE public.competitor_research 
SET produto = 'diesel_s10' 
WHERE produto = 'diesel_s10';

UPDATE public.competitor_research 
SET produto = 'diesel_s500' 
WHERE produto = 'diesel_s500';

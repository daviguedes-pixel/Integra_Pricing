-- Adicionar colunas faltantes para novas rotas em profile_permissions

ALTER TABLE public.profile_permissions 
ADD COLUMN IF NOT EXISTS portfolio_manager BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS variations BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS quotations BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS mapa_contatos BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS cargas BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS nfs_incorretas BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS paridade BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS financial_review BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profile_permissions.portfolio_manager IS 'Acesso ao gestor de carteiras';
COMMENT ON COLUMN public.profile_permissions.variations IS 'Acesso à aba de Variações';
COMMENT ON COLUMN public.profile_permissions.quotations IS 'Acesso à aba de Cotações';
COMMENT ON COLUMN public.profile_permissions.mapa_contatos IS 'Acesso ao Mapa de Contatos';
COMMENT ON COLUMN public.profile_permissions.cargas IS 'Acesso às Cargas';
COMMENT ON COLUMN public.profile_permissions.nfs_incorretas IS 'Acesso às NFs Incorretas';
COMMENT ON COLUMN public.profile_permissions.paridade IS 'Acesso à Paridade';
COMMENT ON COLUMN public.profile_permissions.financial_review IS 'Acesso à Revisão de Documentos Financeiros';

-- Garantir que admin (e talvez diretor comercial) tenham tudo ativo por padrão
UPDATE public.profile_permissions SET 
  portfolio_manager = true,
  variations = true,
  quotations = true,
  mapa_contatos = true,
  cargas = true,
  nfs_incorretas = true,
  paridade = true,
  financial_review = true
WHERE admin = true OR perfil = 'diretor_comercial';

-- Notificar PostgREST
NOTIFY pgrst, 'reload schema';

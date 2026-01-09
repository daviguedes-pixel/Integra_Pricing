-- Create public.Contatos table to store imported contacts
CREATE TABLE IF NOT EXISTS public."Contatos" (
    id text PRIMARY KEY,
    distribuidora text,
    cidade text,
    uf text,
    estado text,
    base text,
    pego boolean DEFAULT false,
    status text DEFAULT 'faltante',
    regiao text,
    data_contato timestamp with time zone,
    responsavel text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public."Contatos" ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Enable read access for all users" ON public."Contatos"
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" ON public."Contatos"
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON public."Contatos"
    FOR UPDATE USING (true);

CREATE POLICY "Enable delete for all users" ON public."Contatos"
    FOR DELETE USING (true);

-- Grant permissions
GRANT ALL ON public."Contatos" TO anon;
GRANT ALL ON public."Contatos" TO authenticated;
GRANT ALL ON public."Contatos" TO service_role;

-- Update get_contatos RPC to source from this new table
DROP FUNCTION IF EXISTS public.get_contatos();

CREATE OR REPLACE FUNCTION public.get_contatos()
RETURNS TABLE (
  uf text,
  estado text,
  cidade text,
  base text,
  distribuidora text,
  pego boolean,
  status text,
  data_contato timestamp with time zone,
  responsavel text,
  regiao text
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    c.uf,
    c.estado,
    c.cidade,
    c.base,
    c.distribuidora,
    c.pego,
    c.status,
    c.data_contato,
    c.responsavel,
    c.regiao
  FROM public."Contatos" c;
END;
$$;

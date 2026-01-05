-- Função RPC para atualizar status de contato (pego/faltante)
CREATE OR REPLACE FUNCTION update_contato_pego(
  p_id text,
  p_pego boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE cotacao."Contatos"
  SET 
    pego = p_pego,
    "Pego" = p_pego,
    status = CASE WHEN p_pego THEN 'pego' ELSE 'faltante' END,
    status_contato = CASE WHEN p_pego THEN 'pego' ELSE 'faltante' END
  WHERE 
    id::text = p_id 
    OR "Id"::text = p_id 
    OR id_contato::text = p_id;
END;
$$;

-- Dar permissão para usuários autenticados
GRANT EXECUTE ON FUNCTION update_contato_pego(text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION update_contato_pego(text, boolean) TO anon;


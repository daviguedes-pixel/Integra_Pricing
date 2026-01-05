-- Migração para converter valores antigos de purchase_cost e freight_cost de centavos para reais
-- Esta migração identifica valores que claramente estão em centavos (valores muito grandes)
-- e os converte para reais dividindo por 100
--
-- IMPORTANTE: Esta migração é conservadora e só converte valores que claramente estão em centavos
-- Valores normais de custo de compra estão entre 0.50 e 10.00 reais
-- Valores normais de frete estão entre 0.01 e 1.00 reais
--
-- Se um valor for > 100, provavelmente está em centavos (ex: 539.43 centavos = 5.3943 reais)

-- Converter purchase_cost: se o valor for >= 100, provavelmente está em centavos
-- Exemplo: 539.43 centavos = 5.3943 reais
UPDATE public.price_suggestions
SET purchase_cost = purchase_cost / 100
WHERE purchase_cost IS NOT NULL 
  AND purchase_cost >= 100
  AND purchase_cost < 10000; -- Evitar converter valores extremamente grandes que podem ser erros

-- Converter freight_cost: se o valor for >= 10, provavelmente está em centavos
-- Exemplo: 25 centavos = 0.25 reais
UPDATE public.price_suggestions
SET freight_cost = freight_cost / 100
WHERE freight_cost IS NOT NULL 
  AND freight_cost >= 10
  AND freight_cost < 1000; -- Evitar converter valores extremamente grandes que podem ser erros

-- Log da migração
DO $$
DECLARE
  purchase_count INTEGER;
  freight_count INTEGER;
BEGIN
  -- Contar quantos registros foram convertidos
  SELECT COUNT(*) INTO purchase_count
  FROM public.price_suggestions
  WHERE purchase_cost IS NOT NULL 
    AND purchase_cost >= 100 
    AND purchase_cost < 10000;
  
  SELECT COUNT(*) INTO freight_count
  FROM public.price_suggestions
  WHERE freight_cost IS NOT NULL 
    AND freight_cost >= 10 
    AND freight_cost < 1000;
  
  RAISE NOTICE 'Migração de conversão de centavos para reais:';
  RAISE NOTICE '  - % registros de purchase_cost serão convertidos (valores >= 100)', purchase_count;
  RAISE NOTICE '  - % registros de freight_cost serão convertidos (valores >= 10)', freight_count;
  RAISE NOTICE 'Migração concluída com sucesso!';
END $$;


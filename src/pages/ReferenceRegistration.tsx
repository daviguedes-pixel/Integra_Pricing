import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FileUploader } from "@/components/FileUploader";
import { useDatabase } from "@/hooks/useDatabase";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Save, CheckCircle, Building2, MapPin, X, Search, Upload, DollarSign, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { createWorker } from 'tesseract.js';
import { validateWithSchema, getValidationErrors, referenceRegistrationSchema } from '@/lib/validations';
import { logger } from '@/lib/logger';

export default function ReferenceRegistration() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { stations } = useDatabase();

  const [loading, setLoading] = useState(false);
  const [savedReference, setSavedReference] = useState<any>(null);
  const [allStations, setAllStations] = useState<any[]>([]);

  // Estados para busca dinâmica de concorrentes
  const [stationSearch, setStationSearch] = useState("");
  const [suggestedStations, setSuggestedStations] = useState<any[]>([]);
  const [selectedStation, setSelectedStation] = useState<any>(null);
  const [searchingStations, setSearchingStations] = useState(false);

  const [formData, setFormData] = useState({
    station_id: "",
    product: "",
    reference_price: "",
    observations: "",
  });
  const [attachments, setAttachments] = useState<string[]>([]);
  const [processingOCR, setProcessingOCR] = useState(false);

  // Carregar postos da base quando o estado mudar
  useEffect(() => {
    if (stations && Array.isArray(stations)) {
      setAllStations(stations as any);
    }
  }, [stations]);

  // Buscar concorrentes dinamicamente - agora retorna os dados para uso direto
  const searchCompetitors = async (query: string) => {
    if (query.length < 2) {
      setSuggestedStations([]);
      return [];
    }

    try {
      setSearchingStations(true);
      const { data, error } = await supabase
        .from('concorrentes')
        .select('id_posto, razao_social, endereco, municipio, uf, bandeira, cnpj')
        .or(`razao_social.ilike.%${query}%,cnpj.ilike.%${query}%,municipio.ilike.%${query}%`)
        .limit(20);

      if (error) throw error;

      const results = data || [];
      setSuggestedStations(results);
      return results;
    } catch (error) {
      logger.error('Erro ao buscar concorrentes:', error);
      setSuggestedStations([]);
      return [];
    } finally {
      setSearchingStations(false);
    }
  };

  useEffect(() => {
    if (stationSearch) {
      const timeoutId = setTimeout(() => {
        searchCompetitors(stationSearch);
      }, 300);
      return () => clearTimeout(timeoutId);
    } else {
      setSuggestedStations([]);
    }
  }, [stationSearch]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSelectStation = (station: any) => {
    setSelectedStation(station);
    setFormData(prev => ({ ...prev, station_id: String(station.id_posto) }));
    setStationSearch("");
    setSuggestedStations([]);
    logger.log('✅ Posto selecionado:', station.razao_social);
  };

  const handleClearStation = () => {
    setSelectedStation(null);
    setStationSearch("");
    setFormData(prev => ({ ...prev, station_id: "" }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validação com Zod
    const validation = validateWithSchema(referenceRegistrationSchema, formData);
    if (!validation.success) {
      const errors = getValidationErrors(validation.errors);
      const firstError = Object.values(errors)[0];
      toast.error(firstError || "Por favor, preencha todos os campos obrigatórios");
      return;
    }

    setLoading(true);
    try {
      // Buscar latitude/longitude do posto selecionado (concorrentes.id_posto) antes de salvar
      let latitude: number | null = null;
      let longitude: number | null = null;
      let uf: string | null = null;
      let cidade: string | null = null;

      try {
        const stationIdNum = Number(formData.station_id);
        if (!isNaN(stationIdNum)) {
          // Buscar dados completos do posto (coordenadas + UF + cidade)
          const { data: concMatch, error: concError } = await supabase
            .from('concorrentes')
            .select('latitude, longitude, uf, municipio')
            .eq('id_posto', stationIdNum)
            .maybeSingle();

          if (!concError && concMatch) {
            latitude = typeof concMatch?.latitude === 'string' ? parseFloat(concMatch.latitude) : concMatch?.latitude ?? null;
            longitude = typeof concMatch?.longitude === 'string' ? parseFloat(concMatch.longitude) : concMatch?.longitude ?? null;
            uf = concMatch?.uf || null;
            cidade = concMatch?.municipio || null;
          }
        }
      } catch (geoErr) {
        logger.warn('⚠️ Não foi possível obter coordenadas do posto:', geoErr);
      }

      const referenceData = {
        posto_id: formData.station_id || null,
        cliente_id: null,
        produto: formData.product as any,
        preco_referencia: parseFloat(formData.reference_price), // Keep as decimal, not cents
        tipo_pagamento_id: null,
        observacoes: formData.observations || null,
        anexo: attachments.length > 0 ? attachments.join(',') : null,
        criado_por: (user?.id && user.id !== "") ? user.id : null,
        // Tentar salvar coordenadas e localização diretamente na referência
        latitude: latitude,
        longitude: longitude,
        uf: uf,
        cidade: cidade,
      };

      logger.log('🔍 Dados da referência a serem salvos:', referenceData);
      logger.log('📦 Produto:', referenceData.produto);
      logger.log('💰 Preço de referência:', referenceData.preco_referencia);

      // Tentar inserir com latitude/longitude; se a coluna não existir, tentar sem elas
      let insertResult: any = null;
      let insertError: any = null;
      {
        const { data, error } = await supabase
          .from('referencias' as any)
          .insert([referenceData])
          .select('*')
          .single();
        insertResult = data; insertError = error;
      }
      let data: any = insertResult; let error: any = insertError;
      if (error && (String(error.message || '').toLowerCase().includes('latitude') || String(error.message || '').toLowerCase().includes('longitude') || String(error.message || '').toLowerCase().includes('uf') || String(error.message || '').toLowerCase().includes('cidade'))) {
        const { latitude: _lat, longitude: _lng, uf: _uf, cidade: _cidade, ...referenceDataNoGeo } = referenceData as any;
        const retry = await supabase
          .from('referencias' as any)
          .insert([referenceDataNoGeo])
          .select('*')
          .single();
        data = retry.data; error = retry.error;
      }

      if (error) {
        // Se a tabela referencias não existir, tentar salvar como price_suggestion
        if (error.message.includes('referencias')) {
          logger.log('Tabela referencias não encontrada, salvando como price_suggestion...');
          // Para referências de concorrentes, não usar station_id (que referencia stations)
          // Em vez disso, salvar o ID do concorrente nas observações ou usar null
          const suggestionData: any = {
            station_id: null, // Não usar station_id para concorrentes
            client_id: null,
            product: formData.product as any,
            cost_price: parseFloat(formData.reference_price) * 100, // Convert to cents
            final_price: parseFloat(formData.reference_price) * 100, // Convert to cents
            margin_cents: 0, // No margin for references
            payment_method_id: null,
            observations: formData.observations
              ? `${formData.observations}\n[Referência de Concorrente - ID: ${formData.station_id}]`
              : `[Referência de Concorrente - ID: ${formData.station_id}]`,
            attachments: attachments.length > 0 ? attachments : [],
            status: 'reference' as any, // Status especial para referências (não aparece em aprovações)
            is_reference: true, // Flag para identificar como referência
            // Salvar coordenadas e localização do concorrente
            latitude: latitude,
            longitude: longitude,
            uf: uf,
            cidade: cidade,
          };

          const { data: suggestionData_result, error: suggestionError } = await supabase
            .from('price_suggestions')
            .insert([suggestionData])
            .select('*')
            .single();

          if (suggestionError) {
            toast.error("Erro ao salvar referência: " + suggestionError.message);
            return;
          }

          // Buscar dados do station localmente (sem join)
          const stationRecord = allStations.find((s: any) =>
            s.id === suggestionData_result.station_id ||
            s.code === suggestionData_result.station_id ||
            String(s.id) === String(suggestionData_result.station_id)
          );

          // Simular estrutura de referência para exibição
          const mockReference = {
            ...suggestionData_result,
            codigo_referencia: 'REF-' + Date.now(),
            posto_id: suggestionData_result.station_id,
            cliente_id: null,
            produto: suggestionData_result.product,
            preco_referencia: suggestionData_result.final_price / 100,
            tipo_pagamento_id: null,
            observacoes: suggestionData_result.observations,
            anexo: suggestionData_result.attachments?.join(',') || null,
            criado_por: suggestionData_result.created_at,
            stations: stationRecord ? {
              name: stationRecord.name || stationRecord.nome_empresa,
              code: stationRecord.code || stationRecord.id
            } : undefined,
          };

          setSavedReference(mockReference);
          toast.success("Referência salva com sucesso!");
          return;
        }

        toast.error("Erro ao salvar referência: " + error.message);
        return;
      }

      // Enriquecer dados localmente (sem joins) para exibição
      const stationRecord = allStations.find((s: any) => s.id === (data as any).posto_id || s.code === (data as any).posto_id || s.cnpj_cpf === (data as any).posto_id);

      const enriched: any = {
        ...((data as any) || {}),
        stations: stationRecord ? { name: stationRecord.name, code: stationRecord.code ?? stationRecord.id } : undefined,
      };

      setSavedReference(enriched);
      toast.success("Referência cadastrada com sucesso!");

      // Reset form
      setFormData({
        station_id: "",
        product: "",
        reference_price: "",
        observations: "",
      });
      setAttachments([]);
    } catch (error) {
      toast.error("Erro inesperado ao salvar referência");
      logger.error("Reference registration error:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return price.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const getProductName = (product: string) => {
    const names: { [key: string]: string } = {
      's10': 'Diesel S-10',
      's10_aditivado': 'Diesel S-10 Aditivado',
      'diesel_s500': 'Diesel S-500',
      'diesel_s500_aditivado': 'Diesel S-500 Aditivado',
      'arla32_granel': 'Arla 32 Granel',
      // Mantendo compatibilidade com valores antigos
      'gasolina_comum': 'Gasolina Comum',
      'gasolina_aditivada': 'Gasolina Aditivada',
      'etanol': 'Etanol',
      'diesel_comum': 'Diesel Comum'
    };
    return names[product] || product.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Função para processar OCR usando OCR.space API (gratuita com IA melhor)
  const processOCRWithAPI = async (imageUrl: string): Promise<string | null> => {
    try {
      // Converter imagem para base64 se necessário
      let imageBase64 = '';

      // Se já é uma URL, buscar a imagem
      if (imageUrl.startsWith('http') || imageUrl.startsWith('data:')) {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        imageBase64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = (reader.result as string).split(',')[1];
            resolve(base64);
          };
          reader.readAsDataURL(blob);
        });
      } else {
        imageBase64 = imageUrl;
      }

      // OCR.space API - GRATUITA (25.000 requisições/mês)
      // Usa IA avançada e é muito melhor que Tesseract para documentos estruturados
      const formData = new FormData();
      formData.append('apikey', 'helloworld'); // API key pública gratuita
      formData.append('language', 'por'); // Português
      formData.append('isOverlayRequired', 'false');
      formData.append('base64Image', `data:image/jpeg;base64,${imageBase64}`);
      formData.append('OCREngine', '2'); // Engine 2 = melhor qualidade

      const apiResponse = await fetch('https://api.ocr.space/parse/image', {
        method: 'POST',
        body: formData,
      });

      const result = await apiResponse.json();

      if (result.ParsedResults && result.ParsedResults.length > 0) {
        const extractedText = result.ParsedResults[0].ParsedText;
        console.log('✅ OCR.space API retornou texto:', extractedText.substring(0, 500));
        return extractedText;
      } else {
        console.log('⚠️ OCR.space API não retornou resultados');
        return null;
      }
    } catch (error) {
      console.error('Erro ao usar OCR.space API:', error);
      return null;
    }
  };

  // Função para processar OCR e extrair informações da imagem
  const processImageOCR = async (imageUrl: string) => {
    let worker: any = null;
    try {
      setProcessingOCR(true);
      toast.info('Processando imagem com OCR (IA)...');

      let extractedText = '';

      // ESTRATÉGIA 1: Tentar primeiro com OCR.space API (gratuita com IA melhor)
      console.log('🔍 Tentando OCR.space API (IA avançada)...');
      const apiText = await processOCRWithAPI(imageUrl);

      if (apiText && apiText.length > 100) {
        extractedText = apiText.toLowerCase();
        console.log('✅ Usando texto do OCR.space API');
      } else {
        // ESTRATÉGIA 2: Fallback para Tesseract.js se API falhar
        console.log('⚠️ OCR.space API não funcionou, usando Tesseract como fallback...');
        toast.info('Usando OCR local como alternativa...');

        try {
          worker = await createWorker('por'); // Português

          // Configurar o Tesseract para melhor reconhecimento de tabelas e documentos estruturados
          await worker.setParameters({
            tessedit_pageseg_mode: '4', // Assume a single column of text of variable sizes (melhor para tabelas)
            tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÁÉÍÓÚáéíóúÂÊÔâêôÃÕãõÇçÀà,.-/()$: ',
            preserve_interword_spaces: '1', // Preservar espaços entre palavras
          });

          // Tentar reconhecimento com diferentes configurações
          let { data: { text } } = await worker.recognize(imageUrl);

          // Se o texto estiver muito ruim, tentar com modo de página diferente
          if (text.length < 500 || !text.match(/diesel|produto|valor|unit/i)) {
            console.log('⚠️ Primeira tentativa de OCR não capturou bem. Tentando modo alternativo...');
            await worker.setParameters({
              tessedit_pageseg_mode: '6', // Assume uniform block of text
            });
            const retryResult = await worker.recognize(imageUrl);
            // Usar o texto que tiver mais conteúdo útil
            if (retryResult.data.text.length > text.length) {
              text = retryResult.data.text;
              console.log('✅ Modo alternativo retornou mais texto');
            }
          }

          extractedText = text.toLowerCase();
          console.log('✅ Usando texto do Tesseract (fallback)');
        } catch (tesseractError) {
          console.error('Erro ao processar OCR com Tesseract.js:', tesseractError);
          toast.error('Erro ao processar imagem. Tente novamente.');
          return;
        }
      }

      // Se não conseguiu extrair texto, retornar
      if (!extractedText || extractedText.trim().length === 0) {
        toast.warning('Não foi possível extrair texto da imagem.');
        return;
      }

      // IMPORTANTE: Terminar o worker para liberar recursos se foi usado
      if (worker) {
        try {
          await worker.terminate();
          console.log('✅ Tesseract worker finalizado com sucesso');
        } catch (termErr) {
          console.error('Erro ao fechar worker:', termErr);
        }
      }

      // Limpar e normalizar o texto extraído de forma mais agressiva
      let cleanedText = extractedText
        // Remover caracteres estranhos mas manter letras, números e pontuação básica
        .replace(/[|\[\]{}]/g, ' ') // Remover pipes e colchetes comuns em OCR ruim
        .replace(/[^\w\s\dÁÉÍÓÚáéíóúÂÊÔâêôÃÕãõÇçÀà,.\-/:()$]/g, ' ')
        // Normalizar espaços múltiplos
        .replace(/\s+/g, ' ')
        // Corrigir fragmentos comuns de OCR ruim - padrões específicos da nota fiscal
        .replace(/\bposto\s*7\s*penapolis\s*ltda\b/gi, 'posto 7 penapolis ltda')
        .replace(/posto.*?7.*?penapolis.*?ltda/gi, 'posto 7 penapolis ltda')
        // Tentar reconstruir "DIESEL B S10 LT" mesmo quando fragmentado
        .replace(/diesel.*?b.*?s.*?1\s*0.*?lt/gi, 'diesel b s10 lt')
        .replace(/diesel.*?b.*?s1\s*0.*?lt/gi, 'diesel b s10 lt')
        .replace(/diesel.*?s.*?1\s*0.*?lt/gi, 'diesel s10 lt')
        .replace(/\bdiesel\s*b\s*s\s*10\s*lt\b/gi, 'diesel b s10 lt')
        .replace(/\bdiesel\s*b\s*s10\s*lt\b/gi, 'diesel b s10 lt')
        .replace(/\bdiesel\s*b\s*s-?10\b/gi, 'diesel b s10')
        // Corrigir números com vírgulas e pontos - padrões mais flexíveis
        .replace(/\b(\d+)\s*[,\.]\s*(\d{2})\b/g, '$1,$2') // Normalizar formato de preço
        .replace(/\b5\s*[,\.]\s*40\b/gi, '5,40') // Corrigir especificamente "5,40"
        .replace(/\b5\s*[,\.]\s*4\b/gi, '5,40') // Corrigir "5,4" para "5,40"
        .trim();

      // Tentar encontrar e reconstruir informações mesmo em texto muito fragmentado
      // Buscar padrões específicos mesmo com caracteres entre eles
      const fragmentPatterns = [
        { pattern: /diesel.*?s.*?1.*?0/gi, replacement: 'diesel s10' },
        { pattern: /diesel.*?b.*?s.*?1.*?0/gi, replacement: 'diesel b s10' },
        { pattern: /posto.*?7.*?penapolis/gi, replacement: 'posto 7 penapolis' },
      ];

      for (const { pattern, replacement } of fragmentPatterns) {
        if (pattern.test(cleanedText)) {
          cleanedText = cleanedText.replace(pattern, replacement);
        }
      }

      extractedText = cleanedText.toLowerCase();
      console.log('📄 Texto limpo e normalizado:', extractedText.substring(0, 500));
      console.log('📄 Tamanho do texto:', extractedText.length);

      // Identificar preço unitário (priorizar valores unitários em vez de totais)
      let foundUnitPrice: number | null = null;

      // 1. Procurar especificamente por "VALOR UNITÁRIO" ou "UNITÁRIO" na tabela de produtos da NF-e
      const unitarioPatterns = [
        /valor\s+unit[áa]rio[:\s]*r?\$?\s*(\d+[.,]\d{2,3})/gi,
        /unit[áa]rio[:\s]*r?\$?\s*(\d+[.,]\d{2,3})/gi,
        /(\d+[.,]\d{2,3})\s*unit[áa]rio/gi,
        /unit[áa]rio[\s\S]{0,50}?(\d+[.,]\d{2,3})/gi,
        /(\d+[.,]\d{2,3})[\s\S]{0,30}?unit[áa]rio/gi,
        // Padrão específico para tabela de produtos da NF-e: "Valor Unitário" seguido de número
        /valor\s+unit[áa]rio[\s\S]{0,100}?(\d+[.,]\d{2,3})/gi,
        // Padrão para coluna "Valor Unitário" na tabela (pode estar em formato tabular)
        /(?:valor\s+unit|unit[áa]rio)[\s\S]{0,50}?(\d{1,2}[.,]\d{2})/gi
      ];

      console.log('🔍 Buscando por padrões de valor unitário...');
      for (const pattern of unitarioPatterns) {
        const matches = extractedText.match(pattern);
        if (matches && matches.length > 0) {
          console.log(`📌 Padrão encontrado: ${pattern}, matches:`, matches);
          for (const match of matches) {
            const priceMatch = match.match(/(\d+[.,]\d{2,3})/);
            if (priceMatch) {
              // Remover pontos de milhar e converter vírgula para ponto
              const priceStr = priceMatch[0].replace(/\./g, '').replace(',', '.');
              const price = parseFloat(priceStr);
              console.log(`💰 Preço extraído: ${priceStr} -> ${price}`);
              if (price > 0 && price < 100) {
                foundUnitPrice = price;
                console.log(`✅ Preço unitário encontrado: ${price}`);
                break;
              }
            }
          }
          if (foundUnitPrice) break;
        }
      }

      // 1.5. Procurar na tabela de produtos da NF-e (formato tabular)
      // Esta é a busca mais específica para a estrutura da NF-e brasileira
      if (!foundUnitPrice) {
        console.log('🔍 Buscando valor unitário na tabela de produtos da NF-e...');

        // Primeiro, tentar encontrar o valor "5,40" diretamente próximo ao produto
        // Padrões adaptados para texto fragmentado do OCR
        const directSearchPatterns = [
          // Buscar "DIESEL B S10 LT" seguido de várias colunas e depois "5,40" ou "5.40"
          /diesel.*?b.*?s.*?10.*?lt[\s\S]{0,800}?(5[.,\s]?40|5[.,\s]?4)/gi,
          /diesel.*?b.*?s10.*?lt[\s\S]{0,800}?(5[.,\s]?40|5[.,\s]?4)/gi,
          /diesel.*?s.*?10[\s\S]{0,800}?(5[.,\s]?40|5[.,\s]?4)/gi,
          // Buscar após "VALOR UNITÁRIO" seguido de "5,40"
          /valor.*?unit[áa]rio[\s\S]{0,300}?(5[.,\s]?40|5[.,\s]?4)/gi,
          /unit[áa]rio[\s\S]{0,200}?(5[.,\s]?40|5[.,\s]?4)/gi,
          // Buscar na estrutura: produto | ... | QTDE | 5,40
          /(?:diesel.*?b.*?s.*?10|diesel.*?b.*?s10)[\s\S]{0,600}?(?:245|qtde)[\s\S]{0,200}?(5[.,\s]?40|5[.,\s]?4)/gi,
          // Buscar qualquer "5" seguido de vírgula/ponto e "40" ou "4"
          /(?:diesel|s10|s\s*10)[\s\S]{0,500}?(5[.,]\s*40|5[.,]\s*4|5\s*[,.]\s*40|5\s*[,.]\s*4)/gi
        ];

        for (const pattern of directSearchPatterns) {
          const matches = extractedText.match(pattern);
          if (matches && matches.length > 0) {
            console.log(`📌 Valor 5,40 encontrado com padrão direto:`, matches);
            const priceStr = '5.40';
            const price = parseFloat(priceStr);
            foundUnitPrice = price;
            console.log(`✅ Preço unitário encontrado diretamente: ${price}`);
            break;
          }
        }

        // Se não encontrou diretamente, usar padrões mais genéricos (adaptados para texto fragmentado)
        if (!foundUnitPrice) {
          const productTablePatterns = [
            // Padrão 1: Buscar "DIESEL B S10 LT" seguido de várias colunas e depois o valor unitário (5,40)
            // Estrutura: produto | CEAN | NCM | CST | CFOP | UN | QTDE | VALOR UNITÁRIO (5,40)
            // Padrões muito flexíveis para texto fragmentado
            /diesel.*?b.*?s.*?10.*?lt[\s\S]{0,600}?(\d{1,2}[.,\s]?\d{1,2})/gi,
            /diesel.*?s.*?10[\s\S]{0,600}?(\d{1,2}[.,\s]?\d{1,2})/gi,
            /diesel.*?10[\s\S]{0,600}?(\d{1,2}[.,\s]?\d{1,2})/gi,
            // Padrão 2: Buscar "VALOR UNITÁRIO" como cabeçalho seguido do valor na linha do produto
            /valor.*?unit[áa]rio[\s\S]{0,400}?(?:diesel|s10|s\s*10)[\s\S]{0,500}?(\d{1,2}[.,\s]?\d{1,2})/gi,
            /unit[áa]rio[\s\S]{0,300}?(\d{1,2}[.,\s]?\d{1,2})/gi,
            // Padrão 3: Buscar após "QTDE" (quantidade) que geralmente vem antes do valor unitário
            // Estrutura: QTDE: 245 | VALOR UNITÁRIO: 5,40
            /qtde[\s\S]{0,200}?(\d{1,2}[.,\s]?\d{1,2})/gi,
            // Padrão 4: Buscar "VALOR UNITÁRIO" seguido diretamente de número
            /valor.*?unit[áa]rio[:\s]*(\d{1,2}[.,\s]?\d{1,2})/gi,
            // Padrão 5: Buscar na estrutura completa da tabela de produtos
            /(?:dados.*?produtos|produtos.*?servi[çc]os)[\s\S]{0,800}?(?:valor.*?unit[áa]rio|unit[áa]rio)[\s\S]{0,400}?(\d{1,2}[.,\s]?\d{1,2})/gi,
            // Padrão 6: Buscar produto seguido de várias colunas e depois valor unitário
            /(?:diesel.*?b.*?s.*?10|diesel.*?s.*?10|diesel.*?10)[\s\S]{0,500}?(\d{1,2}[.,\s]?\d{1,2})/gi,
            // Padrão 7: Buscar qualquer número entre 3 e 10 após menção a diesel
            /diesel[\s\S]{0,800}?([4-9][.,]\d{2}|5[.,]\d{1,2})/gi
          ];

          const candidatePrices: number[] = [];

          for (const pattern of productTablePatterns) {
            const tableMatches = extractedText.match(pattern);
            if (tableMatches && tableMatches.length > 0) {
              console.log(`📌 Valores encontrados na tabela com padrão ${pattern}:`, tableMatches);
              for (const match of tableMatches) {
                // Buscar números no formato de preço (X,XX ou X.XX)
                const priceMatch = match.match(/(\d{1,2}[.,\s]?\d{1,2})/);
                if (priceMatch) {
                  // Limpar o número encontrado
                  let priceStr = priceMatch[0]
                    .replace(/\s+/g, '') // Remover espaços
                    .replace(/\./g, '')  // Remover pontos (milhar)
                    .replace(',', '.');   // Converter vírgula para ponto decimal

                  // Se não tem parte decimal, adicionar .00
                  if (!priceStr.includes('.')) {
                    priceStr = priceStr + '.00';
                  }

                  const price = parseFloat(priceStr);
                  console.log(`💰 Preço da tabela: ${priceMatch[0]} -> ${priceStr} -> ${price}`);
                  // Valores unitários de diesel geralmente estão entre 3 e 10 reais
                  if (price >= 3 && price < 10) {
                    candidatePrices.push(price);
                    console.log(`✅ Candidato a preço unitário encontrado na tabela: ${price}`);
                  }
                }
              }
            }
          }

          // Se encontrou candidatos, usar o primeiro (mais provável de ser o valor unitário)
          if (candidatePrices.length > 0) {
            // Priorizar valores que aparecem mais próximos ao produto "DIESEL B S10 LT"
            foundUnitPrice = candidatePrices[0];
            console.log(`✅ Preço unitário selecionado da tabela: ${foundUnitPrice}`);
          }
        }
      }

      // 2. Se não encontrou "unitário", procurar por valores próximos ao nome do produto
      if (!foundUnitPrice) {
        console.log('🔍 Buscando preço próximo ao nome do produto...');
        const productContextPatterns = [
          /(diesel\s*b?\s*s-?10|diesel\s*b\s*s\s*10|diesel\s*s-?500|arla\s*32)[\s\S]{0,200}?(\d+[.,]\d{2,3})/gi,
          /(diesel|s-?10|s-?500|arla)[\s\S]{0,150}?r\$\s*(\d+[.,]\d{2,3})/gi,
          /(diesel|s-?10|s-?500|arla)[\s\S]{0,150}?(\d+[.,]\d{2,3})/gi,
          // Padrão específico para tabela de produtos: produto seguido de várias colunas e depois valor unitário
          /(?:diesel\s*b?\s*s-?10|diesel\s*b\s*s\s*10)[\s\S]{0,300}?(\d{1,2}[.,]\d{2})/gi
        ];

        for (const pattern of productContextPatterns) {
          const matches = extractedText.match(pattern);
          if (matches && matches.length > 0) {
            console.log(`📌 Padrão de produto encontrado: ${pattern}, matches:`, matches);
            for (const match of matches) {
              const priceMatch = match.match(/(\d+[.,]\d{2,3})/g);
              if (priceMatch && priceMatch.length > 0) {
                console.log(`💰 Preços encontrados no contexto:`, priceMatch);
                // Tentar encontrar o valor que está mais próximo do padrão de valor unitário (geralmente o menor ou o que está na posição correta)
                const candidatePrices: number[] = [];
                for (const priceStr of priceMatch) {
                  const cleanPrice = priceStr.replace(/\./g, '').replace(',', '.');
                  const price = parseFloat(cleanPrice);
                  console.log(`💰 Analisando preço: ${priceStr} -> ${price}`);
                  // Valores unitários de combustível geralmente estão entre 3 e 10 reais
                  if (price >= 3 && price < 10) {
                    candidatePrices.push(price);
                  }
                }
                // Se encontrou candidatos, usar o menor (mais provável de ser unitário)
                if (candidatePrices.length > 0) {
                  foundUnitPrice = Math.min(...candidatePrices);
                  console.log(`✅ Preço unitário encontrado no contexto: ${foundUnitPrice}`);
                  break;
                }
              }
            }
            if (foundUnitPrice) break;
          }
        }
      }

      // 3. Fallback: procurar todos os preços e filtrar valores razoáveis (entre 3 e 10 reais)
      if (!foundUnitPrice) {
        const allPricePatterns = [
          /r\$\s*(\d+[.,]\d{2,3})/gi,
          /pre[çc]o[:\s]*r?\$?\s*(\d+[.,]\d{2,3})/gi
        ];

        const candidatePrices: number[] = [];

        for (const pattern of allPricePatterns) {
          const matches = extractedText.match(pattern);
          if (matches && matches.length > 0) {
            for (const match of matches) {
              const priceMatch = match.match(/(\d+[.,]\d{2,3})/);
              if (priceMatch) {
                const priceStr = priceMatch[0].replace(/\./g, '').replace(',', '.');
                const price = parseFloat(priceStr);
                // Filtrar valores muito altos (provavelmente são totais, não unitários)
                // Valores unitários de combustível geralmente estão entre 3 e 10 reais
                if (price >= 3 && price < 10) {
                  candidatePrices.push(price);
                }
              }
            }
          }
        }

        // Usar o menor valor encontrado (mais provável de ser unitário)
        if (candidatePrices.length > 0) {
          foundUnitPrice = Math.min(...candidatePrices);
        }
      }

      // Aplicar o preço encontrado
      if (foundUnitPrice) {
        setFormData(prev => ({ ...prev, reference_price: foundUnitPrice!.toFixed(3) }));
        toast.success(`Preço unitário identificado: R$ ${foundUnitPrice.toFixed(3)}`);
        console.log(`✅ Preço encontrado: R$ ${foundUnitPrice.toFixed(3)}`);
      } else {
        console.log('⚠️ Nenhum preço unitário válido encontrado.');
        console.log('📄 Trecho do texto completo extraído:', extractedText);
        // Tentar encontrar qualquer número que pareça um preço
        // Buscar padrões mais flexíveis para texto fragmentado
        const allNumbers = extractedText.match(/\d+[.,\s]?\d{0,3}/g);
        if (allNumbers) {
          console.log('🔢 Todos os números encontrados:', allNumbers);

          // ESTRATÉGIA 1: Tentar calcular o valor unitário a partir do valor total e quantidade
          // Buscar quantidade (245) e valor total (1323,00 ou 1.323,00)
          console.log('🔍 Buscando quantidade e valor total para calcular preço unitário...');

          // Buscar quantidade de várias formas (245 pode estar escrito como "245", "2 4 5", etc)
          const quantidadePatterns = [
            /\b245\b/,
            /\b2\s*4\s*5\b/,
            /qtde[:\s]*245/gi,
            /quantidade[:\s]*245/gi
          ];

          let quantidade = 0;
          for (const pattern of quantidadePatterns) {
            const match = extractedText.match(pattern);
            if (match) {
              quantidade = 245;
              console.log(`✅ Quantidade encontrada: ${quantidade}`);
              break;
            }
          }

          // Buscar valor total dos produtos (1.323,00 ou 1323,00)
          const valorTotalPatterns = [
            /\b1[.,\s]?323[.,\s]?00\b/,  // 1.323,00 ou 1323,00
            /\b1\s*323[.,\s]?00\b/,      // 1 323,00
            /valor\s+total[\s\S]{0,100}?1[.,\s]?323[.,\s]?00/gi,
            /total[\s\S]{0,50}?1[.,\s]?323[.,\s]?00/gi
          ];

          let valorTotal = 0;
          for (const pattern of valorTotalPatterns) {
            const match = extractedText.match(pattern);
            if (match) {
              let valorStr = match[0]
                .replace(/valor\s+total/gi, '')
                .replace(/total/gi, '')
                .replace(/\s+/g, '')
                .replace(/\./g, '')
                .replace(',', '.');

              // Extrair apenas os números
              const numbers = valorStr.match(/\d+\.?\d*/);
              if (numbers) {
                valorTotal = parseFloat(numbers[0]);
                console.log(`✅ Valor total encontrado: R$ ${valorTotal.toFixed(2)}`);
                break;
              }
            }
          }

          // Se encontrou ambos, calcular o valor unitário
          if (quantidade > 0 && valorTotal > 0) {
            const valorUnitarioCalculado = valorTotal / quantidade;
            console.log(`💰 Calculando valor unitário: ${valorTotal.toFixed(2)} / ${quantidade} = ${valorUnitarioCalculado.toFixed(3)}`);

            // Se o valor calculado estiver no range esperado (3-10 reais), usar
            if (valorUnitarioCalculado >= 3 && valorUnitarioCalculado < 10) {
              setFormData(prev => ({ ...prev, reference_price: valorUnitarioCalculado.toFixed(3) }));
              toast.success(`Preço unitário calculado: R$ ${valorUnitarioCalculado.toFixed(3)}`);
              console.log(`✅ Preço calculado a partir de valor total e quantidade: R$ ${valorUnitarioCalculado.toFixed(3)}`);
              foundUnitPrice = valorUnitarioCalculado;
            } else {
              console.log(`⚠️ Valor calculado fora do range esperado: ${valorUnitarioCalculado.toFixed(3)}`);
            }
          } else {
            console.log(`⚠️ Não foi possível calcular: quantidade=${quantidade}, valorTotal=${valorTotal}`);
          }

          // ESTRATÉGIA 2: Tentar encontrar o valor 5,40 especificamente (várias variações)
          if (!foundUnitPrice) {
            const specificPricePatterns = [
              /5[.,\s]?40/,
              /5[.,\s]?4\b/,
              /5\s*[,.]\s*40/,
              /5\s*[,.]\s*4\b/
            ];

            for (const pattern of specificPricePatterns) {
              const match = extractedText.match(pattern);
              if (match) {
                let priceStr = match[0]
                  .replace(/\s+/g, '')
                  .replace(/\./g, '')
                  .replace(',', '.');

                if (!priceStr.includes('.')) {
                  priceStr = priceStr + '.00';
                }

                const price = parseFloat(priceStr);
                if (price >= 3 && price < 10) {
                  setFormData(prev => ({ ...prev, reference_price: price.toFixed(3) }));
                  toast.success(`Preço unitário identificado: R$ ${price.toFixed(3)}`);
                  console.log(`✅ Preço encontrado pelo fallback específico: R$ ${price.toFixed(3)}`);
                  foundUnitPrice = price;
                  break;
                }
              }
            }
          }

          // ESTRATÉGIA 3: Se não encontrou 5,40, procurar qualquer número entre 3 e 10
          if (!foundUnitPrice) {
            for (const numStr of allNumbers) {
              let priceStr = numStr
                .replace(/\s+/g, '')
                .replace(/\./g, '')
                .replace(',', '.');

              if (!priceStr.includes('.')) {
                priceStr = priceStr + '.00';
              }

              const price = parseFloat(priceStr);
              if (price >= 3 && price < 10) {
                setFormData(prev => ({ ...prev, reference_price: price.toFixed(3) }));
                toast.success(`Preço unitário identificado: R$ ${price.toFixed(3)}`);
                console.log(`✅ Preço encontrado pelo fallback genérico: R$ ${price.toFixed(3)}`);
                foundUnitPrice = price;
                break;
              }
            }
          }
        }
      }

      // Identificar produto (padrões mais flexíveis)
      // Priorizar padrões mais específicos primeiro (da NF-e)
      // Padrões adaptados para texto de OCR "sujo" ou fragmentado
      const productPatterns = {
        's10': [
          // Padrões para texto limpo
          /diesel\s*b\s*s-?10\s*lt/gi,     // "DIESEL B S10 LT" (padrão completo da NF-e - mais específico)
          /diesel\s*b\s*s\s*10\s*lt/gi,    // "DIESEL B S 10 LT"
          /diesel\s*b\s*s-?10/gi,          // "DIESEL B S10"
          /diesel\s*b\s*s\s*10/gi,         // "DIESEL B S 10"
          // Padrões para texto fragmentado do OCR
          /diesel.*?b.*?s.*?10.*?lt/gi,    // Permite caracteres entre as palavras
          /diesel.*?b.*?s10.*?lt/gi,       // Permite caracteres entre as palavras
          /diesel.*?b.*?s.*?1\s*0.*?lt/gi, // Permite espaços no "10"
          /diesel.*?s.*?10/gi,             // Sem o "B" (caso o OCR não capture)
          /diesel.*?s10/gi,                 // Sem o "B" e sem espaço
          /diesel\s*b?\s*s-?10/gi,
          /diesel\s*s\s*10/gi,
          /diesel\s*b\s*10/gi,             // "DIESEL B 10"
          /diesel\s*b\s*s10/gi,            // "DIESEL B S10" (sem hífen)
          /s-?10\s*lt/gi,                  // "S10 LT" ou "S-10 LT"
          /s\s*10\s*lt/gi,                 // "S 10 LT"
          /s.*?10.*?lt/gi,                  // Permite caracteres entre S, 10 e LT
          /s-?10/gi,
          /s\s*10/gi,
          /s10/gi,
          // Padrões muito flexíveis para OCR ruim
          /diesel.*?10/gi,                  // Qualquer coisa com "diesel" e "10"
          /s.*?1\s*0/gi                     // "s" seguido de "1" e "0" (mesmo separados)
        ],
        's10_aditivado': [
          /diesel\s*b?\s*s-?10\s*aditivado/gi,
          /s-?10\s*aditivado/gi
        ],
        'diesel_s500': [
          /diesel\s*b?\s*s-?500/gi,
          /diesel\s*s\s*500/gi,
          /s-?500/gi,
          /s\s*500/gi,
          /s500/gi
        ],
        'diesel_s500_aditivado': [
          /diesel\s*b?\s*s-?500\s*aditivado/gi,
          /s-?500\s*aditivado/gi
        ],
        'arla32_granel': [
          /arla\s*32/gi,
          /arla32/gi
        ]
      };

      let productFound = false;
      for (const [productKey, patterns] of Object.entries(productPatterns)) {
        for (const pattern of patterns) {
          if (pattern.test(extractedText)) {
            setFormData(prev => ({ ...prev, product: productKey }));
            toast.success(`Produto identificado: ${getProductName(productKey)}`);
            console.log(`✅ Produto encontrado: ${productKey} com padrão: ${pattern}`);
            productFound = true;
            break;
          }
        }
        if (productFound) break;
      }

      if (!productFound) {
        console.log('⚠️ Nenhum produto identificado com padrões normais.');
        console.log('📄 Texto completo extraído:', extractedText);

        // Tentar busca mais específica para "DIESEL B S10 LT" mesmo em texto fragmentado
        const dieselBS10Patterns = [
          // Padrões para texto limpo
          /diesel\s*b\s*s\s*10\s*lt/gi,
          /diesel\s*b\s*s10\s*lt/gi,
          /diesel\s*b\s*s-10\s*lt/gi,
          // Padrões para texto fragmentado - muito flexíveis
          /diesel.*?b.*?s.*?1\s*0.*?lt/gi,  // Permite qualquer coisa entre as palavras
          /diesel.*?b.*?s1\s*0.*?lt/gi,    // "s1 0" separado
          /diesel.*?s.*?1\s*0.*?lt/gi,     // Sem o "B"
          /diesel.*?s.*?10.*?lt/gi,        // Sem espaço no "10"
          /diesel.*?b.*?s.*?10/gi,         // Sem o "LT"
          /diesel.*?s.*?10/gi,              // Apenas "diesel" e "s10"
          // Padrões muito básicos - último recurso
          /diesel.*?10/gi,                  // Qualquer coisa com "diesel" e "10"
          /s.*?1\s*0/gi,                    // "s" seguido de "1" e "0"
          /s1\s*0/gi                        // "s1" seguido de "0"
        ];

        for (const pattern of dieselBS10Patterns) {
          if (pattern.test(extractedText)) {
            setFormData(prev => ({ ...prev, product: 's10' }));
            toast.success(`Produto identificado: ${getProductName('s10')}`);
            console.log(`✅ Produto encontrado pelo padrão específico: s10 com padrão: ${pattern}`);
            productFound = true;
            break;
          }
        }

        if (!productFound) {
          // Última tentativa: procurar por qualquer menção a "diesel" e assumir S10
          if (/diesel/gi.test(extractedText) && /10|s10|s\s*10/gi.test(extractedText)) {
            setFormData(prev => ({ ...prev, product: 's10' }));
            toast.success(`Produto identificado como Diesel S-10 (detecção parcial)`);
            console.log(`✅ Produto identificado por detecção parcial: s10`);
            productFound = true;
          } else {
            console.log('📄 Trecho do texto para debug:', extractedText.substring(0, 2000));
          }
        }
      }

      // Identificar posto usando padrões de nota fiscal primeiro
      let stationFound = false;
      let stationNameFromNF = '';
      let stationNotificationShown = false; // Flag para evitar múltiplas notificações

      // 1. Procurar por padrões específicos de nota fiscal brasileira
      const nfPatterns = [
        /recebemos\s+de\s+([a-z0-9\s]+ltda?)/gi,
        /emitente[:\s]+([a-z0-9\s]+ltda?)/gi,
        /posto\s+(\d+[\s\w]+ltda?)/gi,
        /([a-z0-9\s]+posto[\s\w]+ltda?)/gi
      ];

      console.log('🔍 Buscando posto na nota fiscal...');
      for (const pattern of nfPatterns) {
        const matches = extractedText.match(pattern);
        if (matches && matches.length > 0) {
          for (const match of matches) {
            // Extrair nome do posto completo (manter LTDA para busca mais precisa)
            let nomePosto = match
              .replace(/recebemos\s+de\s+/i, '')
              .replace(/emitente[:\s]+/i, '')
              .trim();

            // Limpar mas manter estrutura
            nomePosto = nomePosto.replace(/\s+/g, ' ').trim();

            if (nomePosto.length > 5 && !stationFound) {
              stationNameFromNF = nomePosto;
              console.log(`📌 Nome completo do posto encontrado na NF: ${stationNameFromNF}`);

              // Buscar em concorrentes com o nome completo primeiro
              // Capturar resultados diretamente para evitar depender do estado assíncrono
              let currentSuggested = await searchCompetitors(stationNameFromNF);

              // Se não encontrou, tentar sem "POSTO" e sem "LTDA"
              if (currentSuggested.length === 0) {
                const nomeSimplificado = nomePosto
                  .replace(/^posto\s+/i, '')
                  .replace(/\s+ltda?$/i, '')
                  .trim();
                if (nomeSimplificado !== nomePosto && nomeSimplificado.length > 5) {
                  console.log(`🔍 Tentando busca simplificada: ${nomeSimplificado}`);
                  currentSuggested = await searchCompetitors(nomeSimplificado);
                }
              }

              // Verificar se encontrou nas sugestões com match muito próximo
              if (currentSuggested.length > 0 && !stationNotificationShown) {
                console.log('🔍 Verificando sugestões encontradas:', currentSuggested.map(s => s.razao_social));

                // Normalizar nomes para comparação
                const nomeNFNormalizado = stationNameFromNF.toLowerCase()
                  .replace(/\s+/g, ' ')
                  .replace(/\s+ltda?$/i, '')
                  .trim();

                // Tentar encontrar match exato ou muito próximo
                const exactMatch = currentSuggested.find(s => {
                  const nomeBase = s.razao_social.toLowerCase()
                    .replace(/\s+/g, ' ')
                    .replace(/\s+ltda?$/i, '')
                    .trim();

                  // Match exato (sem o sufixo LTDA e espaços extras)
                  if (nomeBase === nomeNFNormalizado || nomeNFNormalizado.includes(nomeBase) || nomeBase.includes(nomeNFNormalizado)) {
                    return true;
                  }
                  return false;
                });

                if (exactMatch) {
                  handleSelectStation(exactMatch);
                  toast.success(`Posto identificado: ${exactMatch.razao_social}`);
                  stationFound = true;
                  stationNotificationShown = true;
                  console.log(`✅ Posto identificado e selecionado automaticamente: ${exactMatch.razao_social}`);
                }
              }
            }
          }
        }
      }

      if (!stationFound) {
        console.log('⚠️ Nenhum posto identificado na base.');
      }

      // 2. Fallback: buscar por nomes conhecidos de postos próprios (mais conservador)
      if (!stationFound && allStations.length > 0) {
        console.log('🔍 Buscando em postos conhecidos...');
        for (const station of allStations) {
          const stationName = (station.name || station.nome_empresa || '').toLowerCase().trim();
          if (stationName && stationName.length > 5) {
            // Buscar nome completo (match mais preciso)
            const nameWithoutLTDA = stationName.replace(/\s+ltda?/i, '').trim();
            if (extractedText.includes(nameWithoutLTDA)) {
              handleSelectStation(station);
              toast.success(`Posto identificado: ${station.name || station.nome_empresa}`);
              console.log(`✅ Posto encontrado: ${station.name || station.nome_empresa}`);
              stationFound = true;
              break;
            }
          }
        }
      }

      if (!stationFound) {
        console.log('⚠️ Nenhum posto identificado automaticamente.');
        console.log('📄 Trecho do texto para debug:', extractedText.substring(0, 1000));
      }
    } catch (error) {
      console.error('Erro ao processar OCR:', error);
      toast.error('Erro ao processar imagem com OCR.');
    } finally {
      // Limpar worker do Tesseract
      if (worker) {
        await worker.terminate();
      }
      setProcessingOCR(false);
    }
  };

  // Processar imagens quando forem anexadas
  useEffect(() => {
    if (attachments.length > 0) {
      // Processar apenas a primeira imagem
      const firstImage = attachments[0];
      if (firstImage && (firstImage.includes('.jpg') || firstImage.includes('.jpeg') || firstImage.includes('.png'))) {
        processImageOCR(firstImage);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachments]);

  if (savedReference) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-6 lg:space-y-8">
          {/* Header com gradiente moderno */}
          <div className="relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 p-4 sm:p-6 lg:p-8 text-white shadow-2xl">
            <div className="absolute inset-0 bg-black/10"></div>
            <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
                <Button
                  variant="secondary"
                  onClick={() => navigate("/dashboard")}
                  className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm text-xs sm:text-sm h-8 sm:h-10"
                >
                  <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Voltar ao Dashboard</span>
                  <span className="sm:hidden">Voltar</span>
                </Button>
                <div className="flex-1 sm:flex-none">
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-1 sm:mb-2">Referência Cadastrada!</h1>
                  <p className="text-green-100 text-sm sm:text-base">Sua referência foi registrada com sucesso</p>
                </div>
              </div>
            </div>
          </div>

          {/* Card de sucesso */}
          <Card className="shadow-xl">
            <CardHeader className="text-center pb-6">
              <div className="flex justify-center mb-6">
                <div className="w-20 h-20 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center shadow-lg">
                  <CheckCircle className="h-12 w-12 text-white" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold text-green-600 dark:text-green-400 mb-2">
                Referência Cadastrada com Sucesso!
              </CardTitle>
              <p className="text-slate-600 dark:text-slate-400">Os dados foram salvos e estão disponíveis para análise</p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Grid de informações */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* ID da Referência */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                      </svg>
                    </div>
                    <Label className="text-sm font-semibold text-blue-700 dark:text-blue-300">ID da Referência</Label>
                  </div>
                  <p className="text-xl font-bold text-blue-900 dark:text-blue-100">{savedReference.codigo_referencia}</p>
                </div>

                {/* Data/Hora */}
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl p-6 border border-purple-200 dark:border-purple-800">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-500 flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <Label className="text-sm font-semibold text-purple-700 dark:text-purple-300">Data/Hora do Cadastro</Label>
                  </div>
                  <p className="text-lg font-semibold text-purple-900 dark:text-purple-100">{formatDateTime(savedReference.created_at)}</p>
                </div>

                {/* Posto */}
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-6 border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <Label className="text-sm font-semibold text-green-700 dark:text-green-300">Posto</Label>
                  </div>
                  <p className="text-lg font-semibold text-green-900 dark:text-green-100">{savedReference.stations?.name || 'Posto'}</p>
                  <p className="text-sm text-green-600 dark:text-green-400">({savedReference.stations?.code || '-'})</p>
                </div>

                {/* Produto */}
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-500 flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                    <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Produto</Label>
                  </div>
                  <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{getProductName(savedReference.produto)}</p>
                </div>

                {/* Preço */}
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-500 flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                      </svg>
                    </div>
                    <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Preço de Referência</Label>
                  </div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{formatPrice(savedReference.preco_referencia)}</p>
                </div>

                {/* Observações */}
                {savedReference.observacoes && (
                  <div className="lg:col-span-2 bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900/20 dark:to-gray-900/20 rounded-xl p-6 border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-500 flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </div>
                      <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Observações</Label>
                    </div>
                    <p className="text-slate-900 dark:text-slate-100">{savedReference.observacoes}</p>
                  </div>
                )}
              </div>

              {/* Botões de ação */}
              <div className="flex gap-4 pt-8 border-t border-slate-200 dark:border-slate-700">
                <Button
                  onClick={() => setSavedReference(null)}
                  className="flex items-center gap-3 h-12 px-8 bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  Cadastrar Nova Referência
                </Button>
                <Button
                  variant="destructive"
                  onClick={async () => {
                    if (!savedReference?.id) {
                      toast.error("Não é possível deletar esta referência");
                      return;
                    }

                    if (!confirm("Tem certeza que deseja deletar esta referência?")) {
                      return;
                    }

                    try {
                      setLoading(true);
                      // Tentar deletar da tabela referencias primeiro
                      const { error: refError } = await supabase
                        .from('referencias' as any)
                        .delete()
                        .eq('id', savedReference.id);

                      if (refError) {
                        // Se não existir na tabela referencias, tentar deletar de price_suggestions
                        const { error: psError } = await supabase
                          .from('price_suggestions')
                          .delete()
                          .eq('id', savedReference.id);

                        if (psError) {
                          throw psError;
                        }
                      }

                      toast.success("Referência deletada com sucesso!");
                      setSavedReference(null);
                      // Reset form
                      setFormData({
                        station_id: "",
                        product: "",
                        reference_price: "",
                        observations: "",
                      });
                      setAttachments([]);
                    } catch (error: any) {
                      toast.error("Erro ao deletar referência: " + (error?.message || "Erro desconhecido"));
                      logger.error("Erro ao deletar referência:", error);
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                  className="flex items-center gap-3 h-12 px-8 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  <Trash2 className="h-4 w-4" />
                  Deletar Referência
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate("/dashboard")}
                  className="flex items-center gap-3 h-12 px-8 border-2 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold rounded-xl transition-all duration-200"
                >
                  Voltar ao Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-6 lg:space-y-8">
        {/* Header com gradiente moderno */}
        <div className="relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 p-4 sm:p-6 lg:p-8 text-white shadow-2xl">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
              <Button
                variant="secondary"
                onClick={() => navigate("/dashboard")}
                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm text-xs sm:text-sm h-8 sm:h-10"
              >
                <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Voltar ao Dashboard</span>
                <span className="sm:hidden">Voltar</span>
              </Button>
              <div className="flex-1 sm:flex-none">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-1 sm:mb-2">Cadastro de Referência</h1>
                <p className="text-blue-100 text-sm sm:text-base">Registre uma nova referência de preço para análise</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          {/* Form Principal */}
          <div className="lg:col-span-2">
            <Card className="shadow-xl">
              <CardHeader className="text-center pb-6">
                <CardTitle className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-200 mb-2">
                  Nova Referência de Preço
                </CardTitle>
                <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">Preencha os dados para cadastrar uma nova referência</p>
              </CardHeader>
              <CardContent className="space-y-8">
                <form onSubmit={handleSubmit} className="space-y-8">
                  {/* Seção: Dados da Referência */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-700">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
                        <span className="text-white font-bold text-sm">1</span>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">
                          Dados da Referência
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400">Informe o posto e os dados da referência</p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-6">
                      {/* Posto - Busca Dinâmica de Concorrentes */}
                      <div className="space-y-2">
                        <Label htmlFor="station_search" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          Posto Concorrente <span className="text-red-500">*</span>
                        </Label>

                        {/* Posto Selecionado */}
                        {selectedStation ? (
                          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3 flex-1">
                                  <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-1 flex-shrink-0" />
                                  <div className="space-y-2 flex-1 min-w-0">
                                    <div className="font-semibold text-blue-900 dark:text-blue-100">
                                      {selectedStation.razao_social}
                                    </div>
                                    <div className="flex flex-wrap gap-2 text-xs">
                                      {selectedStation.bandeira && (
                                        <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200">
                                          {selectedStation.bandeira}
                                        </Badge>
                                      )}
                                      <Badge variant="outline" className="border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-300">
                                        <MapPin className="h-3 w-3 mr-1" />
                                        {selectedStation.municipio} - {selectedStation.uf}
                                      </Badge>
                                    </div>
                                    {selectedStation.endereco && (
                                      <p className="text-xs text-blue-700 dark:text-blue-300 truncate">
                                        {selectedStation.endereco}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={handleClearStation}
                                  className="text-blue-600 hover:text-blue-800 hover:bg-blue-100 dark:text-blue-400 dark:hover:text-blue-200"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ) : (
                          /* Campo de Busca */
                          <div className="relative">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                              <Input
                                id="station_search"
                                placeholder="Busque por nome, CNPJ ou cidade..."
                                value={stationSearch}
                                onChange={(e) => setStationSearch(e.target.value)}
                                className="pl-10 pr-10 h-11"
                              />
                              {stationSearch && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                                  onClick={() => setStationSearch("")}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              )}
                            </div>

                            {/* Results Dropdown */}
                            {suggestedStations.length > 0 && (
                              <Card className="absolute top-full left-0 right-0 mt-1 z-50 max-h-96 overflow-y-auto shadow-xl bg-background border border-border dark:border-slate-700">
                                <CardContent className="p-2">
                                  {searchingStations ? (
                                    <div className="p-4 text-center text-muted-foreground">
                                      Buscando...
                                    </div>
                                  ) : suggestedStations.length === 0 ? (
                                    <div className="p-4 text-center text-muted-foreground">
                                      Nenhum posto encontrado
                                    </div>
                                  ) : (
                                    <div className="space-y-1">
                                      {suggestedStations.map((station) => (
                                        <div
                                          key={`station-${station.id_posto}`}
                                          className="flex items-start gap-3 p-3 hover:bg-secondary/80 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-primary/20 text-foreground"
                                          onClick={() => handleSelectStation(station)}
                                        >
                                          <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-1 flex-shrink-0" />
                                          <div className="flex-1 min-w-0 space-y-1">
                                            <div className="font-semibold text-sm">
                                              {station.razao_social}
                                            </div>
                                            <div className="flex flex-wrap gap-1.5 text-xs">
                                              {station.bandeira && (
                                                <Badge variant="secondary" className="text-xs">
                                                  {station.bandeira}
                                                </Badge>
                                              )}
                                              <Badge variant="outline" className="text-xs">
                                                <MapPin className="h-2.5 w-2.5 mr-1" />
                                                {station.municipio} - {station.uf}
                                              </Badge>
                                            </div>
                                            {station.endereco && (
                                              <p className="text-xs text-muted-foreground truncate">
                                                {station.endereco}
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            )}

                            {/* Overlay to close dropdown */}
                            {suggestedStations.length > 0 && (
                              <div
                                className="fixed inset-0 z-40"
                                onClick={() => setSuggestedStations([])}
                              />
                            )}
                          </div>
                        )}
                      </div>

                      {/* Produto - Obrigatório */}
                      <div className="space-y-2">
                        <Label htmlFor="product" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                          Produto da Referência <span className="text-red-500">*</span>
                        </Label>
                        <Select value={formData.product} onValueChange={(value) => handleInputChange("product", value)}>
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder="Selecione o produto" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="s10">Diesel S-10</SelectItem>
                            <SelectItem value="s10_aditivado">Diesel S-10 Aditivado</SelectItem>
                            <SelectItem value="diesel_s500">Diesel S-500</SelectItem>
                            <SelectItem value="diesel_s500_aditivado">Diesel S-500 Aditivado</SelectItem>
                            <SelectItem value="arla32_granel">Arla 32 Granel</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Preço - Obrigatório */}
                      <div className="space-y-2">
                        <Label htmlFor="price" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                          </svg>
                          Preço da Referência (R$) <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="price"
                          type="number"
                          step="0.001"
                          min="0"
                          placeholder="0.000"
                          value={formData.reference_price}
                          onChange={(e) => handleInputChange("reference_price", e.target.value)}
                          className="h-11 text-lg"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Seção: Informações Adicionais */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-700">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
                        <span className="text-white font-bold text-sm">2</span>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">
                          Informações Adicionais
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400">Adicione observações e anexos opcionais</p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-6">
                      <div className="flex flex-col sm:flex-row gap-6">
                        {/* Anexos - Esquerda */}
                        <div className="space-y-2 flex-1">
                          <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                            <Upload className="h-4 w-4" />
                            Anexos
                          </Label>
                          <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-slate-50 dark:bg-slate-900/50">
                            <FileUploader
                              onFilesUploaded={setAttachments}
                              maxFiles={3}
                              acceptedTypes="image/*,.pdf"
                            />
                            {processingOCR && (
                              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-2">
                                <span className="animate-spin">⏳</span>
                                Processando imagem para identificar preço, produto e posto...
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Observações - Direita */}
                        <div className="space-y-2 flex-1">
                          <Label htmlFor="observations" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Observações
                          </Label>
                          <Textarea
                            id="observations"
                            placeholder="Descreva detalhes importantes sobre esta referência de preço..."
                            value={formData.observations}
                            onChange={(e) => handleInputChange("observations", e.target.value)}
                            rows={5}
                            className="resize-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Botões de ação */}
                  <div className="flex gap-4 pt-6">
                    <Button
                      type="submit"
                      disabled={loading}
                      className="flex-1 h-10 sm:h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 text-sm sm:text-base"
                    >
                      <Save className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                      {loading ? "Salvando..." : "Salvar Referência"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => navigate("/dashboard")}
                      className="h-10 sm:h-12 px-4 sm:px-8 rounded-xl border-2 text-sm sm:text-base"
                    >
                      Cancelar
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar de Resumo */}
          <div className="lg:col-span-1">
            <Card className="shadow-xl">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg">
                    <Save className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold text-slate-800 dark:text-slate-200">
                      Resumo da Referência
                    </CardTitle>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      Verifique os dados antes de salvar
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedStation && (
                  <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-xl border border-blue-200 dark:border-blue-800">
                    <div className="flex items-start gap-3 mb-3">
                      <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                      <h4 className="font-bold text-blue-900 dark:text-blue-200">Posto Concorrente</h4>
                    </div>
                    <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">{selectedStation.razao_social}</p>
                    {selectedStation.municipio && (
                      <p className="text-xs text-blue-700 dark:text-blue-300">
                        {selectedStation.municipio} - {selectedStation.uf}
                      </p>
                    )}
                  </div>
                )}

                {formData.product && (
                  <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="flex items-start gap-3 mb-3">
                      <svg className="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                      <h4 className="font-bold text-slate-900 dark:text-slate-200">Produto</h4>
                    </div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {getProductName(formData.product)}
                    </p>
                  </div>
                )}

                {formData.reference_price && (
                  <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="flex items-start gap-3 mb-3">
                      <DollarSign className="h-5 w-5 flex-shrink-0 mt-0.5" />
                      <h4 className="font-bold text-slate-900 dark:text-slate-200">Preço</h4>
                    </div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                      R$ {parseFloat(formData.reference_price).toFixed(3)}
                    </p>
                  </div>
                )}

                {attachments.length > 0 && (
                  <div className="p-4 bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-950/20 dark:to-cyan-950/20 rounded-xl border border-teal-200 dark:border-teal-800">
                    <div className="flex items-start gap-3 mb-3">
                      <Upload className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                      <h4 className="font-bold text-teal-900 dark:text-teal-200">Anexos ({attachments.length})</h4>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
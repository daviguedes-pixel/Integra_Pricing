import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { sanitizeText, sanitizeObject } from '@/lib/sanitize';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Função para converter formato brasileiro (vírgula) para internacional (ponto)
export function parseBrazilianDecimal(value: string | number): number {
  if (typeof value === 'number') return value;

  // Remove espaços
  let cleanValue = value.toString().trim();

  // Se tiver pontos e vírgulas (ex: 1.000,00), remove os pontos
  if (cleanValue.includes('.') && cleanValue.includes(',')) {
    cleanValue = cleanValue.replace(/\./g, '');
  }

  // Converte vírgula para ponto
  cleanValue = cleanValue.replace(',', '.');

  // Converte para número
  const parsed = parseFloat(cleanValue);

  // Retorna NaN se não conseguir converter
  return isNaN(parsed) ? 0 : parsed;
}

// Função para formatar número para exibição brasileira
export function formatBrazilianCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export const formatCurrency = formatBrazilianCurrency;

// Função para converter número inteiro (centavos) para formato de exibição com vírgula fixa
// Ex: 350 -> "3,50", 100 -> "1,00"
export function formatIntegerToPrice(integerValue: string | number): string {
  if (!integerValue && integerValue !== 0) return '';
  const num = typeof integerValue === 'string' ? parseInt(integerValue.replace(/\D/g, ''), 10) : integerValue;
  if (isNaN(num)) return '';
  const reais = Math.floor(num / 100);
  const centavos = num % 100;
  return `${reais},${centavos.toString().padStart(2, '0')}`;
}

// Função para converter formato de exibição (com vírgula) para número inteiro (centavos)
// Ex: "3,50" -> 350, "1,00" -> 100
export function parsePriceToInteger(priceString: string): number {
  if (!priceString) return 0;
  // Remove tudo exceto números
  const cleanValue = priceString.replace(/\D/g, '');
  return parseInt(cleanValue, 10) || 0;
}

/**
 * Mapeia o valor do produto do frontend para o valor válido do enum product_type no banco de dados
 * @param product - Valor do produto do frontend (ex: 's10_aditivado', 'diesel_s500_aditivado')
 * @returns Valor válido do enum product_type ou null se não mapeado
 */
export function mapProductToEnum(product: string | null | undefined): string | null {
  if (!product) return null;

  const productLower = product.toLowerCase().trim();

  // Mapeamento de valores do frontend para valores do enum
  // Baseado no enum atual: 'gasolina_comum', 'gasolina_aditivada', 'etanol', 's10', 's500'
  // (O enum pode ter 'diesel_s10'/'diesel_s500' ou 's10'/'s500' dependendo da migração)
  const productMap: Record<string, string> = {
    // S10 - mapeia para s10 (versão atual do enum)
    's10': 's10',
    'diesel_s10': 's10', // Fallback: se o enum usar 's10' ao invés de 'diesel_s10'
    's10_aditivado': 's10', // Mapeia para s10 pois não existe s10_aditivado no enum
    'diesel_s10_aditivado': 's10',

    // S500 - mapeia para s500 (versão atual do enum)
    's500': 's500',
    'diesel_s500': 's500', // Fallback: se o enum usar 's500' ao invés de 'diesel_s500'
    's500_aditivado': 's500', // Mapeia para s500 pois não existe s500_aditivado no enum
    'diesel_s500_aditivado': 's500',

    // Gasolina
    'gasolina_comum': 'gasolina_comum',
    'gasolina_aditivada': 'gasolina_aditivada',

    // Etanol
    'etanol': 'etanol',

    // ARLA
    'arla32_granel': 'arla32_granel',
    'arla': 'arla32_granel',
  };

  // Retorna o valor mapeado ou o próprio valor se já for válido
  if (productMap[productLower] !== undefined) {
    return productMap[productLower];
  }

  // Se não encontrou no mapa, retorna o valor original (pode ser válido)
  return productLower;
}

// Função para verificar se uma string é um UUID válido
export function isValidUUID(uuid: string | null | undefined): boolean {
  if (!uuid) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

// Função para gerar UUID v4 compatível (funciona em todos os ambientes)
export function generateUUID(): string {
  // Verificar se crypto.randomUUID está disponível (navegadores modernos)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback: gerar UUID v4 manualmente
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Cria uma notificação no banco de dados e envia push notification
 * 
 * IMPORTANTE: Esta função cria notificações SEMPRE, mesmo se for para o próprio usuário.
 * Não há limitação de auto-notificação - o usuário quer receber notificações sempre.
 * 
 * @param userId - ID do usuário que receberá a notificação
 * @param type - Tipo da notificação
 * @param title - Título da notificação (será sanitizado para prevenir XSS)
 * @param message - Mensagem da notificação (será sanitizada para prevenir XSS)
 * @param data - Dados adicionais em formato JSON (será sanitizado)
 * @param expiresAt - Data de expiração da notificação (opcional)
 * @returns Promise<boolean> - true se a notificação foi criada com sucesso
 * @throws Error se userId for inválido
 * 
 * @example
 * ```typescript
 * await createNotification(
 *   user.id,
 *   'price_approved',
 *   'Preço Aprovado',
 *   'Sua solicitação foi aprovada',
 *   { suggestion_id: '123', approved_by: 'João' }
 * );
 * ```
 */
export async function createNotification(
  userId: string,
  type: 'rate_expiry' | 'approval_pending' | 'price_approved' | 'price_rejected' | 'system' | 'competitor_update' | 'client_update',
  title: string,
  message: string,
  data?: Record<string, any>,
  expiresAt?: Date
) {
  // Validar userId
  if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
    console.error('❌ createNotification: userId vazio ou inválido');
    return false;
  }

  if (!isValidUUID(userId)) {
    console.error(`❌ createNotification: userId NÃO é um UUID válido: "${userId}"`);
    console.trace('Trace da origem do erro de UUID:');
    return false;
  }

  // Sanitizar inputs para prevenir XSS
  const sanitizedTitle = sanitizeText(title);
  const sanitizedMessage = sanitizeText(message);
  const sanitizedData = data ? sanitizeObject(data) : undefined;

  const { supabase } = await import('@/integrations/supabase/client');

  // IMPORTANTE: Não há verificação de "mesmo usuário" aqui
  // A notificação será criada SEMPRE, independente de quem está criando

  interface NotificationInsert {
    user_id: string;
    type: string;
    title: string;
    message: string;
    read: boolean;
    suggestion_id: string; // Coluna NOT NULL no banco
    data?: Record<string, any> | null;
    expires_at?: string | null;
  }

  // Garantir que temos um suggestion_id válido (coluna é NOT NULL)
  let validSuggestionId = '00000000-0000-0000-0000-000000000000';
  if (data?.suggestion_id && isValidUUID(data.suggestion_id)) {
    validSuggestionId = data.suggestion_id;
  } else if (data?.suggestion_id) {
    console.warn(`⚠️ createNotification: suggestion_id NÃO é um UUID válido: "${data.suggestion_id}". Usando fallback.`);
  } else {
    console.warn('⚠️ suggestion_id não fornecido nos dados da notificação. Usando fallback.');
  }

  const notificationData: NotificationInsert = {
    user_id: userId.trim(),
    type,
    title: sanitizedTitle,
    message: sanitizedMessage,
    read: false,
    suggestion_id: validSuggestionId
  };

  // Adicionar campo 'data' apenas se a coluna existir (para evitar erros)
  // Vamos tentar adicionar sempre, mas se der erro, continuamos sem ele
  if (sanitizedData) {
    // Remover suggestion_id dos dados se já estiver no nível superior
    const { suggestion_id, ...dataWithoutSuggestionId } = sanitizedData;
    notificationData.data = dataWithoutSuggestionId;
  }

  if (expiresAt) {
    notificationData.expires_at = expiresAt.toISOString();
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('📝 INSERINDO NOTIFICAÇÃO NO BANCO');
  console.log('═══════════════════════════════════════════════════════');
  console.log('User ID:', userId);
  console.log('Type:', type);
  console.log('Title:', title);
  console.log('Message:', message);
  console.log('Data recebido:', data);
  console.log('Data type:', typeof data);
  console.log('Notification Data completo:', notificationData);
  console.log('Data field no notificationData:', notificationData.data);
  console.log('═══════════════════════════════════════════════════════');
  console.log('');

  // Verificar se suggestion_id é obrigatório tentando inserir primeiro
  let insertedData: any = null;
  let error: any = null;

  try {
    const result = await supabase
      .from('notifications')
      .insert([notificationData as any])
      .select();

    insertedData = result.data;
    error = result.error;
  } catch (err: any) {
    error = err;
  }

  if (error) {
    console.error('❌ Erro ao criar notificação:', {
      error,
      errorCode: error.code,
      errorMessage: error.message,
      errorDetails: error.details,
      errorHint: error.hint,
      notificationData
    });

    // Se o erro for sobre coluna 'data' não encontrada, tentar sem ela
    if (error.message?.includes("'data' column") || error.message?.includes('schema cache')) {
      console.log('⚠️ Coluna "data" não encontrada. Tentando inserir sem ela...');

      // Remover campo 'data' e tentar novamente
      const { data: dataField, ...notificationDataWithoutData } = notificationData;

      const retryResult = await supabase
        .from('notifications')
        .insert([notificationDataWithoutData])
        .select();

      if (retryResult.error) {
        console.error('❌ Erro ao criar notificação (retry sem data):', retryResult.error);
        // Continuar para outras tentativas
      } else {
        insertedData = retryResult.data;
        console.log('✅ Notificação inserida no banco (sem campo data):', insertedData);
        error = null; // Marcar como sucesso
      }
    }

    // Se o erro for sobre suggestion_id obrigatório (23502 = not null violation)
    if (error && (error.message?.includes('suggestion_id') || error.code === '23502') && !notificationData.suggestion_id) {
      console.log('⚠️ suggestion_id é obrigatório mas não foi fornecido. Gerando UUID temporário...');

      // Gerar UUID temporário para suggestion_id (não ideal, mas necessário se a tabela exige)
      const notificationDataWithSuggestionId = {
        ...notificationData,
        suggestion_id: generateUUID()
      };

      // Remover 'data' se ainda estiver presente e causar erro
      if (error.message?.includes("'data' column")) {
        delete notificationDataWithSuggestionId.data;
      }

      const retryResult = await supabase
        .from('notifications')
        .insert([notificationDataWithSuggestionId])
        .select();

      if (retryResult.error) {
        console.error('❌ Erro ao criar notificação (retry com suggestion_id):', retryResult.error);
        throw retryResult.error;
      }

      insertedData = retryResult.data;
      console.log('✅ Notificação inserida no banco (com suggestion_id gerado):', insertedData);
      error = null; // Marcar como sucesso
    } else if (error) {
      throw error;
    }
  }

  if (!error) {
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ NOTIFICAÇÃO INSERIDA NO BANCO');
    console.log('═══════════════════════════════════════════════════════');
    console.log('Notification ID:', insertedData?.[0]?.id);
    console.log('User ID:', userId);
    console.log('Title:', title);
    console.log('Type:', type);
    console.log('Inserted Data completo:', insertedData?.[0]);
    console.log('Data field inserido:', insertedData?.[0]?.data);
    console.log('Data type:', typeof insertedData?.[0]?.data);
    console.log('Approved by no data:', insertedData?.[0]?.data?.approved_by);
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
  }

  // Verificar se a notificação foi realmente criada e é visível para o usuário
  if (insertedData?.[0]?.id) {
    // Aguardar um pouco para garantir que a transação foi commitada
    await new Promise(resolve => setTimeout(resolve, 100));

    const { data: verifyData, error: verifyError } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', insertedData[0].id)
      .single();

    if (verifyError) {
      console.error('⚠️ Notificação criada mas não encontrada na verificação:', {
        error: verifyError,
        notificationId: insertedData[0].id,
        userId,
        possibleRLSIssue: verifyError.code === 'PGRST301' || verifyError.message?.includes('RLS')
      });
    } else {
      console.log('✅ Notificação verificada no banco:', {
        id: verifyData?.id,
        user_id: verifyData?.user_id,
        userId,
        match: verifyData?.user_id === userId,
        read: verifyData?.read,
        title: verifyData?.title
      });

      // Se o user_id não corresponde, há um problema
      if (verifyData?.user_id !== userId) {
        console.error('❌ PROBLEMA CRÍTICO: user_id da notificação não corresponde!', {
          expectedUserId: userId,
          actualUserId: verifyData?.user_id,
          notificationId: verifyData?.id
        });
      }
    }
  }

  // Enviar notificação push também (usando a mesma função que funciona no PushNotificationSetup)
  try {
    const { sendPushNotification } = await import('@/lib/pushNotification');

    // Preparar payload exatamente como no PushNotificationSetup que funciona
    const pushPayload = {
      title,
      body: message,
      url: data?.url || '/dashboard',
      tag: type,
      data: data || {}
    };

    // Chamar exatamente como no PushNotificationSetup
    await sendPushNotification(userId, pushPayload);
  } catch (pushError: any) {
    // Não falhar se push não funcionar
    console.warn('Aviso: Não foi possível enviar push notification:', pushError);
  }

  return true;
}

// Função helper para criar notificações para múltiplos usuários
export async function createNotificationForUsers(
  userIds: string[],
  type: 'rate_expiry' | 'approval_pending' | 'price_approved' | 'price_rejected' | 'system' | 'competitor_update' | 'client_update',
  title: string,
  message: string,
  data?: Record<string, any>
) {
  const { supabase } = await import('@/integrations/supabase/client');

  const notifications = userIds.map(userId => {
    // Garantir que temos um suggestion_id válido (coluna é NOT NULL)
    let validSuggestionId = '00000000-0000-0000-0000-000000000000';
    if (data?.suggestion_id && isValidUUID(data.suggestion_id)) {
      validSuggestionId = data.suggestion_id;
    }

    const item: any = {
      user_id: userId,
      type,
      title,
      message,
      read: false,
      suggestion_id: validSuggestionId
    };

    if (data) {
      // Remover suggestion_id dos dados se já estiver no nível superior
      const { suggestion_id, ...dataWithoutSuggestionId } = data;
      item.data = dataWithoutSuggestionId;
    }

    return item;
  });

  const { error } = await supabase
    .from('notifications')
    .insert(notifications);

  if (error) {
    console.error('Erro ao criar notificações:', error);
    throw error;
  }

  // Enviar notificações push também
  try {
    const { sendPushNotificationToUsers } = await import('@/lib/pushNotification');
    await sendPushNotificationToUsers(userIds, {
      title,
      body: message,
      data: data || {},
      tag: type
    });
  } catch (pushError) {
    // Não falhar se push não funcionar
    console.warn('Aviso: Não foi possível enviar push notifications:', pushError);
  }

  return true;
}

// Função para formatar nome a partir de email ou string similar
// Ex: davi.guedes@exemplo.com -> Davi Guedes
// Ex: davi.guedes -> Davi Guedes
export function formatNameFromEmail(input: string | undefined | null): string {
  if (!input) return 'N/A';
  if (input === 'Desconhecido') return input;

  let result = input;

  // Se for email, pega a primeira parte
  if (result.includes('@')) {
    result = result.split('@')[0];
  }

  // Se o resultado contiver pontos ou underscores, substitui por espaços e capitaliza
  // Verifica se tem ponto ou underscore E não tem espaço (para evitar alterar nomes normais que tenham ponto como Sr. Silva)
  // Mas como a ordem veio de email, vamos assumir que pontos devem virar espaços
  if (result.includes('.') || result.includes('_')) {
    result = result.replace(/[._]/g, ' ');
    // Capitaliza cada palavra
    result = result.toLowerCase().split(' ').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  } else if (!result.includes(' ') && result !== input) {
    // Se era um email simples sem pontos (ex: admin@...), apenas capitaliza
    result = result.charAt(0).toUpperCase() + result.slice(1).toLowerCase();
  }

  return result;
}

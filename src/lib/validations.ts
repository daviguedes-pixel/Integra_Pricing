/**
 * Schemas de validação usando Zod
 * Validação de inputs para prevenir erros e ataques
 */

import { z } from 'zod';

/**
 * Schema para validação de solicitação de preço
 */
export const priceSuggestionSchema = z.object({
  station_id: z.string().min(1, 'Selecione um posto'),
  client_id: z.string().min(1, 'Selecione um cliente'),
  product: z.string().min(1, 'Selecione um produto'),
  suggested_price: z.string().min(1, 'Preço sugerido é obrigatório').refine(
    (val) => {
      // Remove symbols and ensure it's a number
      const clean = val.replace(/[^\d,]/g, '').replace(',', '.');
      const num = parseFloat(clean);
      return !isNaN(num) && num > 0;
    },
    { message: 'Preço sugerido deve ser maior que zero' }
  ),
  current_price: z.string().optional(),
  purchase_cost: z.string().optional(),
  freight_cost: z.string().optional(),
  payment_method_id: z.string().optional(),
  reference_id: z.string().optional(),
  observations: z.string().max(5000, 'Observações muito longas').optional(),
  batch_name: z.string().max(200, 'Nome do lote muito longo').optional(),
});

/**
 * Schema para validação de edição de solicitação
 */
export const editRequestSchema = z.object({
  station_id: z.string().min(1, 'Selecione um posto'),
  client_id: z.string().min(1, 'Selecione um cliente'),
  product: z.string().min(1, 'Selecione um produto'),
  payment_method_id: z.string().min(1, 'Selecione um método de pagamento'),
  cost_price: z.string().refine(
    (val) => {
      const num = parseFloat(val.replace(',', '.'));
      return !isNaN(num) && num > 0;
    },
    { message: 'Preço de custo deve ser maior que zero' }
  ),
  final_price: z.string().optional(),
  margin_cents: z.string().optional(),
  observations: z.string().max(5000, 'Observações muito longas').optional(),
});

/**
 * Schema para validação de cliente
 */
export const clientSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório').max(200, 'Nome muito longo'),
  cnpj: z.string().max(18, 'CNPJ inválido').optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  telefone: z.string().max(20, 'Telefone muito longo').optional(),
  endereco: z.string().max(500, 'Endereço muito longo').optional(),
});

/**
 * Schema para validação de posto
 */
export const stationSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200, 'Nome muito longo'),
  code: z.string().min(1, 'Código é obrigatório').max(50, 'Código muito longo'),
  address: z.string().max(500, 'Endereço muito longo').optional(),
  latitude: z.string().optional().refine(
    (val) => !val || (!isNaN(parseFloat(val)) && parseFloat(val) >= -90 && parseFloat(val) <= 90),
    { message: 'Latitude inválida (deve estar entre -90 e 90)' }
  ),
  longitude: z.string().optional().refine(
    (val) => !val || (!isNaN(parseFloat(val)) && parseFloat(val) >= -180 && parseFloat(val) <= 180),
    { message: 'Longitude inválida (deve estar entre -180 e 180)' }
  ),
});

/**
 * Schema para validação de notificação
 */
export const notificationSchema = z.object({
  userId: z.string().uuid('ID de usuário inválido'),
  type: z.enum([
    'rate_expiry',
    'approval_pending',
    'price_approved',
    'price_rejected',
    'system',
    'competitor_update',
    'client_update'
  ]),
  title: z.string().min(1, 'Título é obrigatório').max(200, 'Título muito longo'),
  message: z.string().min(1, 'Mensagem é obrigatória').max(2000, 'Mensagem muito longa'),
  data: z.record(z.any()).optional(),
});

/**
 * Função helper para validar dados com schema Zod
 * 
 * @template T - Tipo esperado dos dados validados
 * @param schema - Schema Zod para validação
 * @param data - Dados a serem validados
 * @returns Objeto com success: true e data validada, ou success: false com errors
 * 
 * @example
 * ```typescript
 * const validation = validateWithSchema(priceSuggestionSchema, formData);
 * if (!validation.success) {
 *   const errors = getValidationErrors(validation.errors);
 *   // Tratar erros
 * }
 * ```
 */
export function validateWithSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, errors: result.error };
  }
}

/**
 * Schema para validação de referência de preço
 */
export const referenceRegistrationSchema = z.object({
  station_id: z.string().min(1, 'Selecione um posto'),
  product: z.string().min(1, 'Selecione um produto'),
  reference_price: z.string().min(1, 'Preço de referência é obrigatório').refine(
    (val) => {
      const num = parseFloat(val.replace(',', '.'));
      return !isNaN(num) && num > 0;
    },
    { message: 'Preço de referência deve ser maior que zero' }
  ),
  observations: z.string().max(5000, 'Observações muito longas').optional(),
});

/**
 * Função helper para obter mensagens de erro formatadas do Zod
 * 
 * @param error - Erro Zod retornado pela validação
 * @returns Objeto com chaves sendo os caminhos dos campos e valores sendo as mensagens de erro
 * 
 * @example
 * ```typescript
 * const validation = validateWithSchema(schema, data);
 * if (!validation.success) {
 *   const errors = getValidationErrors(validation.errors);
 *   // errors = { "station_id": "Selecione um posto", "product": "Selecione um produto" }
 * }
 * ```
 */
export function getValidationErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};

  error.errors.forEach((err) => {
    const path = err.path.join('.');
    errors[path] = err.message;
  });

  return errors;
}


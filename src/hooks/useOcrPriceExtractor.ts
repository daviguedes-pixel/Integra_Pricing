import { useState, useCallback } from 'react';
import { toast } from 'sonner';

// ── Price ranges per product (used to filter outliers) ──
const PRICE_RANGES: Record<string, { min: number; max: number }> = {
    s10: { min: 3.5, max: 9.0 },
    s10_aditivado: { min: 3.5, max: 9.5 },
    diesel_s500: { min: 3.5, max: 9.0 },
    diesel_s500_aditivado: { min: 3.5, max: 9.5 },
    arla32_granel: { min: 0.5, max: 4.5 },
};

// ── Product detection patterns ──
const PRODUCT_PATTERNS: { product: string; patterns: RegExp[] }[] = [
    {
        product: 's10',
        patterns: [
            /diesel\s*b?\s*s[\s-]?10/gi,
            /s[\s-]?10\b/gi,
            /diesel.*s[\s-]?10/gi,
        ],
    },
    {
        product: 'diesel_s500',
        patterns: [
            /diesel\s*(?:b\s*)?s[\s-]?500/gi,
            /s[\s-]?500\b/gi,
        ],
    },
    {
        product: 'arla32_granel',
        patterns: [
            /arla\s*32/gi,
            /arla32/gi,
            /arla\b/gi,
        ],
    },
];

export interface OcrPriceResult {
    product: string;           // e.g. 's10', 'diesel_s500', 'arla32_granel'
    productLabel: string;      // e.g. 'Diesel S-10'
    price: number;
    confidence: 'high' | 'medium' | 'low';
    source: 'detected' | 'fallback'; // 'detected' = product found in text, 'fallback' = used form product
}

export interface OcrExtractionResult {
    prices: OcrPriceResult[];
    rawText: string;
}

const PRODUCT_LABELS: Record<string, string> = {
    s10: 'Diesel S-10',
    s10_aditivado: 'Diesel S-10 Aditivado',
    diesel_s500: 'Diesel S-500',
    diesel_s500_aditivado: 'Diesel S-500 Aditivado',
    arla32_granel: 'Arla 32 Granel',
};

// ───────────────────────────────── Hook ──────────────────────────────────
export function useOcrPriceExtractor() {
    const [isProcessing, setIsProcessing] = useState(false);
    const [results, setResults] = useState<OcrExtractionResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    // ── OCR.space API call ──
    const callOcrSpaceApi = async (imageUrl: string): Promise<string | null> => {
        try {
            let imageBase64 = '';

            if (imageUrl.startsWith('http') || imageUrl.startsWith('data:')) {
                const response = await fetch(imageUrl);
                const blob = await response.blob();
                imageBase64 = await new Promise<string>((resolve) => {
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

            const formData = new FormData();
            formData.append('apikey', 'helloworld');
            formData.append('language', 'por');
            formData.append('isOverlayRequired', 'false');
            formData.append('base64Image', `data:image/jpeg;base64,${imageBase64}`);
            formData.append('OCREngine', '2');

            const apiResponse = await fetch('https://api.ocr.space/parse/image', {
                method: 'POST',
                body: formData,
            });

            const result = await apiResponse.json();
            if (result.ParsedResults?.[0]?.ParsedText) {
                return result.ParsedResults[0].ParsedText;
            }
            return null;
        } catch (err) {
            console.error('OCR.space API error:', err);
            return null;
        }
    };

    // ── Tesseract.js fallback ──
    const callTesseract = async (imageUrl: string): Promise<string | null> => {
        try {
            const { createWorker } = await import('tesseract.js');
            const worker = await createWorker('por');
            await worker.setParameters({
                tessedit_pageseg_mode: '4' as any,
                preserve_interword_spaces: '1',
            });

            const { data: { text } } = await worker.recognize(imageUrl);

            // Retry with different page seg mode if poor result
            if (text.length < 200) {
                await worker.setParameters({ tessedit_pageseg_mode: '6' as any });
                const retry = await worker.recognize(imageUrl);
                if (retry.data.text.length > text.length) {
                    await worker.terminate();
                    return retry.data.text;
                }
            }

            await worker.terminate();
            return text;
        } catch (err) {
            console.error('Tesseract error:', err);
            return null;
        }
    };

    // ── Extract prices from text — NF-e-aware logic ──
    const extractPricesFromText = (
        rawText: string,
        selectedProduct: string
    ): OcrPriceResult[] => {
        const text = rawText.toLowerCase();
        const results: OcrPriceResult[] = [];
        const alreadyFound = new Set<string>();

        // 1. Try to detect each product in the text and extract its unit price
        for (const { product, patterns } of PRODUCT_PATTERNS) {
            if (alreadyFound.has(product)) continue;

            for (const pattern of patterns) {
                pattern.lastIndex = 0;
                const match = pattern.exec(text);
                if (match) {
                    // Found product mention — extract unit price from its NF-e row
                    const price = extractUnitPriceFromRow(text, match.index, product);
                    if (price !== null) {
                        results.push({
                            product,
                            productLabel: PRODUCT_LABELS[product] || product,
                            price,
                            confidence: 'high',
                            source: 'detected',
                        });
                        alreadyFound.add(product);
                    }
                    break; // Move to next product
                }
            }
        }

        // 2. Fallback: if no product-specific prices found, use form's selected product
        if (results.length === 0 && selectedProduct) {
            console.log(`🔄 OCR fallback: usando produto do formulário (${selectedProduct})`);
            const range = PRICE_RANGES[selectedProduct] || { min: 2, max: 10 };
            const candidates = findAllCandidatePrices(text, range);
            if (candidates.length > 0) {
                results.push({
                    product: selectedProduct,
                    productLabel: PRODUCT_LABELS[selectedProduct] || selectedProduct,
                    price: candidates[0],
                    confidence: 'medium',
                    source: 'fallback',
                });
            }
        }

        return results;
    };

    /**
     * Extract unit price from the NF-e product row.
     * In a NF-e, the product row typically contains:
     * CÓDIGO | DESCRIÇÃO | NCM | CST | CFOP | UN | QTDE | VALOR UNITÁRIO | DESCONTO | VALOR TOTAL
     *
     * Strategy: search AFTER the product name for the unit price,
     * which is the first reasonable number AFTER quantity fields.
     */
    const extractUnitPriceFromRow = (text: string, productIndex: number, product: string): number | null => {
        const range = PRICE_RANGES[product] || { min: 2, max: 10 };

        // Get region after product mention (the rest of the NF-e row data)
        const regionAfter = text.substring(productIndex, Math.min(text.length, productIndex + 800));

        console.log(`🔍 [${product}] Buscando preço na região: "${regionAfter.substring(0, 200)}..."`);

        // Strategy 1: Look for "VALOR UNITÁRIO" or "UNIT" label followed by price
        const unitarioPatterns = [
            /valor\s+unit[áa]rio[:\s]*r?\$?\s*(\d+[.,]\d{2,4})/gi,
            /unit[áa]rio[:\s]*r?\$?\s*(\d+[.,]\d{2,4})/gi,
            /vl\.?\s*unit\.?[:\s]*r?\$?\s*(\d+[.,]\d{2,4})/gi,
        ];

        for (const pat of unitarioPatterns) {
            pat.lastIndex = 0;
            const m = pat.exec(regionAfter);
            if (m) {
                const price = parseBrNumber(m[1]);
                if (price !== null && price >= range.min && price <= range.max) {
                    console.log(`✅ [${product}] Preço unitário via label: R$ ${price}`);
                    return price;
                }
            }
        }

        // Strategy 2: Parse the NF-e table row structure
        // After the product description, expect: NCM | CST | CFOP | UN | QTDE | VALOR_UNITÁRIO
        // Skip numbers that look like NCM (8+ digits), CST (3 digits), CFOP (4-5 digits with dot)
        // Then skip quantity (often > 10 or has 3 decimals like 350,000)
        // The unit price is a small number with 2-4 decimals in the valid range

        // Extract all number-like tokens from the row region
        const numberTokens: { value: number; raw: string; index: number }[] = [];
        const numRegex = /(\d+[.,]\d{1,6})/g;
        let nm: RegExpExecArray | null;
        while ((nm = numRegex.exec(regionAfter)) !== null) {
            const parsed = parseBrNumber(nm[1]);
            if (parsed !== null) {
                numberTokens.push({ value: parsed, raw: nm[1], index: nm.index });
            }
        }

        console.log(`📊 [${product}] Tokens numéricos encontrados:`, numberTokens.map(t => `${t.raw}→${t.value}`).join(', '));

        // Find the first number in the valid price range that:
        // - Is NOT a large quantity (>= 100)
        // - IS within the product's price range
        // - Has 2-4 decimal places (unit prices typically do)
        for (const token of numberTokens) {
            const decMatch = token.raw.match(/[.,](\d+)$/);
            const decimals = decMatch ? decMatch[1].length : 0;

            // Skip numbers without decimal part or with 1 decimal (not a price format)
            if (decimals < 2) continue;

            // Skip CFOPs (like 5.667, 5.102 — 4+ digit numbers or starting with 5 followed by 3 digits after dot)
            if (/^\d[.,]\d{3,}$/.test(token.raw) && token.value < 10) {
                // Could be CFOP like 5.667 or 5.102 — check if it has exactly 3 decimals AND value pattern matches CFOP
                const afterDot = token.raw.split(/[.,]/)[1];
                if (afterDot && afterDot.length === 3 && parseInt(afterDot) >= 100) {
                    console.log(`⏭️ [${product}] Pulando possível CFOP: ${token.raw}`);
                    continue;
                }
            }

            // Skip quantities (usually >= 100 or have 3 trailing zeros like 350,000)
            if (token.value >= 100) continue;

            // Check if within valid price range
            if (token.value >= range.min && token.value <= range.max) {
                console.log(`✅ [${product}] Preço unitário da tabela NF-e: R$ ${token.value.toFixed(4)} (raw: ${token.raw})`);
                return token.value;
            }
        }

        console.log(`⚠️ [${product}] Nenhum preço unitário encontrado na faixa ${range.min}-${range.max}`);
        return null;
    };

    /**
     * Parse Brazilian number format:
     * "5,60" → 5.60
     * "20,610" → 20.610
     * "1.960,00" → 1960.00
     * "5.667" → 5667 (thousand separator) OR 5.667 (decimal — ambiguous)
     */
    const parseBrNumber = (raw: string): number | null => {
        // Detect format: if has both dot and comma, dot is thousand separator
        if (raw.includes('.') && raw.includes(',')) {
            // "1.960,00" → "1960.00"
            const cleaned = raw.replace(/\./g, '').replace(',', '.');
            return parseFloat(cleaned);
        }
        if (raw.includes(',')) {
            // "5,60" → "5.60"  or  "350,000" → "350.000"
            const cleaned = raw.replace(',', '.');
            return parseFloat(cleaned);
        }
        if (raw.includes('.')) {
            // "5.667" — could be decimal (5.667) or thousand separator (5667)
            // If exactly 3 digits after dot AND before-dot is 1-3 digits, treat as decimal
            const parts = raw.split('.');
            if (parts[1] && parts[1].length === 3 && parts[0].length <= 2) {
                return parseFloat(raw); // 5.667 → 5.667 (decimal)
            }
            // Otherwise treat as thousand separator: "5.667" → 5667
            if (parts[1] && parts[1].length === 3 && parts[0].length > 2) {
                return parseFloat(raw.replace('.', ''));
            }
            return parseFloat(raw);
        }
        return parseFloat(raw);
    };

    /**
     * Fallback: find all candidate prices in the entire text within a range.
     * Used when no specific product was detected.
     */
    const findAllCandidatePrices = (text: string, range: { min: number; max: number }): number[] => {
        const candidates: number[] = [];

        // Priority 1: Look for "VALOR UNITÁRIO" labels
        const unitPatterns = [
            /valor\s+unit[áa]rio[:\s]*r?\$?\s*(\d+[.,]\d{2,4})/gi,
            /unit[áa]rio[:\s]*r?\$?\s*(\d+[.,]\d{2,4})/gi,
        ];
        for (const pat of unitPatterns) {
            pat.lastIndex = 0;
            let m: RegExpExecArray | null;
            while ((m = pat.exec(text)) !== null) {
                const price = parseBrNumber(m[1]);
                if (price !== null && price >= range.min && price <= range.max) {
                    candidates.push(price);
                }
            }
            if (candidates.length > 0) return [...new Set(candidates)].sort((a, b) => a - b);
        }

        // Priority 2: R$ amounts
        const rPattern = /r\$\s*(\d+[.,]\d{2,4})/gi;
        let rm: RegExpExecArray | null;
        while ((rm = rPattern.exec(text)) !== null) {
            const price = parseBrNumber(rm[1]);
            if (price !== null && price >= range.min && price <= range.max) {
                candidates.push(price);
            }
        }

        return [...new Set(candidates)].sort((a, b) => a - b);
    };

    // ── Main processing function ──
    const processImage = useCallback(async (
        imageUrl: string,
        selectedProduct: string
    ): Promise<OcrExtractionResult | null> => {
        setIsProcessing(true);
        setError(null);
        setResults(null);

        try {
            // Strategy 1: OCR.space API
            console.log('🔍 Tentando OCR.space API...');
            let rawText = await callOcrSpaceApi(imageUrl);

            // Strategy 2: Tesseract.js fallback
            if (!rawText || rawText.trim().length < 50) {
                console.log('⚠️ OCR.space falhou, tentando Tesseract.js...');
                toast.info('Usando OCR local como alternativa...');
                rawText = await callTesseract(imageUrl);
            }

            if (!rawText || rawText.trim().length === 0) {
                setError('Não foi possível extrair texto da imagem.');
                toast.warning('OCR não conseguiu extrair texto da imagem.');
                return null;
            }

            console.log('📄 Texto extraído (primeiros 500 chars):', rawText.substring(0, 500));

            // Clean text
            const cleanedText = rawText
                .replace(/[|[\]{}]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();

            // Extract prices
            const prices = extractPricesFromText(cleanedText, selectedProduct);

            const result: OcrExtractionResult = {
                prices,
                rawText: cleanedText,
            };

            setResults(result);

            if (prices.length > 0) {
                const priceLabels = prices.map(p =>
                    `${p.productLabel}: R$ ${p.price.toFixed(4)}`
                ).join(', ');
                toast.success(`Preço(s) extraído(s): ${priceLabels}`);
            } else {
                toast.warning('OCR processou a imagem mas não encontrou preços no intervalo esperado.');
            }

            return result;
        } catch (err: any) {
            const msg = err?.message || 'Erro no OCR';
            setError(msg);
            toast.error(`Erro ao processar OCR: ${msg}`);
            return null;
        } finally {
            setIsProcessing(false);
        }
    }, []);

    const clearResults = useCallback(() => {
        setResults(null);
        setError(null);
    }, []);

    return {
        isProcessing,
        results,
        error,
        processImage,
        clearResults,
    };
}

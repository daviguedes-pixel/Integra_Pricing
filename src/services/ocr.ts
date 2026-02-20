import { supabase } from "@/integrations/supabase/client";

export interface OCRResult {
    type: 'boleto' | 'nfe' | 'unknown';
    issuer_cnpj?: string;
    issuer_name?: string;
    buyer_cnpj?: string;
    document_number?: string;
    barcode?: string;
    digitable_line?: string;
    issue_date?: string;
    due_date?: string;
    amount?: number;
    raw_text?: string;
}

export const ocrService = {
    async uploadAndProcess(file: File): Promise<OCRResult> {
        try {
            // 1. Upload to Supabase Storage (Optional for now, but good for persistence)
            const filename = `${Date.now()}_${file.name}`;
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('financial-documents') // Ensure this bucket exists or use 'attachments'
                .upload(filename, file);

            if (uploadError) {
                console.warn("Failed to upload to storage, proceeding with direct processing", uploadError);
            }

            // 2. Send to Python Service for OCR
            // Assuming Python service is proxied or accessible. 
            // If running locally, it's on port 8000. 
            // In production, might need a proper URL config.
            const formData = new FormData();
            formData.append('file', file);

            // Use a relative path if proxy is set up in vite.config, otherwise absolute local for dev
            const response = await fetch('http://localhost:8000/api/ocr', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error(`OCR processing failed: ${response.statusText}`);
            }

            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error || 'Unknown OCR error');
            }

            return result.data;
        } catch (error) {
            console.error('OCR Service Error:', error);
            throw error;
        }
    },

    async saveDocument(data: any): Promise<any> {
        // @ts-ignore
        const { data: result, error } = await supabase
            .from('financial_documents')
            .insert(data)
            .select()
            .single();

        if (error) throw error;
        return result;
    }
};

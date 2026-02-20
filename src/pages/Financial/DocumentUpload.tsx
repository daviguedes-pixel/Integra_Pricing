import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ocrService, OCRResult } from "@/services/ocr";
import { Loader2, Upload, Check, FileCheck, FileText } from "lucide-react";
import { toast } from "sonner";

export default function DocumentUpload() {
    const [loading, setLoading] = useState(false);
    const [ocrData, setOcrData] = useState<OCRResult | null>(null);
    const [file, setFile] = useState<File | null>(null);

    const { register, handleSubmit, setValue, reset } = useForm();

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);
            setOcrData(null);
            reset();

            // Auto process
            await processFile(selectedFile);
        }
    };

    const processFile = async (fileToProcess: File) => {
        setLoading(true);
        try {
            toast.info("Processando documento...");
            const result = await ocrService.uploadAndProcess(fileToProcess);
            setOcrData(result);

            // Populate form
            setValue('document_type', result.type || 'other');
            setValue('document_number', result.document_number || '');
            setValue('issuer_cnpj', result.issuer_cnpj || '');
            setValue('issuer_name', result.issuer_name || '');
            setValue('issue_date', result.issue_date || '');
            setValue('due_date', result.due_date || '');
            setValue('amount', result.amount || '');
            setValue('barcode', result.barcode || '');
            setValue('digitable_line', result.digitable_line || '');

            toast.success("Leitura concluída com sucesso!");
        } catch (error) {
            toast.error("Erro ao processar documento.");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const onSubmit = async (data: any) => {
        setLoading(true);
        try {
            const payload = {
                ...data,
                original_filename: file?.name,
                verified: true,
                status: 'pending'
            };

            await ocrService.saveDocument(payload);
            toast.success("Documento registrado com sucesso!");
            setFile(null);
            setOcrData(null);
            reset();
        } catch (error) {
            toast.error("Erro ao salvar documento.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Importação de Documentos</h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Upload Section */}
                <Card>
                    <CardHeader>
                        <CardTitle>Upload</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:bg-gray-50 transition-colors cursor-pointer relative">
                            <input
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png"
                                onChange={handleFileChange}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            <Upload className="mx-auto h-12 w-12 text-gray-400" />
                            <p className="mt-2 text-sm text-gray-600">
                                Arraste um PDF ou Imagem
                            </p>
                        </div>

                        {file && (
                            <div className="bg-blue-50 p-4 rounded flex items-center gap-2">
                                <FileText className="h-5 w-5 text-blue-500" />
                                <span className="text-sm font-medium">{file.name}</span>
                            </div>
                        )}

                        {loading && (
                            <div className="flex items-center justify-center py-4 text-blue-600">
                                <Loader2 className="animate-spin mr-2" />
                                <span>Processando via OCR...</span>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Data Verification Section */}
                <Card className={!ocrData && !file ? "opacity-50 pointer-events-none" : ""}>
                    <CardHeader>
                        <CardTitle>Dados Extraídos</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Tipo de Documento</Label>
                                    <select
                                        {...register('document_type')}
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:opacity-50"
                                    >
                                        <option value="boleto">Boleto Bancário</option>
                                        <option value="nfe">Nota Fiscal (NFe)</option>
                                        <option value="other">Outro</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Número</Label>
                                    <Input {...register('document_number')} placeholder="Nº Documento" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Emitente</Label>
                                <Input {...register('issuer_name')} placeholder="Nome da empresa" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>CNPJ Emitente</Label>
                                    <Input {...register('issuer_cnpj')} placeholder="00.000.000/0000-00" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Valor Total (R$)</Label>
                                    <Input type="number" step="0.01" {...register('amount')} placeholder="0.00" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Data Emissão</Label>
                                    <Input {...register('issue_date')} placeholder="DD/MM/AAAA" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Vencimento</Label>
                                    <Input {...register('due_date')} placeholder="DD/MM/AAAA" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Linha Digitável (Boleto)</Label>
                                <Input {...register('digitable_line')} placeholder="" />
                            </div>

                            <div className="pt-4">
                                <Button type="submit" className="w-full" disabled={loading}>
                                    {loading ? <Loader2 className="animate-spin mr-2" /> : <Check className="mr-2" />}
                                    Confirmar e Registrar
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

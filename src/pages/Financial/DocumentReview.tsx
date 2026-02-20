import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Eye, CheckCircle, FileText } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function DocumentReview() {
    const [documents, setDocuments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDoc, setSelectedDoc] = useState<any | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    useEffect(() => {
        fetchDocuments();

        // Subscribe to realtime changes
        const channel = supabase
            .channel('financial-documents-changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'financial_documents' },
                (payload) => {
                    fetchDocuments();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const fetchDocuments = async () => {
        try {
            // @ts-ignore
            const { data, error } = await supabase
                .from('financial_documents')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setDocuments(data || []);
        } catch (error) {
            console.error("Error fetching documents:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (doc: any) => {
        try {
            // @ts-ignore
            const { error } = await supabase
                .from('financial_documents')
                .update({ status: 'scheduled', verified: true }) // Changed to scheduled as an example of next step
                .eq('id', doc.id);

            if (error) throw error;
            toast.success("Documento aprovado!");
            setIsDialogOpen(false);
            fetchDocuments();
        } catch (error) {
            toast.error("Erro ao aprovar documento.");
            console.error(error);
        }
    };

    const openReview = (doc: any) => {
        setSelectedDoc(doc);
        setIsDialogOpen(true);
    };

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Revisão de Documentos (OCR)</h1>
                <Button onClick={fetchDocuments} variant="outline" size="sm">
                    Atualizar
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Documentos Processados</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="animate-spin h-8 w-8 text-primary" />
                        </div>
                    ) : documents.length === 0 ? (
                        <div className="text-center p-8 text-muted-foreground">
                            Nenhum documento encontrado. Adicione arquivos na pasta monitorada.
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Tipo</TableHead>
                                    <TableHead>Arquivo</TableHead>
                                    <TableHead>Emitente</TableHead>
                                    <TableHead>Valor</TableHead>
                                    <TableHead>Vencimento</TableHead>
                                    <TableHead>Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {documents.map((doc) => (
                                    <TableRow key={doc.id}>
                                        <TableCell>
                                            <Badge variant={doc.status === 'pending' ? 'destructive' : 'default'} className={doc.status === 'pending' ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-green-500 hover:bg-green-600'}>
                                                {doc.status === 'pending' ? 'Pendente' : doc.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="capitalize">{doc.document_type}</TableCell>
                                        <TableCell className="max-w-[200px] truncate" title={doc.original_filename}>
                                            {doc.original_filename}
                                        </TableCell>
                                        <TableCell>{doc.issuer_name || '-'}</TableCell>
                                        <TableCell>
                                            {doc.amount ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(doc.amount) : '-'}
                                        </TableCell>
                                        <TableCell>
                                            {doc.due_date ? format(new Date(doc.due_date), 'dd/MM/yyyy') : '-'}
                                        </TableCell>
                                        <TableCell>
                                            <Button variant="ghost" size="sm" onClick={() => openReview(doc)}>
                                                <Eye className="h-4 w-4 mr-1" /> Revisar
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Revisão de Documento</DialogTitle>
                    </DialogHeader>

                    {selectedDoc && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                            <div className="border rounded-lg bg-gray-50 flex items-center justify-center p-4 min-h-[400px]">
                                {selectedDoc.file_url ? (
                                    selectedDoc.original_filename?.toLowerCase().endsWith('.pdf') ? (
                                        <iframe src={selectedDoc.file_url} className="w-full h-full min-h-[500px]" title="Document Preview" />
                                    ) : (
                                        <img src={selectedDoc.file_url} alt="Document Preview" className="max-w-full max-h-[500px] object-contain" />
                                    )
                                ) : (
                                    <div className="text-center text-muted-foreground">
                                        <FileText className="h-16 w-16 mx-auto mb-2 opacity-50" />
                                        <p>Visualização indisponível</p>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-medium">Tipo</label>
                                        <div className="p-2 bg-secondary rounded text-sm capitalize">{selectedDoc.document_type}</div>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium">Número</label>
                                        <div className="p-2 bg-secondary rounded text-sm">{selectedDoc.document_number || '-'}</div>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-sm font-medium">Emitente</label>
                                    <div className="p-2 bg-secondary rounded text-sm">{selectedDoc.issuer_name || '-'}</div>
                                    <div className="text-xs text-muted-foreground mt-1">CNPJ: {selectedDoc.issuer_cnpj || '-'}</div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-medium">Emissão</label>
                                        <div className="p-2 bg-secondary rounded text-sm">{selectedDoc.issue_date ? format(new Date(selectedDoc.issue_date), 'dd/MM/yyyy') : '-'}</div>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium">Vencimento</label>
                                        <div className="p-2 bg-secondary rounded text-sm font-bold">{selectedDoc.due_date ? format(new Date(selectedDoc.due_date), 'dd/MM/yyyy') : '-'}</div>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-sm font-medium">Valor</label>
                                    <div className="p-2 bg-secondary rounded text-lg font-bold text-green-700">
                                        {selectedDoc.amount ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedDoc.amount) : '-'}
                                    </div>
                                </div>

                                {selectedDoc.document_type === 'boleto' && (
                                    <div>
                                        <label className="text-sm font-medium">Linha Digitável</label>
                                        <div className="p-2 bg-secondary rounded text-xs font-mono break-all">{selectedDoc.digitable_line || '-'}</div>
                                    </div>
                                )}

                                <div className="pt-4 flex gap-3">
                                    <Button className="w-full" onClick={() => handleApprove(selectedDoc)}>
                                        <CheckCircle className="mr-2 h-4 w-4" /> Aprovar e Registrar
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

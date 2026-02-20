import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, FileText, Paperclip, Upload, X, MessageSquare } from "lucide-react";

export interface ActionField {
    id: string;
    label: string;
    type: "text" | "number" | "textarea" | "currency" | "radio" | "file" | "info";
    placeholder?: string;
    required?: boolean;
    defaultValue?: any;
    options?: { label: string; value: string | number }[];
}

interface ActionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: "default" | "destructive";
    fields?: ActionField[];
    onConfirm: (data: Record<string, any>) => Promise<void>;
}

export function ActionDialog({
    open,
    onOpenChange,
    title,
    description,
    confirmLabel = "Confirmar",
    cancelLabel = "Cancelar",
    variant = "default",
    fields = [],
    onConfirm,
}: ActionDialogProps) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<Record<string, any>>({});

    // Reset form when opening
    useEffect(() => {
        if (open) {
            const initialData: Record<string, any> = {};
            fields.forEach((field) => {
                initialData[field.id] = field.defaultValue || "";
            });
            setFormData(initialData);
            setLoading(false);
        }
    }, [open, fields]);

    const handleChange = (id: string, value: any, type?: string) => {
        let newValue = value;

        if (type === 'currency' && typeof value === 'string') {
            // Remove non-digits
            const numbers = value.replace(/\D/g, "");
            // Convert to decimal (cents)
            const amount = Number(numbers) / 100;
            // Format as BRL
            newValue = amount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }

        setFormData((prev) => ({ ...prev, [id]: newValue }));
    };

    const handleConfirm = async () => {
        // Basic validation
        for (const field of fields) {
            if (field.required && !formData[field.id]) {
                // You might want to show an error state here, for now we just return
                return;
            }
        }

        try {
            setLoading(true);
            await onConfirm(formData);
            onOpenChange(false);
        } catch (error) {
            console.error("ActionDialog error:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    {description && <DialogDescription>{description}</DialogDescription>}
                </DialogHeader>

                {fields.length > 0 && (
                    <div className="grid gap-4 py-4">
                        {fields.map((field) => (
                            <div key={field.id} className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor={field.id} className="text-right">
                                    {field.label}
                                </Label>
                                <div className="col-span-3">
                                    {field.type === "info" && (
                                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                                            <Label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold flex items-center gap-1">
                                                <MessageSquare size={12} />
                                                {field.label}
                                            </Label>
                                            <p className="text-sm text-slate-600 italic leading-relaxed">
                                                {field.placeholder || field.defaultValue || "Sem observações."}
                                            </p>
                                        </div>
                                    )}
                                    {field.type === "file" && (
                                        <div className="space-y-2">
                                            <div className="relative group">
                                                <input
                                                    type="file"
                                                    id={`file-${field.id}`}
                                                    className="hidden"
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) handleChange(field.id, file);
                                                    }}
                                                />
                                                <label
                                                    htmlFor={`file-${field.id}`}
                                                    className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer transition-all bg-white border-slate-300 hover:border-purple-400 hover:bg-purple-50"
                                                >
                                                    {formData[field.id] instanceof File ? (
                                                        <div className="flex flex-col items-center">
                                                            <FileText className="h-6 w-6 text-purple-600 mb-1" />
                                                            <span className="text-[10px] font-bold text-slate-700 max-w-[150px] truncate">
                                                                {(formData[field.id] as File).name}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <Upload className="h-6 w-6 text-slate-400 group-hover:text-purple-500" />
                                                            <span className="mt-1 text-[10px] font-bold text-slate-500 uppercase">Anexar Arquivo</span>
                                                        </>
                                                    )}
                                                </label>
                                            </div>
                                            {formData[field.id] instanceof File && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleChange(field.id, "")}
                                                    className="text-red-500 hover:text-red-600 h-6 px-2 text-[9px] uppercase font-bold"
                                                >
                                                    Remover
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                    {field.type === "textarea" && (
                                        <Textarea
                                            id={field.id}
                                            placeholder={field.placeholder}
                                            value={formData[field.id] || ""}
                                            onChange={(e) => handleChange(field.id, e.target.value)}
                                            className="min-h-[80px]"
                                        />
                                    )}
                                    {field.type === "currency" && (
                                        <Input
                                            id={field.id}
                                            type="text"
                                            placeholder={field.placeholder}
                                            value={formData[field.id] || ""}
                                            onChange={(e) => handleChange(field.id, e.target.value, "currency")}
                                        />
                                    )}
                                    {field.type === "radio" && field.options && (
                                        <RadioGroup
                                            value={String(formData[field.id] || "")}
                                            onValueChange={(value) => handleChange(field.id, value)}
                                            className="n/a" // Remove generic grid gap if needed, or use default
                                        >
                                            <div className="flex items-center space-x-4">
                                                {field.options.map((option) => (
                                                    <div key={option.value} className="flex items-center space-x-2">
                                                        <RadioGroupItem value={String(option.value)} id={`${field.id}-${option.value}`} />
                                                        <Label htmlFor={`${field.id}-${option.value}`}>{option.label}</Label>
                                                    </div>
                                                ))}
                                            </div>
                                        </RadioGroup>
                                    )}
                                    {field.type !== "textarea" && field.type !== "currency" && field.type !== "radio" && field.type !== "file" && field.type !== "info" && (
                                        <Input
                                            id={field.id}
                                            type={field.type}
                                            placeholder={field.placeholder}
                                            value={formData[field.id] || ""}
                                            onChange={(e) => handleChange(field.id, e.target.value)}
                                        />
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={loading}
                    >
                        {cancelLabel}
                    </Button>
                    <Button
                        variant={variant}
                        onClick={handleConfirm}
                        disabled={loading}
                    >
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

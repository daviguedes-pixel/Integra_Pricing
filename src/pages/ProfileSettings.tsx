import React, { useState, useEffect, useCallback } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PushNotificationSetup } from '@/components/PushNotificationSetup';
import { useAuth } from '@/hooks/useAuth';
import { User, Upload, Settings as SettingsIcon } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { formatNameFromEmail } from '@/lib/utils';
import { ThemeToggle } from '@/components/ThemeToggle';
import Cropper from 'react-easy-crop';
import getCroppedImg from '@/lib/cropImage';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";

export default function ProfileSettings() {
    const { user, profile } = useAuth();
    const [loading, setLoading] = useState(false);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

    // Crop state
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
    const [isCropping, setIsCropping] = useState(false);
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [imageFileName, setImageFileName] = useState<string | null>(null);
    const [imageFileType, setImageFileType] = useState<string>('image/jpeg');

    useEffect(() => {
        if (profile?.avatar_url) {
            setAvatarUrl(profile.avatar_url);
        }
    }, [profile]);

    const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            setImageFileName(file.name);
            setImageFileType(file.type);
            const reader = new FileReader();
            reader.addEventListener('load', () => {
                setImageSrc(reader.result?.toString() || null);
                setIsCropping(true);
            });
            reader.readAsDataURL(file);
            // Reset input value to allow selecting the same file again if needed
            e.target.value = '';
        }
    };

    const handleSaveCrop = async () => {
        if (!imageSrc || !croppedAreaPixels) return;

        try {
            setLoading(true);
            const croppedImageBlob = await getCroppedImg(imageSrc, croppedAreaPixels, 0, { horizontal: false, vertical: false }, imageFileType);

            if (!croppedImageBlob) {
                throw new Error('Could not create cropped image');
            }

            const fileExt = imageFileName?.split('.').pop() || 'jpeg';
            const filePath = `${user?.id}/avatar.${fileExt}`;

            // Upload image
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, croppedImageBlob, { upsert: true });

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            // Add timestamp to force cache busting
            const publicUrlWithTimestamp = `${publicUrl}?t=${new Date().getTime()}`;

            // Update user profile
            const { error: updateError } = await supabase
                .from('user_profiles')
                .update({ avatar_url: publicUrlWithTimestamp } as any)
                .eq('user_id', user?.id);

            if (updateError) throw updateError;

            setAvatarUrl(publicUrlWithTimestamp);
            toast.success('Foto de perfil atualizada com sucesso!');
            setIsCropping(false);
            setImageSrc(null);

            // Force reload to update UI components that might cache the image
            window.location.reload();

        } catch (error: any) {
            console.error('Error uploading avatar:', error);
            toast.error('Erro ao atualizar foto de perfil: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCancelCrop = () => {
        setIsCropping(false);
        setImageSrc(null);
        setZoom(1);
        setCrop({ x: 0, y: 0 });
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-background p-4 sm:p-6 lg:p-8">
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-blue-600 rounded-lg">
                        <SettingsIcon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                            Minhas Configurações
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Gerencie seus dados pessoais e preferências
                        </p>
                    </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                    {/* Profile Section */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <User className="h-5 w-5 text-blue-600" />
                                <CardTitle>Perfil</CardTitle>
                            </div>
                            <CardDescription>
                                Atualize suas informações pessoais e foto
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex flex-col items-center gap-4 py-4">
                                <div className="relative group">
                                    <Avatar className="w-32 h-32 border-4 border-slate-100 dark:border-slate-800">
                                        <AvatarImage src={avatarUrl || undefined} className="object-cover" />
                                        <AvatarFallback className="bg-slate-200 dark:bg-slate-700">
                                            <User className="h-12 w-12 text-slate-400" />
                                        </AvatarFallback>
                                    </Avatar>
                                    <label
                                        htmlFor="avatar-upload"
                                        className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-full cursor-pointer text-white font-medium text-sm"
                                    >
                                        <Upload className="h-5 w-5 mr-1" />
                                        Alterar
                                    </label>
                                    <input
                                        id="avatar-upload"
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleFileSelect}
                                        disabled={loading}
                                    />
                                </div>
                                <div className="text-center">
                                    <h3 className="font-semibold text-lg">{formatNameFromEmail(profile?.nome || profile?.email || 'Usuário')}</h3>
                                    <p className="text-sm text-muted-foreground">{user?.email}</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Cargo / Perfil</Label>
                                <Input value={formatNameFromEmail(profile?.perfil || 'N/A')} disabled className="bg-slate-50 dark:bg-slate-900" />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Notifications Section */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <SettingsIcon className="h-5 w-5 text-blue-600" />
                                <CardTitle>Configurações</CardTitle>
                            </div>
                            <CardDescription>
                                Gerencie suas preferências do sistema
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div>
                                <h3 className="text-sm font-medium mb-4">Aparência</h3>
                                <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
                                    <span className="text-sm text-muted-foreground">Alternar tema (claro/escuro)</span>
                                    <ThemeToggle />
                                </div>
                            </div>

                            <div className="pt-4 border-t">
                                <h3 className="text-sm font-medium mb-4">Notificações</h3>
                                <PushNotificationSetup />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Crop Dialog */}
            <Dialog open={isCropping} onOpenChange={(open) => !open && handleCancelCrop()}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Ajustar Foto de Perfil</DialogTitle>
                    </DialogHeader>
                    <div className="relative w-full h-80 bg-slate-900 rounded-lg overflow-hidden my-4">
                        {imageSrc && (
                            <Cropper
                                image={imageSrc}
                                crop={crop}
                                zoom={zoom}
                                aspect={1}
                                onCropChange={setCrop}
                                onCropComplete={onCropComplete}
                                onZoomChange={setZoom}
                            />
                        )}
                    </div>
                    <div className="space-y-2">
                        <Label>Zoom</Label>
                        <Slider
                            value={[zoom]}
                            min={1}
                            max={3}
                            step={0.1}
                            onValueChange={(value) => setZoom(value[0])}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={handleCancelCrop}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSaveCrop} disabled={loading}>
                            {loading ? 'Salvando...' : 'Salvar Foto'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    );
}

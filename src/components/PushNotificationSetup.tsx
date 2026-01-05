import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useFirebasePush } from '@/hooks/useFirebasePush';
import { Bell, BellOff, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export function PushNotificationSetup() {
  const { isSupported, permission, fcmToken, isLoading, requestToken, removeToken } = useFirebasePush();
  const [isRequesting, setIsRequesting] = useState(false);

  const handleEnable = async () => {
    setIsRequesting(true);
    try {
      const token = await requestToken();
      if (token) {
        toast.success('Notificações push ativadas!');
      } else {
        const permission = Notification.permission;
        if (permission === 'denied') {
          toast.error('Permissão de notificação negada', {
            description: 'Acesse as configurações do navegador para permitir notificações.',
          });
        }
      }
    } catch (error: any) {
      console.error('Erro ao ativar notificações:', error);
      toast.error('Erro ao ativar notificações');
    } finally {
      setIsRequesting(false);
    }
  };

  const handleDisable = async () => {
    try {
      await removeToken();
      toast.success('Notificações push desativadas');
    } catch (error) {
      toast.error('Erro ao desativar notificações');
      console.error(error);
    }
  };

  if (!isSupported) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
          <AlertCircle className="h-5 w-5" />
          <span className="font-medium">Não suportado</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Seu navegador não suporta notificações push.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {permission === 'granted' && fcmToken ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">Notificações ativadas</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Você receberá notificações push quando houver novas atualizações.
          </p>

          <Button
            variant="outline"
            onClick={handleDisable}
            className="w-full"
          >
            <BellOff className="h-4 w-4 mr-2" />
            Desativar Notificações
          </Button>
        </div>
      ) : permission === 'denied' ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <XCircle className="h-5 w-5" />
            <span className="font-medium">Notificações bloqueadas</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Você bloqueou as notificações. Para ativar, acesse as configurações do navegador.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Ative as notificações push para receber alertas importantes mesmo quando o site estiver fechado.
          </p>
          <Button
            onClick={handleEnable}
            disabled={isLoading || isRequesting}
            className="w-full"
          >
            <Bell className="h-4 w-4 mr-2" />
            {isLoading || isRequesting ? 'Ativando...' : 'Ativar Notificações Push'}
          </Button>
        </div>
      )}
    </div>
  );
}

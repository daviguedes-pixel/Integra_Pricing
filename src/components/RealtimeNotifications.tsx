import { useEffect } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export function RealtimeNotifications() {
  const { refresh } = useNotifications();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    // Configurar subscription para notificações em tempo real
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        async (payload) => {
          const notification = payload.new;

          // Mostrar toast para notificações não lidas
          if (!notification.read) {
            // Tocar som de notificação
            try {
              const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBzGF0fPTgjMIGmW57+OcTQ8OUKXj8LZjHAY4kdfyzHksBSR3x/DdkEAKFF606euoVRQKRp/g8r5sIQcxhdHz04IzCBplue/jnE0PDlCl4/C2YxwGOJHX8sx5LAUkd8fw3ZBAC');
              audio.volume = 0.5;
              audio.play().catch(e => console.log('Erro ao tocar som:', e));
            } catch (e) {
              // Fallback: usar beep do navegador
              try {
                const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                oscillator.frequency.value = 800;
                oscillator.type = 'sine';
                gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.3);
              } catch (audioError) {
                console.log('Erro ao tocar som de notificação:', audioError);
              }
            }

            toast.info(notification.title || 'Nova notificação', {
              description: notification.message,
              duration: 5000,
              action: {
                label: 'Ver',
                onClick: () => {
                  // Navegar diretamente para os detalhes da solicitação
                  if (notification.suggestion_id) {
                    navigate(`/approval-details/${notification.suggestion_id}`);
                  } else if (notification.data?.suggestion_id) {
                    navigate(`/approval-details/${notification.data.suggestion_id}`);
                  } else {
                    // Fallback: abrir centro de notificações
                    const bellButton = document.querySelector('[data-notification-bell]') as HTMLElement;
                    if (bellButton) {
                      bellButton.click();
                    }
                  }
                }
              }
            });

            // Enviar notificação push (apenas se não foi enviada pela função createNotification)
            // Notificações criadas via triggers do banco não têm push automático, então enviamos aqui
            try {
              const { sendPushNotification } = await import('@/lib/pushNotification');
              await sendPushNotification(notification.user_id, {
                title: notification.title || 'Nova notificação',
                body: notification.message,
                data: notification.data || {},
                url: notification.suggestion_id ? `/approval-details/${notification.suggestion_id}` : (notification.data?.url || '/approvals'),
                tag: notification.type || 'notification'
              });
            } catch (pushError) {
              // Não falhar se push não funcionar
              console.warn('Aviso: Não foi possível enviar push notification:', pushError);
            }
          }

          // Recarregar notificações
          refresh();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          // Recarregar notificações quando atualizadas
          refresh();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          // Recarregar notificações quando deletadas
          refresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refresh]);

  return null; // Este componente não renderiza nada visual
}

export default RealtimeNotifications;

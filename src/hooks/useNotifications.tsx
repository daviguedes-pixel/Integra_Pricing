import { createContext, useContext, ReactNode, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  deleteNotification as deleteNotificationApi,
  listNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  type NotificationRecord,
} from '@/api/notificationsApi';

interface NotificationsContextType {
  notifications: NotificationRecord[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType>({
  notifications: [],
  unreadCount: 0,
  markAsRead: async () => {},
  markAllAsRead: async () => {},
  deleteNotification: async () => {},
  refresh: async () => {},
});

export const NotificationsProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);

  const loadNotifications = useCallback(async () => {
    if (!user) {
      console.log('⚠️ Usuário não autenticado, não carregando notificações');
      return;
    }

    console.log('🔄 Carregando notificações para user_id:', user.id);

    try {
      const data = await listNotifications(user.id);

      console.log('📬 Notificações carregadas:', {
        total: data?.length || 0,
        unread: data?.filter((n) => !n.read).length || 0,
        userId: user.id,
        notifications: data?.map((n) => ({
          id: n.id,
          read: n.read,
          type: n.type,
          title: n.title,
          user_id: n.user_id,
          hasData: !!n.data,
          dataType: typeof n.data,
          data: n.data,
        })),
      });

      setNotifications(data);
    } catch (error) {
      console.error('❌ Erro ao carregar notificações:', error);
      setNotifications([]);
    }
  }, [user]);

  useEffect(() => {
    loadNotifications();
    
    // Escutar evento customizado para refresh quando notificação for criada
    const handleNotificationCreated = () => {
      console.log('🔄 Evento de notificação criada recebido, recarregando...');
      // Aguardar um pouco antes de recarregar para garantir que a transação foi commitada
      setTimeout(() => {
        loadNotifications();
      }, 500);
    };
    
    window.addEventListener('notification-created', handleNotificationCreated);
    
    // Também escutar mudanças no storage (fallback)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'notification-refresh') {
        console.log('🔄 Storage change detectado, recarregando notificações...');
        loadNotifications();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('notification-created', handleNotificationCreated);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [loadNotifications]);

  const markAsRead = async (id: string) => {
    try {
      await markNotificationAsRead(id);
      loadNotifications();
    } catch (error) {
      console.error('Erro ao marcar notificação como lida:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;
    
    try {
      await markAllNotificationsAsRead(user.id);
      loadNotifications();
    } catch (error) {
      console.error('Erro ao marcar todas como lidas:', error);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await deleteNotificationApi(id);
      loadNotifications();
    } catch (error) {
      console.error('Erro ao excluir notificação:', error);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  // Debug: log do contador de não lidas
  useEffect(() => {
    console.log('🔔 Notificações:', {
      total: notifications.length,
      unread: unreadCount,
      notifications: notifications.map(n => ({ id: n.id, read: n.read, title: n.title }))
    });
  }, [notifications, unreadCount]);

  return (
    <NotificationsContext.Provider value={{
      notifications,
      unreadCount,
      markAsRead,
      markAllAsRead,
      deleteNotification,
      refresh: loadNotifications,
    }}>
      {children}
    </NotificationsContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationsContext);

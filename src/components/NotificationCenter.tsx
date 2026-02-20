import { useState, useEffect as ReactUseEffect } from "react";
import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications } from "@/hooks/useNotifications";
import { Bell, Check, CheckCheck, X, Clock, AlertTriangle, CheckCircle, XCircle, Info } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'rate_expiry':
      return <Clock className="h-4 w-4 text-orange-500" />;
    case 'approval_pending':
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    case 'price_approved':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'price_rejected':
      return <XCircle className="h-4 w-4 text-red-500" />;
    default:
      return <Info className="h-4 w-4 text-blue-500" />;
  }
};

const getNotificationColor = (type: string, read: boolean) => {
  const baseDark = read ? 'dark:bg-slate-800/50' : 'dark:bg-slate-800';
  const baseLight = read ? 'bg-slate-50/30' : 'bg-slate-50';

  switch (type) {
    case 'rate_expiry':
      return `border-l-orange-500 ${baseLight} dark:bg-orange-900/20 dark:border-orange-600 ${baseDark}`;
    case 'approval_pending':
      return `border-l-yellow-500 ${baseLight} dark:bg-yellow-900/20 dark:border-yellow-600 ${baseDark}`;
    case 'price_approved':
    case 'approved':
      return `border-l-green-500 ${baseLight} dark:bg-green-900/20 dark:border-green-600 ${baseDark}`;
    case 'price_rejected':
    case 'rejected':
      return `border-l-red-500 ${baseLight} dark:bg-red-900/20 dark:border-red-600 ${baseDark}`;
    default:
      return `border-l-blue-500 ${baseLight} dark:bg-blue-900/20 dark:border-blue-600 ${baseDark}`;
  }
};

export function NotificationCenter({ isOpen, onClose }: NotificationCenterProps) {
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, refresh } = useNotifications();
  const navigate = useNavigate();

  // Forçar refresh quando o modal abrir
  ReactUseEffect(() => {
    if (isOpen) {
      console.log('🔔 NotificationCenter aberto, forçando refresh...');
      refresh();
    }
  }, [isOpen, refresh]);

  const handleNotificationClick = (notification: any) => {
    // Marcar como lida
    if (!notification.read) {
      markAsRead(notification.id);
    }

    // Determinar para onde navegar baseado no suggestion_id ou data.url
    let url = '/approvals';
    if (notification.suggestion_id) {
      url = `/approval-details/${notification.suggestion_id}`;
    } else if (notification.data?.suggestion_id) {
      url = `/approval-details/${notification.data.suggestion_id}`;
    } else if (notification.data?.url) {
      url = notification.data.url;
    }

    console.log('🔔 Navegando para:', url, 'tipo:', notification.type, 'suggestion_id:', notification.suggestion_id);

    // Fechar o modal e navegar
    onClose();
    navigate(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 dark:bg-black/80" onClick={onClose}>
      <div
        className="fixed right-0 sm:right-4 top-12 sm:top-20 w-full sm:w-96 max-w-full sm:max-w-none max-h-[calc(100vh-3rem)] sm:max-h-[600px] bg-white dark:bg-slate-900 border-0 sm:border border-slate-200 dark:border-slate-700 rounded-none sm:rounded-lg shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-slate-900 dark:text-slate-100" />
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">Notificações</h3>
              {unreadCount > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {unreadCount}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllAsRead}
                  className="text-xs"
                >
                  <CheckCheck className="h-3 w-3 mr-1" />
                  Marcar todas
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="p-0">
          <ScrollArea className="h-[500px]">
            {notifications.length === 0 ? (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Nenhuma notificação</p>
              </div>
            ) : (
              <div className="space-y-1 p-2">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`
                      border-l-4 p-4 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer rounded
                      ${getNotificationColor(notification.type, notification.read)}
                    `}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1">
                        {getNotificationIcon(notification.type)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className={`text-sm font-medium ${!notification.read ? 'text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400'}`}>
                              {notification.title}
                            </h4>
                            {!notification.read && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full" />
                            )}
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                            {notification.message}
                          </p>
                          {/* Exibir quem aprovou/rejeitou se disponível */}
                          {(() => {
                            // Debug: logar dados da notificação
                            if (notification.type === 'price_approved' || notification.type === 'approved' || notification.type === 'price_rejected' || notification.type === 'rejected') {
                              console.log('🔍 Notificação de aprovação/rejeição:', {
                                id: notification.id,
                                type: notification.type,
                                data: notification.data,
                                dataType: typeof notification.data,
                                approved_by: (notification.data as any)?.approved_by,
                                rejected_by: (notification.data as any)?.rejected_by,
                                fullNotification: notification
                              });
                            }

                            // Tentar múltiplas formas de acessar o approved_by
                            const notifData = notification.data as any;
                            const approvedBy = notifData?.approved_by ||
                              (typeof notification.data === 'string' ? JSON.parse(notification.data)?.approved_by : null) ||
                              (notification as any).approved_by;

                            const rejectedBy = notifData?.rejected_by ||
                              (typeof notification.data === 'string' ? JSON.parse(notification.data)?.rejected_by : null) ||
                              (notification as any).rejected_by;

                            if (approvedBy) {
                              return (
                                <p className="text-xs font-medium text-green-600 dark:text-green-400 mt-1">
                                  Por: <span className="font-semibold">{approvedBy}</span>
                                </p>
                              );
                            }

                            if (rejectedBy) {
                              return (
                                <p className="text-xs font-medium text-red-600 dark:text-red-400 mt-1">
                                  Por: <span className="font-semibold">{rejectedBy}</span>
                                </p>
                              );
                            }

                            return null;
                          })()}
                          <p className="text-xs text-slate-500 dark:text-slate-500 mt-2">
                            {formatDistanceToNow(new Date(notification.created_at), {
                              addSuffix: true,
                              locale: ptBR
                            })}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        {!notification.read && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsRead(notification.id);
                            }}
                            className="h-8 w-8 p-0"
                            title="Marcar como lida"
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(notification.id);
                          }}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                          title="Excluir"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
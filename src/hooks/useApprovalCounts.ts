import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export function useApprovalCounts() {
    const { user } = useAuth();
    const [pendingCount, setPendingCount] = useState(0);

    const fetchCounts = async () => {
        if (!user) return;

        try {
            const { count, error } = await supabase
                .from('price_suggestions')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'pending');

            if (!error && count !== null) {
                setPendingCount(count);
            }
        } catch (err) {
            console.error('Erro ao buscar contagem de aprovações:', err);
        }
    };

    useEffect(() => {
        if (!user) return;

        // Busca inicial
        fetchCounts();

        // Subscription
        const channel = supabase
            .channel('approval_counts_sidebar')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'price_suggestions'
                },
                () => {
                    // Recarregar contagem em qualquer mudança na tabela
                    fetchCounts();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    return { pendingCount, refresh: fetchCounts };
}

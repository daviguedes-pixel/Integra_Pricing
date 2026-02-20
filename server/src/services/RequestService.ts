import { supabaseAdmin } from '../config/supabase.js';
import { Database } from '../types/supabase.js';

type PriceSuggestion = Database['public']['Tables']['price_suggestions']['Row'];
type UnsavedPriceSuggestion = Database['public']['Tables']['price_suggestions']['Insert'];

export class RequestService {
    /**
     * Creates a new Price Request (Price Suggestion)
     * Validates input, checks margin rules for auto-approval, and inserts into DB.
     */
    static async createRequest(data: UnsavedPriceSuggestion, userId: string) {
        // 1. Validate basic inputs
        if (!data.station_id || !data.product || !data.final_price) {
            throw new Error('Missing required fields: station_id, product, or final_price');
        }

        // 2. Fetch Approval Rules (Margin Config) - Ordered by priority
        // We need to check if this request falls within auto-approval boundaries or needs specific level approval.
        const { data: rules } = await supabaseAdmin
            .from('approval_margin_rules')
            .select('*')
            .eq('is_active', true)
            .order('priority_order', { ascending: true });

        // 3. Determine Initial Status
        // Default to 'pending' unless a rule allows auto-approval (not implemented yet, assuming all go to pending for now)
        // If we implemented auto-approval, we'd check if `margin_cents` >= `min_margin` of a rule that allows auto-approve.
        // For now, let's assume all requests created by non-admins are 'pending' or 'draft'.

        // If status is not provided, default to 'pending' (waiting for approval)
        const status = data.status || 'pending';

        // 4. Insert into Database
        const { data: request, error } = await supabaseAdmin
            .from('price_suggestions')
            .insert({
                ...data,
                created_by: userId,
                status: status,
                approval_level: 1, // Start at level 1
                approvals_count: 0,
                total_approvers: 1, // Default, will be updated by approval rules logic later if needed
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating request:', error);
            throw new Error('Failed to create price request');
        }

        return request;
    }

    /**
     * Approves a Request
     * Checks if user has permission, updates status, and logs to history.
     */
    static async approveRequest(requestId: string, userId: string, observations?: string) {
        // 1. Fetch Request
        const { data: request, error: reqError } = await supabaseAdmin
            .from('price_suggestions')
            .select('*')
            .eq('id', requestId)
            .single();

        if (reqError || !request) throw new Error('Request not found');

        if (request.status !== 'pending') {
            throw new Error('Request is not pending approval');
        }

        // SECURITY CHECK: Is the caller the current approver?
        if (request.current_approver_id && request.current_approver_id !== userId) {
            throw new Error('User is not the current approver for this request.');
        }

        // 2. Fetch User Profile
        const { data: profile } = await supabaseAdmin
            .from('user_profiles')
            .select('*')
            .eq('user_id', userId)
            .single();

        const { data: permissions } = await supabaseAdmin
            .from('profile_permissions')
            .select('*')
            .eq('id', userId)
            .single();

        if (!permissions || !permissions.can_approve) {
            // Allow adding observation without changing status if just commenting? 
            // Current frontend logic logs observation but throws error if trying to approve without permission
            // effectively. However, the frontend allows non-approvers to "approve" which just logs an observation.
            // We will stick to "approveRequest" meaning "User wants to move this forward".
            // If they can't approve, we throw. 
            // If we want to support "Add Observation", that should be a separate method or handled gracefully.
            // For now, strict permission check to be safe.
            throw new Error('User does not have approval permissions');
        }

        // 3. Load Approval Rules & Order
        const marginCents = request.margin_cents || 0;

        // Get generic rule for this margin
        const { data: rules } = await supabaseAdmin.rpc('get_approval_margin_rule', {
            margin_cents: marginCents
        });
        const approvalRule = rules && rules.length > 0 ? rules[0] : null;

        // Get Approval Order
        const { data: orderData } = await supabaseAdmin
            .from('approval_profile_order')
            .select('perfil, order_position')
            .eq('is_active', true)
            .order('order_position', { ascending: true });

        // Default order if none in DB
        const approvalOrder = (orderData && orderData.length > 0)
            ? orderData.map((item: any) => item.perfil)
            : ['analista_pricing', 'supervisor_comercial', 'diretor_comercial', 'diretor_pricing'];

        // 4. Determine Logic
        let currentLevel = request.approval_level || 1;
        const requiredProfiles = approvalRule?.required_profiles || [];

        // Find position of current user (generic check of profile)
        const userProfile = profile?.perfil;

        // If user is not in the approval chain/order, they might be an Admin forcing approval?
        // Let's assume strict adherence to the process for `approveRequest`.

        // Logic from frontend effectively finds the *next* level.
        // We first update the history.
        let approverName = profile?.nome || profile?.email || 'Unknown';

        await supabaseAdmin.from('approval_history').insert({
            suggestion_id: requestId,
            approver_id: userId,
            approver_name: approverName,
            action: 'approved',
            approval_level: currentLevel,
            observations: observations
        });

        // Calculate Next Level
        // Find current profile index in the full order to start looking for next
        // Use the request's current level as a starting point roughly
        // The request.approval_level maps to approvalOrder index + 1

        // Logic: Iterate from currentLevel looking for the NEXT profile that is contained in `requiredProfiles`.
        // If `requiredProfiles` is empty, it usually implies simple flow or instant approval. 
        // Assuming strict flow:

        // Limit loop for safety
        let loopSafety = 0;
        let finalStatus = 'pending';
        let finalNextLevel = null;
        let isLooping = true;

        // Start Loop to handle auto-approvals for same user
        while (isLooping && loopSafety < 10) {
            loopSafety++;

            // Calculate Next Level based on CURRENT iteration's level
            // If request.approval_level was updated in previous loop, we use that?
            // Actually, we are simulating the chain here.

            // Re-calc next level from currentLevel
            let nextLevel = null;
            let nextProfile = null;

            if (requiredProfiles.length > 0) {
                for (let i = currentLevel; i < approvalOrder.length; i++) {
                    const p = approvalOrder[i];
                    if (requiredProfiles.includes(p)) {
                        nextLevel = i + 1;
                        nextProfile = p;
                        break;
                    }
                }
            } else {
                if (currentLevel < approvalOrder.length) {
                    nextLevel = currentLevel + 1;
                    nextProfile = approvalOrder[currentLevel];
                }
            }

            if (nextLevel && nextProfile) {
                // Find user for next profile
                const { data: nextUser } = await supabaseAdmin
                    .from('user_profiles')
                    .select('user_id, email, nome')
                    .eq('perfil', nextProfile)
                    .limit(1)
                    .maybeSingle();

                const nextApproverId = nextUser?.user_id || null;
                const nextApproverName = nextUser?.nome || nextUser?.email || `Perfil: ${nextProfile}`;

                // CHECK: Is the next approver ME?
                if (nextApproverId === userId) {
                    // AUTO-ADVANCE!
                    console.log(`Auto-advancing approval level ${nextLevel} for user ${userId}`);

                    // Log the auto-approval
                    await supabaseAdmin.from('approval_history').insert({
                        suggestion_id: requestId,
                        approver_id: userId,
                        approver_name: approverName, // Me
                        action: 'approved',
                        approval_level: nextLevel,
                        observations: 'Auto-aprovação (nível sequencial)'
                    });

                    // Update local state for next iteration
                    currentLevel = nextLevel;
                    // Approvals count technically increases
                    await supabaseAdmin.rpc('increment_approvals_count', { row_id: requestId });
                    // or just update it at the end. For now, simple increment in final update.

                    continue; // LOOP AGAIN
                }

                // If NOT me, then handoff
                await supabaseAdmin
                    .from('price_suggestions')
                    .update({
                        approval_level: nextLevel,
                        current_approver_id: nextApproverId,
                        current_approver_name: nextApproverName,
                        approvals_count: (request.approvals_count || 0) + loopSafety // Add all auto-approvals
                        // Status remains pending
                    })
                    .eq('id', requestId);

                // Notify Next Approver
                if (nextApproverId) {
                    await supabaseAdmin.from('notifications').insert({
                        user_id: nextApproverId,
                        title: 'Nova Aprovação Pendente',
                        message: `Solicitação aguardando sua aprovação (Nível ${nextLevel})`,
                        type: 'approval_pending',
                        suggestion_id: requestId,
                        read: false
                    });
                }

                finalStatus = 'pending';
                finalNextLevel = nextLevel;
                isLooping = false; // Stop loop

                return { success: true, status: 'pending', nextLevel };
            } else {
                // Final Approval (No more levels)
                finalStatus = 'approved';
                isLooping = false;

                const newStatus = 'approved';

                await supabaseAdmin
                    .from('price_suggestions')
                    .update({
                        status: newStatus,
                        approved_by: userId,
                        approved_at: new Date().toISOString(),
                        current_approver_id: userId,
                        approvals_count: (request.approvals_count || 0) + loopSafety
                    })
                    .eq('id', requestId);

                // Notify Requester
                if (request.requested_by) {
                    await supabaseAdmin.from('notifications').insert({
                        user_id: request.requested_by,
                        title: 'Solicitação Aprovada',
                        message: `Sua solicitação de preço foi aprovada por ${approverName}`,
                        type: 'request_approved',
                        suggestion_id: requestId,
                        read: false
                    });
                }

                return { success: true, status: newStatus };
            }
        }
    }

    /**
     * Rejects a Request
     */
    static async rejectRequest(requestId: string, userId: string, observations: string) {
        // 1. Fetch Request
        const { data: request, error: reqError } = await supabaseAdmin
            .from('price_suggestions')
            .select('*')
            .eq('id', requestId)
            .single();

        if (reqError || !request) throw new Error('Request not found');

        // SECURITY CHECK: Is the caller the current approver?
        if (request.current_approver_id && request.current_approver_id !== userId) {
            throw new Error('User is not the current approver for this request.');
        }

        // 2. Fetch User Profile
        const { data: profile } = await supabaseAdmin
            .from('user_profiles')
            .select('nome, email')
            .eq('user_id', userId)
            .single();

        let approverName = profile?.nome || profile?.email || 'Aprovador';

        // 3. Log History
        await supabaseAdmin.from('approval_history').insert({
            suggestion_id: requestId,
            approver_id: userId,
            approver_name: approverName,
            action: 'rejected',
            observations: observations,
            approval_level: request.approval_level
        });

        // 4. Check Rejection Setting
        const { data: rejectionSetting } = await supabaseAdmin
            .from('approval_settings')
            .select('value')
            .eq('key', 'rejection_action')
            .maybeSingle();

        const rejectionAction = rejectionSetting?.value || 'terminate';

        if (rejectionAction === 'escalate') {
            // Escalate Logic: Move to next approver but keep status pending (basically passing the buck)
            const currentLevel = request.approval_level || 1;

            // Get Approval Order
            const { data: orderData } = await supabaseAdmin
                .from('approval_profile_order')
                .select('perfil')
                .eq('is_active', true)
                .order('order_position', { ascending: true });

            const approvalOrder = (orderData && orderData.length > 0)
                ? orderData.map((item: any) => item.perfil)
                : ['analista_pricing', 'supervisor_comercial', 'diretor_comercial', 'diretor_pricing'];

            const nextLevel = currentLevel + 1;

            if (nextLevel <= approvalOrder.length) {
                const nextProfile = approvalOrder[nextLevel - 1]; // 0-based index

                const { data: nextUser } = await supabaseAdmin
                    .from('user_profiles')
                    .select('user_id, email, nome')
                    .eq('perfil', nextProfile)
                    .eq('ativo', true)
                    .limit(1)
                    .maybeSingle();

                const nextApproverId = nextUser?.user_id || null;
                const nextApproverName = nextUser?.nome || nextUser?.email || `Perfil: ${nextProfile}`;

                await supabaseAdmin
                    .from('price_suggestions')
                    .update({
                        status: 'pending',
                        approval_level: nextLevel,
                        rejections_count: (request.rejections_count || 0) + 1,
                        current_approver_id: nextApproverId,
                        current_approver_name: nextApproverName
                    })
                    .eq('id', requestId);

                if (nextApproverId) {
                    await supabaseAdmin.from('notifications').insert({
                        user_id: nextApproverId,
                        title: 'Solicitação Rejeitada - Escalada',
                        message: `Uma solicitação foi rejeitada e escalada para sua revisão (Nível ${nextLevel})`,
                        type: 'approval_pending',
                        suggestion_id: requestId,
                        read: false
                    });
                }

                return { success: true, status: 'pending', action: 'escalated' };
            }
        }

        // Terminate Logic (Default)
        // 5. Update Request Status to Rejected
        const { error } = await supabaseAdmin
            .from('price_suggestions')
            .update({
                status: 'rejected',
                approved_by: userId, // Rejected by
                approved_at: new Date().toISOString(),
                current_approver_id: null,
                current_approver_name: null,
                rejections_count: (request.rejections_count || 0) + 1
            })
            .eq('id', requestId);

        if (error) throw new Error('Failed to reject request');

        // 6. Notify Requester
        if (request.requested_by) {
            const message = rejectionAction === 'escalate'
                ? 'Sua solicitação foi rejeitada por um aprovador mas escalada para nível superior.'
                : 'Sua solicitação de preço foi rejeitada.';

            await supabaseAdmin.from('notifications').insert({
                user_id: request.requested_by,
                title: 'Solicitação Rejeitada',
                message: message,
                type: 'price_rejected',
                suggestion_id: requestId,
                read: false
            });
        }

        return { success: true, status: 'rejected', action: 'terminated' };
    }

    /**
     * List Requests with filters
     */
    static async getRequests(filters: any) {
        let query = supabaseAdmin
            .from('price_suggestions')
            .select(`
                *,
                stations:station_id (name),
                clients:client_id (name)
            `)
            .order('created_at', { ascending: false });

        if (filters.status) query = query.eq('status', filters.status);
        if (filters.station_id) query = query.eq('station_id', filters.station_id);
        if (filters.requested_by) query = query.eq('requested_by', filters.requested_by);

        const { data, error } = await query;
        if (error) throw new Error('Failed to fetch requests');
        return data;
    }
}

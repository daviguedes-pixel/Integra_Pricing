-- Migration: Fix permissions for all approval actions (approve, suggest, request_justification, request_evidence)
-- Ensure all users have a profile_permissions entry and correct roles have can_approve = true

DO $$
DECLARE
    r RECORD;
BEGIN
    -- 1. Ensure every user in user_profiles has a corresponding entry in profile_permissions
    FOR r IN SELECT user_id, perfil FROM public.user_profiles LOOP
        IF NOT EXISTS (SELECT 1 FROM public.profile_permissions WHERE id = r.user_id) THEN
            INSERT INTO public.profile_permissions (id, perfil, can_approve, created_at, updated_at)
            VALUES (r.user_id, r.perfil, false, now(), now());
        END IF;
    END LOOP;

    -- 2. Grant approval permissions to specific roles
    -- Roles that can approve: analista_pricing, supervisor_comercial, diretor_comercial, diretor_pricing, admin, gerente
    UPDATE public.profile_permissions
    SET can_approve = true,
        updated_at = now()
    WHERE perfil IN ('analista_pricing', 'supervisor_comercial', 'diretor_comercial', 'diretor_pricing', 'admin', 'gerente');

    -- Log the action
    INSERT INTO public.admin_actions_log (
        action_type,
        description,
        metadata
    ) VALUES (
        'fix_permissions',
        'Fixed approval permissions for all roles',
        jsonb_build_object('affected_roles', ARRAY['analista_pricing', 'supervisor_comercial', 'diretor_comercial', 'diretor_pricing', 'admin', 'gerente'])
    );

END $$;

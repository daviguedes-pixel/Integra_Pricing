DO $$ 
DECLARE 
    r RECORD;
    -- Lista de tabelas para MANTER (Não deletar)
    tables_to_keep TEXT[] := ARRAY[
        -- Core
        'user_profiles', 
        'profile_permissions', 
        'app_settings', 
        'approval_profile_order', 
        'approval_margin_rules',
        
        -- Cadastro
        'clientes', 
        'stations', 
        'sis_empresa', -- Manter por segurança se existir
        'concorrentes', 
        'tipos_pagamento', 
        'email_settings', 
        'email_templates',
        
        -- Transacional
        'price_suggestions', 
        'approval_history', 
        'attachments', 
        'notifications', 
        'commercial_proposals', 
        'referencias', 
        'competitor_research',
        'email_logs',
        'system_logs',
        'push_subscriptions' -- Manter para notificações
    ];
BEGIN
    -- Loop por todas as tabelas COMUNS do schema public
    FOR r IN (
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
    ) LOOP
        -- Se a tabela NÃO estiver na lista de manter
        IF NOT (r.tablename = ANY(tables_to_keep)) THEN
            RAISE NOTICE 'Deletando tabela comum: %', r.tablename;
            EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
        ELSE
            RAISE NOTICE 'Mantendo tabela comum: %', r.tablename;
        END IF;
    END LOOP;

    -- Loop por tabelas ESTRANGEIRAS (Foreign Tables)
    FOR r IN (
        SELECT foreign_table_name as tablename
        FROM information_schema.foreign_tables
        WHERE foreign_table_schema = 'public'
    ) LOOP
         -- Se a tabela NÃO estiver na lista de manter
        IF NOT (r.tablename = ANY(tables_to_keep)) THEN
            RAISE NOTICE 'Deletando tabela estrangeira: %', r.tablename;
            EXECUTE 'DROP FOREIGN TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
        ELSE
            RAISE NOTICE 'Mantendo tabela estrangeira: %', r.tablename;
        END IF;
    END LOOP;
END $$;

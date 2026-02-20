-- Migration: Add missing columns for approval workflow
-- Auto-generated to fix "column does not exist" errors

-- 1. rejection_reason (Missing, caused error)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'price_suggestions' 
        AND column_name = 'rejection_reason'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.price_suggestions ADD COLUMN rejection_reason TEXT;
    END IF;
END $$;

-- 2. last_observation (Missing, used in approval logic)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'price_suggestions' 
        AND column_name = 'last_observation'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.price_suggestions ADD COLUMN last_observation TEXT;
    END IF;
END $$;

-- 3. Safety check for other columns that might be missing if 20260213_approval_actions_schema.sql didn't run properly
DO $$ 
BEGIN
    -- evidence_product
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'price_suggestions' 
        AND column_name = 'evidence_product'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.price_suggestions ADD COLUMN evidence_product TEXT;
    END IF;

    -- last_approver_action_by
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'price_suggestions' 
        AND column_name = 'last_approver_action_by'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.price_suggestions ADD COLUMN last_approver_action_by UUID REFERENCES auth.users(id);
    END IF;

    -- appeal_count
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'price_suggestions' 
        AND column_name = 'appeal_count'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.price_suggestions ADD COLUMN appeal_count INTEGER DEFAULT 0;
    END IF;
    
    -- rejections_count
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'price_suggestions' 
        AND column_name = 'rejections_count'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.price_suggestions ADD COLUMN rejections_count INTEGER DEFAULT 0;
    END IF;
END $$;

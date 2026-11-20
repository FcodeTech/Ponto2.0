-- ============================================================
-- Migration: Adicionar coluna 'fgts_calculation' na tabela 'settings'
-- Execute este script no SQL Editor do painel do Supabase
-- ============================================================

ALTER TABLE public.settings
    ADD COLUMN IF NOT EXISTS fgts_calculation BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.settings.fgts_calculation IS
    'Ativa ou desativa o cálculo automático do FGTS (8% CLT) na dashboard e relatórios';

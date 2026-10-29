-- ============================================================
-- Migration: Adicionar 'ferias_calculation' em settings
-- Execute este script no SQL Editor do Supabase
-- ============================================================

-- 1. Coluna de ativação do cálculo de Férias na tabela 'settings'
ALTER TABLE public.settings
    ADD COLUMN IF NOT EXISTS ferias_calculation BOOLEAN DEFAULT true;

COMMENT ON COLUMN public.settings.ferias_calculation IS
    'Ativa ou desativa o cálculo automático de Férias + 1/3 com média de horas extras (CLT) na dashboard e relatórios';

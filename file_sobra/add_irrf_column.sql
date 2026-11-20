-- ============================================================
-- Migration: Adicionar 'irrf_calculation' na tabela 'settings'
-- Regras do Imposto de Renda Retido na Fonte (IRRF) 2026 - Lei nº 15.270/2025
-- Execute este script no SQL Editor do Supabase
-- ============================================================

ALTER TABLE public.settings
    ADD COLUMN IF NOT EXISTS irrf_calculation BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.settings.irrf_calculation IS
    'Ativa ou desativa o cálculo automático do desconto do IRRF (Imposto de Renda 2026 - Lei 15.270) na dashboard e relatórios';

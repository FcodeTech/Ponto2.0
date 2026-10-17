-- ============================================================
-- Migration: Adicionar 'decimo_terceiro_calculation' em settings
-- e 'admission_date' em users
-- Execute este script no SQL Editor do Supabase
-- ============================================================

-- 1. Coluna de ativação do cálculo do 13º salário na tabela 'settings'
ALTER TABLE public.settings
    ADD COLUMN IF NOT EXISTS decimo_terceiro_calculation BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.settings.decimo_terceiro_calculation IS
    'Ativa ou desativa o cálculo automático do 13º salário (CLT) na dashboard e relatórios';

-- 2. Coluna de Data de Admissão na tabela 'users'
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS admission_date DATE;

COMMENT ON COLUMN public.users.admission_date IS
    'Data de admissão do colaborador na empresa (usada para contagem de avos do 13º e benefícios CLT)';

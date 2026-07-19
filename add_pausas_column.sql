-- Migration: Adicionar coluna 'pausas' para suporte à Jornada 7h20 Flexível
-- Execute este script no SQL Editor do Supabase para bancos já existentes.

ALTER TABLE public.registros
    ADD COLUMN IF NOT EXISTS pausas JSONB;

COMMENT ON COLUMN public.registros.pausas IS
    'Array de pausas para jornada 7h20flex: [{pausa: ""HH:MM"", retorno: ""HH:MM""}, ...]';

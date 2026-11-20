-- ============================================================
-- fix_settings_table.sql
-- Execute este script no SQL Editor do Supabase para corrigir a tabela settings
-- ============================================================

-- 1. Adicionar a coluna user_id referenciando auth.users (caso não exista)
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- 2. Garantir que a primary key atual seja removida se necessário
-- Inicialmente, a tabela foi criada com 'id TEXT PRIMARY KEY DEFAULT ''global'''
-- Para suportar multiplos settings por usuário, não devemos usar apenas 'global'.

-- Atualizar o default do ID para auto gerar UUID
ALTER TABLE public.settings ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.settings ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;

-- 3. Agora a tabela poderá receber inserts sem passar o 'id',
-- o banco vai gerar um ID único text automaticamente, e salvará o user_id.

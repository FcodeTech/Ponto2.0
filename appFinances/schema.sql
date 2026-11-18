-- Tabela única e independente para o MarketPulse B3
CREATE TABLE IF NOT EXISTS public.mp_ativos (
  ticker TEXT PRIMARY KEY,
  tipo TEXT NOT NULL, -- 'Ação', 'FII' ou 'MEMORIA'
  nome TEXT,          -- Nome do ativo ou o texto do aprendizado da IA
  preco_atual NUMERIC(12, 2) DEFAULT 0,
  dividend_yield NUMERIC(6, 2) DEFAULT 0,
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Ativa RLS apenas nesta tabela (não afeta as outras tabelas do banco)
ALTER TABLE public.mp_ativos ENABLE ROW LEVEL SECURITY;

-- Libera leitura pública para o front-end
DROP POLICY IF EXISTS "mp_unico_select" ON public.mp_ativos;
CREATE POLICY "mp_unico_select"
ON public.mp_ativos
FOR SELECT
USING (true);

-- Libera gravação apenas para registros de aprendizado da IA (tipo = 'MEMORIA')
DROP POLICY IF EXISTS "mp_unico_insert_memoria" ON public.mp_ativos;
CREATE POLICY "mp_unico_insert_memoria"
ON public.mp_ativos
FOR INSERT
WITH CHECK (tipo = 'MEMORIA');

DROP POLICY IF EXISTS "mp_unico_update_memoria" ON public.mp_ativos;
CREATE POLICY "mp_unico_update_memoria"
ON public.mp_ativos
FOR UPDATE
USING (tipo = 'MEMORIA')
WITH CHECK (tipo = 'MEMORIA');
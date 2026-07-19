-- ============================================================
-- fix_policies_v3.sql
-- Execute no SQL Editor do Supabase para corrigir as políticas RLS
-- ============================================================

-- 1. Criar uma função SECURITY DEFINER para verificar se o usuário é admin
-- Isso evita recursão infinita (infinite recursion) nas políticas do Supabase.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Remover políticas antigas de registros
DROP POLICY IF EXISTS "registros_select" ON public.registros;
DROP POLICY IF EXISTS "registros_insert" ON public.registros;
DROP POLICY IF EXISTS "registros_update" ON public.registros;
DROP POLICY IF EXISTS "registros_delete" ON public.registros;
DROP POLICY IF EXISTS "Users can view own records or admin sees all" ON public.registros;
DROP POLICY IF EXISTS "Users can insert own records" ON public.registros;
DROP POLICY IF EXISTS "Users can update own records" ON public.registros;
DROP POLICY IF EXISTS "Admins can delete records" ON public.registros;

-- ──────────────────────────────────────────────────────────────
-- TABELA: registros
-- ──────────────────────────────────────────────────────────────
-- SELECT: usuário vê os próprios registros; admin vê todos
CREATE POLICY "registros_select" ON public.registros
    FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

-- INSERT: usuário insere apenas com seu próprio user_id
CREATE POLICY "registros_insert" ON public.registros
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- UPDATE: o próprio usuário ou admin podem atualizar
CREATE POLICY "registros_update" ON public.registros
    FOR UPDATE USING (auth.uid() = user_id OR public.is_admin());

-- DELETE: o próprio usuário ou admin podem deletar
CREATE POLICY "registros_delete" ON public.registros
    FOR DELETE USING (auth.uid() = user_id OR public.is_admin());


-- Remover políticas antigas de users
DROP POLICY IF EXISTS "users_select" ON public.users;
DROP POLICY IF EXISTS "users_insert" ON public.users;
DROP POLICY IF EXISTS "users_update" ON public.users;
DROP POLICY IF EXISTS "users_delete" ON public.users;
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile or admins can update any" ON public.users;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.users;
DROP POLICY IF EXISTS "Anyone can view users" ON public.users;
DROP POLICY IF EXISTS "Anyone can insert profile" ON public.users;

-- ──────────────────────────────────────────────────────────────
-- TABELA: users
-- ──────────────────────────────────────────────────────────────
-- SELECT: Usuário vê o próprio perfil; Admin vê todos
CREATE POLICY "users_select" ON public.users
    FOR SELECT USING (auth.uid() = id OR public.is_admin());

-- INSERT: Qualquer usuário logado ou em processo de signup pode inserir seu perfil
CREATE POLICY "users_insert" ON public.users
    FOR INSERT WITH CHECK (true);

-- UPDATE: O próprio usuário ou Admin podem atualizar
CREATE POLICY "users_update" ON public.users
    FOR UPDATE USING (auth.uid() = id OR public.is_admin());

-- DELETE: Apenas admins podem deletar perfis
CREATE POLICY "users_delete" ON public.users
    FOR DELETE USING (public.is_admin());

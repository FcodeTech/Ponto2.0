-- ============================================================
-- admin_functions.sql
-- Execute estas funções no SQL Editor do Supabase
-- (https://supabase.com/dashboard/project/zwcvaqxdfurmexyuxtvv/sql)
-- ============================================================

-- Habilitar a extensão pgcrypto se não estiver habilitada
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ──────────────────────────────────────────────────────────────
-- FUNÇÃO: admin_delete_user
-- Exclui o funcionário de public.users E de auth.users
-- Executada com privilégios elevados (SECURITY DEFINER)
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_delete_user(target_user_id UUID)
RETURNS void AS $$
BEGIN
    -- Verifica se quem chama é admin
    IF NOT EXISTS (
        SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Acesso negado. Apenas administradores podem excluir funcionários.';
    END IF;

    -- Impede que o admin exclua a si mesmo
    IF target_user_id = auth.uid() THEN
        RAISE EXCEPTION 'Você não pode excluir sua própria conta.';
    END IF;

    -- Primeiro, remove de public.users para não violar foreign keys
    DELETE FROM public.users WHERE id = target_user_id;
    
    -- Depois, remove de auth.users (exclui a conta de login)
    DELETE FROM auth.users WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ──────────────────────────────────────────────────────────────
-- FUNÇÃO: admin_update_user_password
-- Atualiza a senha de um funcionário no Supabase Auth
-- Executada com privilégios elevados (SECURITY DEFINER)
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_update_user_password(target_user_id UUID, new_password TEXT)
RETURNS void AS $$
BEGIN
    -- Verifica se quem chama é admin
    IF NOT EXISTS (
        SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Acesso negado. Apenas administradores podem alterar senhas.';
    END IF;

    -- Valida tamanho mínimo da senha
    IF length(new_password) < 6 THEN
        RAISE EXCEPTION 'A senha deve ter no mínimo 6 caracteres.';
    END IF;

    -- Atualiza a senha no schema auth
    UPDATE auth.users 
    SET encrypted_password = crypt(new_password, gen_salt('bf')),
        updated_at = now()
    WHERE id = target_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Usuário não encontrado no sistema de autenticação.';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ──────────────────────────────────────────────────────────────
-- PERMISSÕES: permite chamada via API pelo role 'authenticated'
-- ──────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION admin_delete_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_update_user_password(UUID, TEXT) TO authenticated;

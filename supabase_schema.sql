-- Arquivo de Esquema do Supabase para o Projeto Ponto Eletrônico (PontoMax)
-- Copie e cole este código no SQL Editor do seu painel do Supabase e clique em "Run"

-- 1. Criação da tabela 'users'
CREATE TABLE IF NOT EXISTS public.users (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    name TEXT NOT NULL,
    cpf TEXT,
    matricula TEXT,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    role TEXT DEFAULT 'employee' CHECK (role IN ('admin', 'employee')),
    base_salary NUMERIC DEFAULT 0,
    hour_type TEXT DEFAULT '8h',
    overtime_type TEXT DEFAULT '50',
    journey_start TEXT DEFAULT '08:00',
    journey_pause_start TEXT DEFAULT '12:00',
    journey_pause_end TEXT DEFAULT '13:00',
    journey_end TEXT DEFAULT '17:00',
    profile_color TEXT DEFAULT '#0066cc',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- 2. Criação da tabela 'registros'
CREATE TABLE IF NOT EXISTS public.registros (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    month TEXT NOT NULL,
    jornada TEXT,
    tipo_extra TEXT,
    entrada TEXT,
    pausa TEXT,
    retorno TEXT,
    saida TEXT,
    pausas JSONB,    -- Array de pausas para jornada 7h20flex: [{pausa: "HH:MM", retorno: "HH:MM"}, ...]
    calc JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- 3. Criação da tabela 'settings'
CREATE TABLE IF NOT EXISTS public.settings (
    id TEXT PRIMARY KEY DEFAULT 'global',
    theme TEXT DEFAULT 'light',
    primary_color TEXT DEFAULT '#0066cc',
    logo_url TEXT,
    system_name TEXT DEFAULT 'PontoMax',
    inss_calculation BOOLEAN DEFAULT false,
    noturno_calculation BOOLEAN DEFAULT false,
    fgts_calculation BOOLEAN DEFAULT false,
    reset_tokens TEXT
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- 5. Função para checar administrador (Security Definer para evitar recursão infinita)
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

-- 6. Políticas de Segurança (RLS Policies)

-- Políticas para 'users'
-- Funcionários podem ver o próprio perfil; Admin vê todos
CREATE POLICY "users_select" ON public.users
    FOR SELECT USING (auth.uid() = id OR public.is_admin());

-- Permitir inserção no momento do registro (SignUp)
CREATE POLICY "users_insert" ON public.users
    FOR INSERT WITH CHECK (true);

-- Usuários podem atualizar o próprio perfil, e admins podem atualizar qualquer um
CREATE POLICY "users_update" ON public.users
    FOR UPDATE USING (auth.uid() = id OR public.is_admin());

-- Admins podem deletar perfis
CREATE POLICY "users_delete" ON public.users
    FOR DELETE USING (public.is_admin());

-- Políticas para 'registros'
-- Usuários veem apenas os próprios registros, admins veem todos
CREATE POLICY "registros_select" ON public.registros
    FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

-- Usuários inserem próprios registros
CREATE POLICY "registros_insert" ON public.registros
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Usuários atualizam próprios registros
CREATE POLICY "registros_update" ON public.registros
    FOR UPDATE USING (auth.uid() = user_id OR public.is_admin());

-- Admins podem deletar registros
CREATE POLICY "registros_delete" ON public.registros
    FOR DELETE USING (auth.uid() = user_id OR public.is_admin());

-- Políticas para 'settings'
-- Qualquer usuário logado pode ler as configurações globais
CREATE POLICY "Anyone can view settings" ON public.settings
    FOR SELECT USING (auth.role() = 'authenticated');

-- Qualquer um pode inserir/atualizar (para permitir que o admin ou o primeiro acesso salve)
-- O ideal seria restringir apenas para admins, mas para manter o fluxo do seu app:
CREATE POLICY "Authenticated users can update settings" ON public.settings
    FOR ALL USING (auth.role() = 'authenticated');

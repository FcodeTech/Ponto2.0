-- ============================================================
-- SETUP: Supabase Storage + Settings inicial
-- Execute este SQL no SQL Editor do Supabase
-- ============================================================

-- 1. Inserir configuração global padrão se não existir
INSERT INTO public.settings (id, theme, primary_color, system_name, inss_calculation, noturno_calculation)
VALUES ('global', 'light', '#0066cc', 'PontoMax', false, false)
ON CONFLICT (id) DO NOTHING;

-- 2. Políticas para o bucket system-assets (Storage)
-- (Execute cada um separadamente se der erro de duplicata)

-- Leitura pública
CREATE POLICY IF NOT EXISTS "Public read system-assets" ON storage.objects
FOR SELECT USING (bucket_id = 'system-assets');

-- Upload autenticado
CREATE POLICY IF NOT EXISTS "Authenticated upload system-assets" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'system-assets' AND auth.role() = 'authenticated');

-- Atualização autenticada
CREATE POLICY IF NOT EXISTS "Authenticated update system-assets" ON storage.objects
FOR UPDATE USING (bucket_id = 'system-assets' AND auth.role() = 'authenticated');

-- Deleção autenticada
CREATE POLICY IF NOT EXISTS "Authenticated delete system-assets" ON storage.objects
FOR DELETE USING (bucket_id = 'system-assets' AND auth.role() = 'authenticated');

-- 3. Verificar resultado
SELECT id, theme, primary_color, system_name, logo_url FROM public.settings;

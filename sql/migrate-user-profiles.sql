-- =====================================================
-- Migración: poblar user_profiles con usuarios existentes
-- Ejecutar UNA sola vez en Supabase SQL Editor
-- =====================================================

-- Insertar todos los usuarios existentes en user_profiles
-- ON CONFLICT DO NOTHING para no pisar emails ya guardados
INSERT INTO user_profiles (user_id, email)
SELECT id, email
FROM auth.users
ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email;

-- Verificar resultado
SELECT 
  p.user_id,
  p.email,
  g.grupo_id,
  g.role
FROM user_profiles p
LEFT JOIN user_grupos g ON g.user_id = p.user_id
ORDER BY p.created_at DESC;

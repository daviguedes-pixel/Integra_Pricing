ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Opcional: Adicionar comentário para documentação
COMMENT ON COLUMN user_profiles.avatar_url IS 'URL pública da foto de perfil do usuário';

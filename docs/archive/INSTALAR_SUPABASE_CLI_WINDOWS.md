# 🪟 Instalar Supabase CLI no Windows

O Supabase CLI **não pode ser instalado globalmente via npm**. Use uma das opções abaixo:

## 📋 Opção 1: Via Scoop (Recomendado para Windows)

### Instalar Scoop (se não tiver):

```powershell
# Execute no PowerShell como Administrador
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
irm get.scoop.sh | iex
```

### Instalar Supabase CLI:

```powershell
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

## 📋 Opção 2: Via Chocolatey

```powershell
# Se não tiver Chocolatey, instale primeiro:
# https://chocolatey.org/install

choco install supabase
```

## 📋 Opção 3: Via npm (local no projeto)

```bash
# Instalar como dependência de desenvolvimento
npm install --save-dev supabase

# Usar via npx
npx supabase login
npx supabase link --project-ref SEU-PROJECT-REF
npx supabase functions deploy send-push-notification
```

## 📋 Opção 4: Download Manual

1. Acesse: https://github.com/supabase/cli/releases
2. Baixe o executável para Windows
3. Adicione ao PATH do sistema

## ✅ Verificar Instalação

```bash
supabase --version
```

## 🚀 Após Instalar

```bash
# Login
supabase login

# Linkar projeto (obtenha o Project Reference ID no Supabase Dashboard)
supabase link --project-ref SEU-PROJECT-REF

# Deploy da Edge Function
supabase functions deploy send-push-notification
```

---

**Recomendação:** Use a Opção 3 (npm local) se não quiser instalar ferramentas adicionais.


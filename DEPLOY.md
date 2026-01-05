# 🚀 Guia de Deploy para Firebase Hosting

## Pré-requisitos

1. ✅ Build concluído com sucesso (já feito!)
2. ⚠️ Login no Firebase necessário

## Passos para Deploy

### 1. Fazer Login no Firebase

Abra o terminal e execute:

```bash
firebase login
```

Isso abrirá o navegador para autenticação. Faça login com sua conta Google.

### 2. Verificar/Criar Projeto Firebase

Se você já tem um projeto Firebase:

```bash
firebase use --add
```

Ou crie um novo projeto:

```bash
firebase projects:create seu-projeto-id
firebase use seu-projeto-id
```

### 3. Fazer Deploy

**Opção 1: Usando o script PowerShell (Windows)**
```powershell
.\deploy-firebase.ps1
```

**Opção 2: Comando direto**
```bash
firebase deploy --only hosting
```

### 4. Verificar Deploy

Após o deploy, você receberá uma URL como:
```
https://seu-projeto-id.web.app
```

## Comandos Úteis

- **Ver projetos disponíveis:**
  ```bash
  firebase projects:list
  ```

- **Verificar projeto atual:**
  ```bash
  firebase use
  ```

- **Fazer deploy apenas do hosting:**
  ```bash
  firebase deploy --only hosting
  ```

- **Fazer deploy de tudo:**
  ```bash
  firebase deploy
  ```

- **Ver histórico de deploys:**
  ```bash
  firebase hosting:channel:list
  ```

## Troubleshooting

### Erro: "Authentication Error"
Execute: `firebase login --reauth`

### Erro: "No project active"
Execute: `firebase use --add` e selecione um projeto

### Build falha
Verifique se todas as dependências estão instaladas:
```bash
npm install
npm run build
```

## Status Atual

✅ Build configurado e funcionando
✅ firebase.json configurado
✅ Script de deploy criado
⚠️ Login no Firebase necessário (execute `firebase login`)


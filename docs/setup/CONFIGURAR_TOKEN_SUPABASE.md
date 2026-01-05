# 🔑 Configurar Access Token no Supabase Dashboard

## 📋 Passo a Passo

### 1. No Supabase Dashboard

1. Vá em **Edge Functions** (menu lateral)
2. Clique em **Settings** (ou **Configurações**)
3. Procure por **Secrets** (ou **Variáveis de Ambiente**)
4. Clique em **"Add new secret"** (ou **"Adicionar novo segredo"**)

### 2. Adicionar o Token

Preencha:
- **Name (Nome):** `FIREBASE_ACCESS_TOKEN`
- **Value (Valor):** Cole o token que você obteve:
  ```
  ya29.c.c0AYnqXlhsRtWupMr_2wkzvXvqmihZeJjNZpm4NeIu1HE6n-n5nR59YRzIbgzGA0XOqD8HROFP9AiEfaAWFCTHCMK03NHUiNiN3JZseKwZhInqFbZs64KPf3QwDJ4q852tNOOkQhntR7I3c54i9dYO-WgQFjXSj6KC7Vl-2skPXZoP6-jDbeDl2N02yyl2kXWz0QrSP8STzz1zF5GqMvxfZsKrJjFHyvVt6I9_P3pjsC6iizKAn23Xx45J4ekgI33pgNkP7TaG-9C_koGSUIHy14wBDg2WNYja7N1RYo3NpofekCjRMi2WCeNBI1Zr3KJbvBoIel7zFDhgnlNTQMQ0n9V7gKBgvOL-Y-0UUdxuqretXoPjVIWxZ7fq8uzme1DgZH0T396C6l1ty14uxum-FtoF69gb3QzlltzMFcZxv05rB3Mhb1qizll_uZ9phIncWYfsOd_6lujJ8RyOas93R02-3lvs8qi-YRXnzBMXp8VetF1ZsZ04smk_ViSqzuy0Igb39549be39kMOaZWJ8gRrYy46wyw2St9rW27J_UYtOOImBSsjrshsXRkvOt2geSdy3cu9peBr6Sc38tq6520RuZye3x_xl7WBY69406a2wd1IQ956ftV-oZQR18qeQrXs9F9uqbSsBzl6p9B36UnxeSzi47o28wwXJWVuj7glh-6Xv5eg4W-fF0pwjQnFiS5yr7VwiZZMssqM_wyYcrsMzJj-340__OR-R63ftavmozwi8zhojxB04g3uv9x62_SXmd4qwdqBxVpVhf30_Oel2Zk4tzVd2RbFt3IZygYhrI5zosg7wbRriJOUth7051hyh7z1uc1mgMkw0ikamVm6tjnqgR10yM0mhjJ36lqe6l_7-F25s3bOMnSymmbq8a_cppUZQbhbMYgu5hZJr_BfXccgJQo5s8X_9ohhn9h5xW337bavb_gMxFYZB5g6b4ltijykut_au2gYkeBrvcI-osivfzhaIXZVYRfYY69xu57Qc_pyly8l
  ```

5. Clique em **Save** (ou **Salvar**)

### 3. Fazer Deploy da Edge Function

Após configurar o token, faça o deploy:

```bash
npx supabase functions deploy send-push-notification
```

## ✅ Pronto!

Agora teste:
- Clique em **"Enviar Teste"** em `/settings`
- Você deve receber a notificação push!

## ⚠️ Importante

O Access Token **expira em 1 hora**. Se parar de funcionar:
1. Execute `node get-firebase-token.js` novamente
2. Obtenha um novo token
3. Atualize no Supabase Dashboard

Para produção, considere usar Service Account JSON diretamente na Edge Function.


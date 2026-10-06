# Ativação do Firebase

O aplicativo Web está configurado localmente para `ai-gym-and-diet-manager`. `.env.local` contém apenas a configuração pública Firebase e é ignorado pelo Git. O `measurementId` foi registrado; o SDK Analytics não é inicializado pelo app.

## Passos no console

1. Abra https://console.firebase.google.com/project/ai-gym-and-diet-manager/overview.
2. Em Authentication → Sign-in method, habilite E-mail/senha.
3. Em Authentication → Settings → Authorized domains, autorize `127.0.0.1` e `localhost` para o desenvolvimento e, ao publicar, o domínio GitHub Pages utilizado pelo app.
4. Em Firestore Database, crie o banco `(default)` no modo de produção. A região preferida é `southamerica-east1`, se disponível. Não troque um banco já criado sem avaliar a migração.
5. Na aba Rules do Firestore, publique o conteúdo de `firestore.rules`. Ele permite acesso aos registros apenas pelo usuário autenticado proprietário e nega outros caminhos. Se já houver regras usadas por outro aplicativo, preserve-as e adicione somente o caminho necessário.
6. Na prévia local, abra Perfil → Conectar conta → Criar minha conta. Faça pessoalmente o cadastro/senha. Dados de demonstração ficam separados da conta real.
7. Registre um dado real e confira o documento em `users/{seuUid}/records`. Atualize a página e confira sua persistência. Para migrar um perfil local real, exporte backup JSON antes do login e restaure dentro da conta; não importe a demonstração.

Opcionalmente, com Firebase CLI instalado e autenticado, publique as regras pelo terminal. Execute somente após revisar o arquivo e confirmar que não substituirá regras de outro app:

```sh
firebase login
firebase deploy --only firestore:rules,firestore:indexes --project ai-gym-and-diet-manager
```

Configurar o aplicativo Web não publica regras, não habilita E-mail/senha e não cria o banco automaticamente. A verificação completa requer login e uma leitura/escrita autenticada; configuração inicializada no navegador não é prova de sincronização.

## Serviços de IA e publicação

As Cloud Functions `estimateMeal` e `dailyCoach` ainda precisam ser implementadas e publicadas. As chaves Gemini, Jev, OpenAI e USDA serão armazenadas como segredos do backend, nunca em variáveis `VITE_`. O projeto precisa de Blaze para publicar as Functions. O OCR de bioimpedância funciona localmente sem esses serviços.

GitHub Pages precisa receber as variáveis públicas Firebase no processo de build. `.env.local` não será enviado ao repositório. O workflow de publicação ainda precisa ser preparado.

Documentação oficial: https://firebase.google.com/docs/web/setup, https://firebase.google.com/docs/auth/web/password-auth, https://firebase.google.com/docs/firestore/security/get-started.

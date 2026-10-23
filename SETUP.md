# Ativação do Firebase

O aplicativo Web está configurado localmente para `ai-gym-and-diet-manager`. `.env.local` contém apenas a configuração pública Firebase e é ignorado pelo Git. O `measurementId` foi registrado; o SDK Analytics não é inicializado pelo app.

## Passos no console

1. Abra https://console.firebase.google.com/project/ai-gym-and-diet-manager/overview.
2. Em Authentication → Sign-in method, habilite E-mail/senha.
3. Em Authentication → Settings → Authorized domains, autorize `127.0.0.1` e `localhost` para o desenvolvimento e o domínio publicado `ai-gym-and-diet-manager.web.app`.
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

O PWA publicado usa a função autenticada `proxyAi` em `southamerica-east1`. Ela verifica conta, consentimento e cota antes de chamar somente `deepseek-flash`. A chave `DEEPSEEK_API_KEY` fica no Secret Manager, nunca no navegador. Chat, estimativas por imagem/texto, leitura de exames e propostas usam esse mesmo gateway. Mudanças propostas pelo chat precisam de confirmação do usuário.

Firebase Hosting serve o PWA em https://ai-gym-and-diet-manager.web.app/. Square Cloud, WhatsApp, Siri/webhooks e processos/agendadores de bot não fazem parte da arquitetura ativa. O código e o snapshot do bot foram preservados somente no arquivo privado local `.archive/whatsapp-retired-2026-10-19/`, ignorado pelo Git.

### Desenvolvimento e publicação

1. Configure somente os dados públicos Firebase em `.env.local` e ative `VITE_AI_BACKEND_ENABLED=true` para o build publicado.
2. Para testar IA localmente, coloque `DEEPSEEK_API_KEY` no arquivo ignorado `.env.deepseek`; o Vite usa um proxy Node autenticado, sem expor a chave no bundle.
3. Execute `npm run dev -- --port 5174 --strictPort`.
4. Valide com `npm test` e `npm run build`.
5. Publique com `firebase deploy --only functions:ritmo-ai,hosting --project ai-gym-and-diet-manager`. Nunca inclua arquivos de chaves ou backups privados no deploy.

### Custos e disponibilidade

Não há servidor de bot nem plano de hospedagem Square necessário ao app. A função fica com zero instâncias mínimas e só chama DeepSeek quando o usuário solicita IA; não existem chamadas periódicas pagas. O projeto precisa do plano Firebase Blaze para Cloud Functions: cobrança por uso, com cotas gratuitas, não garantia de custo zero. DeepSeek também cobra pelo consumo da API/saldo disponível. Consulte https://firebase.google.com/pricing e o painel DeepSeek; configure alertas no faturamento Google Cloud. As cotas de IA (100/dia e 20/minuto por usuário) reduzem abuso, mas não são um teto monetário global.

Registros manuais, planos, timers, relatórios e dados sincronizados não dependem de créditos DeepSeek. Sem internet/saldo, o chat deve informar a indisponibilidade sem inventar respostas nem modificar registros. Fotos devem ser JPEG/PNG/WebP; para voz, use o ditado do teclado, pois áudio gravado não é enviado a outros provedores.

Documentação oficial: https://firebase.google.com/docs/web/setup, https://firebase.google.com/docs/auth/web/password-auth, https://firebase.google.com/docs/firestore/security/get-started.

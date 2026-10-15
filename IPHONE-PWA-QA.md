# Treino e PWA no iPhone

## Prévia durante o desenvolvimento

`npm run dev -- --port 5174 --strictPort`

Abra http://127.0.0.1:5174/#workouts no computador. Essa porta é exclusiva desta versão; não use a porta 5173 do outro projeto. O endereço 127.0.0.1 no iPhone aponta para o próprio telefone, não para o computador. Para instalar no iPhone, use a versão publicada em HTTPS no Safari e Compartilhar → Adicionar à Tela de Início.

## Fluxos implementados

- O formulário manual busca no catálogo brasileiro já existente no projeto, sem depender de rede. Também aceita nomes personalizados.
- Carga zero é um placeholder visual, não texto que precisa ser apagado. Campos de séries aceitam digitação temporariamente vazia; carga aceita vírgula decimal. Repetições e RIR devem ser inteiros dentro dos limites.
- As alterações são confirmadas ao sair do campo, pressionar Enter ou colocar o app em segundo plano. O toque para concluir uma série também tira o foco do campo e confirma sua edição.
- O cronômetro tem estado próprio e usa um horário absoluto. Voltar do segundo plano recalcula o tempo restante. Não há garantia de som/notificação no iOS com a PWA suspensa.
- Bi-set: exercícios com IDs próprios vinculados por `supersetId`, cargas/repetições independentes e descanso ao completar ambos na mesma rodada. A próxima rodada pendente aparece automaticamente; as rodadas anteriores podem ser revisadas.
- Editar séries e descanso de um exercício do bi-set atualiza o parceiro no plano. Alterar um plano nunca modifica a cópia das sessões anteriores.
- O painel usa apenas séries efetivamente concluídas em sessões finalizadas. Histórico, carga, repetições e volume são registros, não medidas de hipertrofia. Exercícios com nome reconhecido são associados ao catálogo mesmo em sessões antigas sem `catalogId`.
- CSV de treino inclui `catalogo_id` e `dupla_id`, além das colunas anteriores.
- A avaliação diária considera refeições, sessões parciais/finalizadas e suas séries, hidratação, recuperação, medidas, plano do dia e histórico recente. É solicitada pelo usuário com consentimento. Novos registros invalidam a avaliação visível. Não altera planos ou metas automaticamente.
- Ícones PNG de 192/512 px e Apple Touch de 180 px, áreas seguras, alvos de toque e atualização da PWA com confirmação.

## Verificações automatizadas

```sh
npm run typecheck
npm test
npx playwright install chromium webkit
npm run test:e2e
npm run build
```

Os testes de navegador usam perfis temporários isolados, não a conta pessoal do usuário. Os testes de IA simulam as respostas dos provedores: validam o envio do contexto e a apresentação/invalidação, não disponibilidade ou qualidade real do Gemini/Jev.

Verificado em WebKit com viewport iPhone 13 e Chromium com viewport iPhone SE: seleção do catálogo, formulário manual, bi-set, digitação sem gravação por tecla, preservação do rascunho enquanto o timer anda, descanso, persistência após recarregar, ausência de overflow horizontal e preservação do histórico após editar o plano. Também foi verificado o build de produção sendo recarregado offline em WebKit após instalação do service worker.

Ainda é necessário testar em um iPhone físico: teclado real com idioma português, Safari e modo instalado, rotação, VoiceOver, retomada após suspensão prolongada e sincronização com a conta Firebase real.

## Bloqueio de segurança antes de publicar

A implementação anterior contém chaves privadas dos provedores de IA em `src/ai.ts` e `vite.config.ts`, inclusive valores em Base64 (que não são secretos). Estes ajustes de interface não resolvem essa arquitetura. Não publique esse bundle como se as chaves estivessem protegidas. Revogue/rotacione as chaves expostas e migre as chamadas para um backend autenticado, com segredos do servidor, limites por usuário e validação de consentimento. O objeto público de configuração do Firebase é uma categoria diferente e pode ficar no frontend; regras de acesso continuam obrigatórias.

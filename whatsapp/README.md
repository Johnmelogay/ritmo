# Ritmo — WhatsApp AI Coach (Self-Chat Daemon)

Integração gratuita de acompanhamento autônomo via WhatsApp que utiliza a sua conversa com você mesmo ("Você" / Message Yourself), no mesmo estilo do Hermes, conectada diretamente ao banco de dados do Ritmo no Firebase e ao Google Gemini 2.5 Flash.

---

## ⚡ Como Funciona

1. **Chat consigo mesmo (Self-Chat)**: O bot opera exclusivamente na sua conversa pessoal ("Você"). Nenhuma mensagem vai para terceiros, grupos ou números externos.
2. **Mesma Inteligência do App**: Compartilha as regras de coach (`COACH_RULES`), o mapa do app (`APP_MAP`), a memória diária de 7 dias (`buildMemoryBlock`) e o contexto em tempo real de metas, refeições, treinos e água (`buildDataContext`).
3. **Check-ins Autônomos Inteligentes**:
   - ⚡ **08:00 (Alinhamento Matinal)**: Treino planejado para o dia, meta de água e calorias.
   - 🥗 **13:15 (Almoço)**: Lembra caso o almoço ainda não tenha sido registrado após o horário habitual.
   - 💧 **15:30 (Hidratação)**: Lembra de beber água caso o volume do dia esteja abaixo do ritmo esperado.
   - 🏋️ **45 min antes do Treino (ex.: 17:15)**: Preview dos exercícios do dia com séries, cargas e bi-sets.
   - 🌙 **21:30 (Balanço do Dia)**: Resumo da constância, calorias consumidas, água total e se faltou algo.
4. **Atualização Automática por Respostas**:
   - **Texto**: *"Bebi 500ml"* ou *"Almocei 200g de frango e salada"*
   - **Áudio (Mensagem de Voz)**: Mande um áudio falando o que treinou ou bebeu — o Gemini transcreve e extrai os dados.
   - **Foto do Prato**: Mande foto do almoço/jantar — o Gemini Vision estima gramas e macros.
   - **Sincronização em Tempo Real**: Qualquer dado gravado atualiza instantaneamente a tela do seu iPhone / web app via Firestore `onSnapshot`.

---

## 🚀 Como Iniciar

### 1. Iniciar o Daemon

Na raiz do projeto:
```bash
npm run whatsapp
```
Ou dentro da pasta `whatsapp/`:
```bash
cd whatsapp
npm start
```

### 2. Conectar com o seu WhatsApp (uma única vez)

1. No terminal aparecerá um **QR Code**.
2. Abra o WhatsApp no seu celular:
   - **iPhone**: Configurações → Aparelhos Conectados → Conectar Aparelho.
   - **Android**: Menu (três pontos) → Aparelhos Conectados → Conectar Aparelho.
3. Aponte a câmera para o QR Code no terminal.
4. Pronto! As credenciais ficam salvas na pasta `whatsapp/auth_info/`, então nas próximas vezes a conexão é automática.

### 3. Rodar em segundo plano no seu Mac (Opcional, com PM2)

Para deixar o bot rodando direto sem precisar manter o terminal aberto:
```bash
npm install -g pm2
pm2 start "npm run whatsapp" --name ritmo-coach
pm2 save
```

import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  type WASocket,
  type WAMessage
} from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import { CONFIG } from './config.js';
import { fetchCurrentState, recordWaterIntake, recordMeal, recordSession, updateMemoryAndChat } from './firestore.js';
import { talkWithCoach } from './coach.js';
import { extractMediaFromMessage } from './media.js';
import { startAutonomousScheduler } from './scheduler.js';
import { uid, type Meal } from '../../src/domain.js';

const silentLogger = pino({ level: 'silent' });
const botMessageIds = new Set<string>();

async function startRitmoWhatsAppDaemon() {
  console.log('🚀 Iniciando Ritmo WhatsApp Coach Daemon...');
  console.log(`📁 Diretório de autenticação: ${CONFIG.authDir}`);
  console.log(`👤 UID do usuário no Firebase: ${CONFIG.userUid}`);

  const { state, saveCreds } = await useMultiFileAuthState(CONFIG.authDir);

  const sock: WASocket = makeWASocket({
    auth: state,
    logger: silentLogger,
    printQRInTerminal: false
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n📲 ESCANEIE O QR CODE COM O SEU WHATSAPP:');
      console.log('   (No WhatsApp do iPhone: Configurações → Aparelhos Conectados → Conectar Aparelho)\n');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(`⚠️ Conexão encerrada (código ${statusCode}). Reconectando: ${shouldReconnect}`);
      if (shouldReconnect) {
        setTimeout(startRitmoWhatsAppDaemon, 3000);
      } else {
        console.log('❌ Sessão desconectada. Execute novamente para escanear novo QR code.');
      }
    } else if (connection === 'open') {
      console.log('✅ CONECTADO AO WHATSAPP COM SUCESSO!');
      const selfJid = sock.user?.id ? sock.user.id.replace(/:.*@/, '@') : '';
      console.log(`📱 Chat consigo mesmo (Self-Chat): ${selfJid}`);

      // Start the autonomous nudging scheduler
      startAutonomousScheduler(async (text: string) => {
        if (!selfJid) return;
        const sent = await sock.sendMessage(selfJid, { text });
        if (sent?.key?.id) botMessageIds.add(sent.key.id);
      });

      // Send initial welcome message to self-chat
      try {
        const welcome = await sock.sendMessage(selfJid, {
          text: `⚡ *Ritmo Coach conectado!*\n\nPosso registrar sua água, refeições e treinos diretamente daqui. Envie mensagens em texto, áudio ou fotos do seu prato a qualquer momento.`
        });
        if (welcome?.key?.id) botMessageIds.add(welcome.key.id);
      } catch (err) {
        console.warn('Não foi possível enviar mensagem de boas-vindas inicial:', err);
      }
    }
  });

  // Listen to messages
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      // Ignore bot's own generated messages
      if (msg.key.id && botMessageIds.has(msg.key.id)) continue;

      const selfJid = sock.user?.id ? sock.user.id.replace(/:.*@/, '@') : '';
      const isSelfChat = msg.key.remoteJid === selfJid || msg.key.fromMe;
      if (!isSelfChat) continue;

      // Extract text content
      const text =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        '';

      // Ignore messages created by bot with prefix
      if (text.startsWith('⚡ *Ritmo') || text.startsWith('🤖') || text.startsWith('💧 *Ritmo') || text.startsWith('🥗 *Ritmo') || text.startsWith('🏋️ *Ritmo') || text.startsWith('🌙 *Ritmo')) {
        continue;
      }

      // Check for attached media (voice note or food photo)
      const media = await extractMediaFromMessage(msg);
      if (!text && !media) continue;

      console.log(`📩 Mensagem recebida [${media?.isAudio ? 'Áudio' : media?.isImage ? 'Foto' : 'Texto'}]: "${text || '(mídia)'}"`);

      try {
        // Send a temporary typing indicator
        if (selfJid) {
          await sock.sendPresenceUpdate('composing', selfJid);
        }

        const currentState = await fetchCurrentState(CONFIG.userUid);
        const reply = await talkWithCoach(
          currentState,
          text || (media?.isAudio ? 'Mensagem de voz sobre treino/alimentação/água' : 'Foto da refeição'),
          media ? { mimeType: media.mimeType, data: media.data } : undefined
        );

        let actionConfirm = '';

        // Execute actions autonomously in Firestore
        if (reply.action?.type === 'WATER' && reply.action.waterMl) {
          const { totalToday } = await recordWaterIntake(reply.action.waterMl, CONFIG.userUid);
          actionConfirm = `\n\n💧 *+${reply.action.waterMl} ml* registrados no Ritmo! (Total hoje: ${totalToday} ml)`;
        } else if (reply.action?.type === 'MEAL' && reply.action.meal) {
          const now = new Date();
          const items = reply.action.meal.items.map(item => ({
            foodId: uid(),
            name: item.name,
            grams: item.grams,
            kcal: item.kcal,
            protein: item.protein,
            carbs: item.carbs,
            fat: item.fat,
            source: 'WhatsApp Coach (IA)',
            estimated: true
          }));
          const totalKcal = items.reduce((s, i) => s + i.kcal, 0);
          const totalP = Math.round(items.reduce((s, i) => s + i.protein, 0));
          const totalC = Math.round(items.reduce((s, i) => s + i.carbs, 0));
          const totalG = Math.round(items.reduce((s, i) => s + i.fat, 0));

          const newMeal: Meal = {
            id: uid(),
            date: now.toISOString().slice(0, 10),
            time: now.toTimeString().slice(0, 5),
            name: reply.action.meal.name,
            method: media?.isAudio ? 'audio' : media?.isImage ? 'foto' : 'texto',
            items,
            notes: text,
            updatedAt: now.toISOString()
          };

          await recordMeal(newMeal, CONFIG.userUid);
          actionConfirm = `\n\n🥗 *Refeição salva no Ritmo!*\n${reply.action.meal.name}: *${totalKcal} kcal* (P: ${totalP}g · C: ${totalC}g · G: ${totalG}g)`;
        }

        const fullReply = `${reply.message}${actionConfirm}`;

        if (selfJid) {
          const sent = await sock.sendMessage(selfJid, { text: fullReply });
          if (sent?.key?.id) botMessageIds.add(sent.key.id);
        }

        // Update conversation context & memory in Firestore
        const now = new Date();
        const timeStr = now.toTimeString().slice(0, 5);
        await updateMemoryAndChat(
          { role: 'user', text: text || (media?.isAudio ? '[Áudio]' : '[Foto]'), time: timeStr },
          undefined,
          CONFIG.userUid
        );
        await updateMemoryAndChat(
          { role: 'assistant', text: reply.message, time: timeStr },
          { dailyNote: reply.dailyNote, facts: reply.facts },
          CONFIG.userUid
        );
      } catch (err) {
        console.error('Erro ao processar mensagem do coach:', err);
        if (selfJid) {
          const sent = await sock.sendMessage(selfJid, {
            text: '⚠️ Não consegui processar essa mensagem agora. Tente novamente em instantes.'
          });
          if (sent?.key?.id) botMessageIds.add(sent.key.id);
        }
      }
    }
  });
}

startRitmoWhatsAppDaemon().catch((err) => {
  console.error('Fatal daemon error:', err);
  process.exit(1);
});

import { downloadMediaMessage, type WAMessage } from '@whiskeysockets/baileys';
import pino from 'pino';

const silentLogger = pino({ level: 'silent' });

export interface MediaPayload {
  mimeType: string;
  data: string; // base64
  isAudio: boolean;
  isImage: boolean;
}

/**
 * Downloads media from a WhatsApp message and formats it for Gemini inlineData.
 */
export async function extractMediaFromMessage(msg: WAMessage): Promise<MediaPayload | null> {
  const message = msg.message;
  if (!message) return null;

  const audioMessage = message.audioMessage;
  const imageMessage = message.imageMessage;

  if (!audioMessage && !imageMessage) return null;

  try {
    const buffer = await downloadMediaMessage(
      msg,
      'buffer',
      {},
      { logger: silentLogger, reuploadRequest: () => Promise.reject(new Error('reupload not supported')) }
    );

    if (audioMessage) {
      const mimeType = audioMessage.mimetype || 'audio/ogg; codecs=opus';
      return {
        mimeType,
        data: buffer.toString('base64'),
        isAudio: true,
        isImage: false
      };
    }

    if (imageMessage) {
      const mimeType = imageMessage.mimetype || 'image/jpeg';
      return {
        mimeType,
        data: buffer.toString('base64'),
        isAudio: false,
        isImage: true
      };
    }
  } catch (err) {
    console.error('Failed to download media from message:', err);
  }

  return null;
}

import fs from 'node:fs/promises';
import path from 'node:path';
import type { Plugin } from 'vite';

// Development-only bridge for a user-authorized file recovery. Nothing under
// .recovery is included in the frontend bundle or served as a public asset.
export function recoveryPlugin(): Plugin {
  return { name: 'ritmo-private-recovery', configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (!req.url?.startsWith('/__ritmo/recovery')) return next();
      res.setHeader('Cache-Control', 'no-store'); res.setHeader('Content-Type', 'application/json');
      const fail = (status: number, message: string) => { res.statusCode = status; res.end(JSON.stringify({ error: message })); };
      if (req.method !== 'POST' || !['127.0.0.1:5174','localhost:5174'].includes(req.headers.host ?? '') || req.headers.origin && !['http://127.0.0.1:5174','http://localhost:5174'].includes(req.headers.origin)) { fail(403, 'Acesso local autenticado necessário.'); return; }
      try {
        const request = JSON.parse(await fs.readFile(path.resolve('.recovery/request.json'), 'utf8'));
        const token = req.headers.authorization?.replace(/^Bearer /, '');
        if (!token) { fail(401, 'Entre na conta de destino.'); return; }
        const apiKey = process.env.VITE_FIREBASE_API_KEY;
        const identity = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey ?? '')}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: token }), signal: AbortSignal.timeout(15000) });
        if (!identity.ok) { fail(401, 'Sessão inválida. Entre novamente.'); return; }
        const user = (await identity.json()).users?.[0];
        if (!user?.localId || user.email?.toLowerCase() !== request.email.toLowerCase()) { fail(403, 'A conta conectada não é o destino autorizado para este backup.'); return; }
        if (req.url === '/__ritmo/recovery-result') {
          let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 12000) throw new Error('invalid-report'); }
          const input = JSON.parse(body);
          const report = { email: user.email, uid: user.localId, verifiedAt: new Date().toISOString(), status: input.status === 'verified' ? 'verified' : 'failed', counts: input.counts, message: String(input.message ?? '').slice(0,400) };
          await fs.writeFile(path.resolve('.recovery/result.json'), JSON.stringify(report, null, 2));
          res.end(JSON.stringify({ ok: true })); return;
        }
        if (req.url !== '/__ritmo/recovery') { fail(404, 'Não encontrado.'); return; }
        try {
          const prior = JSON.parse(await fs.readFile(path.resolve('.recovery/result.json'), 'utf8'));
          if (prior.status === 'verified' && prior.uid === user.localId) { res.end(JSON.stringify({ completed: true, email: user.email, uid: user.localId, counts: prior.counts })); return; }
        } catch { /* First authorized recovery. */ }
        const raw = await fs.readFile(request.path, 'utf8');
        if (raw.length > 10 * 1024 * 1024) throw new Error('backup-too-large');
        res.end(JSON.stringify({ email: user.email, uid: user.localId, fileName: path.basename(request.path), backup: JSON.parse(raw) }));
      } catch { fail(409, 'A recuperação ainda não pôde ser concluída. O arquivo original não foi alterado.'); }
    });
  } };
}

const express = require('express');
const session = require('express-session');
const nodeFetch = require('node-fetch');
const crypto = require('crypto');
const path = require('path');
const { execFile } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Constantes do fluxo SED → edusp-api (mesmo do Taskitos) ─────────────────
const SED_SUBSCRIPTION_KEY = process.env.SED_SUBSCRIPTION_KEY || 'd701a2043aa24d7ebb37e9adf60d043b';
const SED_LOGIN_URL = 'https://sedintegracoes.educacao.sp.gov.br/saladofuturobffapi/credenciais/api/LoginCompletoToken';
const EDUSP_BASE = 'https://edusp-api.ip.tv';
const SDF_ORIGIN = 'https://saladofuturo.educacao.sp.gov.br';
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'sync-activities-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 8 * 60 * 60 * 1000 }, // 8h
}));
app.use(express.static(path.join(__dirname, 'public')));

// ─── Helpers ─────────────────────────────────────────────────────────────────

// hex aleatório (Request-Id / Traceparent), equivalente ao ir() do bundle Taskitos
function randHex(len) {
  return crypto.randomBytes(Math.ceil(len / 2)).toString('hex').slice(0, len);
}

// Headers que o Cloudflare do edusp-api.ip.tv exige + headers de plataforma edusp.
// User-Agent/Origin/Referer são "forbidden headers" no fetch do browser — por isso
// só podem ser injetados aqui no servidor. Origin saladofuturo já foi verificado
// ao vivo liberando o Cloudflare.
function eduspHeaders(extra) {
  return Object.assign({
    'Accept': '*/*',
    'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
    'Content-Type': 'application/json',
    'Request-Id': `|${randHex(32)}.${randHex(16)}`,
    'Traceparent': `00-${randHex(32)}-${randHex(16)}-01`,
    'X-Api-Realm': 'edusp',
    'X-Api-Platform': 'webclient',
    'User-Agent': BROWSER_UA,
    'Origin': SDF_ORIGIN,
    'Referer': SDF_ORIGIN + '/',
  }, extra || {});
}

// Requisição via curl (shell-out). CRÍTICO: o Cloudflare do edusp-api.ip.tv
// bloqueia o fingerprint TLS do node-fetch (403 "Just a moment...") mas libera o
// do curl. Então TODA chamada ao edusp passa por aqui. curl está no Windows
// (System32\curl.exe) e em qualquer Linux. Retorna { status, ok, text }.
function curlRequest(url, opts) {
  opts = opts || {};
  const method = opts.method || 'GET';
  const headers = opts.headers || {};
  const body = opts.body;
  return new Promise((resolve, reject) => {
    const args = ['-s', '-m', '30', '--compressed', '-X', method, url];
    for (const k of Object.keys(headers)) args.push('-H', k + ': ' + headers[k]);
    if (body != null && method !== 'GET' && method !== 'HEAD') args.push('--data-binary', body);
    args.push('-w', '\\n__CURLSTATUS__%{http_code}');
    execFile('curl', args, { maxBuffer: 20 * 1024 * 1024 }, (err, stdout) => {
      if (err && !stdout) return reject(new Error('curl falhou: ' + err.message));
      const marker = '\n__CURLSTATUS__';
      const idx = stdout.lastIndexOf(marker);
      let text = stdout, status = 0;
      if (idx >= 0) {
        text = stdout.slice(0, idx);
        status = parseInt(stdout.slice(idx + marker.length).trim(), 10) || 0;
      }
      resolve({ status, ok: status >= 200 && status < 300, text });
    });
  });
}

// Extrai mensagem de causa de corpos edusp (array [{cause}] ou {error|message})
function eduspCause(data) {
  if (Array.isArray(data) && data[0]) return data[0].cause || data[0].message || '';
  if (data && (data.error || data.message)) return data.error || data.message;
  return '';
}

// "Isso é erro de credencial?" — baseado em JSON, nunca em HTML cru.
function looksLikeCredError(status, data) {
  if (status === 401 || status === 403) return true;
  const s = ((data && (data.statusRetorno || data.error || data.message)) || '').toString().toLowerCase();
  return /invalid|incorret|senha|password|não autorizado|nao autorizado|unauthorized/.test(s);
}

// Escolhe a sala como o Taskitos: prioriza rooms cujo topic tem indicador de série
// [º°ª]; se nenhuma, usa todas; depois pega a de maior oper.length.
function pickRoom(rooms) {
  let candidates = rooms.filter((r) =>
    Array.isArray(r.topics)
      ? r.topics.some((t) => /[º°ª]/.test((t && (t.name || t)) || ''))
      : /[º°ª]/.test(r.topic || '')
  );
  if (!candidates.length) candidates = rooms.slice();
  return candidates.reduce((best, r) =>
    ((r.oper && r.oper.length) || 0) > ((best.oper && best.oper.length) || 0) ? r : best
    , candidates[0]);
}

// ─── /api/login: SED (RA/senha) → edusp auth_token → rooms ───────────────────

app.post('/api/login', async (req, res) => {
  const { ra: raRaw, estado, senha } = req.body || {};
  if (!raRaw || !senha) return res.status(400).json({ error: 'RA e senha são obrigatórios.' });

  const raNum = String(raRaw).replace(/\D/g, '');
  const uf = String(estado || 'sp').trim().toLowerCase();
  if (!raNum || raNum.length < 6) return res.status(400).json({ error: 'RA inválido.' });
  const sedUser = raNum + uf; // ex: 111178056sp

  try {
    // ── PASSO 1: autentica na SED e obtém o token intermediário ──────────────
    const sedResp = await nodeFetch(SED_LOGIN_URL, {
      method: 'POST',
      headers: {
        'Accept': '*/*',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        'Content-Type': 'application/json',
        'ocp-apim-subscription-key': SED_SUBSCRIPTION_KEY,
        'User-Agent': BROWSER_UA,
        'Origin': SDF_ORIGIN,
        'Referer': SDF_ORIGIN + '/',
      },
      body: JSON.stringify({ user: sedUser, senha }),
    });

    const sedText = await sedResp.text();
    let sedData = null;
    try { sedData = sedText ? JSON.parse(sedText) : {}; } catch { sedData = null; } // null = não-JSON (HTML)

    const sedToken = sedData && sedData.token;

    // FIX CRÍTICO: o SED é um BFF que retorna 200 mesmo com senha errada e sem
    // token. Decidir pelo CONTEÚDO (token presente?), não só pelo status HTTP.
    if (!sedToken) {
      if (sedData === null) {
        return res.status(502).json({ error: 'Serviço da SED indisponível ou instável. Tente novamente.', stage: 'sed' });
      }
      if (looksLikeCredError(sedResp.status, sedData)) {
        return res.status(401).json({ error: sedData.statusRetorno || 'RA ou senha inválidos.', stage: 'sed' });
      }
      return res.status(502).json({ error: sedData.statusRetorno || 'Falha ao autenticar na SED.', stage: 'sed', statusCode: sedData.statusCode });
    }

    // ── PASSO 2: troca o token da SED pelo auth_token da edusp-api ───────────
    // via curl (o Cloudflare do edusp bloqueia node-fetch)
    const regResp = await curlRequest(EDUSP_BASE + '/registration/edusp/token', {
      method: 'POST',
      headers: eduspHeaders(), // sem x-api-key aqui (ainda não autenticado)
      body: JSON.stringify({ token: sedToken }),
    });

    const regText = regResp.text;
    let regData = null;
    try { regData = regText ? JSON.parse(regText) : {}; } catch { regData = null; }

    if (regResp.status === 403) {
      return res.status(502).json({ error: 'Bloqueado pelo Cloudflare da plataforma. Tente novamente.', stage: 'edusp-cf' });
    }
    if (regData === null) {
      return res.status(502).json({ error: 'Plataforma retornou resposta inválida (não-JSON).', stage: 'edusp' });
    }

    const eduspAuthToken = regData.auth_token;
    if (!eduspAuthToken) {
      const cause = eduspCause(regData);
      if (looksLikeCredError(regResp.status, regData)) {
        return res.status(401).json({ error: cause || 'Sessão negada pela plataforma (edusp).', stage: 'edusp' });
      }
      return res.status(502).json({ error: cause || 'Plataforma não retornou auth_token.', stage: 'edusp' });
    }

    const userName = (regData.user && regData.user.name) || regData.name || '?';

    // ── PASSO 3: lista as salas (rooms) do aluno ─────────────────────────────
    const roomResp = await curlRequest(EDUSP_BASE + '/room/user', {
      method: 'GET',
      headers: eduspHeaders({ 'x-api-key': eduspAuthToken }),
    });

    const roomText = roomResp.text;
    let roomData = null;
    try { roomData = roomText ? JSON.parse(roomText) : {}; } catch { roomData = null; }

    if (roomResp.status === 401) {
      return res.status(401).json({ error: 'Token da plataforma expirou ao listar salas.', stage: 'rooms' });
    }
    if (!roomResp.ok || roomData === null) {
      return res.status(502).json({ error: 'Falha ao listar salas.', stage: 'rooms' });
    }

    const rooms = roomData.rooms || [];
    if (!rooms.length) {
      return res.status(404).json({ error: 'Nenhuma sala encontrada para este aluno.', stage: 'rooms' });
    }

    const chosen = pickRoom(rooms);
    const roomCode = chosen && chosen.name;
    if (!roomCode) {
      return res.status(502).json({ error: 'Sala sem identificador (name).', stage: 'rooms' });
    }

    // ── Salva na sessão ──────────────────────────────────────────────────────
    req.session.sedToken = sedToken;
    req.session.eduspAuthToken = eduspAuthToken; // vira o x-api-key das chamadas
    req.session.userId = raNum;
    req.session.userName = userName;
    req.session.rooms = rooms;
    req.session.roomCode = roomCode;

    console.log('[login] ok — user:', userName, '| RA:', raNum, '| roomCode:', roomCode, '| rooms:', rooms.length);

    return res.json({
      ok: true,
      userId: raNum,
      userName,
      roomCode,
      rooms: rooms.map((r) => ({ id: r.id, name: r.name })), // não vaza auth_token
    });

  } catch (e) {
    console.error('[login] erro:', e.message);
    return res.status(500).json({ error: 'Erro ao conectar: ' + e.message });
  }
});

// ─── Proxy autenticado para a edusp-api ──────────────────────────────────────
// O front chama /api/edusp/<path>; o server injeta x-api-key da sessão + headers
// edusp + headers de browser (Cloudflare). O browser NÃO pode chamar edusp direto
// (CORS + forbidden headers), por isso todo tráfego de atividade passa por aqui.

app.all('/api/edusp/*', async (req, res) => {
  if (!req.session.eduspAuthToken) return res.status(401).json({ error: 'não autenticado' });

  const subPath = req.originalUrl.replace(/^\/api\/edusp/, '');
  const targetUrl = EDUSP_BASE + (subPath.startsWith('/') ? subPath : '/' + subPath);

  const method = req.method;
  const opts = { method, headers: eduspHeaders({ 'x-api-key': req.session.eduspAuthToken }) };
  if (method !== 'GET' && method !== 'HEAD') {
    opts.body = (req.body && Object.keys(req.body).length) ? JSON.stringify(req.body) : undefined;
  }

  try {
    let r = await curlRequest(targetUrl, opts); // curl fura o Cloudflare do edusp
    if (r.status === 403) { // Cloudflare intermitente — 1 retry
      await new Promise((s) => setTimeout(s, 1000));
      r = await curlRequest(targetUrl, opts);
    }
    if (r.status === 401) {
      return res.status(401).json({ error: 'Sessão da plataforma expirou. Faça login novamente.' });
    }
    res.status(r.status).type('application/json').send(r.text);
  } catch (e) {
    console.error('[edusp proxy] erro:', e.message, '→', targetUrl);
    res.status(502).json({ error: e.message });
  }
});

// ─── Sessão / logout ─────────────────────────────────────────────────────────

app.get('/api/session', (req, res) => {
  if (!req.session.eduspAuthToken) return res.json({ logado: false });
  res.json({
    logado: true,
    userId: req.session.userId,
    userName: req.session.userName,
    roomCode: req.session.roomCode,
    rooms: (req.session.rooms || []).map((r) => ({ id: r.id, name: r.name })),
  });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// ─── Serve index.html para qualquer rota desconhecida ────────────────────────

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚀 Sync Activities Web rodando em http://localhost:${PORT}\n`);
});

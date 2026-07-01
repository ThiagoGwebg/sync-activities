const express  = require('express');
const session  = require('express-session');
const nodeFetch = require('node-fetch');
const path     = require('path');
const fs       = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const BASE = 'https://educacaoprofissional.educacao.sp.gov.br';

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'sync-activities-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 8 * 60 * 60 * 1000 }, // 8h
}));
app.use(express.static(path.join(__dirname, 'public')));

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseCookieHeader(raw) {
  if (!raw || !raw.length) return {};
  const out = {};
  const list = Array.isArray(raw) ? raw : [raw];
  list.forEach((c) => {
    const part = c.split(';')[0].trim();
    const eq = part.indexOf('=');
    if (eq > 0) out[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
  });
  return out;
}

function cookieString(obj) {
  return Object.entries(obj).map(([k, v]) => k + '=' + v).join('; ');
}

function extractSesskey(html) {
  let m = html.match(/"sesskey"\s*:\s*"([^"]+)"/);
  if (m) return m[1];
  m = html.match(/name="sesskey"\s+value="([^"]+)"/);
  if (m) return m[1];
  m = html.match(/sesskey=([A-Za-z0-9]+)/);
  return m ? m[1] : '';
}

function extractUserId(html) {
  let m = html.match(/"userid"\s*:\s*(\d+)/);
  if (m) return parseInt(m[1]);
  m = html.match(/data-userid="(\d+)"/);
  return m ? parseInt(m[1]) : 0;
}

// ─── Login via token.php (API mobile do Moodle, sem CSRF) ───────────────────

app.post('/api/login', async (req, res) => {
  const { ra, senha } = req.body;
  if (!ra || !senha) return res.status(400).json({ error: 'RA e senha são obrigatórios.' });

  try {
    // Tenta via token.php (web service — sem CSRF, feito para apps)
    const tokenResp = await nodeFetch(BASE + '/login/token.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'MoodleMobile',
      },
      body: new URLSearchParams({ username: ra, password: senha, service: 'moodle_mobile_app' }).toString(),
    });
    const tokenData = await tokenResp.json();
    console.log('[login/token]', JSON.stringify(tokenData).substring(0, 200));

    if (tokenData.token) {
      // Token obtido — agora pega uma sessão web com o token para o proxy funcionar
      const sessResp = await nodeFetch(BASE + '/login/index.php?token=' + tokenData.token, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        redirect: 'manual',
      });
      let moodleCookies = parseCookieHeader(sessResp.headers.raw()['set-cookie'] || []);

      // Segue redirect para dashboard e coleta cookies
      let currentUrl = sessResp.headers.get('location') || BASE + '/my/';
      if (!currentUrl.startsWith('http')) currentUrl = BASE + currentUrl;
      for (let i = 0; i < 5; i++) {
        const r2 = await nodeFetch(currentUrl, {
          headers: { 'Cookie': cookieString(moodleCookies), 'User-Agent': 'Mozilla/5.0' },
          redirect: 'manual',
        });
        Object.assign(moodleCookies, parseCookieHeader(r2.headers.raw()['set-cookie'] || []));
        const loc = r2.headers.get('location') || '';
        if (r2.status >= 300 && r2.status < 400 && loc) {
          currentUrl = loc.startsWith('http') ? loc : BASE + loc;
        } else {
          const html = await r2.text();
          const sesskey = extractSesskey(html);
          const userId  = extractUserId(html);
          req.session.moodleCookies = moodleCookies;
          req.session.sesskey = sesskey;
          req.session.userId  = userId;
          req.session.wsToken = tokenData.token;
          console.log('[login] ok via token — sesskey:', sesskey ? 'ok' : '?', '| userId:', userId);
          return res.json({ ok: true, sesskey, userId });
        }
      }
      return res.status(500).json({ error: 'Não foi possível obter sessão após token.' });
    }

    // Fallback: login direto via form (com logintoken/CSRF)
    const step1 = await nodeFetch(BASE + '/login/index.php', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    const cookies = parseCookieHeader(step1.headers.raw()['set-cookie'] || []);
    const loginHtml = await step1.text();
    const logintoken = (loginHtml.match(/name="logintoken"[^>]*value="([^"]+)"/) || [])[1] || '';

    const params = new URLSearchParams({ username: ra, password: senha, logintoken, anchor: '' });
    let currentUrl2 = BASE + '/login/index.php';
    let currentCookies = Object.assign({}, cookies);
    let finalHtml = '';
    let finalUrl  = '';

    let resp = await nodeFetch(currentUrl2, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookieString(currentCookies),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Origin': BASE,
        'Referer': BASE + '/login/index.php',
      },
      body: params.toString(),
      redirect: 'manual',
    });

    for (let i = 0; i < 6; i++) {
      Object.assign(currentCookies, parseCookieHeader(resp.headers.raw()['set-cookie'] || []));
      const loc = resp.headers.get('location') || '';
      console.log(`[login/form] hop ${i} status=${resp.status} → ${loc || '(fim)'}`);
      if (resp.status >= 300 && resp.status < 400 && loc) {
        currentUrl2 = loc.startsWith('http') ? loc : BASE + loc;
        resp = await nodeFetch(currentUrl2, {
          headers: { 'Cookie': cookieString(currentCookies), 'User-Agent': 'Mozilla/5.0' },
          redirect: 'manual',
        });
      } else {
        finalUrl  = currentUrl2;
        finalHtml = await resp.text();
        break;
      }
    }

    if (finalUrl.includes('/login/') || finalHtml.includes('name="logintoken"')) {
      // Extrai mensagem de erro do Moodle
      const errMatch = finalHtml.match(/(?:loginerrors|alert-danger|login-error)[^>]*>([\s\S]{0,400})/);
      let msg = errMatch ? errMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '';
      if (!msg) msg = tokenData.error || 'RA ou senha inválidos.';
      return res.status(401).json({ error: msg.substring(0, 150) });
    }

    const sesskey = extractSesskey(finalHtml);
    const userId  = extractUserId(finalHtml);
    req.session.moodleCookies = currentCookies;
    req.session.sesskey = sesskey;
    req.session.userId  = userId;
    console.log('[login/form] ok — sesskey:', sesskey ? 'ok' : '?', '| userId:', userId);
    res.json({ ok: true, sesskey, userId });

  } catch (e) {
    console.error('[login] erro:', e.message);
    res.status(500).json({ error: 'Erro ao conectar: ' + e.message });
  }
});

// ─── Login via sessão passada pelo web app (vinda da extensão) ───────────────

app.post('/api/login-ext', async (req, res) => {
  const { moodleSession, sesskey, userId } = req.body;
  if (!moodleSession) return res.status(400).json({ error: 'Sessão não fornecida.' });

  try {
    const testCookies = { MoodleSession: moodleSession };
    const r = await nodeFetch(BASE + '/my/', {
      headers: { 'Cookie': cookieString(testCookies), 'User-Agent': 'Mozilla/5.0' },
      redirect: 'follow',
    });
    const html = await r.text();
    if (r.url.includes('/login/')) {
      return res.status(401).json({ error: 'Sessão expirada. Acesse o portal primeiro.' });
    }
    const finalSesskey = sesskey || extractSesskey(html);
    const finalUserId  = userId  || extractUserId(html);
    req.session.moodleCookies = testCookies;
    req.session.sesskey = finalSesskey;
    req.session.userId  = finalUserId;
    console.log('[login-ext] ok — sesskey:', finalSesskey ? 'ok' : '?', '| userId:', finalUserId);
    res.json({ ok: true, sesskey: finalSesskey, userId: finalUserId });
  } catch (e) {
    res.status(500).json({ error: 'Erro ao validar sessão: ' + e.message });
  }
});

// ─── Login: retorna URL OAuth para o browser abrir (fallback Google) ─────────

app.get('/api/login-url', async (req, res) => {
  try {
    const r = await nodeFetch(BASE + '/login/index.php', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    const html = await r.text();
    const oauthMatch = html.match(/href="(https?:\/\/educacaoprofissional[^"]*auth\/oauth2\/login\.php[^"]*)"/);
    if (!oauthMatch) return res.status(500).json({ error: 'Botão de login não encontrado.' });
    res.json({ url: oauthMatch[1].replace(/&amp;/g, '&') });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Debug: inspeciona o form de login (temporário) ─────────────────────────

app.get('/api/debug-oauth', async (req, res) => {
  try {
    // 1. Pega a página de login para extrair a URL OAuth2 e cookies iniciais
    const step1 = await nodeFetch(BASE + '/login/index.php', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    const rawCookies = step1.headers.raw()['set-cookie'] || [];
    const cookies = parseCookieHeader(rawCookies);
    const html1 = await step1.text();

    const oauthMatch = html1.match(/href="(https?:\/\/educacaoprofissional[^"]*auth\/oauth2\/login\.php[^"]*)"/);
    if (!oauthMatch) return res.json({ error: 'botão OAuth2 não encontrado', html: html1.substring(0,2000) });

    const oauthUrl = oauthMatch[1].replace(/&amp;/g, '&');
    console.log('[oauth] URL inicial:', oauthUrl);

    // 2. Segue todos os redirects do OAuth manualmente para ver a cadeia
    let currentUrl = oauthUrl;
    let currentCookies = Object.assign({}, cookies);
    const hops = [];

    for (let i = 0; i < 8; i++) {
      const r = await nodeFetch(currentUrl, {
        headers: {
          'Cookie': cookieString(currentCookies),
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        redirect: 'manual',
      });
      const sc = r.headers.raw()['set-cookie'] || [];
      Object.assign(currentCookies, parseCookieHeader(sc));
      const loc = r.headers.get('location') || '';
      hops.push({ step: i, status: r.status, url: currentUrl, location: loc });
      console.log(`[oauth hop ${i}] ${r.status} → ${loc || '(fim)'}`);

      if (r.status >= 300 && r.status < 400 && loc) {
        currentUrl = loc.startsWith('http') ? loc : (new URL(loc, currentUrl)).href;
      } else {
        // chegou ao fim — pega o HTML para ver o form de login
        const finalHtml = await r.text();
        const forms = [...finalHtml.matchAll(/<form[^>]*>([\s\S]{0,600})<\/form>/gi)].map(m => m[0].substring(0,600));
        const inputs = [...finalHtml.matchAll(/<input[^>]+>/gi)].map(m => m[0]);
        return res.json({ hops, finalUrl: currentUrl, htmlSize: finalHtml.length, forms, inputs });
      }
    }
    res.json({ hops, note: 'mais de 8 redirects' });
  } catch (e) {
    res.json({ error: e.message });
  }
});

app.get('/api/debug-sso', async (req, res) => {
  const urls = [
    'https://salafuturo.educacao.sp.gov.br/',
    'https://www.salafuturo.educacao.sp.gov.br/',
    'https://efape.educacao.sp.gov.br/',
    'https://sed.educacao.sp.gov.br/',
  ];
  const results = [];
  for (const url of urls) {
    try {
      const r = await nodeFetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        redirect: 'follow',
      });
      const html = await r.text();
      const forms = [...html.matchAll(/<form[^>]*>([\s\S]{0,500})<\/form>/gi)].map(m => m[0].substring(0,400));
      const inputs = [...html.matchAll(/<input[^>]+>/gi)].map(m => m[0]);
      results.push({ url, finalUrl: r.url, status: r.status, htmlSize: html.length, forms: forms.slice(0,3), inputs: inputs.slice(0,10) });
    } catch (e) {
      results.push({ url, error: e.message });
    }
  }
  res.json(results);
});

app.get('/api/debug-loginhtml', async (req, res) => {
  try {
    const r = await nodeFetch(BASE + '/login/index.php', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      redirect: 'follow',
    });
    const html = await r.text();
    // Retorna parte relevante: tudo entre as tags de social-login e o fim do formulário
    const start = Math.max(0, html.toLowerCase().indexOf('social') - 200);
    const end = Math.min(html.length, start + 6000);
    res.type('text/plain').send(html.substring(start, end));
  } catch (e) {
    res.status(500).send(e.message);
  }
});

app.get('/api/debug-loginform', async (req, res) => {
  try {
    const r = await nodeFetch(BASE + '/login/index.php', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      redirect: 'follow',
    });
    const html = await r.text();
    const inputs = [...html.matchAll(/<input[^>]+>/gi)].map(m => m[0]).join('\n');
    const links  = [...html.matchAll(/href="([^"]+)"/gi)].map(m => m[1]).filter(h => h.includes('auth') || h.includes('oauth') || h.includes('sso') || h.includes('saml') || h.includes('cas') || h.includes('sed') || h.includes('login'));
    const buttons = [...html.matchAll(/<a[^>]+class="[^"]*btn[^"]*"[^>]*>([\s\S]{0,100})<\/a>/gi)].map(m => m[0].substring(0,200));
    // Trecho com Estudante/Servidor se existir
    const idxEst = html.toLowerCase().indexOf('estudante');
    const snippet = idxEst >= 0 ? html.substring(Math.max(0,idxEst-800), idxEst+1200) : '';
    res.json({ finalUrl: r.url, htmlSize: html.length, inputs: inputs.substring(0,3000), authLinks: links.slice(0,20), buttons: buttons.slice(0,10), estudanteSnippet: snippet });
  } catch (e) {
    res.json({ error: e.message });
  }
});

// ─── Registro da extensão Chrome ─────────────────────────────────────────────

let registeredExtId = null;

app.post('/api/register-ext', (req, res) => {
  if (req.body && req.body.extId) {
    registeredExtId = req.body.extId;
    console.log('[ext] registrada:', registeredExtId);
  }
  res.json({ ok: true });
});

app.get('/api/ext-id', (req, res) => {
  res.json({ extId: registeredExtId });
});

// ─── Verifica sessão ─────────────────────────────────────────────────────────

app.get('/api/session', (req, res) => {
  if (!req.session.moodleCookies) return res.json({ logado: false });
  res.json({ logado: true, sesskey: req.session.sesskey, userId: req.session.userId });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// ─── Proxy para o Moodle ─────────────────────────────────────────────────────

app.post('/api/proxy', async (req, res) => {
  if (!req.session.moodleCookies) return res.status(401).json({ error: 'não autenticado' });

  const { url, method = 'GET', headers: extraHeaders = {}, body } = req.body;
  if (!url) return res.status(400).json({ error: 'url obrigatória' });

  // Garante URL absoluta dentro do portal
  const fullUrl = url.startsWith('http') ? url : BASE + (url.startsWith('/') ? url : '/' + url);

  const forwardHeaders = Object.assign({}, extraHeaders, {
    'Cookie': cookieString(req.session.moodleCookies),
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Origin': BASE,
    'Referer': BASE + '/',
  });
  // Remove headers que o browser injeta mas o node não precisa
  delete forwardHeaders['credentials'];

  try {
    const fetchOpts = { method, headers: forwardHeaders, redirect: 'follow' };
    if (body !== null && body !== undefined && method !== 'GET') fetchOpts.body = body;

    const moodleRes = await nodeFetch(fullUrl, fetchOpts);

    // Captura cookies novos (ex: renovação de sessão)
    const rawNew = moodleRes.headers.raw()['set-cookie'] || [];
    if (rawNew.length) {
      Object.assign(req.session.moodleCookies, parseCookieHeader(rawNew));
    }

    const contentType = moodleRes.headers.get('content-type') || 'text/plain';
    const buf = await moodleRes.buffer();
    res.status(moodleRes.status).type(contentType).send(buf);
  } catch (e) {
    console.error('Proxy error:', e.message, '→', fullUrl);
    res.status(500).json({ error: e.message });
  }
});

// ─── Refresh sesskey ─────────────────────────────────────────────────────────
// Chamado quando o frontend precisa de um sesskey fresco

app.post('/api/refresh-auth', async (req, res) => {
  if (!req.session.moodleCookies) return res.status(401).json({ error: 'não autenticado' });
  try {
    const r = await nodeFetch(BASE + '/my/', {
      headers: {
        'Cookie': cookieString(req.session.moodleCookies),
        'User-Agent': 'Mozilla/5.0',
      },
      redirect: 'follow',
    });
    const html = await r.text();
    const sesskey = extractSesskey(html);
    const userId = extractUserId(html) || req.session.userId;
    if (sesskey) { req.session.sesskey = sesskey; req.session.userId = userId; }
    res.json({ sesskey, userId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Serve index.html para qualquer rota desconhecida ────────────────────────

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚀 Sync Activities Web rodando em http://localhost:${PORT}\n`);
});

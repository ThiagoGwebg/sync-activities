// Sync Activities — api.js
// sesskey / userId + chamadas à API ajax do Moodle.
(function () {
  const EA = (window.__EA = window.__EA || {});
  const BASE = 'https://educacaoprofissional.educacao.sp.gov.br';

  function findSesskey() {
    // window.M é page-context (mundo isolado não vê) — então buscamos no DOM/HTML.
    let k = '';
    const meta = document.querySelector('meta[name="sesskey"]');
    if (meta) k = meta.content;
    if (!k) {
      const m = document.body && document.body.innerHTML.match(/"sesskey":"([^"]+)"/);
      if (m) k = m[1];
    }
    if (!k) {
      const inp = document.querySelector('input[name="sesskey"]');
      if (inp) k = inp.value;
    }
    if (!k) {
      const a = document.querySelector('a[href*="sesskey="]');
      if (a) {
        const mm = a.href.match(/sesskey=([^&]+)/);
        if (mm) k = decodeURIComponent(mm[1]);
      }
    }
    return k;
  }

  function findUserId() {
    let id = 0;
    const m = document.body && document.body.innerHTML.match(/"userid"\s*:\s*(\d+)/);
    if (m) id = parseInt(m[1]);
    if (!id) {
      const el = document.querySelector('[data-userid]');
      if (el) id = parseInt(el.getAttribute('data-userid')) || 0;
    }
    return id;
  }

  function parseHTML(html) {
    return new DOMParser().parseFromString(html, 'text/html');
  }
  function espera(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  const api = {
    BASE,
    sesskey: '',
    userId: 0,
    parseHTML,
    espera,

    refreshAuth() {
      api.sesskey = findSesskey();
      api.userId = findUserId();
      return { sesskey: api.sesskey, userId: api.userId };
    },

    // Injeta a ponte no contexto da página para ler window.M.cfg (sesskey/userId).
    initFromPage() {
      return new Promise((resolve) => {
        let done = false;
        function finish(via) {
          if (done) return;
          done = true;
          window.removeEventListener('message', onMsg);
          resolve({ sesskey: api.sesskey, userId: api.userId, via });
        }
        function onMsg(ev) {
          if (ev.source !== window || !ev.data || !ev.data.__ea_page) return;
          if (ev.data.sesskey) api.sesskey = ev.data.sesskey;
          if (ev.data.userId) api.userId = parseInt(ev.data.userId) || api.userId;
          finish('page');
        }
        window.addEventListener('message', onMsg);
        try {
          const s = document.createElement('script');
          s.src = chrome.runtime.getURL('src/injected.js');
          s.onload = function () { this.remove(); };
          (document.head || document.documentElement).appendChild(s);
        } catch (e) { /* ignora */ }
        // timeout: cai no fallback por DOM
        setTimeout(() => { if (!api.sesskey) api.refreshAuth(); finish('timeout'); }, 1500);
      });
    },

    // Garante sesskey + userId antes de chamadas que precisam deles.
    async ensureAuth() {
      if (!api.sesskey) api.refreshAuth();
      if (!api.sesskey || !api.userId) await api.initFromPage();
      // último recurso: pega userid do site info (não precisa de userid no arg)
      if (api.sesskey && !api.userId) {
        try {
          const info = await api.call('core_webservice_get_site_info', {});
          if (info && info.userid) api.userId = info.userid;
        } catch (e) { /* ignora */ }
      }
      return { sesskey: api.sesskey, userId: api.userId };
    },

    // Chamada genérica ao service.php (ajax)
    async call(methodname, args) {
      if (!api.sesskey) api.refreshAuth();
      const url = `${BASE}/lib/ajax/service.php?sesskey=${api.sesskey}&info=${methodname}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify([{ index: 0, methodname, args }]),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (data[0] && data[0].error) {
        throw new Error((data[0].exception && data[0].exception.message) || 'erro na API');
      }
      return data[0].data;
    },

    // GET de uma página, retorna texto
    async getHTML(url) {
      const res = await fetch(url, { credentials: 'include', headers: { Accept: 'text/html' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.text();
    },

    // POST form-urlencoded
    async postForm(url, params) {
      const res = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res;
    },

    // Verifica se o usuário está logado no portal
    async isLoggedIn() {
      try {
        const html = await api.getHTML(BASE + '/login/index.php');
        // Se redireciona para o dashboard, está logado
        const doc = api.parseHTML(html);
        const isLoginPage = doc.querySelector('input[name="username"]') || doc.querySelector('#username');
        return !isLoginPage;
      } catch (e) {
        return false;
      }
    },

    // Faz login no portal Moodle com RA + dígito + estado + senha
    // ra: string (só os números), digito: string (1 char), estado: 'sp', senha: string
    async login(ra, digito, estado, senha) {
      // Monta o username no formato do portal: RA + dígito + estado
      const username = ra.trim() + digito.trim() + estado.trim().toLowerCase();

      // 1) Pega o logintoken da página de login
      const loginHtml = await api.getHTML(BASE + '/login/index.php');
      const loginDoc = api.parseHTML(loginHtml);
      const tokenEl = loginDoc.querySelector('input[name="logintoken"]');
      const logintoken = tokenEl ? tokenEl.value : '';

      // 2) Faz o POST de login
      const params = new URLSearchParams({
        anchor: '',
        logintoken,
        username,
        password: senha,
        rememberusername: '1',
      });

      const res = await fetch(BASE + '/login/index.php', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
        redirect: 'follow',
      });

      const html = await res.text();
      const doc = api.parseHTML(html);

      // Checa se login falhou (página voltou com form de login ou mensagem de erro)
      const errEl = doc.querySelector('.loginerrors, #loginerrormessage, [data-region="login-errors"]');
      if (errEl) throw new Error(errEl.textContent.trim() || 'Usuário ou senha incorretos');

      const stillLogin = doc.querySelector('input[name="username"]') || doc.querySelector('#username');
      if (stillLogin) throw new Error('Usuário ou senha incorretos');

      // Extrai sesskey da página pós-login
      const skMatch = html.match(/"sesskey":"([^"]+)"/);
      if (skMatch) api.sesskey = skMatch[1];

      const uidMatch = html.match(/"userid"\s*:\s*(\d+)/);
      if (uidMatch) api.userId = parseInt(uidMatch[1]);

      if (!api.sesskey) {
        // Tenta buscar sesskey de uma página autenticada
        const home = await api.getHTML(BASE + '/my/');
        const skm2 = home.match(/"sesskey":"([^"]+)"/);
        if (skm2) api.sesskey = skm2[1];
        const uid2 = home.match(/"userid"\s*:\s*(\d+)/);
        if (uid2) api.userId = parseInt(uid2[1]);
      }

      return { sesskey: api.sesskey, userId: api.userId, username };
    },

    // Retry com backoff curto
    async withRetry(fn, tries) {
      tries = tries || 2;
      let lastErr;
      for (let i = 0; i < tries; i++) {
        try {
          return await fn();
        } catch (e) {
          lastErr = e;
          if (i < tries - 1) await espera(1200);
        }
      }
      throw lastErr;
    },
  };

  api.refreshAuth();
  EA.api = api;
})();

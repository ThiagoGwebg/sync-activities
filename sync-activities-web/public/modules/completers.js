// Sync Activities — completers.js
// Estratégias de conclusão por tipo de atividade.
(function () {
  const EA = (window.__EA = window.__EA || {});
  const api = EA.api;
  const BASE = api.BASE;

  function marcarFeito(cmid) {
    return api.call('core_completion_update_activity_completion_status_manually', {
      cmid: cmid,
      completed: true,
    });
  }

  // ─── SCORM ───────────────────────────────────────────────────────────────
  async function scorm(cmid) {
    const res = await fetch(BASE + '/mod/scorm/view.php?id=' + cmid, { credentials: 'include' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const html = await res.text();
    const sm = html.match(/"scoid"\s*:\s*(\d+)/);
    const am = html.match(/"attempt"\s*:\s*(\d+)/);
    const scoid = sm ? sm[1] : null;
    const tentativa = am ? am[1] : '1';
    if (!scoid) return marcarFeito(cmid);

    const params = new URLSearchParams({ id: cmid, scoid, attempt: tentativa, sesskey: api.sesskey });
    if (html.indexOf('cmi.completion_status') >= 0) {
      params.append('cmi.completion_status', 'completed');
      params.append('cmi.success_status', 'passed');
      params.append('cmi.score.raw', '100');
      params.append('cmi.score.max', '100');
      params.append('cmi.score.min', '0');
      params.append('cmi.score.scaled', '1');
    } else {
      params.append('cmi.core.lesson_status', 'passed');
      params.append('cmi.core.score.raw', '100');
      params.append('cmi.core.score.max', '100');
      params.append('cmi.core.score.min', '0');
      params.append('cmi.core.session_time', '00:30:00');
    }
    await api.postForm(BASE + '/mod/scorm/datamodel.php', params);
  }

  // ─── H5P ─────────────────────────────────────────────────────────────────
  function extrairH5P(html) {
    const idx = html.indexOf('H5PIntegration');
    if (idx === -1) return null;
    const inicio = html.indexOf('{', idx);
    if (inicio === -1) return null;
    let prof = 0, dentroStr = false, escapou = false;
    for (let i = inicio; i < html.length; i++) {
      const c = html[i];
      if (escapou) { escapou = false; continue; }
      if (c === '\\' && dentroStr) { escapou = true; continue; }
      if (c === '"' && !escapou) dentroStr = !dentroStr;
      if (!dentroStr) {
        if (c === '{') prof++;
        else if (c === '}') { prof--; if (prof === 0) return html.slice(inicio, i + 1); }
      }
    }
    return null;
  }

  async function postH5P(html, onResposta) {
    const raw = extrairH5P(html);
    if (!raw) throw new Error('H5PIntegration não encontrado');
    let dados;
    try { dados = JSON.parse(raw); } catch (e) { throw new Error('JSON do H5P corrompido'); }
    const conteudos = dados.contents || {};
    const chaves = Object.keys(conteudos);
    if (!chaves.length) throw new Error('nenhum conteúdo H5P');
    const uid = (dados.user && dados.user.id) || '';
    const uname = (dados.user && dados.user.name) || '';

    await Promise.all(chaves.map(async (key) => {
      const ct = conteudos[key];
      const hid = parseInt(key.replace('cid-', ''));
      const urlH5p = ct.url;
      if (!urlH5p) return;

      let questao = null;
      try {
        if (ct.jsonContent) questao = typeof ct.jsonContent === 'string' ? JSON.parse(ct.jsonContent) : ct.jsonContent;
      } catch (e) {}

      let idxCerta = '', txtCerta = '';
      const opcoes = [];
      if (questao && questao.answers && Array.isArray(questao.answers)) {
        questao.answers.forEach((a, i) => {
          const txt = a.text.replace(/<[^>]+>/g, '').replace(/\n/g, '').trim();
          opcoes.push({ id: String(i), description: { 'en-US': txt } });
          if (a.correct) { idxCerta = String(i); txtCerta = txt; }
        });
      }
      if (txtCerta && onResposta) onResposta(txtCerta);

      const stmt = {
        actor: { name: uname, objectType: 'Agent', account: { name: String(uid), homePage: BASE } },
        verb: { id: 'http://adlnet.gov/expapi/verbs/answered', display: { 'en-US': 'answered' } },
        object: {
          id: urlH5p, objectType: 'Activity',
          definition: {
            extensions: { 'http://h5p.org/x-api/h5p-local-content-id': hid },
            name: { 'en-US': (ct.metadata && ct.metadata.title) || '' },
            description: { 'en-US': questao && questao.question ? questao.question.replace(/<[^>]+>/g, '').trim() : '' },
            type: 'http://adlnet.gov/expapi/activities/cmi.interaction',
            interactionType: 'choice',
            correctResponsesPattern: [idxCerta],
            choices: opcoes,
          },
        },
        context: { contextActivities: { category: [{ id: 'http://h5p.org/libraries/' + ct.library.replace(' ', '-'), objectType: 'Activity' }] } },
        result: { score: { min: 0, max: 1, raw: 1, scaled: 1 }, completion: true, success: true, duration: 'PT10S', response: idxCerta },
      };

      const body = [{ index: 0, methodname: 'core_xapi_statement_post', args: {
        component: 'mod_h5pactivity',
        requestjson: JSON.stringify([stmt]),
      }}];
      const r = await fetch(BASE + '/lib/ajax/service.php?sesskey=' + api.sesskey + '&info=core_xapi_statement_post', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error('xAPI HTTP ' + r.status);
      const d = await r.json();
      if (d && d[0] && d[0].error) throw new Error('xAPI: ' + (d[0].exception && d[0].exception.message || 'erro'));
    }));
  }

  async function h5pactivity(cmid, onResposta) {
    const pHtml = await api.getHTML(BASE + '/mod/h5pactivity/view.php?id=' + cmid);
    if (pHtml.indexOf('H5PIntegration') >= 0) return postH5P(pHtml, onResposta);

    const doc = api.parseHTML(pHtml);
    const iframe = doc.querySelector('iframe.h5p-iframe, iframe[src*="h5p/embed"], iframe[src*="embed.php"]');
    let src = iframe ? iframe.getAttribute('src') : null;
    if (!src) {
      const ifrId = doc.querySelector('iframe[data-content-id]');
      if (ifrId) {
        const hid = ifrId.getAttribute('data-content-id');
        src = BASE + '/h5p/embed.php?url=' + encodeURIComponent(BASE + '/pluginfile.php/' + hid + '/mod_h5pactivity/package/0/content.json') + '&preventredirect=0&component=mod_h5pactivity';
      }
    }
    if (!src || src === 'about:blank') {
      const d = await api.call('core_h5p_get_trusted_h5p_file', { url: BASE + '/mod/h5pactivity/view.php?id=' + cmid, frame: 0, export: 0, embed: 0, copyright: 0 });
      const arqs = (d && d[0] && d[0].data && d[0].data.files) || [];
      const arq = arqs.find((x) => x.fileurl && x.fileurl.indexOf('embed') >= 0) || arqs[0];
      if (!arq || !arq.fileurl) throw new Error('H5PIntegration não encontrado');
      const h = await (await fetch(arq.fileurl, { credentials: 'include' })).text();
      return postH5P(h, onResposta);
    }
    const h = await (await fetch(src, { credentials: 'include' })).text();
    return postH5P(h, onResposta);
  }

  // ─── URL / visita simples / genérico ───────────────────────────────────────
  function url(cmid) {
    return fetch(BASE + '/mod/url/view.php?id=' + cmid, { credentials: 'include', redirect: 'manual', mode: 'no-cors' }).catch(() => {});
  }
  async function visitaSimples(tipo, cmid) {
    await api.getHTML(BASE + '/mod/' + tipo + '/view.php?id=' + cmid);
  }
  async function generico(tipo, cmid) {
    await api.getHTML(BASE + '/mod/' + tipo + '/view.php?id=' + cmid);
    try {
      await marcarFeito(cmid);
    } catch (e) {
      if (e.message && e.message.indexOf('não permite') >= 0) return;
      throw e;
    }
  }

  // ─── REGISTROS (IA: lê material + gera resposta via Groq) ─────────────────

  async function gerarTexto(tipo, cmid, sectionUrl) {
    const groq = EA.groq;
    const reader = EA.reader;
    if (!groq || !reader) throw new Error('módulos groq/reader não carregados');
    const cfg = await EA.store.getConfig();
    if (!cfg.groqKey) throw new Error('⚙ Chave Groq não configurada. Vá em "Ajustes" (passo 4) e insira sua API key em "Chave API Groq".');
    const enunciado = tipo === 'assign'
      ? await reader.lerEnunciadoAssign(cmid)
      : await reader.lerEnunciadoForum(cmid);
    const material = sectionUrl ? await reader.lerMaterialDaSemana(sectionUrl) : '';
    return groq.gerar({ enunciado, material, tipo, apiKey: cfg.groqKey, model: cfg.groqModel });
  }

  // Submete tarefa via POST direto — lê o formulário real para pegar todos os campos ocultos
  async function assign(cmid, sectionUrl) {
    const texto = await gerarTexto('assign', cmid, sectionUrl);
    const htmlTexto = texto.split('\n\n').map((p) => '<p>' + p.replace(/\n/g, '<br>') + '</p>').join('');

    // 1) Abre o formulário de edição da submissão para capturar campos ocultos (itemid, etc.)
    const editHtml = await api.getHTML(BASE + '/mod/assign/view.php?id=' + cmid + '&action=editsubmission');
    const editDoc = api.parseHTML(editHtml);
    const form = editDoc.querySelector('form#mform1, form[id^="mform"], form[action*="assign"]');
    if (!form) throw new Error('formulário de submissão não encontrado na página');

    // 2) Coleta TODOS os campos via form.elements (igual ao browser faz)
    const params = new URLSearchParams();
    [...form.elements].forEach((el) => {
      if (el.name && el.type !== 'submit' && el.type !== 'button' && el.type !== 'reset') {
        params.set(el.name, el.value || '');
      }
    });

    // 3) Injeta o texto gerado e força a ação de salvar
    params.set('action', 'savesubmission');
    // Suporte a ambos os formatos de campo de texto (onlinetext e text_editor genérico)
    const textKey = [...params.keys()].find((k) => k.includes('onlinetext') && k.includes('text')) || 'onlinetext_editor[text]';
    const formatKey = textKey.replace('[text]', '[format]');
    params.set(textKey, htmlTexto);
    params.set(formatKey, '1');

    const formAction = form.getAttribute('action') || (BASE + '/mod/assign/view.php');
    const actionUrl = formAction.startsWith('http') ? formAction : BASE + formAction.replace(/^\//, '/');

    const saveRes = await fetch(actionUrl, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    if (!saveRes.ok) throw new Error('assign save HTTP ' + saveRes.status);

    // 4) Verifica se foi salvo (a página redireciona ou mostra confirmação)
    const savedHtml = await saveRes.text();
    const savedOk = savedHtml.includes('submissionstatus') || savedHtml.includes('editsubmission') ||
      savedHtml.includes('submit') || !savedHtml.includes('id="mform1"');

    // 5) Envia para avaliação (submit for grading)
    const submitParams = new URLSearchParams({
      id: cmid,
      sesskey: api.sesskey,
      action: 'submit',
      submissionstatement: '1',
      confirm: '1',
    });
    await fetch(BASE + '/mod/assign/view.php', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: submitParams.toString(),
    });

    if (!savedOk) throw new Error('submissão não confirmada — verifique manualmente');
    return texto;
  }

  // Submete participação no fórum via POST direto
  async function forum(cmid, sectionUrl) {
    const mensagem = await gerarTexto('forum', cmid, sectionUrl);

    // Busca a página do fórum para encontrar discussions e forumid
    const viewHtml = await api.getHTML(BASE + '/mod/forum/view.php?id=' + cmid);
    const doc = api.parseHTML(viewHtml);

    // Tenta responder na primeira discussão existente
    const discLink = doc.querySelector('a[href*="discuss.php?d="]');
    if (discLink) {
      const dMatch = discLink.getAttribute('href').match(/d=(\d+)/);
      const did = dMatch ? dMatch[1] : null;
      if (did) {
        // Busca o post raiz da discussão
        const discHtml = await api.getHTML(BASE + '/mod/forum/discuss.php?d=' + did);
        const discDoc = api.parseHTML(discHtml);
        const replyLink = discDoc.querySelector('a[href*="reply="]');
        const replyMatch = replyLink ? replyLink.getAttribute('href').match(/reply=(\d+)/) : null;
        const replyid = replyMatch ? replyMatch[1] : null;
        if (replyid) {
          const replyParams = new URLSearchParams({
            reply: replyid,
            sesskey: api.sesskey,
            subject: 'Re: participação',
            message: mensagem,
            messageformat: '1',
            mform_isexpanded_id_messageeditable: '1',
          });
          const r = await fetch(BASE + '/mod/forum/post.php', {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: replyParams.toString(),
          });
          if (!r.ok) throw new Error('forum reply HTTP ' + r.status);
          return mensagem;
        }
      }
    }

    // Sem discussão existente: cria nova via formulário add
    const forumidMatch = viewHtml.match(/[?&]f=(\d+)|"forumid"\s*:\s*(\d+)|name="f"\s+value="(\d+)"/);
    const forumid = forumidMatch ? (forumidMatch[1] || forumidMatch[2] || forumidMatch[3]) : null;
    if (!forumid) throw new Error('não encontrei forumid na página');
    const addParams = new URLSearchParams({
      forum: forumid,
      sesskey: api.sesskey,
      subject: 'Participação',
      message: mensagem,
      messageformat: '1',
    });
    const r = await fetch(BASE + '/mod/forum/post.php', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: addParams.toString(),
    });
    if (!r.ok) throw new Error('forum add HTTP ' + r.status);
    return mensagem;
  }

  EA.completers = {
    marcarFeito, scorm, h5pactivity, url, visitaSimples, generico,
    assign, forum,
    // tipos completados só visitando
    visitaSimplesTipos: ['url', 'page', 'resource', 'imscp', 'folder', 'book', 'glossary', 'lesson'],
  };
})();

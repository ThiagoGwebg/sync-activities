// Sync Activities — activities.js
// Scraping de atividades a partir das seções / página do curso.
(function () {
  const EA = (window.__EA = window.__EA || {});
  const api = EA.api;

  function tipoDe(li) {
    const cl = li.className.split(' ');
    const tc = cl.find((c) => c.indexOf('modtype_') === 0);
    return tc ? tc.replace('modtype_', '') : 'unknown';
  }

  const SUFIXO = /\s+(Página|Arquivo|Pasta|Livro|URL|Lição|Questionário|Tarefa|Fórum|F[oó]rum|H5P|SCORM|Pacote SCORM|Conteúdo interativo|Glossário|Conteúdo do pacote IMS|Seção)$/i;

  function nomeDe(li, tipo, cmid) {
    // subseção: o nome vem do aria-label do toggle (o .instancename pega um filho)
    if (tipo === 'subsection') {
      const a = li.querySelector('a[aria-label]');
      if (a && a.getAttribute('aria-label')) return a.getAttribute('aria-label').trim().replace(/\s+/g, ' ');
      const hd = li.querySelector('.sectionname, h3, h4, h5');
      if (hd) return hd.textContent.trim().replace(/\s+/g, ' ');
    }
    const el = li.querySelector('.instancename, .activityname, .activity-name, .modname');
    let nome = '';
    if (el) {
      // remove spans escondidos (.accesshide) que carregam o rótulo do tipo
      const clone = el.cloneNode(true);
      clone.querySelectorAll('.accesshide, .visually-hidden, .sr-only').forEach((n) => n.remove());
      nome = clone.textContent.trim().replace(/\s+/g, ' ');
    }
    nome = nome.replace(SUFIXO, '').trim();
    return nome || tipo + ' #' + cmid;
  }

  function estadoDe(li) {
    let estado = -1;
    const ce = li.querySelector('[data-completionstate]');
    if (ce) estado = parseInt(ce.getAttribute('data-completionstate'));
    if (estado === -1 || estado === 0) {
      if (li.classList.contains('complete') || 
          li.querySelector('.completion-complete') || 
          li.querySelector('.complete') ||
          li.querySelector('.done')) {
        estado = 1;
      }
    }
    if (estado === -1 || estado === 0) {
      const badgeText = (li.textContent || '').toLowerCase();
      const keywords = ['concluído', 'concluido', 'feito', 'done', 'complete', 'passou', 'recebeu nota', 'nota recebida', 'grade received', 'submitted', 'enviado'];
      if (keywords.some(kw => badgeText.includes(kw))) {
        estado = 1;
      }
    }
    if (estado >= 1) return 1;
    if (estado === 0) return 0;
    return estado;
  }

  const activities = {
    // Lê uma URL de seção/curso e retorna [{cmid,modname,cs,nome}]
    async fromUrl(url) {
      let html;
      try {
        const res = await fetch(url, { credentials: 'include' });
        if (!res.ok) return [];
        html = await res.text();
      } catch (e) {
        return [];
      }
      if (!html) return [];
      const doc = api.parseHTML(html);
      const lista = [];

      [].slice.call(doc.querySelectorAll('li.activity[data-id]')).forEach((li) => {
        const cmid = parseInt(li.getAttribute('data-id'));
        if (!cmid) return;
        const tipo = tipoDe(li);
        lista.push({ cmid, modname: tipo, cs: estadoDe(li), nome: nomeDe(li, tipo, cmid) });
      });

      if (!lista.length) {
        [].slice.call(doc.querySelectorAll('[id^="module-"]')).forEach((li) => {
          const cmid = parseInt(li.id.replace('module-', ''));
          if (!cmid) return;
          const tipo = tipoDe(li);
          lista.push({ cmid, modname: tipo, cs: -1, nome: nomeDe(li, tipo, cmid) });
        });
      }
      return lista;
    },
  };

  EA.activities = activities;
})();

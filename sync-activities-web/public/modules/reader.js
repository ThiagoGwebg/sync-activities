// Sync Activities — reader.js
// Lê material de aula: páginas Moodle, PDFs e arquivos da semana.
(function () {
  const EA = (window.__EA = window.__EA || {});
  const api = EA.api;

  // Remove tags HTML e normaliza espaços
  function stripHTML(html) {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  // Extrai texto principal de uma página Moodle (região de conteúdo)
  function extrairConteudo(html) {
    const doc = api.parseHTML(html);
    // Tenta encontrar região de conteúdo principal
    const regioes = [
      '#region-main .box.generalbox',
      '#region-main .activity-description',
      '#region-main [role="main"]',
      '.course-content .sectionname',
      '#region-main',
      'main',
    ];
    for (const sel of regioes) {
      const el = doc.querySelector(sel);
      if (el) {
        const txt = el.textContent.replace(/\s{2,}/g, ' ').trim();
        if (txt.length > 80) return txt.substring(0, 4000);
      }
    }
    return stripHTML(html).substring(0, 4000);
  }

  // Lê texto de um PDF via pdf.js (se disponível) ou retorna null
  async function lerPDF(url) {
    try {
      const resp = await fetch(url, { credentials: 'include' });
      if (!resp.ok) return null;
      const buf = await resp.arrayBuffer();
      // Extrai texto bruto do PDF sem pdf.js (heurística simples)
      const bytes = new Uint8Array(buf);
      const str = new TextDecoder('latin1').decode(bytes);
      // Extrai strings entre parênteses (objetos de texto PDF)
      const matches = str.match(/\(([^\)\\]{4,200})\)/g) || [];
      const texto = matches
        .map((m) => m.slice(1, -1).replace(/\\n/g, '\n').replace(/\\r/g, '').replace(/\\\(/g, '(').replace(/\\\)/g, ')'))
        .filter((t) => /[a-zA-ZÀ-ÿ]{3,}/.test(t))
        .join(' ')
        .replace(/\s{2,}/g, ' ')
        .trim();
      return texto.length > 50 ? texto.substring(0, 3000) : null;
    } catch (e) {
      return null;
    }
  }

  // Lê o enunciado de uma tarefa (mod/assign/view.php)
  async function lerEnunciadoAssign(cmid) {
    try {
      const html = await api.getHTML(api.BASE + '/mod/assign/view.php?id=' + cmid);
      const doc = api.parseHTML(html);
      const desc = doc.querySelector('.box.generalbox, .assignmentintro, [data-region="activity-information"] .intro, .activity-description');
      if (desc) return desc.textContent.replace(/\s{2,}/g, ' ').trim().substring(0, 3000);
      return extrairConteudo(html);
    } catch (e) {
      return '';
    }
  }

  // Lê o enunciado de um fórum (mod/forum/view.php)
  async function lerEnunciadoForum(cmid) {
    try {
      const html = await api.getHTML(api.BASE + '/mod/forum/view.php?id=' + cmid);
      const doc = api.parseHTML(html);
      // Pega descrição do fórum + primeiro post (se houver)
      const partes = [];
      const intro = doc.querySelector('.generalbox.forumintro, .box.generalbox, .activity-description');
      if (intro) partes.push(intro.textContent.replace(/\s{2,}/g, ' ').trim());
      const post = doc.querySelector('.forumpost .posting, .post-message');
      if (post) partes.push(post.textContent.replace(/\s{2,}/g, ' ').trim());
      return partes.join('\n\n').substring(0, 3000) || extrairConteudo(html);
    } catch (e) {
      return '';
    }
  }

  // Lê material da aula: páginas e PDFs da semana (via URL da seção)
  async function lerMaterialDaSemana(sectionUrl) {
    if (!sectionUrl) return '';
    const textos = [];
    try {
      const html = await api.getHTML(sectionUrl);
      const doc = api.parseHTML(html);

      // Atividades do tipo "page" na seção
      const pageLinks = [];
      doc.querySelectorAll('li.activity.modtype_page a.aalink[href], li.activity.modtype_page .activityname a[href]').forEach((a) => {
        const href = a.getAttribute('href');
        if (href && href.includes('/mod/page/view.php')) pageLinks.push(href);
      });

      for (const link of pageLinks.slice(0, 3)) {
        try {
          const ph = await api.getHTML(link);
          const t = extrairConteudo(ph);
          if (t) textos.push('[Página] ' + t);
        } catch (e) {}
      }

      // Arquivos/PDFs
      const fileLinks = [];
      doc.querySelectorAll('li.activity.modtype_resource a.aalink[href], li.activity.modtype_resource .activityname a[href]').forEach((a) => {
        const href = a.getAttribute('href');
        if (href) fileLinks.push(href);
      });

      for (const link of fileLinks.slice(0, 2)) {
        try {
          // Segue redirect para o arquivo real
          const r = await fetch(link, { credentials: 'include' });
          const finalUrl = r.url;
          if (finalUrl.match(/\.pdf(\?|$)/i)) {
            const t = await lerPDF(finalUrl);
            if (t) textos.push('[PDF] ' + t);
          } else {
            const t = extrairConteudo(await r.text());
            if (t) textos.push('[Arquivo] ' + t);
          }
        } catch (e) {}
      }
    } catch (e) {}

    return textos.join('\n\n---\n\n').substring(0, 6000);
  }

  EA.reader = {
    lerEnunciadoAssign,
    lerEnunciadoForum,
    lerMaterialDaSemana,
    extrairConteudo,
  };
})();

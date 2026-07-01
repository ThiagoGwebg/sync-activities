// Sync Activities — courses.js
// Estrutura do portal: Home → disciplinas (competências) → cursos (bimestres) → semanas.
// Os webservices padrão do Moodle estão DESABILITADOS neste portal, então tudo
// é obtido via páginas HTML + o plugin customizado local_dimensions.
(function () {
  const EA = (window.__EA = window.__EA || {});
  const api = EA.api;

  const courses = {
    // ── Disciplinas (passo 1) ──────────────────────────────────────────────
    // Fonte oficial: o bloco "dimensions" da home (funciona de qualquer página).
    // Retorna [{id (=competencyid), name, url, color}]
    async listDisciplines() {
      try {
        const data = await api.call('block_dimensions_get_block_dataset', {});
        const cards = (data && data.competencycards) || [];
        if (cards.length) {
          return cards.map((c) => ({
            id: c.id,
            name: (c.name || 'Disciplina ' + c.id).trim(),
            url: c.url || (api.BASE + '/local/dimensions/view-competency.php?competencyid=' + c.id),
            color: c.bgcolor || null,
          }));
        }
      } catch (e) { /* fallback abaixo */ }
      // fallback: cursos da página atual como "disciplina única"
      const ids = fromDOM();
      if (ids.length) return [{ id: 0, name: 'Cursos desta página', url: '', _courseIds: ids }];
      return [];
    },

    // Cursos (bimestres) de uma disciplina — lidos da página da competência.
    async coursesOfDiscipline(disc) {
      if (disc._courseIds) return disc._courseIds;
      try {
        const html = await api.getHTML(disc.url);
        const doc = api.parseHTML(html);
        return [...new Set(
          [].slice.call(doc.querySelectorAll('[data-courseid]'))
            .map((e) => parseInt(e.dataset.courseid)).filter((n) => n > 1)
        )];
      } catch (e) { return []; }
    },

    // Nome do curso a partir do <h1> da página do curso.
    async nomeDaPagina(id) {
      try {
        const html = await api.getHTML(api.BASE + '/course/view.php?id=' + id);
        const doc = api.parseHTML(html);
        const h1 = doc.querySelector('.page-header-headings h1, #page-header h1, .page-context-header h1, h1.h2');
        let nome = h1 ? h1.textContent.trim().replace(/\s+/g, ' ') : '';
        if (!nome) {
          const t = (doc.querySelector('title') || {}).textContent || '';
          nome = t.replace(/^Disciplina:\s*/i, '').replace(/\s*\|.*$/, '').trim();
        }
        return nome || null;
      } catch (e) { return null; }
    },

    // Expande disciplinas selecionadas em [{id,name,progress}] (cursos por bimestre).
    async expandToCourses(discList, onProgress) {
      const courseSet = new Map();
      for (const d of discList) {
        const ids = await courses.coursesOfDiscipline(d);
        ids.forEach((id) => { if (!courseSet.has(id)) courseSet.set(id, { id, name: 'Curso ' + id, progress: null, discipline: d.name }); });
        if (onProgress) onProgress(d.name, ids.length);
      }
      const lista = [...courseSet.values()];
      // resolve nomes reais via <h1> (em paralelo)
      await Promise.all(lista.map(async (c) => {
        const nome = await courses.nomeDaPagina(c.id);
        if (nome) c.name = nome;
      }));
      return lista;
    },

    // Progresso detalhado (seções/semanas) via plugin local_dimensions
    async progress(ids) {
      try {
        const data = await api.call('local_dimensions_get_course_progress', { courseids: ids });
        return data || [];
      } catch (e) {
        return ids.map((id) => ({ courseid: id, sections: [], locked: false, _fallback: true }));
      }
    },
  };

  function fromDOM() {
    return [...new Set(
      [].slice.call(document.querySelectorAll('[data-courseid]'))
        .map((e) => parseInt(e.dataset.courseid)).filter((n) => n > 1)
    )];
  }

  EA.courses = courses;
})();

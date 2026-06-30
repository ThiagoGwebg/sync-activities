// Sync Activities — engine.js
// Orquestra scan e execução. Emite eventos para a UI (sem conhecer a UI).
(function () {
  const EA = (window.__EA = window.__EA || {});
  const api = EA.api;
  const courses = EA.courses;
  const activities = EA.activities;
  const completers = EA.completers;
  const store = EA.store;

  const REGISTRO_TIPOS = ['assign', 'forum', 'workshop'];
  const IGNORAR = ['label', 'unknown'];

  function emitter() {
    const handlers = {};
    return {
      on(ev, fn) { (handlers[ev] = handlers[ev] || []).push(fn); },
      emit(ev, payload) { (handlers[ev] || []).forEach((fn) => { try { fn(payload); } catch (e) {} }); },
    };
  }

  const engine = Object.assign(emitter(), {
    parado: false,
    rodando: false,
    model: { courses: [] },   // estado do dashboard

    stop() {
      this.parado = true;
      this.emit('log', { msg: 'parando após a atividade atual…', cls: 'wn' });
    },

    // Escaneia os cursos pedidos e popula this.model com atividades.
    // courseList: [{id,name,progress}]
    async scan(courseList) {
      this.emit('log', { msg: 'escaneando ' + courseList.length + ' curso(s)…', cls: 'in' });
      const prog = await courses.progress(courseList.map((c) => c.id));
      const progById = {};
      prog.forEach((p) => { progById[p.courseid] = p; });

      const model = { courses: [] };
      for (const c of courseList) {
        if (this.parado) break;
        const p = progById[c.id] || { sections: [], locked: false };
        const cursoModel = {
          id: c.id, name: c.name, progress: c.progress,
          locked: !!p.locked, lockedUntil: p.formatted_start_date || '',
          activities: [],
        };
        this.emit('scanCourse', { id: c.id, name: c.name });

        if (!p.locked) {
          const secoes = (p.sections || []).filter((s) => s.has_activities && s.url);
          if (secoes.length) {
            for (const s of secoes) {
              if (this.parado) break;
              const ativs = await activities.fromUrl(s.url);
              ativs.forEach((a) => cursoModel.activities.push(Object.assign({ section: s.name, sectionUrl: s.url, status: 'pendente' }, a, { status: a.cs === 1 ? 'feito' : 'pendente' })));
              await api.espera(150);
            }
          } else {
            const ativs = await activities.fromUrl(api.BASE + '/course/view.php?id=' + c.id);
            ativs.forEach((a) => cursoModel.activities.push(Object.assign({ section: '', status: a.cs === 1 ? 'feito' : 'pendente' }, a)));
          }
        }
        model.courses.push(cursoModel);
        this.emit('scanCourseDone', cursoModel);
      }
      this.model = model;
      this.emit('scanDone', model);
      return model;
    },

    // Decide se um tipo deve ser processado conforme config e modo de execução
    _permitido(tipo, cfg, runModes) {
      if (IGNORAR.indexOf(tipo) >= 0) return false;
      const isRegistro = REGISTRO_TIPOS.indexOf(tipo) >= 0;
      const isQuiz = tipo === 'quiz';
      const isAtividade = !isRegistro && !isQuiz;

      // Se runModes for fornecido como objeto (novo comportamento)
      if (runModes && typeof runModes === 'object') {
        if (isAtividade && !runModes.atividades) return false;
        if (isRegistro && (!runModes.registros || !cfg.registros.enabled)) return false;
        if (isQuiz && !runModes.quiz) return false;
      } else {
        // Fallback de compatibilidade
        const runMode = runModes || 'all';
        if (runMode === 'registros') return isRegistro && !!cfg.registros.enabled;
        if (runMode === 'quiz') return isQuiz;
        if (runMode === 'atividades') { if (isRegistro || isQuiz) return false; }
      }

      if (isAtividade) {
        if (tipo === 'scorm') return cfg.types.scorm;
        if (tipo === 'h5pactivity') return cfg.types.h5pactivity;
        if (tipo === 'url') return cfg.types.url;
        if (tipo === 'subsection') return cfg.types.subsection;
        if (completers.visitaSimplesTipos.indexOf(tipo) >= 0) return cfg.types[tipo] !== false;
        return cfg.types.generic;
      }

      return true;
    },

    async _processar(ativ, cfg) {
      const { cmid, modname: tipo } = ativ;

      // Atividade já concluída — pula sem contar como erro
      if (cfg.safeMode && ativ.cs === 1) return 'jafeito';
      if (ativ.status === 'feito') return 'jafeito';

      // Tipos que nunca devem ser processados
      if (IGNORAR.indexOf(tipo) >= 0) return 'pula';

      const onResp = (txt) => this.emit('log', { msg: '  resposta: "' + txt.substring(0, 40) + '"', cls: 'dm' });
      const tries = Math.max(1, cfg.retries);

      if (tipo === 'scorm') {
        await api.withRetry(() => completers.scorm(cmid), tries);
      } else if (tipo === 'h5pactivity') {
        await api.withRetry(() => completers.h5pactivity(cmid, onResp), tries);
      } else if (tipo === 'url') {
        await completers.url(cmid);
      } else if (tipo === 'subsection') {
        await completers.marcarFeito(cmid).catch(() => {});
      } else if (tipo === 'quiz') {
        await completers.visitaSimples('quiz', cmid);
      } else if (REGISTRO_TIPOS.indexOf(tipo) >= 0) {
        if (tipo === 'assign') await api.withRetry(() => completers.assign(cmid, ativ.sectionUrl), tries);
        else if (tipo === 'forum') await api.withRetry(() => completers.forum(cmid, ativ.sectionUrl), tries);
        else throw new Error('workshop ainda não suportado');
      } else if (completers.visitaSimplesTipos.indexOf(tipo) >= 0) {
        await api.withRetry(() => completers.visitaSimples(tipo, cmid), tries);
      } else {
        await api.withRetry(() => completers.generico(tipo, cmid), tries);
      }
      return 'ok';
    },

    // Executa as atividades selecionadas por cmid.
    // selectedCmids: Array<number> — cmids que o usuário explicitamente selecionou no Dashboard
    async run(selectedCmids) {
      if (this.rodando) return;
      this.rodando = true;
      this.parado = false;
      const cfg = await store.getConfig();

      const cmidsSet = new Set(selectedCmids);
      const fila = [];

      // Enfileira apenas as atividades selecionadas no Dashboard
      (this.model.courses || []).forEach((c) => {
        c.activities.forEach((a) => {
          if (cmidsSet.has(a.cmid)) {
            fila.push({ curso: c, ativ: a });
          }
        });
      });

      const total = fila.length;
      let feitos = 0, jafeito = 0, erros = 0, pulados = 0;
      this.emit('runStart', { total });

      for (let i = 0; i < fila.length; i++) {
        if (this.parado) { this.emit('log', { msg: 'parado pelo usuário', cls: 'wn' }); break; }
        const { curso, ativ } = fila[i];
        this.emit('runCourse', { name: curso.name });
        const label = '"' + (ativ.nome || ativ.modname).substring(0, 40) + '"';

        let res;
        try {
          this.emit('activityStart', { ativ, curso });
          res = await this._processar(ativ, cfg);
        } catch (e) {
          res = 'err';
          this.emit('log', { msg: '  falhou ' + label + ': ' + e.message, cls: 'er' });
        }

        if (res === 'ok') { feitos++; ativ.status = 'feito'; this.emit('log', { msg: '✓ ' + label, cls: 'ok' }); }
        else if (res === 'jafeito') { jafeito++; ativ.status = 'feito'; }
        else if (res === 'pula') { pulados++; ativ.status = 'pulado'; }
        else if (res === 'err') { erros++; ativ.status = 'erro'; }

        this.emit('activityDone', { ativ, res });
        this.emit('progress', { done: feitos + jafeito + erros + pulados, total, feitos, jafeito, erros, pulados });
        if (res === 'ok') await api.espera(cfg.delayMs);
      }

      this.rodando = false;
      const resumo = { feitos, jafeito, erros, pulados, total, parado: this.parado };
      await store.addHistory(resumo);
      this.emit('runDone', resumo);
      return resumo;
    },
  });

  EA.engine = engine;
})();

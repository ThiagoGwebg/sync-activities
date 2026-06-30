// Sync Activities — ui.js v4.0
// Painel flutuante redesenhado: layout moderno, filtros por tipo, modo de execução.
(function () {
  const EA = (window.__EA = window.__EA || {});
  const engine = EA.engine;
  const store = EA.store;
  const courses = EA.courses;

  const TIPO_LABEL = {
    scorm: 'SCORM', h5pactivity: 'H5P', url: 'URL', page: 'Página', resource: 'Arquivo',
    folder: 'Pasta', book: 'Livro', lesson: 'Lição', glossary: 'Glossário', imscp: 'IMS',
    subsection: 'Seção', quiz: 'Quiz', assign: 'Tarefa IA', forum: 'Fórum IA', workshop: 'Workshop',
    label: 'Rótulo', unknown: '—',
  };
  const TIPO_ICON = {
    scorm: '◆', h5pactivity: '⬡', url: '🔗', page: '📄', resource: '📎', folder: '📁',
    book: '📖', lesson: '📘', glossary: '📚', imscp: '◈', subsection: '▸',
    quiz: '❓', assign: '✏️', forum: '💬', workshop: '⚒', label: '—', unknown: '·',
  };

  // Categorias para filtro e modo de execução
  const CAT_REGISTRO = ['assign', 'forum', 'workshop'];
  const CAT_QUIZ = ['quiz'];
  const CAT_ATIVIDADE = ['scorm', 'h5pactivity', 'url', 'page', 'resource', 'folder', 'book', 'lesson', 'glossary', 'imscp', 'subsection', 'generic'];

  function catDe(tipo) {
    if (CAT_REGISTRO.indexOf(tipo) >= 0) return 'registro';
    if (CAT_QUIZ.indexOf(tipo) >= 0) return 'quiz';
    return 'atividade';
  }

  const STYLES = `
  :host{ all: initial; }
  *{ box-sizing:border-box; margin:0; padding:0; font-family:'Inter',ui-sans-serif,system-ui,-apple-system,sans-serif; }
  .wrap{
    position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:2147483647;
    display:grid; grid-template-rows: 70px 1fr 64px; grid-template-columns: 280px 1fr;
    color:var(--text); font-size:13px; background:var(--bg);
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    
    --bg:#0A0F1D; --bg2:#0E1527; --surface:rgba(255,255,255,0.03); --surface2:rgba(255,255,255,0.07);
    --border:rgba(255,255,255,0.08); --border2:rgba(255,255,255,0.16);
    --c1:#3B82F6; --c2:#8B5CF6; --grad:linear-gradient(135deg,#2563EB,#7C3AED);
    --text:#ECF0F7; --text2:#94A3B8; --muted:#64748B; --green:#10B981; --red:#EF4444; --amber:#F59E0B; --purple:#8B5CF6;
    --glow:rgba(59,130,246,0.3);
    --cat-reg:#F97316; --cat-quiz:#8B5CF6; --cat-atv:#06B6D4;
  }
  .wrap.cyan{ --c1:#06B6D4; --c2:#0EA5E9; --grad:linear-gradient(135deg,#0891B2,#0284C7); --glow:rgba(6,182,212,0.3); }
  .wrap.verde{ --c1:#10B981; --c2:#059669; --grad:linear-gradient(135deg,#059669,#10B981); --glow:rgba(16,185,129,0.3); }
  
  /* Minimized Mode Styling */
  .wrap.min {
    width: 280px; height: 60px;
    top: auto; left: auto; bottom: 20px; right: 20px;
    border-radius: 16px; border: 1px solid var(--border);
    box-shadow: 0 10px 40px -10px rgba(0,0,0,0.8);
    display: flex !important; grid-template-rows: none; grid-template-columns: none;
    background: rgba(10, 15, 29, 0.95); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
    overflow: hidden;
  }
  .wrap.min .main-header,
  .wrap.min .sidebar,
  .wrap.min .body-container,
  .wrap.min .foot,
  .wrap.min .detail {
    display: none !important;
  }
  .wrap.min .min-bar {
    display: flex !important; width: 100%; height: 100%;
    align-items: center; justify-content: space-between; padding: 0 16px;
  }
  .min-bar { display: none; }

  /* ── HEADER ── */
  .main-header{ grid-column: 1 / -1; display:flex; align-items:center; justify-content:space-between; padding:0 24px; border-bottom:1px solid var(--border); background:rgba(255,255,255,0.01); }
  .htitle{ display:flex; align-items:center; gap:12px; }
  .logo{ width:36px; height:36px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:18px; font-weight:900; color:#fff; background:var(--grad); box-shadow:0 4px 18px var(--glow); animation:pulse-logo 4s ease-in-out infinite; }
  @keyframes pulse-logo { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
  .tw{ display:flex; flex-direction:column; gap:2px; }
  .name{ font-size:15px; font-weight:800; letter-spacing:-.02em; line-height:1; }
  .name b{ background:var(--grad); -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; }
  .name .badge-v { font-size: 10px; background: rgba(255,255,255,0.06); padding: 1px 5px; border-radius: 6px; color: var(--text2); font-weight: 500; margin-left: 4px; }
  .sub{ display:flex; align-items:center; gap:6px; font-size:11px; color:var(--muted); }
  .dot{ width:7px; height:7px; border-radius:50%; background:var(--muted); transition:.3s; }
  .dot.run{ background:var(--c2); box-shadow:0 0 10px var(--c2); animation:pulse 1s ease-in-out infinite; }
  .dot.ok{ background:var(--green); box-shadow:0 0 10px var(--green); }
  .dot.err{ background:var(--red); box-shadow:0 0 10px var(--red); }
  @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(.65)}}
  .header-center { font-size: 12px; font-weight: 600; color: var(--text2); border: 1px solid var(--border); padding: 6px 14px; border-radius: 20px; background: rgba(255,255,255,0.01); }
  .hbtns{ display:flex; gap:8px; }
  .ico{ width:32px; height:32px; border:1px solid var(--border); border-radius:10px; background:var(--surface); color:var(--text2); cursor:pointer; font-size:14px; display:flex; align-items:center; justify-content:center; transition:.15s; }
  .ico:hover{ background:var(--surface2); border-color:var(--border2); color:var(--text); }
  .ico.x:hover{ background:rgba(255,77,106,0.14); border-color:rgba(255,77,106,0.3); color:var(--red); }

  /* ── SIDEBAR ── */
  .sidebar { grid-column: 1; border-right:1px solid var(--border); background:rgba(0, 0, 0, 0.12); display:flex; flex-direction:column; justify-content:space-between; padding:24px 16px; }
  .sidebar-menu { display:flex; flex-direction:column; gap:8px; }
  .stp { display:flex; align-items:center; gap:12px; padding:12px 16px; border-radius:12px; cursor:pointer; opacity:0.5; transition:all 0.2s ease; border:1px solid transparent; }
  .stp:hover { opacity:0.8; background:var(--surface); }
  .stp.on { opacity:1; background:var(--surface2); border-color:var(--border); border-left: 3px solid var(--c1); }
  .stp i { width:26px; height:26px; border-radius:50%; border:1.5px solid var(--border2); display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:800; font-style:normal; color:var(--text2); transition:.2s; flex-shrink:0; }
  .stp.on i { background:var(--grad); border-color:transparent; color:#fff; box-shadow:0 2px 10px var(--glow); }
  .stp.done i { background:rgba(16,185,129,0.1); border-color:var(--green); color:var(--green); }
  .stp-text { display:flex; flex-direction:column; gap:1px; }
  .stp-text span { font-weight:600; font-size:13px; }
  .stp-text small { font-size:10px; color:var(--muted); }
  
  .sidebar-footer { border-top: 1px solid var(--border); padding-top: 16px; }
  .quick-stats { display: flex; justify-content: space-between; gap: 8px; }
  .qs-item { flex: 1; background: var(--surface); padding: 8px; border-radius: 10px; text-align: center; border: 1px solid var(--border); }
  .qs-val { display: block; font-size: 16px; font-weight: 700; color: var(--c2); }
  .qs-lbl { font-size: 9px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }

  /* ── BODY ── */
  .body-container { grid-column: 2; overflow-y:auto; padding:28px 36px; background:var(--bg2); }
  .body-container::-webkit-scrollbar{ width:6px; } .body-container::-webkit-scrollbar-thumb{ background:rgba(255,255,255,0.08); border-radius:6px; }
  .pane{ display:none; } .pane.on{ display:block; animation:fade .25s ease; }
  @keyframes fade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}

  /* ── STEP 1: DISCIPLINAS ── */
  .p1-inner{ max-width: 1000px; margin: 0 auto; }
  .bar{ display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }
  .bar h4{ font-size:12px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:.08em; }
  .link{ font-size:12px; color:var(--c2); cursor:pointer; background:none; border:none; font-weight:700; transition:.15s; padding:0; }
  .link:hover{ opacity:.8; }

  .disc-card{ display:flex; flex-direction:column; margin-bottom:10px; background:var(--surface); border:1px solid var(--border); border-radius:16px; overflow:hidden; transition:all .2s cubic-bezier(0.4, 0, 0.2, 1); position: relative; }
  .disc-card:hover{ border-color:var(--border2); transform: translateY(-2px); box-shadow: 0 10px 25px -10px rgba(0,0,0,0.6); }
  .disc-card.sel{ border-color:rgba(59,130,246,0.3); background:rgba(59,130,246,0.04); }
  .disc-card.sel::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: var(--grad); box-shadow: 2px 0 10px var(--glow); }
  
  .disc-row{ display:flex; align-items:center; gap:14px; padding:16px 20px; cursor:pointer; }
  .disc-ck{ width:20px; height:20px; border-radius:7px; border:1.5px solid var(--border2); display:flex; align-items:center; justify-content:center; font-size:11px; color:transparent; transition:.12s; flex-shrink:0; }
  .disc-ck.on{ background:var(--grad); border-color:transparent; color:#fff; }
  .disc-icon{ font-size:20px; flex-shrink:0; }
  .disc-body{ flex:1; min-width:0; }
  .disc-name{ font-size:14px; font-weight:600; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .disc-meta{ font-size:11px; color:var(--muted); margin-top:3px; }
  .disc-expbtn{ background:none; border:none; color:var(--muted); cursor:pointer; font-size:13px; padding:6px; transition:.2s; flex-shrink:0; border-radius:8px; }
  .disc-expbtn:hover{ color:var(--c2); background:var(--surface2); }
  .disc-expbtn.open{ transform:rotate(90deg); color:var(--c2); }
  .disc-expand{ padding:14px 20px 20px 54px; border-top:1px solid var(--border); background:rgba(0,0,0,0.2); }
  .exp-loading{ font-size:12px; color:var(--muted); }
  .exp-course{ margin-bottom:12px; }
  .exp-cname{ font-size:12.5px; font-weight:700; color:var(--c2); cursor:pointer; margin-bottom:6px; display:flex; align-items:center; gap:8px; }
  .exp-cname:hover{ text-decoration:underline; }
  .exp-cname .ecnt{ font-size:10px; color:var(--muted); font-weight:500; background:var(--surface2); padding:2px 8px; border-radius:8px; }
  .exp-week{ display:flex; align-items:center; gap:8px; padding:4px 0; font-size:12px; color:var(--muted); }
  .exp-wdot{ width:6px; height:6px; border-radius:50%; background:var(--border2); flex-shrink:0; }
  .exp-wdot.done{ background:var(--green); }
  .exp-wname{ flex:1; color:var(--text2); line-height:1.35; }
  .exp-wpct{ font-size:11px; background:var(--surface2); padding:1px 6px; border-radius:7px; flex-shrink:0; }

  /* ── STEP 2: DASHBOARD ── */
  .p2-inner{ max-width: 1000px; margin: 0 auto; }
  .filter-row{ display:flex; gap:8px; margin-bottom:14px; flex-wrap:wrap; }
  .ftag{ font-size:11px; font-weight:700; padding:6px 12px; border-radius:20px; border:1px solid var(--border); background:var(--surface); color:var(--muted); cursor:pointer; transition:.15s; }
  .ftag:hover{ border-color:var(--border2); color:var(--text2); }
  .ftag.on{ border-color:transparent; color:#fff; }
  .ftag.on.f-all{ background:linear-gradient(135deg,var(--c1),var(--c2)); }
  .ftag.on.f-atv{ background:linear-gradient(135deg,#06B6D4,#0EA5E9); }
  .ftag.on.f-reg{ background:linear-gradient(135deg,#F97316,#FFA940); }
  .ftag.on.f-quiz{ background:linear-gradient(135deg,#8B5CF6,#A78BFA); }
  .ftag.on.f-pen{ background:linear-gradient(135deg,#4B5563,#6B7280); }
  .ftag.on.f-done{ background:linear-gradient(135deg,#047857,#10B981); }
  .ftag .fc{ display:inline-block; font-size:10px; opacity:.8; margin-left:4px; }

  .cgroup{ margin-bottom:24px; background: rgba(0,0,0,0.1); padding: 18px; border-radius: 18px; border: 1px solid var(--border); }
  .cg-head{ display:flex; align-items:center; gap:10px; margin-bottom:16px; }
  .cg-icon{ font-size:16px; }
  .cg-name{ font-size:14px; font-weight:800; color:var(--text); flex:1; }
  .cg-count{ font-size:11px; color:var(--muted); background:var(--surface2); padding:3px 10px; border-radius:8px; flex-shrink:0; }
  .week-block{ margin-bottom:16px; padding-left:14px; border-left:2.5px solid rgba(255,255,255,0.07); }
  .week-block.has-reg{ border-left-color:rgba(249,115,22,0.35); }
  .week-block.has-quiz{ border-left-color:rgba(139,92,246,0.35); }
  .wk-title{ font-size:11.5px; font-weight:700; color:var(--c2); margin-bottom:8px; display:flex; align-items:center; gap:8px; }
  .wk-title em{ font-style:normal; font-size:10.5px; color:var(--muted); background:var(--surface2); padding:1px 6px; border-radius:7px; margin-left:auto; }

  .acard{ display:flex; align-items:center; gap:10px; padding:10px 14px; margin-bottom:6px; border-radius:12px; border:1px solid var(--border); background: rgba(255,255,255,0.01); transition:all 0.15s ease; cursor:pointer; }
  .acard:hover{ background:var(--surface); border-color:var(--border2); transform: translateX(2px); }
  .acard.done{ opacity:.65; background: rgba(16,185,129,0.01); }
  
  .acard-ck{ width:18px; height:18px; border-radius:6px; border:1.5px solid var(--border2); display:flex; align-items:center; justify-content:center; font-size:10px; color:transparent; transition:.12s; flex-shrink:0; }
  .acard-ck.on{ background:var(--grad); border-color:transparent; color:#fff; box-shadow:0 2px 8px var(--glow); }
  .acard.sel{ border-color:rgba(59,130,246,0.3); background:rgba(59,130,246,0.03); }

  .acard .aico{ width:28px; height:28px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:13px; flex-shrink:0; }
  .aico.cat-atv{ background:rgba(6,182,210,0.1); color:#06B6D4; }
  .aico.cat-reg{ background:rgba(249,115,22,0.12); color:#F97316; }
  .aico.cat-quiz{ background:rgba(139,92,246,0.12); color:#8B5CF6; }
  .acard .abody{ flex:1; min-width:0; }
  .acard .aname{ font-size:12.5px; font-weight:500; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .acard .ameta{ font-size:10px; color:var(--muted); margin-top:2px; display:flex; align-items:center; gap:5px; }
  .acat{ font-size:9.5px; font-weight:700; padding:1px 6px; border-radius:6px; }
  .acat.cat-atv{ background:rgba(6,182,210,0.12); color:#06B6D4; }
  .acat.cat-reg{ background:rgba(249,115,22,0.12); color:#F97316; }
  .acat.cat-quiz{ background:rgba(139,92,246,0.12); color:#8B5CF6; }
  .abadge{ font-size:9.5px; font-weight:700; padding:2px 8px; border-radius:7px; flex-shrink:0; text-transform:uppercase; letter-spacing:0.02em; }
  .abadge.feito{ background:rgba(16,185,129,0.12); color:var(--green); }
  .abadge.pendente{ background:var(--surface2); color:var(--muted); }
  .abadge.erro{ background:rgba(239,68,68,0.12); color:var(--red); }
  .abadge.pulado{ background:rgba(245,158,11,0.12); color:var(--amber); }

  /* ── STEP 3: LOG & CONSOLE ── */
  .p3-inner{ max-width: 1000px; margin: 0 auto; height:100%; display:flex; flex-direction:column; }
  .console-wrapper { border: 1px solid var(--border); border-radius: 16px; background: rgba(0,0,0,0.25); display: flex; flex-direction: column; overflow: hidden; height: 500px; }
  .console-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 18px; border-bottom: 1px solid var(--border); background: rgba(255,255,255,0.01); }
  .console-header span { font-weight: 700; font-size: 12px; text-transform: uppercase; color: var(--c2); letter-spacing: 0.05em; }
  .btn-clear-log { background: var(--surface); border: 1px solid var(--border); color: var(--text2); padding: 4px 10px; border-radius: 8px; cursor: pointer; font-size: 11px; font-weight: 600; transition: .15s; }
  .btn-clear-log:hover { border-color: var(--border2); color: var(--text); }
  .log{ font-family:'Geist Mono',ui-monospace,monospace; font-size:11px; line-height:2.2; color:var(--text2); padding: 18px; overflow-y:auto; flex: 1; }
  .log-row{ display:flex; gap:10px; animation:fade .18s ease; padding:0; }
  .ts{ color:var(--muted); opacity:.55; flex-shrink:0; font-size:10.5px; }
  .ok{ color:var(--green); } .er{ color:var(--red); } .in{ color:var(--c2); } .wn{ color:var(--amber); } .dm{ color:var(--muted); }

  /* ── STEP 4: CONFIGS ── */
  .p4-inner { max-width: 750px; margin: 0 auto; }
  .config-container { display: flex; flex-direction: column; gap: 18px; }
  .config-container h2 { font-size: 16px; font-weight: 700; color: var(--text); border-bottom: 1px solid var(--border); padding-bottom: 10px; }
  .field{ margin-bottom:4px; }
  .flabel{ display:flex; justify-content:space-between; align-items:center; font-size:11.5px; color:var(--text2); margin-bottom:8px; font-weight:600; }
  .flabel b{ color:var(--c2); font-weight:700; }
  .flabel a{ color:var(--c2); font-size:10.5px; }
  input[type=range]{ width:100%; accent-color:var(--c1); height:4px; }
  input[type=password],input[type=text]{ width:100%; background:rgba(0,0,0,0.3); border:1px solid var(--border); border-radius:9px; color:var(--text); font-size:12px; padding:10px 12px; font-family:monospace; transition:.15s; }
  input[type=password]:focus,input[type=text]:focus{ border-color:var(--c1); outline:none; }
  .seg{ font-size:10px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:.1em; margin:16px 0 8px; }
  .toggles{ display:flex; flex-wrap:wrap; gap:7px; }
  .tg{ font-size:11px; font-weight:600; padding:6px 12px; border-radius:9px; border:1px solid var(--border); background:var(--surface); color:var(--muted); cursor:pointer; transition:.15s; }
  .tg.on{ background:rgba(59,130,246,0.12); border-color:rgba(59,130,246,0.3); color:var(--c2); }
  .tg.reg.on{ background:rgba(249,115,22,0.12); border-color:rgba(249,115,22,0.3); color:var(--cat-reg); }
  .switch{ display:flex; align-items:center; justify-content:space-between; padding:12px 14px; background:var(--surface); border:1px solid var(--border); border-radius:12px; }
  .switch span{ font-size:12px; color:var(--text2); font-weight:500; }
  .sw{ width:38px; height:22px; border-radius:22px; background:rgba(255,255,255,0.1); position:relative; cursor:pointer; transition:.2s; flex-shrink:0; }
  .sw::after{ content:''; position:absolute; top:2px; left:2px; width:18px; height:18px; border-radius:50%; background:#fff; transition:.2s; }
  .sw.on{ background:var(--grad); } .sw.on::after{ transform:translateX(16px); }
  .warn{ font-size:11.5px; color:var(--amber); background:rgba(245,158,11,0.06); border:1px solid rgba(245,158,11,0.16); border-radius:10px; padding:12px; margin-bottom:4px; line-height:1.6; }
  .swatches{ display:flex; gap:9px; }
  .swatch{ flex:1; height:38px; border-radius:10px; border:2px solid transparent; cursor:pointer; transition:.15s; }
  .swatch.on{ border-color:#fff; box-shadow:0 0 12px rgba(255,255,255,0.25); }
  .obtn{ width:100%; padding:12px; border-radius:11px; border:1px solid var(--border); background:var(--surface); color:var(--text2); font-size:12.5px; font-weight:600; cursor:pointer; transition:.15s; margin-top:6px; }
  .obtn:hover{ border-color:var(--red); color:var(--red); }

  /* ── DETAIL OVERLAY (curso → atividades) ── */
  .detail{ position:absolute; inset:0; background:var(--bg); z-index:100; display:flex; flex-direction:column; transform:translateX(100%); transition:transform .3s cubic-bezier(.16,1,.3,1); }
  .detail.on{ transform:none; }
  .dhead{ display:flex; align-items:center; gap:12px; padding:16px 20px; border-bottom:1px solid var(--border); flex-shrink:0; }
  .dback{ background:var(--surface); border:1px solid var(--border); border-radius:8px; width:30px; height:30px; display:flex; align-items:center; justify-content:center; cursor:pointer; color:var(--text2); font-size:18px; flex-shrink:0; transition:.15s; }
  .dback:hover{ border-color:var(--border2); color:var(--text); }
  .dhead-info{ flex:1; min-width:0; }
  .dhead-title{ font-size:14px; font-weight:800; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .dhead-sub{ font-size:11px; color:var(--muted); margin-top:2px; }
  .dbody{ flex:1; overflow-y:auto; padding:20px; }
  .dbody::-webkit-scrollbar{ width:5px; } .dbody::-webkit-scrollbar-thumb{ background:rgba(255,255,255,0.1); border-radius:5px; }
  .d-filter{ display:flex; gap:6px; margin-bottom:14px; }
  .dloading{ text-align:center; color:var(--muted); font-size:13px; padding:40px 0; }
  .dweek{ margin-bottom:16px; }
  .dw-head{ display:flex; align-items:center; gap:10px; padding:8px 12px; border-radius:10px; cursor:pointer; transition:.15s; margin-bottom:6px; }
  .dw-head:hover{ background:var(--surface); }
  .dw-ck{ width:18px; height:18px; border-radius:5px; border:1.5px solid var(--border2); display:flex; align-items:center; justify-content:center; font-size:10px; color:transparent; transition:.12s; flex-shrink:0; }
  .dw-ck.on{ background:var(--grad); border-color:transparent; color:#fff; }
  .dw-name{ font-size:12px; font-weight:700; color:var(--c2); flex:1; line-height:1.35; }
  .dw-cnt{ font-size:10px; color:var(--muted); background:var(--surface2); padding:2px 8px; border-radius:8px; flex-shrink:0; }
  
  .datv{ display:flex; align-items:center; gap:10px; padding:8px 12px; border-radius:10px; cursor:pointer; transition:.15s; margin-bottom:3px; }
  .datv:hover{ background:var(--surface); }
  .datv.done-atv{ opacity:.55; }
  .da-ck{ width:18px; height:18px; border-radius:5px; border:1.5px solid var(--border2); display:flex; align-items:center; justify-content:center; font-size:10px; color:transparent; transition:.12s; flex-shrink:0; }
  .da-ck.on{ background:var(--grad); border-color:transparent; color:#fff; }
  .da-ico{ width:26px; height:26px; border-radius:7px; display:flex; align-items:center; justify-content:center; font-size:13px; flex-shrink:0; }
  .da-body{ flex:1; min-width:0; }
  .da-name{ font-size:12.5px; font-weight:500; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .da-meta{ font-size:10px; color:var(--muted); margin-top:2px; display:flex; align-items:center; gap:5px; }
  .da-done-badge{ font-size:10px; color:var(--green); flex-shrink:0; font-weight:700; }
  .dfoot{ padding:16px 20px; border-top:1px solid var(--border); display:flex; gap:12px; align-items:center; flex-shrink:0; }
  .dsel-info{ flex:1; font-size:12px; color:var(--muted); }
  .dsel-info b{ color:var(--c2); }
  .dbtn{ padding:11px 20px; border-radius:11px; border:none; color:#fff; background:var(--grad); font-size:12px; font-weight:700; cursor:pointer; transition:.15s; box-shadow:0 4px 16px -4px var(--glow); }
  .dbtn:hover{ opacity:.9; transform:translateY(-1px); }

  /* ── FOOTER ── */
  .foot{ grid-column: 1 / -1; display:flex; align-items:center; justify-content:space-between; padding:0 24px; border-top:1px solid var(--border); background:rgba(0,0,0,0.25); }
  .foot-left { display: flex; align-items: center; gap: 12px; }
  .mode-label { font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
  .mode-row { display: flex; gap: 6px; }
  .mode-btn{ padding:8px 12px; border-radius:9px; border:1px solid var(--border); background:var(--surface); color:var(--muted); font-size:11px; font-weight:700; cursor:pointer; transition:.15s; text-align:center; line-height:1.2; }
  .mode-btn:hover{ border-color:var(--border2); color:var(--text2); }
  .mode-btn.on{ color:#fff; border-color:transparent; }
  .mode-btn.m-atv.on{ background:linear-gradient(135deg,#06B6D4,#0EA5E9); box-shadow:0 3px 12px -3px rgba(6,182,212,0.4); }
  .mode-btn.m-reg.on{ background:linear-gradient(135deg,#F97316,#FFA940); box-shadow:0 3px 12px -3px rgba(249,115,22,0.4); }
  .mode-btn.m-quiz.on{ background:linear-gradient(135deg,#8B5CF6,#A78BFA); box-shadow:0 3px 12px -3px rgba(139,92,246,0.4); }
  
  .foot-center { flex: 1; max-width: 400px; margin: 0 40px; }
  .progress-info { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
  .plbl{ font-size:9.5px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:.08em; }
  .pct{ font-size:12px; font-weight:700; color:var(--c2); }
  .pbar{ height:7px; background:rgba(255,255,255,0.05); border-radius:6px; overflow:hidden; box-shadow: inset 0 1px 2px rgba(0,0,0,0.5); }
  .pbar>i{ display:block; height:100%; width:0%; border-radius:6px; background:linear-gradient(90deg,var(--c1),var(--c2)); background-size:200% 100%; transition:width .4s cubic-bezier(.4,0,.2,1); animation:flow 2.5s linear infinite; box-shadow: 0 0 8px var(--glow); }
  @keyframes flow{0%{background-position:0 0}100%{background-position:200% 0}}
  
  .foot-right { display: flex; align-items: center; gap: 18px; }
  .stats { display: flex; gap: 8px; }
  .st{ text-align:center; padding:5px 12px; background:var(--surface); border:1px solid var(--border); border-radius:10px; min-width:60px; }
  .st b{ display:block; font-size:16px; font-weight:700; font-variant-numeric:tabular-nums; line-height:1; }
  .st small{ font-size:9px; color:var(--muted); display:block; margin-top:2px; }
  .st.green b{ color:var(--green); } .st.red b{ color:var(--red); }
  
  .acts{ display:flex; gap:8px; }
  .btn{ padding:10px 18px; border-radius:10px; border:1px solid var(--border); background:var(--surface); color:var(--text2); font-size:12px; font-weight:700; cursor:pointer; transition:.18s; }
  .btn.go{ border:none; color:#fff; background:var(--grad); box-shadow:0 4px 14px -3px var(--glow); }
  .btn.go:hover{ transform:translateY(-1.5px); box-shadow:0 6px 18px -3px var(--glow); }
  .btn.go:disabled{ opacity:.4; cursor:not-allowed; transform:none; box-shadow:none; }
  .btn.stop{ }
  .btn.stop:hover{ border-color:rgba(255,77,106,0.4); color:var(--red); }

  .empty{ text-align:center; color:var(--muted); font-size:13px; padding:60px 18px; line-height:1.9; }
  .empty .big{ font-size:36px; margin-bottom:12px; opacity:.45; }
  .empty b{ color:var(--text2); }
  `;

  const ui = {
    host: null, root: null, el: {},
    step: 1,
    courseList: [],
    selected: new Set(),
    expanded: new Set(),
    previewData: {},
    filters: { tipo: 'todos', status: 'todos' },
    cfg: null, mounted: false, scanned: false,
    // detail panel
    detailCourse: null,
    detailWeeks: [],
    detailSel: new Set(),
    detailFilter: 'todos',
    skippedCmids: new Set(),
    
    // New structures for multi-selection
    selectedCmids: new Set(),
    runModes: { atividades: true, registros: false, quiz: false },

    async mount() {
      if (this.mounted) return;
      this.mounted = true;
      this.cfg = await store.getConfig();
      
      // Carrega os runModes salvos na config
      this.runModes = Object.assign({}, this.cfg.runModes);

      this.host = document.createElement('div');
      this.host.id = '__syncactivities_host';
      document.documentElement.appendChild(this.host);
      this.root = this.host.attachShadow({ mode: 'open' });

      const f1 = document.createElement('link'); f1.rel = 'stylesheet';
      f1.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Geist+Mono:wght@400;500&display=swap';
      this.root.appendChild(f1);

      const style = document.createElement('style'); style.textContent = STYLES;
      this.root.appendChild(style);

      const wrap = document.createElement('div');
      wrap.className = 'wrap ' + (this.cfg.theme || 'sync');
      wrap.innerHTML = this._shell();
      this.root.appendChild(wrap);
      this.el.wrap = wrap;

      this._cache(); this._bind(); this._bindEngine();
      
      // Sincroniza estado visual inicial dos botões com os runModes carregados
      this.root.querySelectorAll('[data-mode]').forEach((b) => {
        const mode = b.getAttribute('data-mode');
        b.classList.toggle('on', !!this.runModes[mode]);
      });

      this.renderCursos(); this.goto(1);
      if (this.cfg.autoCollapse) wrap.classList.add('min');
      this.log('pronto — busque seus cursos pra começar', 'dm');
    },

    _shell() {
      return `
      <!-- Minimized Mode View -->
      <div class="min-bar">
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="dot" data-dot></span>
          <div style="display:flex; flex-direction:column;">
            <span style="font-weight:700; font-size:12px; color:var(--text)">Sync Activities</span>
            <span style="font-size:10px; color:var(--text2);" data-status>ocioso</span>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:12px;">
          <span style="font-size:11px; font-weight:700; color:var(--c2);" data-pct>0%</span>
          <button class="ico" data-expand title="Maximizar" style="border-radius:50%; width:28px; height:28px; padding:0; display:flex; align-items:center; justify-content:center;">⤢</button>
        </div>
      </div>

      <!-- Full Screen Mode View -->
      <div class="main-header">
        <div class="htitle">
          <div class="logo">S</div>
          <div class="tw">
            <div class="name">Sync <b>Activities</b> <span class="badge-v">v4.0</span></div>
            <div class="sub">
              <span class="dot" data-dot></span>
              <span data-status>ocioso</span>
            </div>
          </div>
        </div>
        
        <div class="header-center">
          <span class="portal-tag">Mapeador do Portal Educação Profissional Paulista</span>
        </div>

        <div class="hbtns">
          <button class="ico" data-min title="Minimizar">—</button>
          <button class="ico x" data-close title="Fechar Extensão">✕</button>
        </div>
      </div>

      <div class="sidebar">
        <div class="sidebar-menu">
          <div class="stp on" data-step="1">
            <i>1</i>
            <div class="stp-text">
              <span>Disciplinas</span>
              <small>Listar e Escanear</small>
            </div>
          </div>
          <div class="stp" data-step="2">
            <i>2</i>
            <div class="stp-text">
              <span>Dashboard</span>
              <small>Árvore de Atividades</small>
            </div>
          </div>
          <div class="stp" data-step="3">
            <i>3</i>
            <div class="stp-text">
              <span>Executar</span>
              <small>Console em Tempo Real</small>
            </div>
          </div>
          <div class="stp" data-step="4">
            <i>4</i>
            <div class="stp-text">
              <span>Configurações</span>
              <small>Ajustes e Chaves</small>
            </div>
          </div>
        </div>
        
        <div class="sidebar-footer">
          <div class="quick-stats">
            <div class="qs-item">
              <span class="qs-val" data-s-cur>0</span>
              <span class="qs-lbl">Disciplinas</span>
            </div>
            <div class="qs-item">
              <span class="qs-val" data-s-ativ>0</span>
              <span class="qs-lbl">Atividades</span>
            </div>
          </div>
        </div>
      </div>

      <div class="body-container">
        <div class="pane on" data-pane="1">
          <div class="p1-inner" data-p1></div>
        </div>
        <div class="pane" data-pane="2">
          <div class="p2-inner" data-p2></div>
        </div>
        <div class="pane" data-pane="3">
          <div class="p3-inner">
            <div class="console-wrapper">
              <div class="console-header">
                <span>Terminal Log</span>
                <button class="btn-clear-log" data-clear-log>Limpar Console</button>
              </div>
              <div class="log" data-log></div>
            </div>
          </div>
        </div>
        <div class="pane" data-pane="4">
          <div class="p4-inner" data-p4></div>
        </div>
      </div>

      <div class="foot">
        <div class="foot-left">
          <div class="mode-label">Filtros de Execução:</div>
          <div class="mode-row" data-moderow>
            <button class="mode-btn m-atv on" data-mode="atividades">Atividades</button>
            <button class="mode-btn m-reg" data-mode="registros">✏ Registros</button>
            <button class="mode-btn m-quiz" data-mode="quiz">❓ Quiz</button>
          </div>
        </div>
        
        <div class="foot-center">
          <div class="progress-info">
            <span class="plbl">Progresso</span>
            <span class="pct" data-pct>0%</span>
          </div>
          <div class="pbar"><i data-pbar></i></div>
        </div>

        <div class="foot-right">
          <div class="stats">
            <div class="st green"><b data-s-ok>0</b><small>Feitas</small></div>
            <div class="st red"><b data-s-err>0</b><small>Erros</small></div>
          </div>
          <div class="acts">
            <button class="btn go" data-go>🔍 Buscar disciplinas</button>
            <button class="btn stop" data-stop>Parar</button>
          </div>
        </div>
      </div>

      <div class="detail" data-detail>
        <div class="dhead">
          <div class="dback" data-detail-close>‹</div>
          <div class="dhead-info">
            <div class="dhead-title" data-detail-title>Curso</div>
            <div class="dhead-sub" data-detail-sub></div>
          </div>
        </div>
        <div class="dbody">
          <div class="d-filter" data-dfilter></div>
          <div data-detail-body></div>
        </div>
        <div class="dfoot">
          <span class="dsel-info">Selecionadas: <b data-detail-selcount>0</b></span>
          <button class="dbtn" data-detail-confirm>Confirmar →</button>
        </div>
      </div>`;
    },

    _cache() {
      const q = (s) => this.root.querySelector(s);
      this.el.p1 = q('[data-p1]'); this.el.p2 = q('[data-p2]'); this.el.log = q('[data-log]');
      this.el.dot = q('[data-dot]'); this.el.status = q('[data-status]');
      this.el.pct = q('[data-pct]'); this.el.pbar = q('[data-pbar]');
      this.el.sCur = q('[data-s-cur]'); this.el.sAtiv = q('[data-s-ativ]');
      this.el.sOk = q('[data-s-ok]'); this.el.sErr = q('[data-s-err]');
      this.el.go = q('[data-go]'); this.el.stop = q('[data-stop]');
      this.el.detail = q('[data-detail]');
      this.el.detailTitle = q('[data-detail-title]');
      this.el.detailSub = q('[data-detail-sub]');
      this.el.detailBody = q('[data-detail-body]');
      this.el.detailFilter = q('[data-dfilter]');
      this.el.detailSelCount = q('[data-detail-selcount]');
      
      // Novos elementos do Dashboard tela cheia
      this.el.p4 = q('[data-p4]');
      this.el.clearLog = q('[data-clear-log]');
      this.el.expand = q('[data-expand]');
    },

    _bind() {
      const q = (s) => this.root.querySelector(s);
      q('[data-close]').onclick = () => this.unmount();
      q('[data-min]').onclick = () => this.el.wrap.classList.add('min');
      this.el.expand.onclick = () => this.el.wrap.classList.remove('min');
      
      q('[data-detail-close]').onclick = () => this.el.detail.classList.remove('on');
      q('[data-detail-confirm]').onclick = () => this._confirmDetail();
      
      if (this.el.clearLog) {
        this.el.clearLog.onclick = () => { if (this.el.log) this.el.log.innerHTML = ''; };
      }

      this.root.querySelectorAll('[data-step]').forEach((s) => s.onclick = () => {
        const n = parseInt(s.getAttribute('data-step'));
        if (n > 1 && !this.scanned) return;
        this.goto(n);
      });
      this.el.go.onclick = () => this.onGo();
      this.el.stop.onclick = () => engine.stop();
      
      this.root.querySelectorAll('[data-mode]').forEach((b) => b.onclick = () => {
        const mode = b.getAttribute('data-mode');
        this.runModes[mode] = !this.runModes[mode];
        b.classList.toggle('on', this.runModes[mode]);
        
        // Salva na persistência
        store.setConfig({ runModes: { [mode]: this.runModes[mode] } });
        
        // Atualiza a seleção em lote no Dashboard
        this.toggleModeInSelection(mode, this.runModes[mode]);
      });
    },

    toggleModeInSelection(mode, active) {
      (engine.model.courses || []).forEach((c) => {
        c.activities.forEach((a) => {
          const cat = catDe(a.modname);
          if (cat === mode) {
            if (active) {
              if (a.status !== 'feito' && a.cs !== 1) {
                this.selectedCmids.add(a.cmid);
              }
            } else {
              this.selectedCmids.delete(a.cmid);
            }
          }
        });
      });
      this.renderDash();
      this._updateGo();
    },

    goto(n) {
      this.step = n;
      this.root.querySelectorAll('[data-step]').forEach((s) => {
        const k = parseInt(s.getAttribute('data-step'));
        s.classList.toggle('on', k === n); s.classList.toggle('done', k < n);
      });
      this.root.querySelectorAll('[data-pane]').forEach((p) => p.classList.toggle('on', parseInt(p.getAttribute('data-pane')) === n));
      if (n === 2) this.renderDash();
      if (n === 4) this.renderConfig();
      this._updateGo();
    },

    _updateGo() {
      const go = this.el.go;
      if (this.step === 1) {
        go.textContent = !this.courseList.length ? '🔍 Buscar disciplinas' : (this.selected.size ? '⚡ Escanear ' + this.selected.size + ' disciplina(s)' : 'Selecione disciplinas');
        go.disabled = this.courseList.length && !this.selected.size;
      } else if (this.step === 2) {
        const n = this._obterAtividadesFila();
        go.textContent = n ? '▶ Executar (' + n + ')' : 'Nada pra executar';
        go.disabled = !n || engine.rodando;
      } else {
        go.textContent = engine.rodando ? 'Executando…' : '▶ Executar de novo';
        go.disabled = engine.rodando;
      }
    },

    _obterAtividadesFila() {
      return this.selectedCmids.size;
    },

    _comAtiv() { return (engine.model.courses || []).filter((c) => c.activities.length); },

    async onGo() {
      if (engine.rodando) return;
      if (this.step === 1) { if (!this.courseList.length) await this.buscarCursos(); else await this.escanear(); }
      else await this.rodar();
    },

    async buscarCursos() {
      this.setStatus('run'); this.log('buscando disciplinas…', 'in'); this.el.go.disabled = true;
      try {
        this.courseList = await courses.listDisciplines();
        if (!this.courseList.length) {
          this.log('nenhuma disciplina encontrada', 'wn'); this.setStatus('err');
        } else {
          this.courseList.forEach((c) => this.selected.add(c.id));
          this.log(this.courseList.length + ' disciplina(s) encontrada(s)', 'ok'); this.setStatus('');
        }
        this.el.sCur.textContent = this.courseList.length;
        this.renderCursos();
      } catch (e) { this.log('erro: ' + e.message, 'er'); this.setStatus('err'); }
      this._updateGo();
    },

    async escanear() {
      const sel = this.courseList.filter((c) => this.selected.has(c.id));
      if (!sel.length) return;
      this.setStatus('run'); this.el.go.disabled = true;
      this.log('expandindo ' + sel.length + ' disciplina(s)…', 'in');
      try {
        const lista = await courses.expandToCourses(sel, (nome, n) => this.log('▸ ' + nome + ': ' + n + ' curso(s)', 'dm'));
        if (!lista.length) { this.log('nenhum curso encontrado', 'wn'); this.setStatus('err'); this._updateGo(); return; }
        this.log(lista.length + ' curso(s) — escaneando atividades…', 'in');
        const model = await engine.scan(lista);
        const total = model.courses.reduce((n, c) => n + c.activities.length, 0);
        this.el.sAtiv.textContent = total; this.scanned = true;
        
        // Inicializa a seleção de cmids com atividades pendentes habilitadas
        this.selectedCmids.clear();
        model.courses.forEach((c) => {
          c.activities.forEach((a) => {
            if (a.status !== 'feito' && this._permitidoLocal(a.modname)) {
              this.selectedCmids.add(a.cmid);
            }
          });
        });

        this.log(total + ' atividade(s) encontrada(s)', 'ok'); this.setStatus('');
        this.goto(2);
      } catch (e) { this.log('erro: ' + e.message, 'er'); this.setStatus('err'); this._updateGo(); }
    },

    async rodar() {
      const cmids = Array.from(this.selectedCmids);
      if (!cmids.length) return;
      this.setStatus('run'); this.goto(3);
      await engine.run(cmids, this.runModes);
      this._updateGo();
    },

    _permitidoLocal(tipo) {
      const isRegistro = CAT_REGISTRO.indexOf(tipo) >= 0;
      const isQuiz = CAT_QUIZ.indexOf(tipo) >= 0;
      const isAtividade = !isRegistro && !isQuiz;

      // Filtra pelo botão ativo no rodapé (bulk toggle)
      if (isAtividade && !this.runModes.atividades) return false;
      if (isRegistro && !this.runModes.registros) return false;
      if (isQuiz && !this.runModes.quiz) return false;

      // Verifica tipos específicos da configuração (só para atividades)
      if (isAtividade) {
        if (tipo === 'scorm') return this.cfg.types.scorm;
        if (tipo === 'h5pactivity') return this.cfg.types.h5pactivity;
        if (tipo === 'url') return this.cfg.types.url;
        if (tipo === 'subsection') return this.cfg.types.subsection;
        const tiposVisita = ['url', 'page', 'resource', 'imscp', 'folder', 'book', 'glossary', 'lesson'];
        if (tiposVisita.indexOf(tipo) >= 0) return this.cfg.types[tipo] !== false;
        return this.cfg.types.generic;
      }
      return true;
    },

    // ── Passo 1: Disciplinas ──
    renderCursos() {
      const p = this.el.p1;
      if (!this.courseList.length) {
        p.innerHTML = '<div class="empty"><div class="big">📚</div>Nenhuma disciplina carregada.<br>Clique em <b>Buscar cursos</b> abaixo.</div>';
        this._updateGo(); return;
      }
      const all = this.courseList.every((c) => this.selected.has(c.id));
      let h = '<div class="bar"><h4>' + this.courseList.length + ' disciplinas · ' + this.selected.size + ' selecionadas</h4>'
        + '<button class="link" data-all>' + (all ? 'limpar tudo' : 'todas') + '</button></div>';
      this.courseList.forEach((c) => {
        const on = this.selected.has(c.id);
        const open = this.expanded.has(c.id);
        const prev = this.previewData[c.id];
        h += '<div class="disc-card ' + (on ? 'sel' : '') + '">';
        h += '<div class="disc-row" data-dsel="' + c.id + '">'
          + '<div class="disc-ck ' + (on ? 'on' : '') + '">✓</div>'
          + '<div class="disc-icon">📘</div>'
          + '<div class="disc-body"><div class="disc-name">' + esc(c.name) + '</div>'
          + '<div class="disc-meta">' + (prev ? prev.courses.length + ' bimestre(s)' : 'disciplina') + '</div></div>'
          + '<button class="disc-expbtn ' + (open ? 'open' : '') + '" data-dexp="' + c.id + '">▶</button>'
          + '</div>';
        if (open) {
          h += '<div class="disc-expand">';
          if (!prev) { h += '<div class="exp-loading">Carregando…</div>'; }
          else if (!prev.courses.length) { h += '<div class="exp-loading">Nenhum bimestre encontrado.</div>'; }
          else {
            prev.courses.forEach((cr) => {
              h += '<div class="exp-course"><div class="exp-cname" data-opencourse="' + cr.id + '" data-cname="' + esc(cr.name) + '">'
                + '📖 ' + esc(cr.name) + '<span class="ecnt">' + (cr.sections ? cr.sections.length + ' sem.' : '') + '</span></div>';
              if (cr.sections && cr.sections.length) {
                cr.sections.forEach((s) => {
                  const done = s.completed_activities > 0 && s.completed_activities >= s.total_activities;
                  h += '<div class="exp-week"><span class="exp-wdot ' + (done ? 'done' : '') + '"></span>'
                    + '<span class="exp-wname">' + esc(s.name || 'Semana') + '</span>'
                    + (s.total_activities > 0 ? '<span class="exp-wpct">' + (s.completed_activities || 0) + '/' + s.total_activities + '</span>' : '')
                    + '</div>';
                });
              }
              h += '</div>';
            });
          }
          h += '</div>';
        }
        h += '</div>';
      });
      p.innerHTML = h;
      p.querySelector('[data-all]').onclick = () => { if (all) this.selected.clear(); else this.courseList.forEach((c) => this.selected.add(c.id)); this.renderCursos(); };
      p.querySelectorAll('[data-dsel]').forEach((row) => row.onclick = (e) => {
        if (e.target.closest('[data-dexp]')) return;
        const id = parseInt(row.getAttribute('data-dsel'));
        this.selected.has(id) ? this.selected.delete(id) : this.selected.add(id);
        this.renderCursos();
      });
      p.querySelectorAll('[data-dexp]').forEach((btn) => btn.onclick = async (e) => {
        e.stopPropagation();
        const id = parseInt(btn.getAttribute('data-dexp'));
        if (this.expanded.has(id)) { this.expanded.delete(id); this.renderCursos(); return; }
        this.expanded.add(id); this.renderCursos();
        if (!this.previewData[id]) await this._loadPreview(id);
      });
      p.querySelectorAll('[data-opencourse]').forEach((el) => el.onclick = (e) => {
        e.stopPropagation();
        this.openDetail(parseInt(el.getAttribute('data-opencourse')), el.getAttribute('data-cname'));
      });
      this._updateGo();
    },

    async _loadPreview(discId) {
      const disc = this.courseList.find((c) => c.id === discId);
      if (!disc) return;
      try {
        const courseIds = await EA.courses.coursesOfDiscipline(disc);
        if (!courseIds.length) { this.previewData[discId] = { courses: [] }; this.renderCursos(); return; }
        const courseList = await Promise.all(courseIds.map(async (cid) => {
          const nome = await EA.courses.nomeDaPagina(cid);
          return { id: cid, name: nome || 'Curso ' + cid, sections: [] };
        }));
        const prog = await EA.courses.progress(courseIds);
        const progById = {};
        prog.forEach((p) => { progById[p.courseid] = p; });
        courseList.forEach((cr) => { const p = progById[cr.id] || {}; cr.sections = (p.sections || []).filter((s) => s.name); });
        this.previewData[discId] = { courses: courseList };
      } catch (e) { this.previewData[discId] = { courses: [] }; }
      if (this.expanded.has(discId)) this.renderCursos();
    },

    // ── Detalhe do Curso ──
    async openDetail(courseId, courseName) {
      this.detailCourse = { id: courseId, name: courseName };
      this.detailWeeks = []; this.detailSel = new Set(); this.detailFilter = 'todos';
      this.el.detailTitle.textContent = courseName;
      this.el.detailSub.textContent = 'Carregando…';
      this.el.detailBody.innerHTML = '<div class="dloading">Carregando semanas e atividades…</div>';
      this.el.detailFilter.innerHTML = '';
      this.el.detailSelCount.textContent = '0';
      this.el.detail.classList.add('on');
      try {
        const prog = await EA.courses.progress([courseId]);
        const secoes = ((prog[0] || {}).sections || []).filter((s) => s.url);
        if (!secoes.length) { this.el.detailBody.innerHTML = '<div class="dloading">Nenhuma semana encontrada.</div>'; this.el.detailSub.textContent = '0 semanas'; return; }
        const weeks = [];
        for (const s of secoes) {
          const ativs = await EA.activities.fromUrl(s.url);
          weeks.push({ name: s.name || 'Semana', url: s.url, activities: ativs });
          ativs.forEach((a) => { if (a.cs !== 1) this.detailSel.add(a.cmid); }); // só seleciona pendentes
        }
        this.detailWeeks = weeks;
        const total = weeks.reduce((n, w) => n + w.activities.length, 0);
        const feitos = weeks.reduce((n, w) => n + w.activities.filter((a) => a.cs === 1).length, 0);
        this.el.detailSub.textContent = weeks.length + ' semanas · ' + total + ' atividades · ' + feitos + ' concluídas';
        this._renderDetailFilters();
        this._renderDetail();
      } catch (e) { this.el.detailBody.innerHTML = '<div class="dloading">Erro: ' + esc(e.message) + '</div>'; }
    },

    _renderDetailFilters() {
      const all = this.detailWeeks.flatMap((w) => w.activities);
      const counts = { todos: all.length, atividades: 0, registros: 0, quiz: 0, pendentes: 0, feitos: 0 };
      all.forEach((a) => {
        const c = catDe(a.modname);
        if (c === 'atividade') counts.atividades++;
        else if (c === 'registro') counts.registros++;
        else if (c === 'quiz') counts.quiz++;
        if (a.cs === 1) counts.feitos++; else counts.pendentes++;
      });
      const filters = [
        ['todos', 'Todos', 'f-all'], ['atividades', 'Atividades', 'f-atv'],
        ['registros', '✏ Registros', 'f-reg'], ['quiz', '❓ Quiz', 'f-quiz'],
        ['pendentes', 'Pendentes', 'f-pen'], ['feitos', '✓ Feitos', 'f-done'],
      ];
      let h = '';
      filters.forEach(([v, l, cls]) => {
        if (counts[v] === 0 && v !== 'todos') return;
        h += '<button class="ftag ' + cls + ' ' + (this.detailFilter === v ? 'on' : '') + '" data-df="' + v + '">' + l + ' <span class="fc">' + counts[v] + '</span></button>';
      });
      this.el.detailFilter.innerHTML = h;
      this.el.detailFilter.querySelectorAll('[data-df]').forEach((b) => b.onclick = () => {
        this.detailFilter = b.getAttribute('data-df');
        this._renderDetailFilters(); this._renderDetail();
      });
    },

    _renderDetail() {
      let h = '';
      const f = this.detailFilter;
      this.detailWeeks.forEach((w, wi) => {
        let ativs = w.activities;
        if (f === 'atividades') ativs = ativs.filter((a) => catDe(a.modname) === 'atividade');
        else if (f === 'registros') ativs = ativs.filter((a) => catDe(a.modname) === 'registro');
        else if (f === 'quiz') ativs = ativs.filter((a) => catDe(a.modname) === 'quiz');
        else if (f === 'pendentes') ativs = ativs.filter((a) => a.cs !== 1);
        else if (f === 'feitos') ativs = ativs.filter((a) => a.cs === 1);
        if (!ativs.length) return;

        const allSel = ativs.every((a) => this.detailSel.has(a.cmid));
        h += '<div class="dweek"><div class="dw-head" data-dtogweek="' + wi + '">'
          + '<div class="dw-ck ' + (allSel ? 'on' : '') + '">✓</div>'
          + '<div class="dw-name">' + esc(w.name) + '</div>'
          + '<div class="dw-cnt">' + ativs.length + '</div></div>';
        ativs.forEach((a) => {
          const sel = this.detailSel.has(a.cmid);
          const done = a.cs === 1;
          const cat = catDe(a.modname);
          h += '<div class="datv ' + (done ? 'done-atv' : '') + '" data-dtogativ="' + a.cmid + '">'
            + '<div class="da-ck ' + (sel ? 'on' : '') + '">✓</div>'
            + '<div class="da-ico cat-' + cat + '">' + (TIPO_ICON[a.modname] || '·') + '</div>'
            + '<div class="da-body"><div class="da-name">' + esc(a.nome || a.modname) + '</div>'
            + '<div class="da-meta"><span class="acat cat-' + cat + '">' + (TIPO_LABEL[a.modname] || a.modname) + '</span></div></div>'
            + (done ? '<span class="da-done-badge">✓ feito</span>' : '') + '</div>';
        });
        h += '</div>';
      });
      if (!h) h = '<div class="dloading">Nenhuma atividade neste filtro.</div>';
      this.el.detailBody.innerHTML = h;
      this.el.detailSelCount.textContent = this.detailSel.size;
      this.el.detailBody.querySelectorAll('[data-dtogweek]').forEach((el) => el.onclick = () => {
        const wi = parseInt(el.getAttribute('data-dtogweek'));
        const f = this.detailFilter;
        let ativs = this.detailWeeks[wi].activities;
        if (f === 'pendentes') ativs = ativs.filter((a) => a.cs !== 1);
        else if (f === 'feitos') ativs = ativs.filter((a) => a.cs === 1);
        else if (f === 'atividades') ativs = ativs.filter((a) => catDe(a.modname) === 'atividade');
        else if (f === 'registros') ativs = ativs.filter((a) => catDe(a.modname) === 'registro');
        else if (f === 'quiz') ativs = ativs.filter((a) => catDe(a.modname) === 'quiz');
        const allSel = ativs.every((a) => this.detailSel.has(a.cmid));
        ativs.forEach((a) => allSel ? this.detailSel.delete(a.cmid) : this.detailSel.add(a.cmid));
        this._renderDetailFilters(); this._renderDetail();
      });
      this.el.detailBody.querySelectorAll('[data-dtogativ]').forEach((el) => el.onclick = () => {
        const cmid = parseInt(el.getAttribute('data-dtogativ'));
        this.detailSel.has(cmid) ? this.detailSel.delete(cmid) : this.detailSel.add(cmid);
        this._renderDetailFilters(); this._renderDetail();
      });
    },

    async _confirmDetail() {
      if (!this.detailCourse || !this.detailWeeks.length) { this.el.detail.classList.remove('on'); return; }
      const { id, name } = this.detailCourse;
      const todasAtivs = [];
      this.detailWeeks.forEach((w) => {
        w.activities.forEach((a) => {
          if (this.detailSel.has(a.cmid)) {
            todasAtivs.push(Object.assign({ section: w.name, sectionUrl: w.url, status: a.cs === 1 ? 'feito' : 'pendente' }, a));
          }
        });
      });
      const idx = engine.model.courses.findIndex((c) => c.id === id);
      const cursoModel = { id, name, locked: false, lockedUntil: '', activities: todasAtivs };
      if (idx >= 0) engine.model.courses[idx] = cursoModel;
      else engine.model.courses.push(cursoModel);
      
      // Sincroniza os cmids selecionados
      const ativsConfirmadas = new Set(todasAtivs.map((a) => a.cmid));
      this.detailWeeks.forEach((w) => {
        w.activities.forEach((a) => {
          if (ativsConfirmadas.has(a.cmid)) {
            if (a.status !== 'feito' && this._permitidoLocal(a.modname)) {
              this.selectedCmids.add(a.cmid);
            }
          } else {
            this.selectedCmids.delete(a.cmid);
          }
        });
      });

      this.scanned = true;
      const total = engine.model.courses.reduce((n, c) => n + c.activities.length, 0);
      this.el.sAtiv.textContent = total;
      this.el.detail.classList.remove('on');
      this.log('"' + name + '" → ' + todasAtivs.length + ' atividade(s) selecionadas', 'ok');
      this.goto(2);
    },

    // ── Passo 2: Dashboard ──
    renderDash() {
      const p = this.el.p2;
      const lista = engine.model.courses || [];
      if (!lista.some((c) => c.activities.length)) {
        p.innerHTML = '<div class="empty"><div class="big">🗂️</div>Nada mapeado ainda.<br>Volte ao passo 1 e <b>selecione um curso</b>.</div>';
        this._updateGo(); return;
      }

      const allAtivs = lista.flatMap((c) => c.activities);
      const cntAll = allAtivs.length;
      const cntAtv = allAtivs.filter((a) => catDe(a.modname) === 'atividade').length;
      const cntReg = allAtivs.filter((a) => catDe(a.modname) === 'registro').length;
      const cntQuiz = allAtivs.filter((a) => catDe(a.modname) === 'quiz').length;
      const cntPen = allAtivs.filter((a) => a.status !== 'feito').length;
      const cntDone = allAtivs.filter((a) => a.status === 'feito').length;

      const fT = this.filters.tipo, fS = this.filters.status;
      let h = '<div class="filter-row">';
      const fs = [
        ['todos', 'Todos', 'f-all', cntAll], ['atividades', 'Atividades', 'f-atv', cntAtv],
        ['registros', '✏ Registros', 'f-reg', cntReg], ['quiz', '❓ Quiz', 'f-quiz', cntQuiz],
      ];
      fs.forEach(([v, l, cls, n]) => {
        if (n === 0 && v !== 'todos') return;
        h += '<button class="ftag ' + cls + ' ' + (fT === v ? 'on' : '') + '" data-ft="' + v + '">' + l + ' <span class="fc">' + n + '</span></button>';
      });
      h += '</div><div class="filter-row">';
      [['todos', 'Todos status', 'f-all', cntAll], ['pendente', 'Pendentes', 'f-pen', cntPen], ['feito', '✓ Feitos', 'f-done', cntDone]].forEach(([v, l, cls, n]) => {
        h += '<button class="ftag ' + cls + ' ' + (fS === v ? 'on' : '') + '" data-fs="' + v + '">' + l + ' <span class="fc">' + n + '</span></button>';
      });
      h += '</div>';

      lista.forEach((c) => {
        let ativs = c.activities;
        if (fT === 'atividades') ativs = ativs.filter((a) => catDe(a.modname) === 'atividade');
        else if (fT === 'registros') ativs = ativs.filter((a) => catDe(a.modname) === 'registro');
        else if (fT === 'quiz') ativs = ativs.filter((a) => catDe(a.modname) === 'quiz');
        if (fS !== 'todos') ativs = ativs.filter((a) => a.status === fS);
        if (!ativs.length) return;

        h += '<div class="cgroup"><div class="cg-head"><span class="cg-icon">📚</span><span class="cg-name">' + esc(c.name) + '</span><span class="cg-count">' + ativs.length + '</span></div>';

        const ordem = [];
        const porSemana = {};
        ativs.forEach((a) => {
          const sec = (a.section || 'Geral').trim();
          if (!porSemana[sec]) { porSemana[sec] = []; ordem.push(sec); }
          porSemana[sec].push(a);
        });

        ordem.forEach((sec) => {
          const itens = porSemana[sec];
          const hasReg = itens.some((a) => catDe(a.modname) === 'registro');
          const hasQuiz = itens.some((a) => catDe(a.modname) === 'quiz');
          h += '<div class="week-block ' + (hasReg ? 'has-reg' : hasQuiz ? 'has-quiz' : '') + '">';
          h += '<div class="wk-title">' + esc(sec) + '<em>' + itens.length + '</em></div>';
          itens.forEach((a) => {
            const cat = catDe(a.modname);
            const isSel = this.selectedCmids.has(a.cmid);
            h += '<div class="acard ' + (a.status === 'feito' ? 'done' : '') + ' ' + (isSel ? 'sel' : '') + '" data-acard-cmid="' + a.cmid + '">'
              + '<div class="acard-ck ' + (isSel ? 'on' : '') + '">✓</div>'
              + '<div class="aico cat-' + cat + '">' + (TIPO_ICON[a.modname] || '·') + '</div>'
              + '<div class="abody"><div class="aname">' + esc(a.nome || a.modname) + '</div>'
              + '<div class="ameta"><span class="acat cat-' + cat + '">' + (TIPO_LABEL[a.modname] || a.modname) + '</span></div></div>'
              + '<span class="abadge ' + a.status + '" data-st="' + a.cmid + '">' + a.status + '</span></div>';
          });
          h += '</div>';
        });
        h += '</div>';
      });

      p.innerHTML = h;
      p.querySelectorAll('[data-ft]').forEach((b) => b.onclick = () => { this.filters.tipo = b.getAttribute('data-ft'); this.renderDash(); });
      p.querySelectorAll('[data-fs]').forEach((b) => b.onclick = () => { this.filters.status = b.getAttribute('data-fs'); this.renderDash(); });
      
      // Bind de click nos cartões para seleção granular
      p.querySelectorAll('[data-acard-cmid]').forEach((card) => {
        card.onclick = (e) => {
          e.stopPropagation();
          const cmid = parseInt(card.getAttribute('data-acard-cmid'));
          const ck = card.querySelector('.acard-ck');
          if (this.selectedCmids.has(cmid)) {
            this.selectedCmids.delete(cmid);
            card.classList.remove('sel');
            if (ck) ck.classList.remove('on');
          } else {
            this.selectedCmids.add(cmid);
            card.classList.add('sel');
            if (ck) ck.classList.add('on');
          }
          this._updateGo();
        };
      });

      this._updateGo();
    },

    // ── Config ──
    renderConfig() {
      const c = this.cfg, b = this.el.p4;
      if (!b) return;
      const tipos = ['scorm', 'h5pactivity', 'url', 'page', 'resource', 'folder', 'book', 'lesson', 'glossary', 'imscp', 'subsection', 'generic'];
      let h = '<div class="config-container">';
      h += '<h2>Ajustes Globais da Automação</h2>';
      h += '<div class="field"><div class="flabel">Espera entre atividades <b data-dl>' + c.delayMs + 'ms</b></div><input type="range" min="200" max="3000" step="100" value="' + c.delayMs + '" data-r-delay></div>';
      h += '<div class="field"><div class="flabel">Tentativas por atividade <b data-rt>' + c.retries + '</b></div><input type="range" min="1" max="5" step="1" value="' + c.retries + '" data-r-retry></div>';
      h += '<div class="switch"><span>Modo seguro (pula concluídas)</span><div class="sw ' + (c.safeMode ? 'on' : '') + '" data-sw-safe></div></div>';
      h += '<div class="switch"><span>Iniciar minimizado</span><div class="sw ' + (c.autoCollapse ? 'on' : '') + '" data-sw-collapse></div></div>';
      h += '<div class="seg">Tema visual</div><div class="swatches">';
      [['sync', 'linear-gradient(135deg,#0A84FF,#8B5CF6)'], ['cyan', 'linear-gradient(135deg,#00D4FF,#22F5C9)'], ['verde', 'linear-gradient(135deg,#10B981,#34D399)']].forEach(([t, g]) => h += '<div class="swatch ' + (c.theme === t ? 'on' : '') + '" data-theme="' + t + '" style="background:' + g + '"></div>');
      h += '</div>';
      h += '<div class="seg">Tipos automatizados</div><div class="toggles">';
      tipos.forEach((t) => h += '<button class="tg ' + (c.types[t] !== false ? 'on' : '') + '" data-type="' + t + '">' + (TIPO_LABEL[t] || t) + '</button>');
      h += '</div>';
      h += '<div class="seg">Registros com IA (Groq)</div>';
      h += '<div class="warn">⚠ Lê o material da aula e gera respostas com IA. Posta conteúdo real no portal.</div>';
      h += '<div class="switch"><span>Habilitar registros IA</span><div class="sw ' + (c.registros.enabled ? 'on' : '') + '" data-sw-reg></div></div>';
      h += '<div class="field" style="margin-top:12px"><div class="flabel">Chave API Groq <a href="https://console.groq.com/keys" target="_blank">Obter chave ↗</a></div>';
      h += '<input type="password" placeholder="gsk_..." value="' + esc(c.groqKey || '') + '" data-groqkey></div>';
      h += '<div class="field"><div class="flabel">Modelo Groq <b data-groqmod-lbl>' + esc(c.groqModel || 'llama-3.3-70b-versatile') + '</b></div>';
      h += '<div class="toggles">' + [['llama-3.3-70b-versatile', 'Llama 3.3 70B'], ['llama3-70b-8192', 'Llama 3 70B'], ['mixtral-8x7b-32768', 'Mixtral 8x7B']].map(([v, l]) => '<button class="tg reg ' + ((c.groqModel || 'llama-3.3-70b-versatile') === v ? 'on' : '') + '" data-groqmod="' + v + '">' + l + '</button>').join('') + '</div></div>';
      h += '<button class="obtn" data-reset>Restaurar padrões</button>';
      h += '</div>';
      b.innerHTML = h;
      this._bindConfig(b);
    },

    _bindConfig(b) {
      const save = async (partial) => { this.cfg = await store.setConfig(partial); };
      const q = (s) => b.querySelector(s);
      q('[data-r-delay]').oninput = (e) => { b.querySelector('[data-dl]').textContent = e.target.value + 'ms'; save({ delayMs: parseInt(e.target.value) }); };
      q('[data-r-retry]').oninput = (e) => { b.querySelector('[data-rt]').textContent = e.target.value; save({ retries: parseInt(e.target.value) }); };
      q('[data-sw-safe]').onclick = (e) => { e.target.classList.toggle('on'); save({ safeMode: e.target.classList.contains('on') }); };
      q('[data-sw-collapse]').onclick = (e) => { e.target.classList.toggle('on'); save({ autoCollapse: e.target.classList.contains('on') }); };
      q('[data-sw-reg]').onclick = (e) => { e.target.classList.toggle('on'); save({ registros: { enabled: e.target.classList.contains('on') } }); };
      const gkEl = q('[data-groqkey]');
      if (gkEl) gkEl.onchange = (e) => save({ groqKey: e.target.value.trim() });
      b.querySelectorAll('[data-groqmod]').forEach((x) => x.onclick = () => {
        const v = x.getAttribute('data-groqmod');
        b.querySelectorAll('[data-groqmod]').forEach((y) => y.classList.toggle('on', y === x));
        const lbl = b.querySelector('[data-groqmod-lbl]'); if (lbl) lbl.textContent = v;
        save({ groqModel: v });
      });
      b.querySelectorAll('[data-theme]').forEach((s) => s.onclick = () => {
        const t = s.getAttribute('data-theme');
        this.el.wrap.className = 'wrap ' + t + (this.el.wrap.classList.contains('min') ? ' min' : '');
        save({ theme: t }); this.renderConfig();
      });
      b.querySelectorAll('[data-type]').forEach((x) => x.onclick = () => { x.classList.toggle('on'); save({ types: { [x.getAttribute('data-type')]: x.classList.contains('on') } }); });
      q('[data-reset]').onclick = async () => { this.cfg = await store.resetConfig(); this.el.wrap.className = 'wrap ' + this.cfg.theme; this.renderConfig(); this.log('config restaurada', 'dm'); };
    },

    // ── Engine binding ──
    _bindEngine() {
      engine.on('log', (p) => this.log(p.msg, p.cls));
      engine.on('scanCourse', (p) => this.log('▸ ' + p.name, 'dm'));
      engine.on('runStart', (p) => { this.setProgress(0); this.el.sOk.textContent = '0'; this.el.sErr.textContent = '0'; this.log('executando ' + p.total + ' atividade(s)…', 'in'); });
      engine.on('runCourse', (p) => this.setSub('→ ' + p.name));
      engine.on('progress', (p) => { this.setProgress(p.total ? (p.done / p.total) * 100 : 0); this.el.sOk.textContent = p.feitos + p.jafeito; this.el.sErr.textContent = p.erros; });
      engine.on('activityDone', () => { if (this.step === 2) this._badges(); });
      engine.on('runDone', (r) => {
        const m = r.feitos + ' nova(s)' + (r.jafeito ? ' · ' + r.jafeito + ' já feitas' : '') + (r.erros ? ' · ' + r.erros + ' erro(s)' : '') + (r.pulados ? ' · ' + r.pulados + ' puladas' : '');
        this.log(m, r.erros ? 'wn' : 'ok');
        this.setStatus(r.parado ? '' : (r.erros && !r.feitos ? 'err' : 'ok'));
        this.setSub(r.parado ? 'parado' : 'concluído'); this._updateGo();
      });
    },
    _badges() { (engine.model.courses || []).forEach((c) => c.activities.forEach((a) => { const x = this.root.querySelector('[data-st="' + a.cmid + '"]'); if (x) { x.className = 'abadge ' + a.status; x.textContent = a.status; } })); },

    // ── Helpers ──
    log(msg, cls) {
      if (!this.el.log) return;
      const d = document.createElement('div'); d.className = 'log-row';
      const t = document.createElement('span'); t.className = 'ts'; t.textContent = new Date().toLocaleTimeString('pt-BR');
      const m = document.createElement('span'); m.className = cls || ''; m.textContent = msg;
      d.appendChild(t); d.appendChild(m); this.el.log.appendChild(d); this.el.log.scrollTop = this.el.log.scrollHeight;
    },
    setStatus(cls) { if (this.el.dot) this.el.dot.className = 'dot ' + (cls || ''); if (this.el.status) this.el.status.textContent = cls === 'run' ? 'rodando' : cls === 'ok' ? 'concluído' : cls === 'err' ? 'erro' : 'ocioso'; },
    setSub(t) { if (this.el.status) this.el.status.textContent = t; },
    setProgress(pp) { pp = Math.min(100, Math.max(0, pp)); if (this.el.pbar) this.el.pbar.style.width = pp + '%'; if (this.el.pct) this.el.pct.textContent = Math.round(pp) + '%'; },
    toggle() { if (!this.mounted) { this.mount(); return; } this.host.style.display = this.host.style.display === 'none' ? '' : 'none'; },
    unmount() { if (this.host) this.host.remove(); this.mounted = false; this.host = null; },
  };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  EA.ui = ui;
})();

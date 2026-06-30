// Sync Activities — service worker (MV3)
// Clicar no ícone da extensão alterna o painel injetado na página.

// ─── Auto-registro com o web app local (se estiver rodando) ─────────────────
async function registerWithWebApp() {
  try {
    await fetch('http://localhost:3000/api/register-ext', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ extId: chrome.runtime.id }),
    });
  } catch {} // OK — web app pode não estar aberto
}
registerWithWebApp();

// ─── Comunicação com o web app (localhost:3000) ──────────────────────────────
chrome.runtime.onMessageExternal.addListener(async (msg, sender, sendResponse) => {
  if (msg.type === 'EA_PING') { sendResponse({ ok: true }); return; }
  if (msg.type !== 'EA_GET_SESSION') return;

  try {
    // 1. Pega o cookie MoodleSession
    const cookie = await chrome.cookies.get({
      url: 'https://educacaoprofissional.educacao.sp.gov.br',
      name: 'MoodleSession',
    });
    if (!cookie) {
      sendResponse({ error: 'Não logado. Acesse a Educação Profissional primeiro.' });
      return;
    }

    // 2. Pega sesskey + userId da aba aberta do Moodle
    const tabs = await chrome.tabs.query({ url: 'https://educacaoprofissional.educacao.sp.gov.br/*' });
    let sesskey = '', userId = 0;
    if (tabs.length > 0) {
      try {
        const result = await chrome.tabs.sendMessage(tabs[0].id, { type: 'EA_GET_CFG' });
        if (result) { sesskey = result.sesskey || ''; userId = result.userId || 0; }
      } catch {}
    }

    sendResponse({ moodleSession: cookie.value, sesskey, userId });
  } catch (e) {
    sendResponse({ error: e.message });
  }
  return true; // indica resposta assíncrona
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !tab.url) return;
  if (!tab.url.startsWith('https://educacaoprofissional.educacao.sp.gov.br')) {
    // Fora do portal: abre o portal numa aba nova.
    chrome.tabs.create({ url: 'https://educacaoprofissional.educacao.sp.gov.br/my/' });
    return;
  }
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'EA_TOGGLE' });
  } catch (e) {
    // Content script ainda não carregou (página antiga). Recarrega.
    chrome.tabs.reload(tab.id);
  }
});

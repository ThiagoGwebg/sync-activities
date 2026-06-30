// Sync Activities — service worker (MV3)
// Clicar no ícone da extensão alterna o painel injetado na página.

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

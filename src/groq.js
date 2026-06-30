// Sync Activities — groq.js
// Cliente Groq (llama-3.3-70b-versatile) para geração de respostas de registros.
(function () {
  const EA = (window.__EA = window.__EA || {});

  const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
  const DEFAULT_MODEL = 'llama-3.3-70b-versatile';

  const groq = {
    async gerar({ enunciado, material, tipo, apiKey, model }) {
      const key = apiKey || (EA.store && await EA.store.getConfig().then((c) => c.groqKey)) || '';
      if (!key) throw new Error('Chave Groq não configurada. Vá em ⚙ Configurações e insira sua API key Groq.');

      const systemPrompt = tipo === 'forum'
        ? 'Você é um aluno do ensino técnico paulista. Escreva uma participação em fórum acadêmica, reflexiva e contextualizada, de 3 a 5 parágrafos. Não use listas, bullet points ou emojis. Escreva em português do Brasil de forma natural e coerente com o material.'
        : 'Você é um aluno do ensino técnico paulista. Escreva a resposta para a tarefa solicitada de forma completa, fundamentada no material de aula, em prosa acadêmica clara. Mínimo 4 parágrafos. Não copie trechos literais do material, reescreva com suas palavras. Português do Brasil.';

      const userPrompt = [
        '## Enunciado da atividade',
        enunciado || '(sem enunciado)',
        '',
        material ? '## Material de apoio lido\n' + material : '',
        '',
        tipo === 'forum'
          ? 'Com base no enunciado e no material, escreva sua participação no fórum.'
          : 'Com base no enunciado e no material, escreva sua resposta para a tarefa.',
      ].join('\n').trim();

      const resp = await fetch(GROQ_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + key,
        },
        body: JSON.stringify({
          model: model || DEFAULT_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 1024,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error('Groq: ' + (err.error && err.error.message || 'HTTP ' + resp.status));
      }
      const data = await resp.json();
      const texto = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      if (!texto) throw new Error('Groq: resposta vazia');
      return texto.trim();
    },
  };

  EA.groq = groq;
})();

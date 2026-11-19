
'use strict';
/** Gera relatório Markdown apenas com dados acadêmicos de turma, disciplina e grade. */
function calendar7EduMarkdown(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.entries) || !snapshot.entries.length)
    throw new Error('O calendário 7Edu está vazio.');
  const clean = value => String(value == null ? '' : value).replace(/[\r\n|]/g, ' ').trim();
  const br = value => /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}` : clean(value);
  const groups = new Map();
  for (const e of snapshot.entries) {
    if (!/^[123]M[AB]$/.test(e.turma) || !/^2026-\d{2}-\d{2}$/.test(e.data) || !Number.isInteger(e.aulas) || e.aulas < 0)
      throw new Error('Linha inesperada no calendário exportado; confira a conexão.');
    const key = `${e.turma} / ${e.disciplina}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }
  const lines = ['# Calendário real de aulas — 7Edu', '',
    '- Ano letivo: 2026', '- Período: 4º bimestre', `- Consulta realizada em: ${br(snapshot.consulted_at)}`,
    `- Disciplinas consultadas: ${snapshot.sections_checked || groups.size}`, '',
    '> Fonte: consulta de leitura do diário 7Edu (Grid_Read). Este arquivo **não** lança, altera ou apaga aulas.',
    '> Datas futuras podem aparecer como previstas, mas **não podem ser lançadas antecipadamente**.',
    '> Datas ainda não disponibilizadas pelo 7Edu podem estar ausentes do relatório. Não presuma que a grade está completa.',
    '> "Registrado" significa que o 7Edu retornou RealizedDate; "Pendente" significa linha prevista até a data da consulta.', '',
    '## Grade por turma e disciplina', ''];
  for (const [name, entries] of [...groups.entries()].sort((a,b)=>a[0].localeCompare(b[0]))) {
    lines.push(`### ${clean(name)}`, '', '| Data | Nº de aulas | Horários/Períodos | Situação | Aula do planejamento (preencher depois) |',
      '| --- | ---: | --- | --- | --- |');
    for (const e of [...entries].sort((a,b)=>a.data.localeCompare(b.data))) {
      const slots=(e.horarios || []).map(h=>{
        const prefix=Number.isInteger(h.numero) ? `${h.numero}º ` : '';
        const times=h.inicio && h.fim ? `${clean(h.inicio)}–${clean(h.fim)}` : '';
        return prefix + times;
      }).filter(Boolean).join('; ');
      const state=e.status==='registrado'?'Registrado':e.status==='futuro'?'Futuro / não disponível para lançamento':'Pendente';
      lines.push(`| ${br(e.data)} | ${e.aulas} | ${clean(slots) || 'A conferir'} | ${state} | — |`);
    }
    lines.push('');
  }
  if ((snapshot.warnings || []).length) {
    lines.push('## Alertas da consulta', '');
    for (const w of snapshot.warnings)lines.push(`- ${clean(w)}`);
    lines.push('');
  }
  lines.push('## Como usar este relatório', '',
    'Preencha a última coluna, se desejar, com o encontro do planejamento que corresponde a cada data.',
    'Depois envie o arquivo para remapeamento. O calendário do E-Class deve permanecer independente do 7Edu.',
    'Não publique registros de datas futuras e confira as aulas já registradas antes de qualquer lote.', '');
  return lines.join('\n');
}

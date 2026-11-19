'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const js=fs.readFileSync(path.join(__dirname,'../extension/calendar_export.js'),'utf8');
const ctx=vm.createContext({});vm.runInContext(js,ctx);
const doc=vm.runInContext('calendar7EduMarkdown',ctx)({
 consulted_at:'2026-11-19',sections_checked:2,warnings:['3MB / Filosofia: 4º bimestre ausente.'],
 entries:[
  {turma:'1MB',disciplina:'Matemática',data:'2026-10-14',aulas:1,status:'registrado',horarios:[{numero:2,inicio:'07:00',fim:'07:45'}]},
  {turma:'1MA',disciplina:'Investigação Matemática',data:'2026-11-20',aulas:2,status:'futuro',horarios:[{numero:3,inicio:'08:30',fim:'09:15'},{numero:4,inicio:'09:15',fim:'10:00'}]},
  {turma:'1MA',disciplina:'Investigação Matemática',data:'2026-10-15',aulas:1,status:'pendente',horarios:[]}
 ]
});
assert.match(doc,/14\/10\/2026 \| 1 \| 2º 07:00–07:45 \| Registrado/);
assert.match(doc,/20\/11\/2026 \| 2 \| 3º 08:30–09:15; 4º 09:15–10:00 \| Futuro/);
assert.ok(doc.indexOf('15/10/2026')<doc.indexOf('20/11/2026'));
assert.match(doc,/4º bimestre ausente/);
assert.doesNotMatch(doc,/(employeeId|access_token|Cookie|Authorization)/i);
console.log('PASSOU: exportação Markdown, horários, estado, ordenação, alertas e ausência de sessão.');

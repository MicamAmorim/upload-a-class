/* Teste offline do popup: overrides antigos não alteram a mensagem enviada ao 7Edu. */
'use strict';
const assert=require('node:assert/strict'), fs=require('node:fs'), vm=require('node:vm'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../extension/popup.js'),'utf8');
const isolated=src.slice(0,src.indexOf('function updateSystemUI()'));
assert(isolated.includes('function forSystem(item)'));
const context=vm.createContext({document:{getElementById:id=>({value:'7edu'})},structuredClone});
vm.runInContext(isolated,context);
const base={id:'inv1',disciplina:'Investigação Matemática',titulo:'Antigo detalhado',html:'<p>Texto longo anterior</p>',conteudo_7edu:'Texto anterior',status:'proposta_para_aprovacao',data:'2026-10-01',horario:[{ordem:2}],quantidade_periodos:1,'7edu':{mapeamento:'redistribuido'}};
vm.runInContext(`payload7Edu={postagens:[${JSON.stringify({...base,titulo:'Atividades propostas',html:'<p>Atividades propostas</p>',conteudo_7edu:'Atividades propostas'})}]}; overrides7Edu={inv1:{titulo:'Override antigo',html:'<p>Override antigo</p>'}};`,context);
vm.runInContext('setSystemRecords()',context);
const rows=vm.runInContext('records.map(p=>({titulo:p.titulo,html:p.html,conteudo_7edu:p.conteudo_7edu,status:p.status,horario:p.horario}))',context);
assert.equal(rows[0].titulo,'Atividades propostas');assert.equal(rows[0].html,'<p>Atividades propostas</p>');assert.equal(rows[0].conteudo_7edu,'Atividades propostas');
const payload=vm.runInContext(`forSystem(${JSON.stringify(base)})`,context);
assert.equal(payload.conteudo_7edu,'Atividades propostas');assert.equal(payload.titulo,'Atividades propostas');
assert.equal(payload.html,'<p>Atividades propostas</p>');
console.log('PASSOU: popup sempre envia exatamente Atividades propostas e ignora overrides antigos para Investigação.');

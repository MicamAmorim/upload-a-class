/* Testes locais totalmente offline: nenhuma chamada real ao 7Edu. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const code = fs.readFileSync(path.join(__dirname, '../extension/sevenedu.js'),'utf8');
const guid = (x) => `${x.repeat(8)}-${x.repeat(4)}-${x.repeat(4)}-${x.repeat(4)}-${x.repeat(12)}`;
const id = (n) => guid(n.toString(16));
const fixture = {employee:id(1),term:id(2),section:id(3),group:id(4),subterm:id(5),item:id(6),schedule:id(7),template:id(8),saved:id(9)};
const post = {id:'teste_2ma_filosofia_20261020', turma:'2MA',disciplina:'Filosofia',data:'2026-10-20',
  titulo:'Tema ético',html:'<p>Estudo da ética</p>',conteudo_7edu:'Tema ético\n\nEstudo da ética',
  horario:[{inicio:'09:15',fim:'10:00'}],quantidade_periodos:1};
const homeHtml = `<html><body>teacherportal<input name="academicTermSelectedId" value="${fixture.term}"><script>"Code": "2026-AL"</script></body></html>`;
const classHtml = `<html><body>teacherportal<select name="SectionItemId"><option selected value="${fixture.item}" data-attendancetype="0">Filosofia</option></select></body></html>`;
const section = {AcademicTermId:fixture.term,Identity:fixture.section,TermCourseOfferingGroupId:fixture.group,
 CourseOfferingGroup:'EMERE02MA',Name:'Filosofia',SectionSubtermList:[{Identity:fixture.subterm,
 AcademicSubterm:{StandardSubtermCode:'BIM04',StartDate:'2026/09/21 00:00:00',EndDate:'2026/12/11 00:00:00'}}]};
const slot = {Identity:fixture.schedule,ScheduleTemplateId:fixture.template,Priority:4,WeekDay:2,
 StartTime:'09:15:01',EndTime:'10:00:00'};
function harness(opts={}) {
 const calls=[];let saveBody=null;
 class Parser {
  parseFromString(html){return {
   querySelector(sel){return sel==='input[name="academicTermSelectedId"]' && html===homeHtml?{value:fixture.term}:null;},
   querySelectorAll(sel){return sel==='select[name="SectionItemId"] option[value]' && html===classHtml?
    [{value:fixture.item,hasAttribute:name=>name==='selected',getAttribute:name=>name==='data-attendancetype'?'0':null}]:[];}
  };}
 }
 async function fetch(url,options){
  const uri = new URL(url);calls.push({path:uri.pathname,opts:options});
  assert.equal(uri.origin,'https://7edu-br.educadventista.org');
  assert.equal(options.method,'POST');
  assert.equal(options.credentials,'same-origin');
  let result,mime='application/json';
  if (uri.pathname==='/teacherportal/') {result=opts.wrongYear?homeHtml.replace('2026-AL','2025-AL'):homeHtml;mime='text/html';}
  else if (uri.pathname.endsWith('GetListOpenedSectionByEmployee')) result={Data:opts.emptyClasses?[]:[section],Total:1,Errors:null};
  else if (uri.pathname==='/teacherportal/ClassMeeting') {result=classHtml;mime='text/html';}
  else if (uri.pathname.endsWith('Grid_Read')) {
   const row=opts.duplicate ? {RealizedDate:'2026/10/20 00:00:00'} :
    {ExpectedDate:opts.wrongDate?'2026/10/19 00:00:00':'2026/10/20 00:00:00',RealizedDate:null};
   result={Data:[{...row,ClassMeetingList:opts.twoPeriods?
       [{RealizedSchedule:slot},{RealizedSchedule:{...slot,Priority:5}}]:[{RealizedSchedule:slot}]}],Total:1,Errors:null};
  }
  else if (uri.pathname.endsWith('GetListScheduleTemplateItemByTerm')) result=opts.mismatch?[{...slot,StartTime:'10:20:01'}]:[slot];
  else if (uri.pathname.endsWith('/Save')) {saveBody=JSON.parse(options.body);result=fixture.saved;}
  else throw new Error('Mock: rota não prevista: '+uri.pathname);
  return {ok:true,status:200,headers:{get:()=>mime},text:async()=>mime==='text/html'?result:JSON.stringify(result)};
 }
 const context=vm.createContext({URL,URLSearchParams,DOMParser:Parser,fetch,location:{
   origin:'https://7edu-br.educadventista.org',pathname:'/teacherportal/ClassMeeting',
   href:`https://7edu-br.educadventista.org/teacherportal/ClassMeeting?employeeId=${fixture.employee}&sectionId=${fixture.section}&groupId=${fixture.group}`
 }});
 vm.runInContext(code,context,{filename:'sevenedu.js'});
 const execute=async(action,p=post,options={})=>vm.runInContext('sevenEduPageOperation',context)({action,post:p,options});
 return {execute,calls,saved:()=>saveBody};
}
(async()=>{
 const test=[];
 async function run(name,fn){await fn();test.push(name);console.log('OK',name);}
 await run('status: lista disciplinas sem escrita',async()=>{
  const t=harness();const r=await t.execute('status');assert.equal(r.ok,true);assert.equal(r.data.sections,1);
  assert.equal(t.calls.some(x=>x.path.endsWith('/Save')),false);
 });
 await run('check: leitura e duplicata ainda pendente nao bloqueia',async()=>{
  const t=harness();const r=await t.execute('check');assert.equal(r.ok,true);assert.equal(r.data.aulas_no_dia,0);
  assert.equal(t.calls.some(x=>x.path.endsWith('/Save')),false);
 });
 await run('publish: payload completo e gravacao unica',async()=>{
  const t=harness();const r=await t.execute('publish');assert.equal(r.ok,true,r.error);
  assert.equal(r.data.status,'criado');assert.equal(r.data.post_id,fixture.saved);
  assert.equal(t.calls.filter(x=>x.path.endsWith('/Save')).length,1);
  const p=t.saved();assert.equal(p.RealizedDate,'20/10/2026');assert.equal(p.RealizedContentAll,post.conteudo_7edu);
  assert.equal(p.SectionItemId,fixture.item);assert.equal(p.CourseOfferingSectionSubtermId,fixture.subterm);
  assert.equal(p.ClassMeetingList.length,1);assert.equal(p.ClassMeetingList[0].RealizedSchedule.Identity,fixture.schedule);
  assert.equal(p.Identity,'00000000-0000-0000-0000-000000000000');
 });
 await run('preflight: agenda e horários validam sem gravar',async()=>{
  const t=harness();const r=await t.execute('preflight');assert.equal(r.ok,true,r.error);
  assert.equal(r.data.status,'apto');assert.equal(r.data.aulas_previstas,1);
  assert.equal(t.calls.some(x=>x.path.endsWith('/Save')),false);
 });
 await run('calendar: exporta dias e numero de periodos sem gravação',async()=>{
  const t=harness({twoPeriods:true});const r=await t.execute('calendar',null,{scope:'current'});
  assert.equal(r.ok,true,r.error);assert.equal(r.data.count,1);
  assert.equal(r.data.entries[0].turma,'2MA');assert.equal(r.data.entries[0].aulas,2);
  assert.equal(r.data.entries[0].status,'pendente');assert.equal(r.data.entries[0].horarios.length,2);
  assert.equal(t.calls.some(x=>x.path.endsWith('/Save')),false);
  assert.equal(JSON.stringify(r.data).includes(fixture.employee),false);
 });
 await run('calendar: exporta todas as turmas elegíveis sem gravação',async()=>{
  const t=harness();const r=await t.execute('calendar',null,{scope:'all'});
  assert.equal(r.ok,true,r.error);assert.equal(r.data.sections_checked,1);
  assert.equal(t.calls.some(x=>x.path.endsWith('/Save')),false);
 });
 await run('preflight: data não prevista bloqueia o lote',async()=>{
  const t=harness({wrongDate:true});const r=await t.execute('preflight');
  assert.equal(r.ok,false);assert.match(r.error,/não consta/);
  assert.equal(t.calls.some(x=>x.path.endsWith('/Save')),false);
 });
 await run('preflight: quantidade de períodos incorreta bloqueia',async()=>{
  const t=harness({twoPeriods:true});const r=await t.execute('preflight');
  assert.equal(r.ok,false);assert.match(r.error,/contém 2 aula/);
  assert.equal(t.calls.some(x=>x.path.endsWith('/Save')),false);
 });
 await run('publish: registros ja realizados nao sao duplicados',async()=>{
  const t=harness({duplicate:true});const r=await t.execute('publish');assert.equal(r.ok,true);
  assert.equal(r.data.status,'ja_existente');assert.equal(t.calls.some(x=>x.path.endsWith('/Save')),false);
 });
 await run('publish: horario divergente bloqueia gravacao',async()=>{
  const t=harness({mismatch:true});const r=await t.execute('publish');assert.equal(r.ok,false);assert.match(r.error,/Horário/);
  assert.equal(t.calls.some(x=>x.path.endsWith('/Save')),false);
 });
 await run('publish: data futura bloqueada',async()=>{
  const t=harness();const r=await t.execute('publish',{...post,data:'2026-12-11'});
  assert.equal(r.ok,false);assert.match(r.error,/futura/);
  assert.equal(t.calls.some(x=>x.path.endsWith('/Save')),false);
 });
 await run('status: ano errado bloqueia',async()=>{
  const t=harness({wrongYear:true});const r=await t.execute('status');assert.equal(r.ok,false);
  assert.equal(t.calls.some(x=>x.path.endsWith('/Save')),false);
 });
 await run('check: sem disciplinas retorna falha controlada',async()=>{
  const t=harness({emptyClasses:true});const r=await t.execute('check');assert.equal(r.ok,false);
  assert.equal(t.calls.some(x=>x.path.endsWith('/Save')),false);
 });
 console.log(`PASSOU: ${test.length} cenários locais (sem rede).`);
})().catch(e=>{console.error(e);process.exitCode=1;});

'use strict';
const $=id=>document.getElementById(id);
let payload, payloadEclass, payload7Edu, records=[],selected=new Set(),sending=false,currentPreviewId=null,overrides={},overridesEclass={},overrides7Edu={},originals=new Map();
const READY_7EDU=new Set(['pronto_para_conferencia','revisao_pedagogica','proposta_para_aprovacao']);
function setSystemRecords(){
 payload = system()==='7edu' ? payload7Edu : payloadEclass;
 overrides = system()==='7edu' ? overrides7Edu : overridesEclass;
 records=payload.postagens.map(p=>({...p,...(overrides[p.id]||{})}));
 // Status, horários e origem são apenas da base de auditoria, nunca de sobrescritas do editor.
 if(system()==='7edu')records.forEach((p,i)=>{
  p.status=payload.postagens[i].status;
  p['7edu']=payload.postagens[i]['7edu'];
  p.data=payload.postagens[i].data;
  p.horario=payload.postagens[i].horario;
  p.quantidade_periodos=payload.postagens[i].quantidade_periodos;
  // O conteúdo padronizado de Investigação 7Edu prevalece sobre edições locais antigas,
  // sem apagar o armazenamento ou alterar nenhuma postagem do E-Class.
  if(p.disciplina==='Investigação Matemática'){
   p.titulo=payload.postagens[i].titulo;
   p.html=payload.postagens[i].html;
   p.conteudo_7edu=payload.postagens[i].conteudo_7edu;
  }
 });
 originals=new Map(payload.postagens.map(p=>[p.id,structuredClone(p)]));
}

function system(){return $('system').value;}
function convert7EduHtml(html){
 const doc=new DOMParser().parseFromString(String(html||''),'text/html');
 for(const bad of doc.querySelectorAll('script,style,iframe,object,svg'))bad.remove();
 const block=new Set(['p','div','section','article','header','footer','h1','h2','h3','h4','h5','h6','ul','ol','li','table','tr','blockquote','pre']);
 function walk(node){
  if(node.nodeType===3)return node.nodeValue||'';
  if(node.nodeType!==1)return '';
  const tag=node.tagName.toLowerCase();
  if(tag==='br')return '\n';
  if(tag==='img')return node.getAttribute('alt')?` [Figura: ${node.getAttribute('alt')}] `:' [Figura no plano original] ';
  const inner=Array.from(node.childNodes).map(walk).join('');
  if(tag==='li')return `\n• ${inner}\n`;
  if(tag==='td'||tag==='th')return inner+' | ';
  return block.has(tag)?'\n'+inner+'\n':inner;
 }
 return walk(doc.body).replace(/\u00a0/g,' ').replace(/[ \t]+\n/g,'\n')
   .replace(/\n[ \t]+/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
}
function forSystem(item){
 if(system()!=='7edu')return item;
 // Texto exato solicitado para todas as aulas de Investigação no 7Edu,
 // independentemente de títulos/HTML antigos existentes no armazenamento local.
 if(item.disciplina==='Investigação Matemática')
  return {...item,titulo:'Atividades propostas',html:'<p>Atividades propostas</p>',conteudo_7edu:'Atividades propostas'};
 return {...item,conteudo_7edu:`${item.titulo}\n\n${convert7EduHtml(item.html)}`.trim()};
}
function updateSystemUI(){
 const seven=system()==='7edu';
 $('publishMode').hidden=seven; $('historyApproval').hidden=!seven; $('assessmentApproval').hidden=!seven;
 $('calendarTools').hidden=!seven;
 $('systemNote').textContent=seven
 ? '7Edu: conteúdos redistribuídos por período e por ordem do planejamento. Datas projetadas (após 19/11/2026), domingos, registros e conteúdos indefinidos ficam BLOQUEADOS. Conferir históricos e avaliações antes de lançar.'
 : 'E-Class mantém o fluxo anterior com rascunho/publicação de HTML. Abra o calendário do portal e selecione o ano 2026 e a unidade correta.';
 $('publish').textContent=seven?'Lançar seleção no 7Edu':'Enviar seleção ao E-Class';
 $('testConnection').textContent=seven?'Testar 7Edu (sem lançar)':'Testar conexão (sem publicar)';
}
function summary(){
 if(system()==='7edu'){
  const real=records.filter(x=>!x['7edu']?.projecao_nao_confirmada);
  const ok=records.filter(x=>x['7edu']?.mapeamento==='redistribuido').length;
  const cards=[['datas reais no 7Edu',real.length],['datas futuras estimadas',records.length-real.length],
   ['planejadas para revisão',ok],['registradas',records.filter(x=>x['7edu']?.situacao_portal==='Registrado').length],
   ['conteúdo ainda sem encaixe',Object.values(payload.fila_sem_data||{}).reduce((n,arr)=>n+arr.length,0)]];
  $('stats').innerHTML=cards.map(([n,v])=>`<div class="stat"><b>${v}</b><small>${n}</small></div>`).join('');
  return;
 }
 const s=payload.estatisticas;
 const n=k=>records.filter(x=>x.status===k).length;
 const cards=[['postagens totais',records.length],['períodos programados',records.reduce((s,x)=>s+x.quantidade_periodos,0)],['aulas de Matemática',records.filter(x=>x.disciplina==='Matemática').length],['condensadas',n('revisao_pedagogica')],['propostas a revisar',n('proposta_para_aprovacao')]];
 $('stats').innerHTML=cards.map(([n,v])=>`<div class="stat"><b>${v}</b><small>${n}</small></div>`).join('');
}
function filtered(){
 return records.filter(x=>(!$('turma').value||x.turma===$('turma').value)&&
  (!$('disciplina').value||x.disciplina===$('disciplina').value)&&
  (!$('situacao').value||x.status===$('situacao').value)&&
  (!$('dataInicial').value||x.data>=$('dataInicial').value)&&
  (!$('dataFinal').value||x.data<=$('dataFinal').value));
}
function localToday(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
function isFuture7Edu(item){return system()==='7edu' && item.data>localToday();}
function canSelect(item){
 if(system()==='7edu'){
  const seven=item['7edu'],checks=seven?.requer||{};
  if(!seven||seven.mapeamento!=='redistribuido'||seven.situacao_portal!=='Pendente'||!item.html?.trim()||isFuture7Edu(item)||!READY_7EDU.has(item.status))return false;
  return (!checks.condensacao||$('approveCondensed').checked) && (!checks.proposta||$('approveProposals').checked) &&
    (!checks.historico||$('approveHistory').checked) && (!checks.avaliacao_data||$('approveAssessments').checked);
 }
 return !isFuture7Edu(item) && (item.status==='pronto_para_conferencia'||(item.status==='revisao_pedagogica'&&$('approveCondensed').checked)||(item.status==='proposta_para_aprovacao'&&$('approveProposals').checked));
}
function render(){
 const list=filtered();$('records').replaceChildren();
 for(const item of list){
  const row=document.createElement('div');row.className='rec';
  const cb=document.createElement('input');cb.type='checkbox';cb.checked=selected.has(item.id);cb.disabled=sending||!canSelect(item);
  cb.addEventListener('change',()=>{cb.checked?selected.add(item.id):selected.delete(item.id);updateCount();});
  const body=document.createElement('div');
  const title=document.createElement('b');title.textContent=`${item.data.split('-').reverse().join('/')} · ${item.turma} · ${item.disciplina}`;
  const tag=document.createElement('span');tag.className='tag'+(item.status==='revisao_pedagogica'?' warning':item.status==='proposta_para_aprovacao'?' block':'');
  tag.textContent=isFuture7Edu(item)?'Futura / bloqueada':system()==='7edu'&&!READY_7EDU.has(item.status)?
  ({registrado_7edu:'Já registrada',domingo_atipico:'Data atípica / domingo',sem_plano_7edu:'Sem plano',divergencia_periodos_7edu:'Períodos divergentes',divergencia_horarios_7edu:'Horários divergentes',futuro_7edu:'Futura'}[item.status]||'Bloqueada'):
  item.status==='revisao_pedagogica'?'Condensada':item.status==='proposta_para_aprovacao'?'Proposta':'Conferir';title.append(tag);
  const sub=document.createElement('div');sub.className='subtitle';sub.textContent=`${item.quantidade_periodos} período(s) · ${item.horario.map(x=>x.inicio+'–'+x.fim).join(', ')} · Planos: ${item.planos_originais.join(', ')||'não fornecidos'}`;
  const topic=document.createElement('small');topic.textContent=item.titulo.slice(0,185);
  body.append(title,sub,topic);
  if(system()==='7edu' && !READY_7EDU.has(item.status)){
   const note=document.createElement('small');note.className='waiting';
   note.textContent=`Não selecionável: ${item.observacao||'revisão de calendário pendente'}`;
   body.append(note);
  }
  if(isFuture7Edu(item)){const waiting=document.createElement('small');waiting.className='waiting';waiting.textContent='7Edu não permite lançar esta data antes do dia da aula.';body.append(waiting);}
  const btn=document.createElement('button');btn.className='secondary';btn.textContent='Prévia';btn.addEventListener('click',()=>{
   currentPreviewId=item.id; $('editor').hidden=true; $('saveEditor').hidden=true; $('restoreOriginal').hidden=true; $('toggleEditor').textContent='Editar HTML/título';
   $('titleEditor').value=item.titulo; $('htmlEditor').value=item.html;
   $('previewTitle').textContent=item.titulo;
   const warn=item.html||`<p><strong>Publicação bloqueada.</strong> ${item.observacao}</p>`;
   $('previewFrame').srcdoc=`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><body style="font:15px/1.6 Arial;padding:20px;max-width:760px;margin:auto">${warn}</body></html>`;
   const seven=system()==='7edu';$('previewFrame').hidden=seven;$('plainPreview').hidden=!seven;
   if(seven)$('plainPreview').textContent=forSystem(item).conteudo_7edu;
   $('preview').showModal();
  });
  row.append(cb,body,btn);$('records').append(row);
 }
 if(!list.length){$('records').textContent='Nenhuma postagem com os filtros selecionados.';}
 updateCount();
}
function updateCount(){ $('selected').textContent=`${selected.size} selecionada(s)`; $('publish').disabled=sending||selected.size===0;}
async function request(action,data={}){const r=await chrome.runtime.sendMessage({action,system:system(),...data});if(!r?.ok)throw new Error(r?.error||'Falha na extensão');return r;}
async function refreshSession(){
 try{const r=await request('status');$('context').className='pane good';$('context').textContent=system()==='7edu'
 ? `7Edu · ano ${r.year} · ${r.sections} disciplinas disponíveis. Faça o teste de leitura antes do lançamento.`
 : `Contexto escolar identificado · ano ${r.year} · unidade ${r.entity}. Autenticação da API NÃO verificada: use Testar conexão antes do envio.`;}
 catch(e){$('context').className='pane error';$('context').textContent=`Sessão não disponível: ${e.message}`;}
}
async function testConnection(){
 const readable=x=>system()!=='7edu'||(x['7edu']?.mapeamento==='redistribuido' && x.html?.trim());
 const item=filtered().find(x=>readable(x)&&x.disciplina==='Matemática')||filtered().find(readable)||records.find(readable);
 if(!item){$('progress').textContent='Nenhum registro disponível para testar.';return;}
 const button=$('testConnection');button.disabled=true;
 $('progress').textContent=`Testando acesso de leitura: ${item.turma}, ${item.disciplina}, ${item.data}…`;
 try{
  const r=await request('check',{post:forSystem(item)});
  $('progress').textContent=system()==='7edu'
    ? `7Edu conectado: ${r.result.turma}, ${r.result.disciplina}, ${r.result.aulas_no_dia} aula(s) já ministradas em ${r.result.data}. Nenhuma aula foi lançada.`
    : `Conexão OK: turma ${r.result.turma}, disciplina ${r.result.disciplina}, ${r.result.aulas_no_dia} aula(s) encontradas no dia. A consulta ignora Atividades. Nenhuma aula foi enviada.`;
 }catch(err){
  $('progress').textContent=`Falha no teste: ${err.message}. Nenhuma aula foi enviada.`;
  console.error('Falha no teste de conexão',err);
 }finally{button.disabled=false;}
}
function download7EduMd(markdown, scope){
 const blob=new Blob([markdown],{type:'text/markdown;charset=utf-8'});
 const url=URL.createObjectURL(blob);
 const anchor=document.createElement('a');anchor.href=url;
 const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
 const stem=scope==='all'?'todas-disciplinas':`${normalize($('turma').value||'turma')}-disciplina-aberta`;
 anchor.download=`7edu_calendario_${stem}_4bim_2026.md`;
 document.body.append(anchor);anchor.click();anchor.remove();
 setTimeout(()=>URL.revokeObjectURL(url),3000);
}
async function exportCalendar(scope){
 if(sending)return;
 const button=$(scope==='all'?'exportAll7Edu':'exportCurrent7Edu');
 $('exportCurrent7Edu').disabled=true;$('exportAll7Edu').disabled=true;
 $('progress').textContent=scope==='all'?'Consultando todos os diários 7Edu, somente leitura…':'Consultando disciplina aberta no 7Edu, somente leitura…';
 try{
  const r=await request('calendar',{options:{scope}});
  const md=calendar7EduMarkdown(r.result);
  download7EduMd(md,scope);
  $('progress').textContent=`Arquivo .md gerado com ${r.result.count} data(s), ${r.result.sections_checked} disciplina(s) consultada(s)`+
   (r.result.warnings.length?` e ${r.result.warnings.length} alerta(s) a conferir.`:'.')+
   ' Não foi enviada nenhuma aula.';
 }catch(err){ $('progress').textContent=`Exportação não realizada: ${err.message}. Nenhuma aula foi enviada.`;}
 finally{$('exportCurrent7Edu').disabled=false;$('exportAll7Edu').disabled=false;}
}
async function sendSelection(){
 if(sending)return;
 const chosen=records.filter(x=>selected.has(x.id));
 if(system()==='7edu'&&chosen.some(x=>!x['7edu']||x['7edu'].mapeamento!=='redistribuido'||x['7edu'].situacao_portal!=='Pendente')){
  alert('Mapeamento do 7Edu não validado. Nenhuma aula foi lançada.');return;
 }
 if(chosen.some(x=>!canSelect(x))){alert('Uma ou mais aulas escolhidas estão bloqueadas. Revise a seleção.');return;}
 const approve=$('approveCondensed').checked,approveProposals=$('approveProposals').checked,approveHistory=$('approveHistory').checked,approveAssessments=$('approveAssessments').checked,publish=$('publishNow').checked;
 const seven=system()==='7edu';
 const prompt=seven
 ? `Lançar ${chosen.length} aula(s) no 7Edu como AULAS MINISTRADAS?\nNão há rascunhos nesse fluxo. O conteúdo será convertido de HTML para texto simples.\n${approve?'Condensação autorizada.':'Sem condensação autorizada.'}\n${approveProposals?'Propostas sem plano-fonte autorizadas.':'Sem aprovação das propostas.'}\n${approveHistory?'Sequência com histórico anterior conferida.':'Histórico não conferido.'}\n${approveAssessments?'Datas de avaliações conferidas.':'Datas de avaliações não conferidas.'}\n\nConfira as datas, horários e conteúdos. Não serão alteradas aulas já lançadas.`
 : `Enviar ${chosen.length} postagem(ns) ao E-Class?\nModo: ${publish?'PUBLICAR imediatamente':'CRIAR RASCUNHOS'}.\n${approve?'A condensação pedagógica foi autorizada.':'Sem condensação autorizada.'}\n${approveProposals?'As propostas de Investigação/Filosofia foram autorizadas nesta operação.':'Sem aprovação das propostas sem plano-fonte.'}\n\nNão serão sobrescritas postagens já existentes.\nEsta ação altera o portal de verdade.`;
 if(!confirm(prompt))return;
 sending=true;$('system').disabled=true;render();let done=0,skipped=0,conflicts=0,failed=0,lastNote='';
 $('progress').textContent='Verificando todo o lote antes da primeira gravação (somente leitura)…';
 const ready=[];let already=0;
 try{
   // No 7Edu, conferir todas as datas, dias previstos, números de aulas e horários ANTES de alterar o portal.
   // Se um único item falhar, nenhum POST será disparado neste lote.
   if(!seven){
     // Preservar exatamente o fluxo E-Class anterior: testar apenas o primeiro item.
     await request('check',{post:forSystem(chosen[0])});
     ready.push(...chosen);
   }else{
     for(const [i,item] of chosen.entries()){
       $('progress').textContent=`Pré-validação ${i+1}/${chosen.length}: ${item.turma}, ${item.disciplina}, ${item.data} (sem gravar)…`;
       const verified=await request('preflight',{post:forSystem(item)});
       if(verified.result.status==='ja_existente'){already++;continue;}
       if(verified.result.status!=='apto')throw new Error(`Estado inesperado na data ${item.data}: verifique o diário.`);
       ready.push(item);
     }
   }
 }catch(err){
   sending=false;$('system').disabled=false;render();
   $('progress').textContent=`LOTE NÃO INICIADO: ${err.message}. Todos os envios deste lote foram suspensos. Não houve gravação nesta tentativa.`;
   return;
 }
 if(!ready.length){sending=false;$('system').disabled=false;render();$('progress').textContent=`Nada para lançar: ${already} aula(s) já registradas no 7Edu. Nenhuma gravação realizada.`;return;}
 for(const [i,item] of ready.entries()){
  $('progress').textContent=`Enviando ${i+1}/${ready.length}: ${item.turma} em ${item.data}…`;
  try{
   const r=await request('publish',{post:forSystem(item),options:{approveCondensed:approve,approveProposals,approveHistory,approveAssessments,published:publish}});
   if(r.result.status==='criado'){done++;selected.delete(item.id);}
   else if(r.result.status==='conflito'){conflicts++;lastNote=`CONFLITO — ${item.turma}, ${item.data}: ${r.result.detail}`;console.warn(lastNote);}
   else {skipped++;lastNote=`Ignorada — ${item.turma}, ${item.data}: ${r.result.detail||r.result.status}`;selected.delete(item.id);}
  }catch(err){
   failed++;console.error('Falha na postagem',item.id,err.message);
   $('progress').textContent=`LOTE INTERROMPIDO por segurança após ${i+1}/${ready.length} tentativa(s). Concluídas: ${done}; ignoradas: ${skipped}; conflitos: ${conflicts}; falhas: ${failed}. Erro: ${err.message}. As demais aulas NÃO foram tentadas.`;
   sending=false;$('system').disabled=false;render();return;
  }
  $('progress').textContent=`Concluídas ${done} · Ignoradas ${skipped} · Conflitos ${conflicts} · Falhas ${failed} · ${i+1}/${ready.length}${lastNote?' — '+lastNote:''}`;
 }
 sending=false;$('system').disabled=false;render();
 $('progress').textContent+=already?` — ${already} registro(s) já existentes foram preservados.`:'';
 $('progress').textContent+=conflicts?` — ${conflicts} conflito(s) requer(em) revisão. Nenhum registro em conflito foi enviado.`:` — Fim do lote sem falhas.`;
}
async function init(){
 [payloadEclass,payload7Edu]=await Promise.all([
  fetch(chrome.runtime.getURL('data/aulas_4bim_2026.json')).then(r=>{if(!r.ok)throw Error('Base E-Class ausente');return r.json()}),
  fetch(chrome.runtime.getURL('data/aulas_7edu_4bim_2026.json')).then(r=>{if(!r.ok)throw Error('Base 7Edu ausente');return r.json()})
 ]);
 const storage=await chrome.storage.local.get(['aula_overrides','aula_overrides_7edu']);
 overridesEclass=storage.aula_overrides||{};overrides7Edu=storage.aula_overrides_7edu||{};
 const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
 if(tab?.url?.startsWith('https://7edu-br.educadventista.org/'))$('system').value='7edu';
 setSystemRecords();updateSystemUI();summary();render();refreshSession();
 $('system').addEventListener('change',()=>{if(sending)return;selected.clear();setSystemRecords();updateSystemUI();summary();render();refreshSession();$('progress').textContent='';});
 for(const el of document.querySelectorAll('.filters input,.filters select'))el.addEventListener('change',render);
 $('approveCondensed').addEventListener('change',()=>{
  if(!$('approveCondensed').checked){for(const p of records)if(system()==='7edu' ? p['7edu']?.requer?.condensacao : p.status==='revisao_pedagogica')selected.delete(p.id);}
  render();
 });
 $('approveProposals').addEventListener('change',()=>{
  if(!$('approveProposals').checked){for(const p of records)if(system()==='7edu' ? p['7edu']?.requer?.proposta : p.status==='proposta_para_aprovacao')selected.delete(p.id);}
  render();
 });
 $('approveHistory').addEventListener('change',()=>{if(!$('approveHistory').checked)for(const p of records)if(p['7edu']?.requer?.historico)selected.delete(p.id);render();});
 $('approveAssessments').addEventListener('change',()=>{if(!$('approveAssessments').checked)for(const p of records)if(p['7edu']?.requer?.avaliacao_data)selected.delete(p.id);render();});
 $('selectAll').onclick=()=>{for(const x of filtered())if(canSelect(x))selected.add(x.id);render();};
 $('clear').onclick=()=>{selected.clear();render();};
 $('publish').onclick=sendSelection;
 $('testConnection').onclick=testConnection;
 $('exportCurrent7Edu').onclick=()=>exportCalendar('current');
 $('exportAll7Edu').onclick=()=>exportCalendar('all');
 $('closePreview').onclick=()=>$('preview').close();
 $('toggleEditor').onclick=()=>{
  const item=records.find(x=>x.id===currentPreviewId);
  if(system()==='7edu' && item?.disciplina==='Investigação Matemática'){
   alert('Investigação Matemática no 7Edu usa o texto padronizado: Atividades propostas. Para mudar essa regra, atualize a base de planejamento.');
   return;
  }
  if(system()==='7edu' && !READY_7EDU.has(item?.status)){alert('Data bloqueada. Ajuste o mapeamento e gere nova base antes de editar para envio.');return;}
  const show=$('editor').hidden;$('editor').hidden=!show;$('saveEditor').hidden=!show;$('restoreOriginal').hidden=!show;$('toggleEditor').textContent=show?'Ocultar editor':'Editar HTML/título';};
 $('saveEditor').onclick=async()=>{
  const post=records.find(x=>x.id===currentPreviewId);if(!post)return;
  const h=$('htmlEditor').value.trim(),t=$('titleEditor').value.trim();
  if(!h||!t){alert('Título e HTML não podem estar vazios.');return;}
  post.html=h;post.titulo=t;overrides[post.id]={html:h,titulo:t};
  await chrome.storage.local.set({[system()==='7edu'?'aula_overrides_7edu':'aula_overrides']:overrides});
  $('previewTitle').textContent=t;$('previewFrame').srcdoc=`<meta charset="utf-8"><body style="padding:20px;max-width:760px;margin:auto;font:15px/1.6 Arial">${h}</body>`;if(system()==='7edu')$('plainPreview').textContent=forSystem(post).conteudo_7edu;
  render();alert('Revisão salva localmente no navegador. O JSON original não foi alterado.');
 };
 $('restoreOriginal').onclick=async()=>{
  const post=records.find(x=>x.id===currentPreviewId),src=originals.get(currentPreviewId);if(!post||!src)return;
  post.html=src.html;post.titulo=src.titulo;delete overrides[post.id];await chrome.storage.local.set({[system()==='7edu'?'aula_overrides_7edu':'aula_overrides']:overrides});
  $('htmlEditor').value=post.html;$('titleEditor').value=post.titulo;$('previewTitle').textContent=post.titulo;
  $('previewFrame').srcdoc=`<meta charset="utf-8"><body style="padding:20px;max-width:760px;margin:auto;font:15px/1.6 Arial">${post.html}</body>`;if(system()==='7edu')$('plainPreview').textContent=forSystem(post).conteudo_7edu;render();
 };
}
init().catch(e=>{$('context').className='pane error';$('context').textContent=e.message;});

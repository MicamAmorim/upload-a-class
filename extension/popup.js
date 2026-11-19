'use strict';
const $=id=>document.getElementById(id);
let payload,records=[],selected=new Set(),sending=false,currentPreviewId=null,overrides={},originals=new Map();
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
 return {...item,conteudo_7edu:`${item.titulo}\n\n${convert7EduHtml(item.html)}`.trim()};
}
function updateSystemUI(){
 const seven=system()==='7edu';
 $('publishMode').hidden=seven;
 $('systemNote').textContent=seven
 ? '7Edu registra Aulas Ministradas em texto simples, sem modo rascunho. Abra uma disciplina → Aulas Ministradas no 7Edu. Os registros são conferidos por turma, disciplina, data e períodos antes da gravação; datas futuras não são lançadas.'
 : 'E-Class mantém o fluxo anterior com rascunho/publicação de HTML. Abra o calendário do portal e selecione o ano 2026 e a unidade correta.';
 $('publish').textContent=seven?'Lançar seleção no 7Edu':'Enviar seleção ao E-Class';
 $('testConnection').textContent=seven?'Testar 7Edu (sem lançar)':'Testar conexão (sem publicar)';
}
function summary(){
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
function canSelect(item){return item.status==='pronto_para_conferencia'||(item.status==='revisao_pedagogica'&&$('approveCondensed').checked)||(item.status==='proposta_para_aprovacao'&&$('approveProposals').checked);}
function render(){
 const list=filtered();$('records').replaceChildren();
 for(const item of list){
  const row=document.createElement('div');row.className='rec';
  const cb=document.createElement('input');cb.type='checkbox';cb.checked=selected.has(item.id);cb.disabled=sending||!canSelect(item);
  cb.addEventListener('change',()=>{cb.checked?selected.add(item.id):selected.delete(item.id);updateCount();});
  const body=document.createElement('div');
  const title=document.createElement('b');title.textContent=`${item.data.split('-').reverse().join('/')} · ${item.turma} · ${item.disciplina}`;
  const tag=document.createElement('span');tag.className='tag'+(item.status==='revisao_pedagogica'?' warning':item.status==='proposta_para_aprovacao'?' block':'');
  tag.textContent=item.status==='revisao_pedagogica'?'Condensada':item.status==='proposta_para_aprovacao'?'Proposta':'Conferir';title.append(tag);
  const sub=document.createElement('div');sub.className='subtitle';sub.textContent=`${item.quantidade_periodos} período(s) · ${item.horario.map(x=>x.inicio+'–'+x.fim).join(', ')} · Planos: ${item.planos_originais.join(', ')||'não fornecidos'}`;
  const topic=document.createElement('small');topic.textContent=item.titulo.slice(0,185);
  body.append(title,sub,topic);
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
 const item=filtered().find(x=>x.disciplina==='Matemática')||filtered()[0]||records.find(x=>x.disciplina==='Matemática');
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
async function sendSelection(){
 if(sending)return;
 const chosen=records.filter(x=>selected.has(x.id));
 if(chosen.some(x=>!canSelect(x))){alert('Uma ou mais aulas escolhidas estão bloqueadas. Revise a seleção.');return;}
 const approve=$('approveCondensed').checked,approveProposals=$('approveProposals').checked,publish=$('publishNow').checked;
 const seven=system()==='7edu';
 const prompt=seven
 ? `Lançar ${chosen.length} aula(s) no 7Edu como AULAS MINISTRADAS?\nNão há rascunhos nesse fluxo. O conteúdo será convertido de HTML para texto simples.\n${approve?'Condensação autorizada.':'Sem condensação autorizada.'}\n${approveProposals?'Propostas sem plano-fonte autorizadas.':'Sem aprovação das propostas.'}\n\nConfira as datas, horários e conteúdos. Não serão alteradas aulas já lançadas.`
 : `Enviar ${chosen.length} postagem(ns) ao E-Class?\nModo: ${publish?'PUBLICAR imediatamente':'CRIAR RASCUNHOS'}.\n${approve?'A condensação pedagógica foi autorizada.':'Sem condensação autorizada.'}\n${approveProposals?'As propostas de Investigação/Filosofia foram autorizadas nesta operação.':'Sem aprovação das propostas sem plano-fonte.'}\n\nNão serão sobrescritas postagens já existentes.\nEsta ação altera o portal de verdade.`;
 if(!confirm(prompt))return;
 sending=true;$('system').disabled=true;render();let done=0,skipped=0,conflicts=0,failed=0,lastNote='';
 $('progress').textContent='Validando autenticação antes do lote (somente leitura; nenhuma aula enviada)...';
 try{
   // Nunca começar um lote sem um GET bem-sucedido; se a sessão estiver expirada,
   // interromper ANTES do primeiro POST. Não fazer retry automático de POST.
   await request('check',{post:forSystem(chosen[0])});
 }catch(err){
   sending=false;$('system').disabled=false;render();
   $('progress').textContent=`LOTE NÃO INICIADO: ${err.message}. Nenhuma aula foi enviada por esta tentativa.`;
   return;
 }
 for(const [i,item] of chosen.entries()){
  $('progress').textContent=`Enviando ${i+1}/${chosen.length}: ${item.turma} em ${item.data}…`;
  try{
   const r=await request('publish',{post:forSystem(item),options:{approveCondensed:approve,approveProposals,published:publish}});
   if(r.result.status==='criado'){done++;selected.delete(item.id);}
   else if(r.result.status==='conflito'){conflicts++;lastNote=`CONFLITO — ${item.turma}, ${item.data}: ${r.result.detail}`;console.warn(lastNote);}
   else {skipped++;lastNote=`Ignorada — ${item.turma}, ${item.data}: ${r.result.detail||r.result.status}`;selected.delete(item.id);}
  }catch(err){
   failed++;console.error('Falha na postagem',item.id,err.message);
   $('progress').textContent=`LOTE INTERROMPIDO por segurança após ${i+1}/${chosen.length} tentativa(s). Concluídas: ${done}; ignoradas: ${skipped}; conflitos: ${conflicts}; falhas: ${failed}. Erro: ${err.message}. As demais aulas NÃO foram tentadas.`;
   sending=false;$('system').disabled=false;render();return;
  }
  $('progress').textContent=`Concluídas ${done} · Ignoradas ${skipped} · Conflitos ${conflicts} · Falhas ${failed} · ${i+1}/${chosen.length}${lastNote?' — '+lastNote:''}`;
 }
 sending=false;$('system').disabled=false;render();
 $('progress').textContent+=conflicts?` — ${conflicts} conflito(s) requer(em) revisão. Nenhum registro em conflito foi enviado.`:` — Fim do lote sem falhas.`;
}
async function init(){
 payload=await (await fetch(chrome.runtime.getURL('data/aulas_4bim_2026.json'))).json();
 originals=new Map(payload.postagens.map(p=>[p.id,structuredClone(p)]));
 overrides=(await chrome.storage.local.get('aula_overrides')).aula_overrides||{};
 records=payload.postagens.map(p=>({...p,...(overrides[p.id]||{})}));
 const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
 if(tab?.url?.startsWith('https://7edu-br.educadventista.org/'))$('system').value='7edu';
 updateSystemUI();summary();render();refreshSession();
 $('system').addEventListener('change',()=>{if(sending)return;selected.clear();updateSystemUI();render();refreshSession();$('progress').textContent='';});
 for(const el of document.querySelectorAll('.filters input,.filters select'))el.addEventListener('change',render);
 $('approveCondensed').addEventListener('change',()=>{
  if(!$('approveCondensed').checked){for(const p of records)if(p.status==='revisao_pedagogica')selected.delete(p.id);}
  render();
 });
 $('approveProposals').addEventListener('change',()=>{
  if(!$('approveProposals').checked){for(const p of records)if(p.status==='proposta_para_aprovacao')selected.delete(p.id);}
  render();
 });
 $('selectAll').onclick=()=>{for(const x of filtered())if(canSelect(x))selected.add(x.id);render();};
 $('clear').onclick=()=>{selected.clear();render();};
 $('publish').onclick=sendSelection;
 $('testConnection').onclick=testConnection;
 $('closePreview').onclick=()=>$('preview').close();
 $('toggleEditor').onclick=()=>{const show=$('editor').hidden;$('editor').hidden=!show;$('saveEditor').hidden=!show;$('restoreOriginal').hidden=!show;$('toggleEditor').textContent=show?'Ocultar editor':'Editar HTML/título';};
 $('saveEditor').onclick=async()=>{
  const post=records.find(x=>x.id===currentPreviewId);if(!post)return;
  const h=$('htmlEditor').value.trim(),t=$('titleEditor').value.trim();
  if(!h||!t){alert('Título e HTML não podem estar vazios.');return;}
  post.html=h;post.titulo=t;overrides[post.id]={html:h,titulo:t};
  await chrome.storage.local.set({aula_overrides:overrides});
  $('previewTitle').textContent=t;$('previewFrame').srcdoc=`<meta charset="utf-8"><body style="padding:20px;max-width:760px;margin:auto;font:15px/1.6 Arial">${h}</body>`;if(system()==='7edu')$('plainPreview').textContent=forSystem(post).conteudo_7edu;
  render();alert('Revisão salva localmente no navegador. O JSON original não foi alterado.');
 };
 $('restoreOriginal').onclick=async()=>{
  const post=records.find(x=>x.id===currentPreviewId),src=originals.get(currentPreviewId);if(!post||!src)return;
  post.html=src.html;post.titulo=src.titulo;delete overrides[post.id];await chrome.storage.local.set({aula_overrides:overrides});
  $('htmlEditor').value=post.html;$('titleEditor').value=post.titulo;$('previewTitle').textContent=post.titulo;
  $('previewFrame').srcdoc=`<meta charset="utf-8"><body style="padding:20px;max-width:760px;margin:auto;font:15px/1.6 Arial">${post.html}</body>`;if(system()==='7edu')$('plainPreview').textContent=forSystem(post).conteudo_7edu;render();
 };
}
init().catch(e=>{$('context').className='pane error';$('context').textContent=e.message;});

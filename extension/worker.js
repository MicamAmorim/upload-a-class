'use strict';
importScripts('sevenedu.js');
/**
 * Não contém chaves nem tokens fixos. Captura SOMENTE metadados x-portal-*.
 * Autenticação: lê o token do portal na página e, quando recebe HTTP 401 em GET,
 * usa a rota oficial de renovação identificada no HAR. Sem retry de POST.
 * O token fica em fechamento de função na aba e não vai ao worker, armazenamento
 * da extensão, logs ou popup. Requisições não enviam cookies.
 */
const PORTAL = 'https://portal.educacaoadventista.org.br/';
const API = 'https://api-eclass.educacaoadventista.org.br/api/v1/';
const USERS = 'https://api-usuario.educacaoadventista.org.br/api/v1/';
const ALLOWED = new Set(['x-portal-academic-year','x-portal-association','x-portal-division','x-portal-entity','x-portal-profile-id','x-portal-publisher','x-portal-union']);
const contextKey = tab => `context_tab_${tab}`;
chrome.webRequest.onBeforeSendHeaders.addListener(details => {
  if (details.tabId < 0 || !details.initiator?.startsWith(PORTAL.replace(/\/$/,''))) return;
  let headers = {};
  for (const h of details.requestHeaders || []) if(ALLOWED.has(h.name.toLowerCase())) headers[h.name.toLowerCase()] = h.value;
  if (!headers['x-portal-academic-year'] || !headers['x-portal-entity']) return;
  // Só registra metadados operacionais, nunca Authorization, Cookie nem CSRF.
  // Isso NÃO comprova autenticação válida: somente um GET respondido com sucesso o faz.
  chrome.storage.session.set({[contextKey(details.tabId)]:{headers,seenAt:Date.now()}}).catch(()=>{});
},{urls:[`${API}*`,`${USERS}*`]},['requestHeaders','extraHeaders']);

async function activePortalTab(){
  let arr=await chrome.tabs.query({active:true,currentWindow:true});
  const tab=arr[0];
  if(!tab || !tab.url?.startsWith(PORTAL)) throw new Error('Abra https://portal.educacaoadventista.org.br/ e atualize a página.');
  return tab;
}
async function context(tab){
  const obj=await chrome.storage.session.get(contextKey(tab.id));
  const c=obj[contextKey(tab.id)];
  if(!c)throw new Error('Contexto do E-Class não identificado. Abra o calendário de aulas no portal e recarregue a página.');
  if(c.headers['x-portal-academic-year']!=='2026')throw new Error('Ano letivo ativo não é 2026: selecione 2026 no portal e recarregue.');
  if(c.headers['x-portal-entity']!=='89')throw new Error('A unidade ativa não é Itabuna (entidade 89). Troque para a escola correta.');
  return c;
}
async function pageRequest(tab,url,method,headers,payload){
  // Apenas rotas usadas pelo planejador. O refresh só usa a API oficial de login.
  const isSchoolApi=url.startsWith(USERS) && (
    /^turmas-escola\/89\?strictUser=true$/.test(url.slice(USERS.length)) ||
    /^lista-disciplinas-turma\/\d+\?strictUser=true$/.test(url.slice(USERS.length)));
  const isEclassApi=url.startsWith(API) && (
    /^posts\?date_min=2026-\d\d-\d\d&date_max=2026-\d\d-\d\d&worker_id=1$/.test(url.slice(API.length)) ||
    (url===`${API}dailies` && method==='POST'));
  if ((!isSchoolApi && !isEclassApi) || !['GET','POST'].includes(method))
    throw new Error('URL ou método fora das rotas autorizadas do planejador.');
  const args={url,method,headers,payload};
  const responses=await chrome.scripting.executeScript({target:{tabId:tab.id},world:'MAIN',func:async (arg)=>{
    try {
      const namespace='__eclass_bridge_4bim_104';
      if(typeof window[namespace]!=='function'){
        // O Bearer existe SOMENTE neste fechamento (contexto MAIN da aba).
        // Não é retornado ao service worker, popup, logs ou storage da extensão.
        let refreshedToken=null;
        let refreshExpiresAt=0;
        const loginUrl='https://login.educacaoadventista.org.br/api/v1/atualiza-token';
        const readStoredToken=()=>{
          const raw=window.localStorage.getItem('portal-token');
          try {const parsed=JSON.parse(raw);return typeof parsed==='string'&&parsed.trim()?parsed:null;}
          catch {return null;}
        };
        const decodeResponse=async r=>{
          const raw=await r.text();
          try {return {ok:r.ok,status:r.status,data:JSON.parse(raw)};}
          catch {return {ok:r.ok,status:r.status,data:{message:raw.slice(0,300)}};}
        };
        const validCache=()=>refreshedToken && Date.now() < refreshExpiresAt;
        const refresh=async current=>{
          if(!current) return {ok:false,status:0,authState:'missing',error:'AUTH_CONTEXT_MISSING: sessão não encontrada no portal.'};
          // Mesma rota de renovação observada no HAR. Não altera o estado Angular
          // nem sobrescreve o token mantido pela aplicação.
          const r=await window.fetch(loginUrl,{
            method:'POST',credentials:'omit',cache:'no-store',
            headers:{Accept:'application/json, text/plain, */*','Content-Type':'application/json',Authorization:`Bearer ${current}`},
            body:'{}'
          });
          const parsed=await decodeResponse(r);
          if(!parsed.ok || typeof parsed.data?.token!=='string' || !parsed.data.token.trim())
            return {ok:false,status:parsed.status,authState:'refresh_failed',error:`AUTH_REFRESH_FAILED: servidor de autenticação respondeu HTTP ${parsed.status}.`};
          refreshedToken=parsed.data.token;
          const ttl=Number(parsed.data.expires_in);
          refreshExpiresAt=Date.now()+Math.max(30,Math.min(Number.isFinite(ttl)?ttl:300,3600)-45)*1000;
          return {ok:true};
        };
        const requestWith=async (args,token)=>{
          const h={Accept:'application/json, text/plain, */*','Content-Language':'pt-BR',...args.headers,Authorization:`Bearer ${token}`};
          if(args.payload!==undefined)h['Content-Type']='application/json';
          const r=await window.fetch(args.url,{
            method:args.method,headers:h,credentials:'omit',cache:'no-store',
            body:args.payload===undefined?undefined:JSON.stringify(args.payload)
          });
          return decodeResponse(r);
        };
        const callable=async args=>{
          // Guarda de defesa em profundidade para chamadas realizadas na própria página.
          const api='https://api-eclass.educacaoadventista.org.br/api/v1/';
          const users='https://api-usuario.educacaoadventista.org.br/api/v1/';
          const allowed=(args.method==='GET' && (
             /^https:\/\/api-usuario\.educacaoadventista\.org\.br\/api\/v1\/(turmas-escola\/89|lista-disciplinas-turma\/\d+)\?strictUser=true$/.test(args.url) ||
             /^https:\/\/api-eclass\.educacaoadventista\.org\.br\/api\/v1\/posts\?date_min=2026-\d\d-\d\d&date_max=2026-\d\d-\d\d&worker_id=1$/.test(args.url))) ||
             (args.method==='POST' && args.url===`${api}dailies` && args.payload?.target?.[0]?.entity_id===89);
          if(!allowed) return {ok:false,status:0,error:'Chamada não autorizada pelo planejador.'};
          let token=validCache()?refreshedToken:readStoredToken();
          if(!token)return {ok:false,status:0,authState:'missing',error:'AUTH_CONTEXT_MISSING: faça login e abra o calendário.'};
          // Jamais começar um POST com uma credencial cujo prazo não foi validado.
          // A eventual repetição automática é permitida apenas para GET.
          if(args.method==='POST' && !validCache()){
            const renew=await refresh(token);
            if(!renew.ok)return renew;
            token=refreshedToken;
          }
          let result=await requestWith(args,token);
          if(result.status===401 && args.method==='GET'){
            // O portal usa o token do store Angular; o localStorage pode estar defasado.
            // Renovar a sessão, e repetir SOMENTE a leitura, é seguro.
            const renewed=await refresh(token);
            if(!renewed.ok)return renewed;
            result=await requestWith(args,refreshedToken);
          }
          return result;
        };
        Object.defineProperty(window,namespace,{value:callable,configurable:true,enumerable:false,writable:false});
      }
      return await window[namespace](arg);
    }catch(error){return {ok:false,status:0,error:String(error?.message||error)};}
  },args:[args]});
  const r=responses?.[0]?.result;
  if(!r)throw new Error('Não foi possível executar a requisição dentro da aba do portal.');
  if(!r.ok){
    if(r.authState==='missing'||r.authState==='refresh_failed')throw new Error(r.error);
    if(r.status===401 && (r.data?.key==='errors.token_expired'||/expired token/i.test(String(r.data?.msg||''))))
      throw new Error('AUTH_EXPIRED: a API continuou recusando o token mesmo após renovação. Nenhuma operação de publicação foi repetida.');
    if(r.status===401)throw new Error('AUTH_REQUIRED: a API recusou a autenticação após a tentativa segura de renovação.');
    if(r.status===403)throw new Error('A API retornou 403: seu usuário não tem permissão para essa operação.');
    throw new Error(`E-Class retornou HTTP ${r.status}: ${r.error||r.data?.msg||r.data?.message||'falha de comunicação'}`);
  }
  if(r.data?.ret!==undefined && r.data.ret!==1)throw new Error(`E-Class recusou operação: ${r.data.msg||'ret inválido'}`);
  return r.data;
}
async function getRequest(tab,c,url){return pageRequest(tab,url,'GET',c.headers);}
async function validateMapping(tab,c,item){
  const groups=await getRequest(tab,c,`${USERS}turmas-escola/89?strictUser=true`);
  const list=Array.isArray(groups)?groups:groups.data;
  const expected=`EMERE0${item.turma[0]}M${item.turma[2]}`;
  const g=(list||[]).find(x=>Number(x.id)===Number(item.group_id_sugerido) &&
     (String(x.cod_turma||'').toUpperCase()===item.turma[2] || String(x.nome||'').endsWith(expected)));
  if(!g)throw new Error(`Turma ${item.turma} não corresponde ao ID de 2026. Publicação bloqueada.`);
  const subjects=await getRequest(tab,c,`${USERS}lista-disciplinas-turma/${g.id}?strictUser=true`);
  const subjectsList=Array.isArray(subjects)?subjects:subjects.data;
  const norm=s=>(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
  const subject=(subjectsList||[]).find(x=>norm(x.descricao)===norm(item.disciplina));
  if(!subject)throw new Error(`Disciplina ${item.disciplina} não está disponível para ${item.turma}.`);
  return {groupId:g.id,subjectId:subject.id};
}
/** Somente registros de AULA (worker_id=1), nunca Atividades (worker_id=2).
 *  Filtro duplicado: consulta na API e checagem da resposta, para prevenir
 *  regressões e não confundir postagens dos dois módulos. */
async function getLessonsOnDate(tab,c,date){
  const list=await getRequest(tab,c,`${API}posts?date_min=${encodeURIComponent(date)}&date_max=${encodeURIComponent(date)}&worker_id=1`);
  if(!Array.isArray(list?.data)) throw new Error('A API não retornou lista válida de aulas; publicação bloqueada por segurança.');
  if(list.data.some(post=>post.worker_id===undefined||post.worker_id===null))
    throw new Error('A API não identificou o tipo de um registro. Verificação de duplicatas inconclusiva; publicação bloqueada.');
  return list.data.filter(post=>Number(post.worker_id)===1);
}
async function publishOne(item,{approveCondensed=false,approveProposals=false,published=false}={}){
  if(!item || !/^(1|2|3)M(A|B)$/.test(item.turma) || !/^2026-(09|10|11|12)-\d{2}$/.test(item.data))
    throw new Error('Registro do calendário inválido.');
  if(!['Matemática','Investigação Matemática','Filosofia'].includes(item.disciplina)) throw new Error('Disciplina não autorizada.');
  if(!item.html?.trim()) throw new Error('Conteúdo vazio; publicação bloqueada.');
  if(item.status==='revisao_pedagogica'&&!approveCondensed)throw new Error('Plano condensado precisa de aprovação pedagógica explícita.');
  if(item.status==='proposta_para_aprovacao'&&!approveProposals) throw new Error('Aula proposta sem plano-fonte exige aprovação explícita antes de publicar.');
  if(!['pronto_para_conferencia','revisao_pedagogica','proposta_para_aprovacao'].includes(item.status))throw new Error('Plano ainda não aprovado.');
  const tab=await activePortalTab(), c=await context(tab);
  const mapping=await validateMapping(tab,c,item);
  const key=`posted_${item.id}`;
  const local=(await chrome.storage.local.get(key))[key];
  if(local)return {status:'ja_registrado',detail:'Já enviado anteriormente por esta extensão',reference_id:local.post_id};
  // worker_id=1 significa AULA no E-Class. worker_id=2 é Atividade;
  // atividades não devem bloquear a criação de aulas no mesmo dia/disciplina.
  // A API /posts sem filtro mistura registros de tipos diferentes.
  const existent=await getLessonsOnDate(tab,c,item.data);
  const duplicate=existent.find(post=>{
    const sameDay=String(post.date||'').slice(0,10)===item.data;
    const targets=Array.isArray(post.targets)?post.targets:[];
    const sameTarget=targets.some(t=>Number(t.group_id)===Number(mapping.groupId) && Number(t.subject_id)===Number(mapping.subjectId));
    return sameDay && sameTarget;
  });
  if(duplicate){
    // Uma aula com título igual é duplicata; uma aula com título diferente exige
    // revisão manual, evitando substituir ou repetir registros desconhecidos.
    const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toLowerCase();
    if(normalize(duplicate.title)===normalize(item.titulo))
      return {status:'ja_existente',detail:'Aula com o mesmo título já existe nessa turma/disciplina/data. Nenhuma alteração feita.'};
    return {status:'conflito',detail:`Já existe uma AULA diferente nessa turma/disciplina/data: ${String(duplicate.title||'Sem título').slice(0,120)}. Revisão manual necessária; atividades não são consideradas.`};
  }
  const payload={title:item.titulo.slice(0,180),date_pin:null,content:item.html,
    attachments:[],learningTrailsElements:[],games:[],published:Boolean(published),
    target:[{entity_id:89,group_id:mapping.groupId,subject_id:mapping.subjectId,date:item.data}]};
  const result=await pageRequest(tab,`${API}dailies`,'POST',c.headers,payload);
  const post_id=result?.data?.[0]?.post_id;
  if(!post_id)throw new Error('Requisição enviada, mas API não devolveu identificador. Confira o portal antes de tentar novamente.');
  await chrome.storage.local.set({[key]:{post_id,created_at:new Date().toISOString(),published,group_id:mapping.groupId,subject_id:mapping.subjectId}});
  return {status:'criado',post_id,detail:published?'Publicado':'Criado como rascunho'};
}
/** Verifica acesso somente de leitura: nenhuma criação ou alteração no E-Class. */
async function checkConnection(item){
  if(!item || !/^(1|2|3)M(A|B)$/.test(item.turma) || !/^2026-(09|10|11|12)-\d{2}$/.test(item.data))
    throw new Error('Selecione uma aula válida para testar a conexão.');
  const tab=await activePortalTab(), c=await context(tab);
  const mapping=await validateMapping(tab,c,item);
  const lessons=await getLessonsOnDate(tab,c,item.data);
  return {status:'conexao_ok',turma:item.turma,disciplina:item.disciplina,data:item.data,
    group_id:mapping.groupId,subject_id:mapping.subjectId,aulas_no_dia:lessons.length,
    tipo_consultado:'aulas (worker_id=1)'};
}
chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
  (async()=>{
    if (message.system === '7edu') {
      if (message.action === 'status') return {ok:true, ...(await sevenEduCall('status'))};
      if (message.action === 'check') return {ok:true, result:await sevenEduCall('check', message.post)};
      if (message.action === 'publish') return {ok:true, result:await sevenEduPublish(message.post, message.options)};
      throw new Error('Ação indisponível no 7Edu.');
    }
    if(message.action==='status'){
      const tab=await activePortalTab();const c=await context(tab);
      return {ok:true,tabId:tab.id,year:c.headers['x-portal-academic-year'],entity:c.headers['x-portal-entity']};
    }
    if(message.action==='check') return {ok:true,result:await checkConnection(message.post)};
    if(message.action==='publish') return {ok:true,result:await publishOne(message.post,message.options)};
    if(message.action==='localAudit'){
      const result=await chrome.storage.local.get(null);
      return {ok:true,registered:Object.keys(result).filter(k=>k.startsWith('posted_')).length};
    }
    throw new Error('Ação desconhecida');
  })().then(sendResponse).catch(e=>sendResponse({ok:false,error:String(e?.message||e)}));
  return true;
});

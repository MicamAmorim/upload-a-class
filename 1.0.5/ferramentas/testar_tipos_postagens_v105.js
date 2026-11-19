'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert').strict;
const base=__dirname+'/../extension/';
const P=JSON.parse(fs.readFileSync(base+'data/aulas_4bim_2026.json','utf8'));
const items=P.postagens.filter(x=>x.turma==='2MB' && x.disciplina==='Matemática' && x.status==='pronto_para_conferencia').filter((v,i,a)=>a.findIndex(b=>b.data===v.data)===i).slice(0,5);
assert.equal(items.length,5,'Teste exige 5 encontros diferentes de 2MB');
const [activityOnly,sameLesson,differentLesson,unknownType,activityAgain]=items;
const modes=new Map([[activityOnly.data,'activity'],[sameLesson.data,'same'],[differentLesson.data,'different'],[unknownType.data,'unknown'],[activityAgain.data,'activity']]);
const subjectId=123456,groupId=activityOnly.group_id_sugerido;
const session={},local={};let msgHandler,listener,posts=[],reads=[],token='test-token-portal';
const h={'x-portal-academic-year':'2026','x-portal-entity':'89','x-portal-profile-id':'123'};
const response=(data,status=200)=>({ok:status>=200&&status<300,status,text:async()=>JSON.stringify(data)});
const window={localStorage:{getItem:key=>{assert.equal(key,'portal-token');return JSON.stringify(token);}},fetch:async(url,opts)=>{
 assert.equal(opts.credentials,'omit');assert.equal(opts.headers.Authorization,`Bearer ${token}`);
 if(url.includes('/atualiza-token'))return response({token,expires_in:480,token_type:'Bearer'});
 if(url.includes('turmas-escola/89'))return response([{id:groupId,cod_turma:'B',nome:'2º Ano - EMERE02MB'}]);
 if(url.includes('lista-disciplinas-turma/'))return response([{id:subjectId,descricao:'Matemática'}]);
 if(url.includes('posts?')){
   const u=new URL(url);assert.equal(u.searchParams.get('worker_id'),'1','Consulta deve separar Aulas de Atividades');
   const date=u.searchParams.get('date_min'), mode=modes.get(date);
   reads.push({date,mode});
   const item=items.find(x=>x.data===date);const post={date,worker_id:mode==='activity'?2:1,title:mode==='same'?item.titulo:'Outra aula',targets:[{group_id:groupId,subject_id:subjectId}]};
   if(mode==='unknown')delete post.worker_id;
   return response({ret:1,data:[post]});
 }
 if(url.endsWith('/dailies')){posts.push(JSON.parse(opts.body));return response({ret:1,data:[{post_id:90000+posts.length}]});}
 throw new Error('Rota inesperada: '+url);
}};
const chrome={
 webRequest:{onBeforeSendHeaders:{addListener:f=>listener=f}},
 runtime:{onMessage:{addListener:f=>msgHandler=f}},
 tabs:{query:async()=>[{id:7,url:'https://portal.educacaoadventista.org.br/aulas'}]},
 storage:{session:{set:async v=>Object.assign(session,v),get:async k=>({[k]:session[k]})},local:{set:async v=>Object.assign(local,v),get:async k=>k===null?local:{[k]:local[k]}}},
 scripting:{executeScript:async({func,args,world})=>{assert.equal(world,'MAIN');return [{result:await func(args[0])}];}}
};
const sandbox={chrome,window,console,Date,Set,Promise,URL,encodeURIComponent};vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(base+'worker.js','utf8'),sandbox);
const send=o=>new Promise(resolve=>msgHandler(o,{},resolve));
(async()=>{
 listener({tabId:7,initiator:'https://portal.educacaoadventista.org.br',requestHeaders:Object.entries(h).map(([name,value])=>({name,value}))});
 await new Promise(r=>setTimeout(r,15));
 let r=await send({action:'check',post:activityOnly});assert(r.ok,r.error);assert.equal(r.result.aulas_no_dia,0);
 r=await send({action:'publish',post:activityOnly,options:{published:false}});assert(r.ok,r.error);assert.equal(r.result.status,'criado');assert.equal(posts.length,1,'Atividade não bloqueia aula');
 r=await send({action:'publish',post:sameLesson,options:{published:false}});assert(r.ok,r.error);assert.equal(r.result.status,'ja_existente');assert.equal(posts.length,1,'Aula existente com mesmo título não pode ser duplicada');
 r=await send({action:'publish',post:differentLesson,options:{published:false}});assert(r.ok,r.error);assert.equal(r.result.status,'conflito');assert.equal(posts.length,1,'Aula diferente precisa revisão manual');
 r=await send({action:'publish',post:unknownType,options:{published:false}});assert(!r.ok&&r.error.includes('tipo'),r.error);assert.equal(posts.length,1,'Tipo indefinido bloqueia escrita');
 r=await send({action:'publish',post:activityAgain,options:{published:true}});assert(r.ok,r.error);assert.equal(r.result.status,'criado');assert.equal(posts.length,2);
 assert(!JSON.stringify(session).includes(token));assert(!JSON.stringify(local).includes(token));
 assert.equal(reads.length,6);
 console.log('PASSOU: atividades (worker_id=2) não bloqueiam aulas; aulas iguais ignoradas; aulas diferentes sinalizadas; tipo desconhecido bloqueado; credenciais não persistidas.');
})().catch(e=>{console.error(e);process.exit(1)});

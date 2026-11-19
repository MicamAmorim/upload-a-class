'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert').strict;
const base=__dirname+'/../extension/';
const P=JSON.parse(fs.readFileSync(base+'data/aulas_4bim_2026.json','utf8'));
const first=P.postagens.find(x=>x.turma==='2MB'&&x.disciplina==='Matemática'&&x.status==='pronto_para_conferencia');
const another=P.postagens.find(x=>x.turma==='2MB'&&x.disciplina==='Matemática'&&x.status==='pronto_para_conferencia'&&x.data!==first.data);
let listener,msgHandler,refreshCount=0,postCount=0,postReject=false,allRequests=[];
let storedToken='expired-from-storage',currentToken='fresh-token';
const session={},local={};
const headers={'x-portal-academic-year':'2026','x-portal-entity':'89','x-portal-association':'1','x-portal-division':'1','x-portal-profile-id':'123456','x-portal-publisher':'1','x-portal-union':'1'};
const response=(data,status=200)=>({ok:status>=200&&status<300,status,text:async()=>JSON.stringify(data)});
const window={
  localStorage:{getItem:key=>(assert.equal(key,'portal-token'),storedToken?JSON.stringify(storedToken):null)},
  fetch:async (url,options)=>{
    assert.equal(options.credentials,'omit');
    allRequests.push({url,method:options.method,authPresent:!!options.headers.Authorization});
    if(url.includes('/atualiza-token')){
      refreshCount++;
      if(!storedToken)return response({key:'errors.invalid_token'},401);
      return response({token:currentToken,expires_in:480,token_type:'Bearer'});
    }
    assert.ok(options.headers.Authorization?.startsWith('Bearer '),'Toda operação usa Bearer');
    if(!options.headers.Authorization.endsWith(currentToken))return response({code:401,key:'errors.token_expired',msg:'Expired token'},401);
    if(url.includes('turmas-escola'))return response([{id:first.group_id_sugerido,cod_turma:'B',nome:'2º Ano - EMERE02MB'}]);
    if(url.includes('lista-disciplinas'))return response([{id:123456,descricao:'Matemática'}]);
    if(url.includes('posts?'))return response({ret:1,data:[]});
    if(url.endsWith('/dailies')){
      postCount++;
      if(postReject)return response({code:401,key:'errors.token_expired',msg:'Expired token'},401);
      return response({ret:1,data:[{post_id:34567+postCount}]});
    }
    throw new Error('Endpoint inesperado: '+url);
  }
};
const chrome={
 webRequest:{onBeforeSendHeaders:{addListener(f){listener=f}}},
 runtime:{onMessage:{addListener(f){msgHandler=f}}},
 tabs:{query:async()=>[{id:7,url:'https://portal.educacaoadventista.org.br/aulas'}]},
 storage:{session:{set:async x=>Object.assign(session,x),get:async k=>({[k]:session[k]})},local:{set:async x=>Object.assign(local,x),get:async k=>k===null?local:{[k]:local[k]}}},
 scripting:{executeScript:async({func,args,world})=>{assert.equal(world,'MAIN');return [{result:await func(args[0])}];}}
};
const sandbox={chrome,window,console,Date,Set,Promise,URL,encodeURIComponent};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync(base+'worker.js','utf8'),sandbox);
const msg=obj=>new Promise(resolve=>msgHandler(obj,{},resolve));
(async()=>{
 listener({tabId:7,initiator:'https://portal.educacaoadventista.org.br',requestHeaders:Object.entries(headers).map(([name,value])=>({name,value}))});
 await new Promise(r=>setTimeout(r,10));
 let r=await msg({action:'check',post:first});assert(r.ok,r.error);
 assert.equal(refreshCount,1,'GET expirado deve renovar uma única vez');assert.equal(postCount,0,'Teste de conexão não publica');
 r=await msg({action:'check',post:first});assert(r.ok,r.error);assert.equal(refreshCount,1,'Token renovado deve ser reutilizado');
 r=await msg({action:'publish',post:first,options:{published:false}});assert(r.ok,r.error);assert.equal(r.result.status,'criado');assert.equal(postCount,1,'Apenas um POST de publicação');
 postReject=true;
 r=await msg({action:'publish',post:another,options:{published:false}});
 assert(!r.ok&&r.error.includes('AUTH_EXPIRED'),r.error);
 assert.equal(postCount,2,'Um POST que recebeu 401 NÃO pode ser repetido');
 assert(!JSON.stringify(session).includes(currentToken));
 assert(!JSON.stringify(local).includes(currentToken));
 assert(!allRequests.some(x=>x.url.includes('alheio')));
 assert.equal(P.postagens.length,284);
 console.log('PASSOU: GET expirado renova, GET de confirmação passa, POST único, POST 401 não é repetido, token não é armazenado pela extensão, 284 aulas preservadas.');
})().catch(e=>{console.error(e);process.exit(1)});

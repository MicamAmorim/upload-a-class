'use strict';
// Executor retrocompatível dos testes independentes do worker.
const cp=require('child_process'),path=require('path');
for(const name of ['testar_autenticacao_v104.js','testar_tipos_postagens_v105.js','testar_7edu_mock.js']){
 cp.execFileSync(process.execPath,[path.join(__dirname,name)],{stdio:'inherit'});
}

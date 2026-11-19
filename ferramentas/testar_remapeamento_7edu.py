#!/usr/bin/env python3
"""Gates puramente locais para a atualização da grade 7Edu."""
import json,sys,pathlib,collections,hashlib
folder=pathlib.Path(__file__).resolve().parents[1]
e=json.loads((folder/'extension/data/aulas_4bim_2026.json').read_text())
x=json.loads((folder/'extension/data/aulas_7edu_4bim_2026.json').read_text())
r=x['postagens'];o=e['postagens']
assert len(o)==284 and len(r)==221
assert len({(a['turma'],a['disciplina']) for a in r})==14
assert len({(a['turma'],a['disciplina'],a['data']) for a in r})==len(r)
assert sum(a['quantidade_periodos'] for a in r)==277
assert x['fonte_consulta']['data']=='2026-11-19'
assert len([a for a in r if a['status']=='domingo_atipico'])==14
assert len([a for a in r if a['7edu']['situacao_portal']=='Registrado'])==19
assert all(a['7edu']['mapeamento']=='bloqueado' for a in r if a['7edu']['situacao_portal']=='Registrado')
assert all(a['7edu']['mapeamento']=='bloqueado' for a in r if a['data']=='2026-09-27')
assert sum(a['7edu']['mapeamento']=='exato' for a in r)==169
assert sum(a['status']=='sem_plano_7edu' for a in r)==20
assert all(a['status']=='sem_plano_7edu' for a in r if a['turma']=='2MA' and a['disciplina']=='Investigação Matemática' and a['data']!='2026-09-27')
index={z['id']:z for z in o}
for a in r:
    if a['7edu']['mapeamento']!='exato':continue
    old=index[a['7edu']['fonte_eclass_id']]
    assert a['data']==old['data']
    assert a['quantidade_periodos']==old['quantidade_periodos']
    assert a['html']==old['html'] and a['titulo']==old['titulo']
    assert len(a['horario'])==a['quantidade_periodos']
    assert a['7edu']['situacao_portal']=='Pendente'
print('PASSOU: 284 E-Class originais, 221 datas/277 períodos 7Edu, 169 correspondências exatas, 52 bloqueios, 14 domingos e 19 registradas preservadas.')

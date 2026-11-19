#!/usr/bin/env python3
"""Valida a sequência de Filosofia e os impedimentos de publicação."""
import sys,json,pathlib,collections,tempfile,hashlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'ferramentas'))
import redistribuir_aulas_7edu as gen
src=json.loads((ROOT/'extension/data/plano_filosofia_7edu_2026.json').read_text(encoding='utf8'))
out=json.loads((ROOT/'extension/data/aulas_7edu_4bim_2026.json').read_text(encoding='utf8'))
eclass=(ROOT/'extension/data/aulas_4bim_2026.json').read_bytes()
assert len(json.loads(eclass)['postagens'])==284
assert out['versao']=='1.0.10'
assert out['estatisticas']['datas_reais']==221
assert out['estatisticas']['periodos_reais']==277
assert out['estatisticas']['datas_projetadas']==78
assert out['estatisticas']['periodos_projetados']==96
assert all(p['7edu']['mapeamento']=='bloqueado' for p in out['postagens'] if p['7edu']['situacao_portal']=='Registrado')
assert len([p for p in out['postagens'] if p['7edu']['situacao_portal']=='Registrado'])==19
for turma,target,expos,prat in [('2MA',12,5,7),('2MB',11,5,6)]:
    rows=sorted([x for x in out['postagens'] if x['disciplina']=='Filosofia' and x['turma']==turma and x['fonte_unidades']],key=lambda x:x['data'])
    assert len(rows)==target,(turma,len(rows))
    assert sum(x['tipos_aula']==['expositiva'] for x in rows)==expos
    assert sum(x['tipos_aula']==['pratica_exercicios'] for x in rows)==prat
    expected=gen.load_filosofia_units()[turma]
    assert [y for r in rows for y in r['fonte_unidades']]==[u['id'] for u in expected]
    assert all(len(r['fonte_unidades'])==1 and len(r['7edu']['alocacao_por_periodo'])==1 for r in rows)
    assert all(r['7edu']['requer']['proposta'] for r in rows)
    assert all(not r['avaliacao'] for r in rows)
    assert all('Exercícios de aprendizagem:' in r['conteudo_7edu'] for r in rows)
    assert all('Tipo de aula:' in r['conteudo_7edu'] for r in rows)
    assert all(r['status']=='projecao_nao_aberta' and r['7edu']['mapeamento']=='projecao' for r in rows if r['data']>'2026-11-19')
    assert all(r['status']=='proposta_para_aprovacao' for r in rows if r['data']<='2026-11-19')
    sun=[r for r in out['postagens'] if r['disciplina']=='Filosofia' and r['turma']==turma and r['data']=='2026-09-27']
    assert len(sun)==1 and sun[0]['status']=='domingo_atipico' and not sun[0]['fonte_unidades']
    assert not out['fila_sem_data'].get(turma+' / Filosofia')
for x in gen.load_filosofia_units().values():
    for mod in range(8,13):
        kinds={u['tipo_aula'] for u in x if mod in u['modulos'] and len(u['modulos'])==1}
        assert kinds=={'expositiva','pratica_exercicios'},(mod,kinds)
# Reruns must retain the teacher-approved source of Philosophy and be deterministic.
with tempfile.TemporaryDirectory() as tmp:
    gen.generate(ROOT/'relatorios/calendario_7edu_todas_disciplinas_2026.md',
        ROOT/'extension/data/aulas_4bim_2026.json', ROOT/'extension/data/planos_originais_matematica_120.json',
        pathlib.Path(tmp)/'data.json',pathlib.Path(tmp)/'report.md')
    assert (pathlib.Path(tmp)/'data.json').read_bytes()==(ROOT/'extension/data/aulas_7edu_4bim_2026.json').read_bytes()
print('PASSOU: Filosofia v1.0.10, 2MA=12, 2MB=11; módulos 8–12; expositivas/práticas; datas futuras bloqueadas; fonte persistente.')

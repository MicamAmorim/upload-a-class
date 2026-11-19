#!/usr/bin/env python3
"""Auditoria 7Edu v1.0.9: prova conservação, bloqueios e ordem por turma."""
import collections,datetime,hashlib,json,pathlib,sys
from importlib.util import spec_from_file_location,module_from_spec
ROOT=pathlib.Path(__file__).resolve().parents[1]
parent=json.loads((ROOT/'extension/data/aulas_4bim_2026.json').read_text())
out=json.loads((ROOT/'extension/data/aulas_7edu_4bim_2026.json').read_text())
base=ROOT/'extension/data/planos_originais_matematica_120.json'
spec=spec_from_file_location('newgenerator',ROOT/'ferramentas/redistribuir_aulas_7edu.py')
# O gerador depende do parser na pasta de ferramentas
sys.path.insert(0,str(ROOT/'ferramentas'))
import redistribuir_aulas_7edu as gen
units=gen.make_units(parent,json.loads(base.read_text()))
assert len(parent['postagens'])==284
assert out['versao']=='1.0.10'
assert out['estatisticas']['datas_reais']==221
assert out['estatisticas']['periodos_reais']==277
assert out['estatisticas']['datas_projetadas']>0
assert len(out['postagens'])==out['estatisticas']['datas_reais']+out['estatisticas']['datas_projetadas']
assert len(set((p['turma'],p['disciplina'],p['data']) for p in out['postagens']))==len(out['postagens'])
assert len([p for p in out['postagens'] if p['data']=='2026-09-27'])==14
assert all(p['7edu']['mapeamento']=='bloqueado' for p in out['postagens'] if p['data']=='2026-09-27')
assert len([p for p in out['postagens'] if p['7edu']['situacao_portal']=='Registrado'])==19
assert all(p['7edu']['mapeamento']=='bloqueado' for p in out['postagens'] if p['7edu']['situacao_portal']=='Registrado')
assert all(p['7edu']['mapeamento']=='projecao' and p['status']=='projecao_nao_aberta' for p in out['postagens'] if p['data']>'2026-11-19')
assert all(p['7edu']['mapeamento']=='bloqueado' for p in out['postagens'] if p['data']=='2026-10-30')
assert all(p['7edu']['mapeamento']!='redistribuido' for p in out['postagens'] if p['status'] in ('sem_plano_7edu','feriado_a_conferir','domingo_atipico','registrado_7edu','projecao_nao_aberta'))
actual=collections.defaultdict(list)
for p in out['postagens']:
    group=(p['turma'],p['disciplina'])
    allocation=p['7edu']['alocacao_por_periodo']
    assert len(allocation)==p['quantidade_periodos']
    assert all(len(x)<=2 for x in allocation)
    assert p['fonte_unidades']==[y for row in allocation for y in row]
    assert p['7edu']['requer']['condensacao']==any(len(x)>1 for x in allocation)
    if p['7edu']['mapeamento']=='redistribuido':
        assert p['7edu']['situacao_portal']=='Pendente'
        assert p['data']<='2026-11-19'
        assert p['html'] and p['conteudo_7edu']
        assert str(p['data'][8:10]+'/'+p['data'][5:7]+'/'+p['data'][:4]) in p['html']
        assert p['status'] in ('pronto_para_conferencia','revisao_pedagogica','proposta_para_aprovacao')
    for row in allocation:
        if len(row)==2:
            assert not any(x.get('avaliacao') for x in units[group] if x['id'] in row)
    actual[group].extend(p['fonte_unidades'])
for group,u in units.items():
    assigned=actual[group]
    expected=[x['id'] for x in u]
    assert assigned==expected[:len(assigned)],(group,assigned[:10],expected[:10])
    remaining=[x['id'] for x in out['fila_sem_data'].get(' / '.join(group),[])]
    assert assigned+remaining==expected,(group,len(assigned),len(expected),len(remaining))
assert '2MA / Investigação Matemática' not in out['fila_sem_data']
assert any(p['turma']=='2MA' and p['disciplina']=='Investigação Matemática' and p['7edu']['requer']['adaptacao_outra_turma'] for p in out['postagens'])
assert any(p['7edu']['requer']['historico'] for p in out['postagens'])
assert any(p['7edu']['requer']['avaliacao_data'] for p in out['postagens'])
print('PASSOU: 14 disciplinas, 221 datas reais, redistribuição por período, nenhuma unidade duplicada, 19 registros bloqueados, 14 domingos e projeções NÃO publicáveis.')

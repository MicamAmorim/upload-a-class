#!/usr/bin/env python3
from pathlib import Path
import json,re,collections,datetime,zipfile
root=Path(__file__).resolve().parents[1]
P=json.loads((root/'extension/data/aulas_4bim_2026.json').read_text(encoding='utf-8'))
posts=P['postagens']
assert len(posts)==284
assert all(P['periodo']['inicio']<=p['data']<=P['periodo']['fim'] for p in posts)
assert all(datetime.date.fromisoformat(p['data']).weekday()<5 for p in posts)
hols={x['data'] for x in P['feriados']}
assert all(p['data'] not in hols for p in posts)
assert len({(p['data'],p['turma'],p['disciplina']) for p in posts})==len(posts)
assert sum(p['quantidade_periodos'] for p in posts)==348
for cl in ['1MA','1MB','2MA','2MB','3MA','3MB']:
 got=[n for p in posts if p['turma']==cl and p['disciplina']=='Matemática' for n in p['planos_originais']]
 assert sorted(got)==list(range(1,41)),(cl,got)
for p in posts:
 if p['disciplina']=='Matemática':
  assert p['html'].startswith('<p><img') and '<strong>Professor Miquéias Amorim</strong>' in p['html']
  assert 'VERSÍCULO BÍBLICO' in p['html'] and 'Leitura prévia' in p['html']
  assert p['status'] in ('pronto_para_conferencia','revisao_pedagogica')
  assert p['quantidade_periodos'] in (1,2)
 else:
  assert p['status']=='proposta_para_aprovacao' and p['html'] and 'Leitura prévia' in p['html']
 assert all(x['inicio']<x['fim'] for x in p['horario'])
assert len([x for x in posts if x['disciplina']=='Matemática'])==170
assert len([x for x in posts if x['disciplina']!='Matemática'])==114
assert len([p for p in posts if p['condensacao']])==16
print('PASSOU: 284 postagens, 348 períodos, 120 planos-base distribuídos, feriados sem postagens.')

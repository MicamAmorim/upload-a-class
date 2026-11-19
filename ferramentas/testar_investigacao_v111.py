#!/usr/bin/env python3
"""V1.0.11 - investigação: texto único e proteção contra regressão do gerador."""
import json, pathlib, subprocess, tempfile, hashlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
d=json.loads((ROOT/'extension/data/aulas_7edu_4bim_2026.json').read_text('utf8'))
assert d['versao']=='1.0.11'
inv=[p for p in d['postagens'] if p['disciplina']=='Investigação Matemática']
assert len(inv)==92
assert {p['turma'] for p in inv}=={'1MA','1MB','2MA','2MB','3MA','3MB'}
assert all(p['titulo']=='Atividades propostas' for p in inv)
assert all(p['conteudo_7edu']=='Atividades propostas' for p in inv)
assert all(p['html']=='<p>Atividades propostas</p>' for p in inv)
assert len([p for p in d['postagens'] if p['7edu']['situacao_portal']=='Registrado'])==19
assert len([p for p in d['postagens'] if p['status']=='projecao_nao_aberta'])==78
assert all(p['7edu']['mapeamento']!='redistribuido' for p in inv if p['status'] in ('domingo_atipico','projecao_nao_aberta','registrado_7edu','feriado_a_conferir'))
with tempfile.TemporaryDirectory() as td:
    dst=pathlib.Path(td)/'regenerated.json'
    subprocess.run(['python',str(ROOT/'ferramentas/redistribuir_aulas_7edu.py'),str(ROOT/'relatorios/calendario_7edu_todas_disciplinas_2026.md'),str(ROOT/'extension/data/aulas_4bim_2026.json'),str(ROOT/'extension/data/planos_originais_matematica_120.json'),str(dst),str(pathlib.Path(td)/'report.md')],check=True,capture_output=True)
    assert dst.read_bytes()==(ROOT/'extension/data/aulas_7edu_4bim_2026.json').read_bytes()
print('PASSOU: 92 registros de Investigação com conteúdo exato, 6 turmas, calendário preservado, regeneração idêntica.')

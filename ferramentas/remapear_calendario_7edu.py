#!/usr/bin/env python3
"""Cruza exportação Markdown 7Edu com o plano E-Class sem alterar origem.

Uso: python ferramentas/remapear_calendario_7edu.py CALENDARIO.md BASE_ECLASS.json DESTINO.json RELATORIO.md
Regras: correspondência somente por turma+disciplina+data e períodos/horários.
Sem conteúdo inventado, domingos quarentenados, registros existentes bloqueados.
"""
import sys, re, json, collections, datetime, hashlib
from pathlib import Path

KNOWN={'Matemática','Investigação Matemática','Filosofia'}
DAYS=['segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado','domingo']

def minclock(s):
    h,m=map(int,s.split(':'))
    return h*60+m

def parse_md(path):
    text=Path(path).read_text(encoding='utf-8')
    m=re.search(r'Consulta realizada em: (\d{2}/\d{2}/\d{4})',text)
    if not m: raise ValueError('Data da consulta ausente')
    consultation=datetime.datetime.strptime(m[1],'%d/%m/%Y').date()
    current=None;rows=[];names=set()
    for line in text.splitlines():
        h=re.match(r'^### ([123]M[AB]) / (.+?)\s*$',line)
        if h:
            current=(h[1],h[2]);
            if current[1] not in KNOWN: raise ValueError(f'Disciplina não reconhecida: {current[1]}')
            if current in names: raise ValueError(f'Disciplina duplicada: {current}')
            names.add(current)
        elif re.match(r'^\| \d{2}/\d{2}/\d{4} \|',line):
            if not current: raise ValueError('Linha sem cabeçalho')
            cols=[v.strip() for v in line.strip().strip('|').split('|')]
            if len(cols)!=5: raise ValueError('Tabela não tem cinco colunas')
            d=datetime.datetime.strptime(cols[0],'%d/%m/%Y').date();count=int(cols[1])
            if not 1<=count<=10:raise ValueError('Contagem inválida')
            pattern=r'^(\d+)º (\d\d:\d\d)[–-](\d\d:\d\d)$'
            times=[]
            for fragment in cols[2].split(';'):
                a=re.match(pattern,fragment.strip())
                if not a:raise ValueError('Período/horário não interpretável: '+cols[2])
                times.append({'ordem':int(a[1]),'inicio':a[2],'fim':a[3]})
            if len(times)!=count:raise ValueError('Número de horários não confere')
            if cols[3] not in ('Registrado','Pendente','Futuro / não disponível para lançamento'):
                raise ValueError('Estado do 7Edu não reconhecido: '+cols[3])
            rows.append({'turma':current[0],'disciplina':current[1],'data':d.isoformat(),
                         'quantidade_periodos':count,'horario':times,'situacao':cols[3],
                         'dia_semana':DAYS[d.weekday()]})
    expected=int(re.search(r'Disciplinas consultadas: (\d+)',text)[1])
    if len(names)!=expected: raise ValueError(f'Esperadas {expected} disciplinas, extraídas {len(names)}')
    keylist=[(r['turma'],r['disciplina'],r['data']) for r in rows]
    if len(keylist)!=len(set(keylist)):raise ValueError('Duplicidade na grade 7Edu')
    return consultation,rows,hashlib.sha256(text.encode('utf-8')).hexdigest()

def classify(entry,src,consulted):
    if entry['dia_semana']=='domingo':return 'domingo_atipico', 'DOMINGO: 27/09 aparece nas 14 disciplinas; conferir no portal antes de usar.'
    if entry['situacao']=='Registrado':return 'registrado_7edu','Aula registrada no 7Edu; não alterar ou duplicar.'
    if entry['data']>consulted.isoformat() or entry['situacao'].startswith('Futuro'):
        return 'futuro_7edu','Data futura na fotografia exportada; aguardar abertura.'
    if src is None:return 'sem_plano_7edu','Não existe plano E-Class para esta mesma data, turma e disciplina.'
    if entry['quantidade_periodos']!=src['quantidade_periodos']:
        return 'divergencia_periodos_7edu',f"E-Class: {src['quantidade_periodos']} período(s); 7Edu: {entry['quantidade_periodos']}. Revisão necessária."
    if len(entry['horario'])!=len(src['horario']):return 'divergencia_horarios_7edu','Horários incompletos.'
    for a,b in zip(entry['horario'],src['horario']):
        if abs(minclock(a['inicio'])-minclock(b['inicio']))>1 or abs(minclock(a['fim'])-minclock(b['fim']))>5:
            return 'divergencia_horarios_7edu',f"Horários diferem entre os portais: {src['horario']} × {entry['horario']}."
    if src['status'] not in ('pronto_para_conferencia','revisao_pedagogica','proposta_para_aprovacao'):
        return 'revisao_calendario_7edu','Situação do planejamento original não está habilitada.'
    return src['status'], 'Correspondência exata com a data e quantidade de períodos do E-Class; horários compatíveis.'

def generate(md,base,output,report):
    consultation,rows,sha=parse_md(md)
    parent=json.loads(Path(base).read_text(encoding='utf-8'))
    postidx={(x['turma'],x['disciplina'],x['data']):x for x in parent['postagens']}
    original_ids=set();out=[];flags=collections.Counter();total=collections.Counter(); groups=collections.defaultdict(lambda:collections.Counter());all_keys=set()
    for r in rows:
        key=(r['turma'],r['disciplina'],r['data']);src=postidx.get(key)
        status,reason=classify(r,src,consultation)
        # Registros bloqueados têm conteúdo original apenas como referência; não são publicáveis.
        if src:
            x=dict(src)
            original_ids.add(src['id'])
            x['id']=src['id'] # mantém histórico local da versão anterior
            x['horario']=r['horario'] # horários oficiais do 7Edu
            x['quantidade_periodos']=r['quantidade_periodos']
            x['status']=status
            x['observacao']=reason + (' ' + str(src.get('observacao','')) if status in ('revisao_pedagogica','proposta_para_aprovacao') else '')
        else:
            code={'Matemática':'MAT','Investigação Matemática':'INV','Filosofia':'FIL'}[r['disciplina']]
            x={'id':f"7EDU_{r['data']}_{r['turma']}_{code}",
               'data':r['data'],'turma':r['turma'],'disciplina':r['disciplina'],
               'dia_semana':r['dia_semana'],'entity_id':None,'group_id_sugerido':None,
               'horario':r['horario'],'quantidade_periodos':r['quantidade_periodos'],
               'planos_originais':[],'origem':'calendario_7edu_sem_plano',
               'status':status,'observacao':reason,
               'titulo':f"[SEM PLANO] {r['turma']} / {r['disciplina']} / {r['data']}",
               'html':'','avaliacao':False,'aula_complementar':False,'condensacao':False}
        # Status de bloqueio prevalece sobre o conteúdo; consentimento genérico não desbloqueia.
        x['7edu']={'consultado_em':consultation.isoformat(), 'situacao_portal':r['situacao'],
                   'mapeamento':'exato' if status in ('pronto_para_conferencia','revisao_pedagogica','proposta_para_aprovacao') else 'bloqueado',
                   'bloqueio':reason if status not in ('pronto_para_conferencia','revisao_pedagogica','proposta_para_aprovacao') else None,
                   'fonte_eclass_id':src['id'] if src else None,
                   'fonte_eclass_data':src['data'] if src else None}
        x['data']=r['data'];x['dia_semana']=r['dia_semana']
        out.append(x);flags[status]+=1;total[r['situacao']]+=1;groups[(r['turma'],r['disciplina'])][status]+=1
    mapped_count=sum(flags[t] for t in ('pronto_para_conferencia','revisao_pedagogica','proposta_para_aprovacao'))
    missing=sorted((x for x in parent['postagens'] if x['id'] not in original_ids),key=lambda x:(x['turma'],x['disciplina'],x['data']))
    archive={'versao':'1.0.8','sistema':'7edu','ano':2026,'periodo':'4º bimestre',
             'fonte_consulta':{'data':consultation.isoformat(),'sha256_markdown':sha,'alcance':'fotografia parcial das 14 seções; sem atualização automática','nao_incluir_cookies':True},
             'politica':'Somente data exata e horários/quantidade compatíveis podem ser selecionados. Registros, datas atípicas, faltantes e divergências ficam bloqueados. Live preflight é obrigatório.',
             'total_entradas_7edu':len(rows),'total_periodos_7edu':sum(x['quantidade_periodos'] for x in rows),
             'estatisticas':{'mapeados':mapped_count,'bloqueados':len(rows)-mapped_count,'por_status':dict(flags),'por_situacao_portal':dict(total)},
             'postagens':out,'planos_eclass_sem_data_7edu':[{'id':x['id'],'data':x['data'],'turma':x['turma'],'disciplina':x['disciplina'],'planos_originais':x['planos_originais']} for x in missing]}
    Path(output).parent.mkdir(parents=True,exist_ok=True)
    Path(output).write_text(json.dumps(archive,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    lines=['# Auditoria do remapeamento — 7Edu 4º bimestre 2026','',f'- Consultado em: {consultation.strftime("%d/%m/%Y")}',
           f'- Data de referência: {consultation.isoformat()} (não é uma sincronização em tempo real)',
           f'- Disciplinas: {len(groups)}',f'- Datas extraídas: {len(rows)}',
           f'- Períodos: {archive["total_periodos_7edu"]}',f'- Linhas com plano de mesma data e horários compatíveis: **{mapped_count}**',
           f'- Linhas bloqueadas: **{len(rows)-mapped_count}**',f'- Planos E-Class sem correspondência de data no retrato: **{len(missing)}**', '',
           '## Contagens por situação','', '| Situação | Datas |','|---|---:|']
    for k,v in sorted(flags.items()):lines.append(f'| {k} | {v} |')
    lines.extend(['','## Por turma / disciplina','', '| Turma / disciplina | Correspondência exata | Bloqueadas |', '|---|---:|---:|'])
    for group,counts in sorted(groups.items()):
        ok=sum(counts[t] for t in ('pronto_para_conferencia','revisao_pedagogica','proposta_para_aprovacao'))
        lines.append(f'| {group[0]} / {group[1]} | {ok} | {sum(counts.values())-ok} |')
    lines.extend(['','## Entradas que exigem revisão','', '| Turma / disciplina | Data | Períodos 7Edu | Situação no 7Edu | Problema |','|---|---|---:|---|---|'])
    for r in out:
        if r['7edu']['mapeamento'] != 'exato':
            lines.append(f'| {r["turma"]} / {r["disciplina"]} | {r["data"]} | {r["quantidade_periodos"]} | {r["7edu"]["situacao_portal"]} | {r["status"]} |')
    lines.extend(['','## Salvaguardas','',
     '- Os 284 registros do E-Class permanecem no JSON original e não foram alterados.',
     '- O calendário 7Edu é fotografia parcial; aulas posteriores a 19/11 não devem ser inferidas como ausentes.',
     '- Registros já gravados (incluindo os 11 do lote anterior, quando presentes) não são selecionáveis.',
     '- Todos os itens de domingo 27/09/2026 foram bloqueados para conferência humana.',
     '- 2MA / Investigação Matemática aparece no portal, mas não há plano-fonte; nenhum conteúdo foi criado automaticamente.',
     '- A 7Edu consulta atualizada no momento do envio e pode bloquear se o portal mudou.',
     '- Não é seguro confirmar o conteúdo das aulas já registradas apenas pelos estados deste Markdown.',
     '- O HTTP 400 anterior não foi diagnosticado como causado exclusivamente por datas.',
     '','## Como avançar','',
     'Revise os itens bloqueados e confirme horários, dias atípicos e sequências pedagógicas com o diário real. Depois solicite uma segunda rodada de remapeamento para vincular conteúdos das datas que não coincidem.', ''])
    Path(report).write_text('\n'.join(lines),encoding='utf-8')
    return archive

if __name__=='__main__':
    if len(sys.argv)!=5: raise SystemExit('Uso: script calendario.md eclass.json 7edu.json relatorio.md')
    result=generate(*sys.argv[1:]);print(json.dumps(result['estatisticas'],ensure_ascii=False,indent=2))

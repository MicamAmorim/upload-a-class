#!/usr/bin/env python3
"""Planejamento independente 7Edu: distribui unidades pedagógicas cronologicamente.

Dados reais: calendário Markdown exportado por Grid_Read. Datas posteriores à consulta
são projeções separadas e NUNCA se tornam publicáveis sem nova exportação.
Preserva fonte E-Class; não afirma conhecer o conteúdo de registros históricos.

Uso: python ferramentas/redistribuir_aulas_7edu.py CALENDARIO.md ORIGEM.json PLANOS_120.json DESTINO.json RELATORIO.md
"""
import collections
import datetime as dt
import hashlib
import html
import json
import re
import sys
from pathlib import Path
from html.parser import HTMLParser
from remapear_calendario_7edu import parse_md

ALLOWED={'Matemática','Investigação Matemática','Filosofia'}
DAYS=['segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado','domingo']

class ToLines(HTMLParser):
    def __init__(self):super().__init__();self.parts=[]
    def handle_data(self,data):self.parts.append(data)
    def handle_starttag(self,tag,attrs):
        if tag in ('br','p','li','tr','div'):self.parts.append('\n')
    def get(self):
        return re.sub(r'\n{3,}','\n\n',html.unescape(''.join(self.parts))).strip()

def content_from_source(src):
    p=ToLines();p.feed(src.get('html',''));content=p.get()
    # Remove cabeçalho e rodapé vinculados à data/horário do E-Class.
    lines=[re.sub(r'^\s*\d\d:\d\d\s*[–-]\s*\d\d:\d\d\s*[–-]\s*','',s.strip()) for s in content.splitlines()]
    wanted=[];include=False
    for line in lines:
        if re.search(r'Leitura prévia:',line,re.I):include=True
        if re.search(r'Um abraço|Professor Miquéias',line,re.I):break
        if include and line:wanted.append(line)
    if not wanted: wanted=['Atividade de origem: '+src['titulo'].split('|')[-1].strip()]
    return '\n'.join(wanted)

def make_units(source, originals):
    grouped=collections.defaultdict(list)
    for x in source['postagens']:
        grouped[(x['turma'],x['disciplina'])].append(x)
    for key in grouped:grouped[key].sort(key=lambda z:(z['data'],z['id']))
    units={}
    for turma in ('1MA','1MB','2MA','2MB','3MA','3MB'):
        serie=turma[0]
        for disc in ALLOWED:
            key=(turma,disc)
            if disc=='Matemática':
                units[key]=[
                    {'id':f'PLANO_{serie}_{int(p["numero"]):02d}','tipo_fonte':'docx_plano_individual',
                     'ordem':int(p['numero']),'tema':p['tema'], 'leitura':p.get('leitura',''),
                     'em_classe':p.get('em_classe',''),'preparacao':p.get('preparacao',''),
                     'etapa':p.get('etapa',''),'avaliacao':bool(re.search(r'\b(TESTE|PROVA)\b',p['tema'],re.I)),
                     'proposta':False,'adaptado_de_turma':None}
                    for p in originals[serie]
                ]
            else:
                borrowed=False
                posts=grouped.get(key,[])
                if not posts and key==('2MA','Investigação Matemática'):
                    posts=grouped.get(('2MB','Investigação Matemática'),[])
                    borrowed=True
                if not posts:continue
                units[key]=[
                    {'id':p['id'],'tipo_fonte':'proposta_eclass','ordem':i+1,
                     'tema':p['titulo'].split(' | ',1)[-1].strip(),
                     'texto':content_from_source(p),'avaliacao':p.get('avaliacao',False),
                     'etapa':'proposta','proposta':True,
                     'adaptado_de_turma':'2MB' if borrowed else None}
                    for i,p in enumerate(posts)]
    return units

def project(calendar_rows, consulted, until, holidays):
    """Projeta horários frequentes na grade atual; não afirma disponibilidade futura."""
    by_group=collections.defaultdict(list)
    for r in calendar_rows:
        if r['dia_semana']!='domingo':by_group[(r['turma'],r['disciplina'])].append(r)
    result=[]
    for key,rows in sorted(by_group.items()):
        by_weekday=collections.defaultdict(list)
        for r in rows:
            d=dt.date.fromisoformat(r['data'])
            by_weekday[d.weekday()].append(r)
        for wd,rr in by_weekday.items():
            if len(rr)<2:continue # sem frequência observável
            rr.sort(key=lambda z:z['data'])
            # Estimativa de períodos: grade mais frequente, desempate pela mais recente.
            choices=collections.Counter(tuple((h['ordem'],h['inicio'],h['fim']) for h in r['horario']) for r in rr)
            common=max(choices,key=lambda profile:(choices[profile],max(r['data'] for r in rr if tuple((h['ordem'],h['inicio'],h['fim']) for h in r['horario'])==profile)))
            cur=consulted+dt.timedelta(days=1)
            while cur<=until:
                if cur.weekday()==wd and cur.isoformat() not in holidays:
                    h=[{'ordem':p[0],'inicio':p[1],'fim':p[2]} for p in common]
                    result.append({'turma':key[0],'disciplina':key[1], 'data':cur.isoformat(),
                        'quantidade_periodos':len(h),'horario':h,'situacao':'Não disponível',
                        'dia_semana':DAYS[wd],'projecao':True,
                        'metodo_projecao':'Recorrência semanal observada no calendário, sem confirmação do 7Edu'})
                cur+=dt.timedelta(days=1)
    return sorted(result,key=lambda r:(r['turma'],r['disciplina'],r['data']))

def allocated(units,slotcount):
    """DP determinístico: mantém a ordem, distribui condensações, isola avaliações.

    Até duas unidades por período. Se faltam vagas, mantém as restantes na fila;
    nunca duplica tópicos e nunca preenche lacunas com conteúdo inventado.
    """
    if slotcount<=0:return [],list(units)
    count=len(units)
    if count==0:return [[] for _ in range(slotcount)],[]
    target=min(count,2*slotcount)
    states={0:(0.0,[])}
    for i in range(slotcount):
        nextstates={}
        for used,(cost,steps) in states.items():
            for take in (0,1,2):
                if used>=count and take!=0:continue
                if used<count and take==0:continue
                if used+take>count:continue
                if take==2 and any(x.get('avaliacao') for x in units[used:used+2]):continue
                used2=used+take
                # Quando sobra capacidade, usar primeiro as aulas completas e deixar
                # as datas excedentes vazias no fim, pendentes de revisão.
                ideal=min(count,(i+1)*count/slotcount)
                progresscost=(used2-ideal)**2
                if take==2:progresscost+=0.05
                value=(cost+progresscost,steps+[take])
                if used2 not in nextstates or value[0]<nextstates[used2][0]:nextstates[used2]=value
        states=nextstates
        if not states:raise ValueError('Não foi possível organizar a distribuição de unidades')
    # Consome a quantidade máxima possível e minimiza oscilações/condensações.
    complete=max(states)
    quotas=states[complete][1]
    consumed=0;assigned=[]
    for n in quotas:
        assigned.append(units[consumed:consumed+n]);consumed+=n
    return assigned,units[consumed:]

def generated_post(row,parts,consulted,history_before=False,holidays=None):
    turma,disc,date=row['turma'],row['disciplina'],row['data'];iso=dt.date.fromisoformat(date)
    qty=row['quantidade_periodos'];projected=row.get('projecao',False)
    sunday=iso.weekday()==6
    registered=row['situacao']=='Registrado'
    holiday=bool(holidays and date in holidays)
    source_ids=[u['id'] for unit in parts for u in unit]
    all_units=[u for unit in parts for u in unit]
    is_proposal=any(u.get('proposta',False) for u in all_units)
    is_adapted=any(u.get('adaptado_de_turma') for u in all_units)
    is_condensed=any(len(unit)>1 for unit in parts)
    has_content=bool(all_units) and all(parts)
    checks={'condensacao':is_condensed,'proposta':is_proposal,'historico':history_before,'adaptacao_outra_turma':is_adapted,'avaliacao_data':any(u.get('avaliacao') for u in all_units)}
    if sunday:status='domingo_atipico'
    elif registered:status='registrado_7edu'
    elif holiday:status='feriado_a_conferir'
    elif projected:status='projecao_nao_aberta'
    elif not has_content:status='sem_plano_7edu'
    elif is_condensed:status='revisao_pedagogica'
    elif is_proposal:status='proposta_para_aprovacao'
    else:status='pronto_para_conferencia'
    br=date[8:10]+'/'+date[5:7]+'/'+date[:4]
    label='; '.join(x['tema'] for x in all_units)
    title=(f'{turma} · {disc} · {br} · '+(label or '[SEM CONTEÚDO DEFINIDO]'))[:360]
    headline=['',f'Planejamento para conferência — {turma} / {disc}',f'Data 7Edu: {br} · {qty} período(s)']
    for idx,unit_list in enumerate(parts):
        h=row['horario'][idx];headline+=['',f'{h["ordem"]}º período — {h["inicio"]}–{h["fim"]}']
        if not unit_list:
            headline+=['Conteúdo não definido; requer planejamento do docente.']
        for u in unit_list:
            headline+=['',f'Conteúdo: {u["tema"]}']
            if u['tipo_fonte']=='docx_plano_individual':
                for label,field in [('Leitura prévia','leitura'),('Em classe','em_classe'),('Preparação do aluno','preparacao')]:
                    if u.get(field):headline+=[f'{label}: {u[field]}']
            else:
                headline+=[u['texto']]
    plain='\n'.join(headline).strip()
    htmlparts=[f'<p><strong>PLANEJAMENTO PARA CONFERÊNCIA — {html.escape(turma)} / {html.escape(disc)} — {br}</strong></p>',
        f'<p>Data do 7Edu: {br}. {qty} período(s).</p>']
    for i,p in enumerate(parts):
        h=row['horario'][i]
        htmlparts.append(f'<p><strong>{h["ordem"]}º período — {h["inicio"]}–{h["fim"]}</strong></p>')
        for u in p:
            htmlparts.append('<p><strong>Conteúdo: '+html.escape(u['tema'])+'</strong></p>')
            if u['tipo_fonte']=='docx_plano_individual':
                for label,field in [('Leitura prévia','leitura'),('Em classe','em_classe'),('Preparação do aluno','preparacao')]:
                    if u.get(field):htmlparts.append('<p>'+label+': '+html.escape(u[field])+'</p>')
            else:htmlparts.append('<p>'+html.escape(u['texto']).replace('\n','<br>')+'</p>')
    if not has_content:htmlparts.append('<p>[SEM PLANO: revisão necessária]</p>')
    note=('Dia atípico: domingo, requer conferência. ' if sunday else '')+('Conteúdo já registrado: o calendário NÃO informa o que foi ensinado. ' if registered else '')+('Data projetada, NÃO aberta no portal. ' if projected else '')+('Data identificada como feriado no planejamento E-Class: conferir se houve aula no 7Edu. ' if holiday else '')+('Planejamento associado à data real (não necessariamente efetivamente ministrado).')
    return {'id':f'7EDU_{date}_{turma}_{ {"Matemática":"MAT","Investigação Matemática":"INV","Filosofia":"FIL"}[disc]}',
      'turma':turma,'disciplina':disc,'data':date,'dia_semana':row['dia_semana'],
      'entity_id':None,'group_id_sugerido':None,'horario':row['horario'],'quantidade_periodos':qty,
      'planos_originais':[u['ordem'] for u in all_units if u['tipo_fonte']=='docx_plano_individual'],
      'fonte_unidades':source_ids,'origem':'redistribuicao_sequencial_7edu_v109',
      'status':status,'observacao':note,'titulo':title,'html':'\n'.join(htmlparts),
      'conteudo_7edu':plain,'avaliacao':any(u.get('avaliacao') for u in all_units),
      'aula_complementar':False,'condensacao':is_condensed,
      '7edu':{'consultado_em':consulted.isoformat(),'situacao_portal':row['situacao'],
           'mapeamento':'projecao' if projected else ('bloqueado' if sunday or registered or holiday or not has_content else 'redistribuido'),
           'fonte_unidades':source_ids,'alocacao_por_periodo':[[u['id'] for u in v] for v in parts],'requer':checks,
           'projecao_nao_confirmada':projected,
           'bloqueio':note if sunday or registered or holiday or projected or not has_content else None}}

def generate(calendar,sourcefile,individualsfile,output,report):
    consulted,real,sha=parse_md(calendar)
    parent=json.loads(Path(sourcefile).read_text('utf8'))
    originals=json.loads(Path(individualsfile).read_text('utf8'))
    units=make_units(parent,originals)
    end=dt.date.fromisoformat(parent['periodo']['fim'])
    holidays={r['data'] for r in parent.get('feriados',[])}
    forecast=project(real,consulted,end,holidays)
    groups=collections.defaultdict(list)
    for r in real:
        groups[r['turma'],r['disciplina']].append(dict(r,projecao=False))
    for r in forecast:groups[r['turma'],r['disciplina']].append(r)
    allposts=[];fifo={};stats=collections.Counter();per_group=[]
    for key,group in sorted(groups.items()):
        group.sort(key=lambda r:(r['data'],r.get('projecao',False)))
        # Domingos atípicos não participam da contagem de conteúdos.
        legit=[r for r in group if dt.date.fromisoformat(r['data']).weekday()!=6]
        slots=[(r,i) for r in legit for i in range(r['quantidade_periodos'])]
        sourceunits=units.get(key,[])
        matched,remainder=allocated(sourceunits,len(slots))
        parts_by_date=collections.defaultdict(list)
        for (r,_),part in zip(slots,matched):parts_by_date[r['data']].append(part)
        recorded_seen=False;kind=collections.Counter();nplanned=0
        for r in group:
            if dt.date.fromisoformat(r['data']).weekday()==6:parts=[[] for _ in range(r['quantidade_periodos'])]
            else:parts=parts_by_date.get(r['data'],[[] for _ in range(r['quantidade_periodos'])])
            item=generated_post(r,parts,consulted,recorded_seen,holidays)
            allposts.append(item);kind[item['status']]+=1;nplanned+=len(item['fonte_unidades'])
            if r['situacao']=='Registrado':recorded_seen=True
        fifo[key]=[{'id':u['id'],'tema':u['tema'],'ordem':u['ordem']} for u in remainder]
        per_group.append({'turma':key[0],'disciplina':key[1],'unidades_fonte':len(sourceunits),
          'periodos_disponiveis_na_fotografia':sum(r['quantidade_periodos'] for r in group if not r.get('projecao') and r['dia_semana']!='domingo'),
          'periodos_projetados_nao_abertos':sum(r['quantidade_periodos'] for r in group if r.get('projecao')),
          'unidades_reservadas':nplanned,'unidades_aguardando_data':len(remainder),
          'situacoes':dict(kind)})
        stats.update(kind)
    archive={'versao':'1.0.9','sistema':'7edu','ano':2026,'periodo':'4º bimestre',
      'fonte_consulta':{'data':consulted.isoformat(),'sha256_markdown':sha,
        'projecoes_nao_oficiais':True,'requer_nova_exportacao_antes_de_publicar':True},
      'metodologia':'Redistribuição cronológica de unidades dos planos DOCX e propostas E-Class, por períodos reais; previsões futuras sem autorização de postagem. Datas registradas não comprovam conteúdos.',
      'estatisticas':{'por_situacao':dict(stats),'datas_reais':len(real),
        'datas_projetadas':len(forecast),'periodos_reais':sum(r['quantidade_periodos'] for r in real),
        'periodos_projetados':sum(r['quantidade_periodos'] for r in forecast)},
      'por_disciplina':per_group,'postagens':allposts,
      'fila_sem_data':{f'{t} / {d}':v for (t,d),v in fifo.items() if v},
      'politica_publicacao':'Projeções, domingos, registros e faltas de conteúdo sempre bloqueados. Enviar somente após conferência pedagógica e pré-validação ao vivo.'}
    Path(output).parent.mkdir(parents=True,exist_ok=True)
    Path(output).write_text(json.dumps(archive,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    lines=['# Redistribuição das aulas — 7Edu, 4º bimestre de 2026','',
      '> **PLANEJAMENTO PROPOSTO, NÃO COMPROVANTE DE AULAS MINISTRADAS.** As linhas registradas são bloqueadas e seu conteúdo verdadeiro precisa ser conferido no diário.',
      '',f'- Calendário oficial consultado em: **{consulted.strftime("%d/%m/%Y")}**',
      f'- Datas no calendário exportado: **{len(real)}**',f'- Datas projetadas por recorrência semanal até {end.strftime("%d/%m/%Y")}: **{len(forecast)}**, SEM confirmação do 7Edu',
      '- O E-Class original não foi alterado. Tópicos de Matemática vêm dos 40 planos individuais por série; demais disciplinas usam propostas do pacote E-Class, identificadas para aprovação.',
      '- 2MA / Investigação Matemática recebe **proposta adaptada** da sequência 2MB e exige aprovação expressa.',
      '- Registros anteriores consomem posições na sequência apenas **como hipótese**, não como demonstração de conteúdo efetivamente ministrado. Verifique o histórico antes de publicar aulas subsequentes.',
      '- Cada período recebe até duas unidades do plano; encontros com duas unidades em um período exigem aprovação de condensação.',
      '- Projeções são recalculadas quando novas datas forem disponibilizadas; o relatório deve ser conferido antes de regenerar/publicar.',
      '', '## Visão por disciplina','',
      '| Turma / disciplina | Fonte | Períodos reais válidos | Períodos projetados | Na fila |', '|---|---:|---:|---:|---:|']
    for row in per_group:
        lines.append(f'| {row["turma"]} / {row["disciplina"]} | {row["unidades_fonte"]} | {row["periodos_disponiveis_na_fotografia"]} | {row["periodos_projetados_nao_abertos"]} | {row["unidades_aguardando_data"]} |')
    lines+=['','## Redistribuição proposta, aula por aula','','| Turma / disciplina | Data | Períodos | Estado | Tópicos redistribuídos |', '|---|---|---:|---|---|']
    for row in allposts:
        keys='; '.join(row['fonte_unidades']) or 'SEM CONTEÚDO'
        topics=row['titulo'].split(' · ',3)[-1].replace('|','/')[:170]
        lines.append(f'| {row["turma"]} / {row["disciplina"]} | {row["data"]} | {row["quantidade_periodos"]} | {row["status"]} | {keys} — {topics} |')
    lines+=['','## Unidades ainda aguardando data','']
    for group,remainder in archive['fila_sem_data'].items():
        lines += [f'### {group}', '']
        lines += [f'- {u["id"]}: {u["tema"]}' for u in remainder]
    lines+=['','## Restrições de segurança','',
      '- Não publicar datas de domingo, feriados identificados no planejamento original, datas registradas, projeções ou unidades sem plano.',
      '- Antes de cada envio a extensão verificará a grade atual, horários e duplicatas.',
      '- A grade exportada não contém a descrição do conteúdo dos registros já existentes.',
      '- As estimativas de futuras datas não substituem o calendário oficial.']
    Path(report).parent.mkdir(parents=True,exist_ok=True)
    Path(report).write_text('\n'.join(lines)+'\n',encoding='utf8')
    return archive

if __name__=='__main__':
    if len(sys.argv)!=6:raise SystemExit('Uso: script CALENDARIO.md ORIGEM_ECLASS.json PLANOS_120.json DESTINO_7EDU.json RELATORIO.md')
    result=generate(*sys.argv[1:])
    print(json.dumps(result['estatisticas'],ensure_ascii=False,indent=2))

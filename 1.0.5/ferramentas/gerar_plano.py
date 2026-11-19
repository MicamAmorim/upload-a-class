#!/usr/bin/env python3
"""Reconstitui o cronograma a partir dos planejamentos anexados e do horário transcrito. Sem acesso à rede."""
from docx import Document
from pathlib import Path
from datetime import date,timedelta
from collections import Counter,defaultdict
import json,re,html,csv
from PIL import Image
BASE=Path(__file__).resolve().parents[1]
OUT=BASE/'extension/data'; SRC=Path('/mnt/data')
START=date(2026,9,21); END=date(2026,12,11)
FERIADOS={date(2026,10,12):'Nossa Senhora Aparecida — feriado nacional',date(2026,10,30):'Dia do Comerciário — feriado municipal (Itabuna)',date(2026,11,2):'Finados — feriado nacional',date(2026,11,15):'Proclamação da República — nacional (domingo)',date(2026,11,20):'Dia Nacional de Zumbi e da Consciência Negra — nacional'}
# Horário da fotografia fornecida. Números 1...7 identificam tempos de aula (intervalo removido).
TIMES={1:('07:00','07:45'),2:('07:45','08:30'),3:('08:30','09:15'),4:('09:15','10:00'),5:('10:20','11:05'),6:('11:05','11:50'),7:('11:50','12:30')}
# dia ISO 1=seg...5=sex; matérias verificadas visualmente.
GRADE={
 '1MA': {1:{'Matemática':[3,4],'Investigação Matemática':[7]},2:{'Investigação Matemática':[4]}},
 '1MB': {2:{'Matemática':[1],'Investigação Matemática':[2]},3:{'Matemática':[2]},5:{'Matemática':[4]}},
 '2MA': {2:{'Filosofia':[4]},3:{'Matemática':[7]},4:{'Matemática':[5]},5:{'Matemática':[1,2]}},
 '2MB': {1:{'Matemática':[1,2]},2:{'Matemática':[5]},3:{'Matemática':[3]},4:{'Filosofia':[1]},5:{'Investigação Matemática':[6]}},
 '3MA': {1:{'Matemática':[5,6]},3:{'Matemática':[4],'Investigação Matemática':[5]},4:{'Matemática':[2],'Investigação Matemática':[7]}},
 '3MB': {2:{'Matemática':[6,7]},3:{'Investigação Matemática':[6]},4:{'Matemática':[3,4]},5:{'Investigação Matemática':[5]}}
}
# IDs fornecidos pela resposta GET /turmas-escola/89 do HAR. ID da disciplina SEMPRE será resolvido no portal em tempo real.
GROUPS={'1MA':247646,'1MB':245735,'2MA':242576,'2MB':250051,'3MA':243501,'3MB':244682}
DAYS=['segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado','domingo']

def extract_lessons(ano):
 f=next(SRC.glob(f'Planejamento_Matematica_4_Bimestre_{ano}oANOMA_MB_2026*.docx'))
 tables=Document(f).tables[1:]
 assert len(tables)==40,(f,len(tables))
 out=[]
 for n,t in enumerate(tables,1):
  txt=t.cell(0,0).text
  lines=[ln.strip() for ln in txt.splitlines() if ln.strip()]
  assert f'ENCONTRO/AULA {n:02d}' in lines[0], (n,lines[0])
  mat=re.search(r'CONTEÚDO ATÉ (O TESTE|A PROVA)\s*\|\s*(.*)',txt)
  vers=re.search(r'VERSÍCULO BÍBLICO\s*[“\"](.+?)[”\"]\s*(.+)',txt)
  lectura=re.search(r'📖 Leitura prévia:\s*(.*?)(?=\n🧠 Em classe:)',txt,re.S)
  classwork=re.search(r'🧠 Em classe:\s*(.*?)(?=\n✏️ Preparação do aluno:)',txt,re.S)
  student=re.search(r'✏️ Preparação do aluno:\s*(.*?)(?=\nUm abraço!)',txt,re.S)
  if not all((mat,vers,lectura,classwork,student)):raise ValueError((f,n,txt))
  titulo=re.sub(r'\s+(?:Teórico-prático|Resolução de problemas|Prático|Avaliação|Simulado)\s*$','',mat.group(2)).strip()
  # Some source titles end with type and others do not: preserve full source line separately.
  tipo=(mat.group(2)[len(titulo):].strip() or '')
  out.append(dict(numero=n,etapa='teste' if n<=20 else 'prova',tema=titulo,tipo=tipo,linha_conteudo_original=mat.group(2),
                  versiculo=vers.group(1),referencia=vers.group(2).strip(),
                  leitura=re.sub(r'\s+',' ',lectura.group(1)).strip(),
                  em_classe=re.sub(r'^•\s*','',re.sub(r'\s+',' ',classwork.group(1)).strip()),
                  preparacao=re.sub(r'\s+',' ',student.group(1)).strip(), texto_original=txt))
 return out

COURSES={str(y):extract_lessons(y) for y in [1,2,3]}

def day_iter():
 d=START
 while d<=END:
  if d.weekday()<5 and d not in FERIADOS:yield d
  d+=timedelta(days=1)

def split_content(primary,n):
 """N aulas de livro sobre n tempos existentes; registros extras são de revisão, nunca simulam fonte."""
 k=len(primary)
 if n<=0:raise ValueError('Nenhuma aula disponível')
 if k>=n:
  buckets=[[] for _ in range(n)]
  for i,a in enumerate(primary):buckets[min(n-1,(i*n)//k)].append(a)
  return buckets
 # Distribuição com espaço adicional para revisão guiada, sem inventar novas aulas-base.
 buckets=[[] for _ in range(n)]
 for i,a in enumerate(primary):
  idx=(i*n)//k
  buckets[idx].append(a)
 return buckets

def timeline(cls,subject):
 arr=[]
 for d in day_iter():
  for slot in GRADE[cls].get(d.isoweekday(),{}).get(subject,[]):
   t=TIMES[slot]
   arr.append({'data':d.isoformat(),'slot':slot,'inicio':t[0],'fim':t[1]})
 return arr

def distribute_math(cls):
 base=COURSES[cls[0]]
 arr=timeline(cls,'Matemática')
 assert arr,(cls,'sem aulas')
 # Última aula possível antes de 30/10 e última aula do bimestre para provas.
 test_idx=max(i for i,x in enumerate(arr) if x['data']<='2026-10-29')
 prova_idx=len(arr)-1
 simtest_idx=max(i for i,x in enumerate(arr[:test_idx]) if x['data']<arr[test_idx]['data'])
 simprova_idx=max(i for i,x in enumerate(arr[:prova_idx]) if x['data']<arr[prova_idx]['data'])
 slots=[[] for _ in arr]
 slots[test_idx]=[base[19]];slots[simtest_idx]=[base[18]]
 slots[prova_idx]=[base[39]];slots[simprova_idx]=[base[38]]
 pre_indices=[i for i in range(test_idx) if i!=simtest_idx]
 post_indices=[i for i in range(test_idx+1,prova_idx) if i!=simprova_idx]
 for inds,lesson_range in [(pre_indices,base[:18]),(post_indices,base[20:38])]:
  dist=split_content(lesson_range,len(inds))
  for idx,b in zip(inds,dist):slots[idx]=b
 for i,b in enumerate(slots):
  if b:continue
  # aula de reforço gerada explicitamente, sem material original atribuído
  earlier=[l for prev in slots[:i] for l in prev if l['numero'] not in (19,20,39,40)]
  anchor=earlier[-1]['tema'] if earlier else 'revisão diagnóstica'
  slots[i]=[{'numero':None,'etapa':'revisão','tema':f'Retomada e exercícios: {anchor}','tipo':'Revisão complementar',
               'leitura':'Rever os exemplos e exercícios corrigidos dos conteúdos anteriores.',
               'em_classe':'Retomar dúvidas da turma, resolver exercícios de fixação e corrigir dificuldades identificadas.',
               'preparacao':'Concluir as atividades pendentes e organizar as dúvidas.',
               'versiculo':'Tudo quanto fizerdes, fazei-o de todo o coração.','referencia':'Colossenses 3:23','gerada':True}]
 assert {s['numero'] for lesson in slots for s in lesson if s['numero'] is not None}==set(range(1,41))
 return arr,slots

def esc(s):return html.escape(str(s),quote=True)
HEADER_URL='https://snv.educacaoadventista.org.br/ckeditor/eclass/2026/YnLsCqh2g8sux3TUQT18DJX94QpsJc3pqpTLtMDj.png'

def make_html_math(cls,day,lesson_slots,listing,sequence):
 # preserve all pedagogical content even in grouped lessons
 lflat=[l for bucket in lesson_slots for l in bucket]
 themes=list(dict.fromkeys(l['tema'] for l in lflat))
 only_eval=len(lflat)==1 and lflat[0].get('tipo')=='Avaliação'
 stage='CONTEÚDO ATÉ O TESTE' if all(l.get('etapa')=='teste' for l in lflat) else 'CONTEÚDO ATÉ A PROVA' if all(l.get('etapa')=='prova' for l in lflat) else 'CONTEÚDOS DO BIMESTRE'
 first=lflat[0]
 num=' e '.join(str(l['numero']).zfill(2) for l in lflat if l.get('numero'))
 dateBR=day.strftime('%d/%m/%Y')
 block=[]
 for p,bucket in zip(listing,lesson_slots):
  names=' / '.join(l['tema'] for l in bucket)
  if len(bucket)>1:
   block.append(f'<li><strong>{esc(p["inicio"])}–{esc(p["fim"])}</strong> — <strong>Proposta condensada:</strong> {esc(names)}.<ul>')
   for l in bucket:
    block.append(f'<li><strong>Plano {l["numero"]:02d}:</strong> {esc(l["em_classe"])}</li>')
   block.append('</ul></li>')
  elif bucket:
   block.append(f'<li><strong>{esc(p["inicio"])}–{esc(p["fim"])}</strong> — {esc(bucket[0]["tema"])}: {esc(bucket[0]["em_classe"])}</li>')
 # combine distinct source readings and preparations, with indication of numbered source item
 reading=''.join(f'<li>{"Plano "+str(l["numero"]).zfill(2) if l.get("numero") else "Reforço"}: {esc(l["leitura"])}</li>' for l in lflat)
 home=''.join(f'<li>{"Plano "+str(l["numero"]).zfill(2) if l.get("numero") else "Reforço"}: {esc(l["preparacao"])}</li>' for l in lflat)
 note = ('<p><strong>Observação de planejamento:</strong> há conteúdos originalmente previstos para períodos de 45 minutos agrupados em um período real. A execução integral exige readequação pedagógica.</p>' if any(len(b)>1 for b in lesson_slots) else '')
 return ('<p><img src="'+esc(HEADER_URL)+'" alt="Colégio Adventista de Itabuna — Escola para a vida" style="max-width:100%;height:auto" /></p>'
  + f'<p><strong>ENCONTRO {sequence:02d} — {cls[0]}º {cls[1:]} &nbsp; {dateBR}</strong><br>{DAYS[day.weekday()].capitalize()}</p>'
  + f'<p style="text-align:center"><strong>{stage} &nbsp; | &nbsp; {esc("; ".join(themes))}</strong></p>'
  + f'<table style="margin:auto;border-collapse:collapse"><tbody><tr><td style="border:1px solid #bbb;padding:8px;text-align:center"><strong>VERSÍCULO BÍBLICO</strong><br><em>“{esc(first["versiculo"])}”</em><br><strong>{esc(first["referencia"])}</strong></td></tr></tbody></table>'
  + '<p>Olá, queridos alunos! Sigamos firmes em nossos estudos.</p><p>📌 <strong>Aula de Matemática</strong></p>'
  + '<p>📖 <strong>Leitura prévia:</strong></p><ul>'+reading+'</ul>'
  + '<p>🧠 <strong>Em classe:</strong></p><ul>'+''.join(block)+'</ul>'
  + '<p>✏️ <strong>Preparação do aluno:</strong></p><ul>'+home+'</ul>'+note
  + '<p>Um abraço!<br><strong>Professor Miquéias Amorim</strong></p>')


# Propostas novas, NÃO contidas nos DOCX de Matemática. Derivadas das diretrizes
# gerais anteriores do professor, sem atribuir páginas ou títulos não recebidos.
PHIL=[
 ('Módulo 8 — leitura guiada e levantamento de questões','Ler o início do módulo 8 e selecionar dois conceitos para discussão.','Retomar conceitos centrais do módulo 8; formular perguntas filosóficas e registrar argumentos.','Registrar definições e duas perguntas filosóficas.'),
 ('Módulo 8 — situações-problema e argumentação','Rever os conceitos do módulo 8 e destacar exemplos relevantes.','Debater situações-problema, identificar premissas e justificar posições com argumentos.','Escrever um parágrafo argumentativo com tese e justificativa.'),
 ('Módulo 9 — leitura comparativa de argumentos','Ler o módulo 9 e anotar sua questão principal.','Comparar argumentos encontrados no módulo 9; organizar quadro de teses, fundamentos e objeções.','Preparar uma pergunta e uma objeção fundamentada.'),
 ('Produção textual em sala 1 — módulos 8 e 9','Revisar as anotações dos módulos 8 e 9.','Planejar e produzir em classe um texto argumentativo relacionado aos conceitos estudados.','Revisar a coesão, clareza e fundamentação do texto.'),
 ('Módulo 10 — leitura, interpretação e discussão','Ler o módulo 10; localizar os conceitos e as principais teses.','Analisar trechos do módulo 10 e confrontar argumentos; construir síntese da etapa pré-teste.','Produzir resumo esquemático do módulo 10.'),
 ('Revisão para o teste — módulos 8 a 10','Revisar exercícios, anotações e textos dos módulos 8, 9 e 10.','Realizar revisão dialogada, questões de interpretação e organização dos conceitos para o teste.','Elaborar roteiro de estudo e corrigir questões já discutidas.'),
 ('Teste de Filosofia — módulos 8 a 10','Revisar integralmente os módulos 8, 9 e 10.','Realização do teste sobre os módulos 8–10, conforme organização pedagógica da escola.','Após a devolutiva, registrar dúvidas e pontos a aprofundar.'),
 ('Módulo 11 — conceitos e problemas filosóficos','Ler o módulo 11; sublinhar conceitos, definições e questões propostas.','Interpretar conceitos do módulo 11 e construir argumentos com base no texto do material.','Elaborar quadro com conceitos, teses e exemplos.'),
 ('Produção textual em sala 2 — módulo 11','Revisar o módulo 11 e selecionar uma questão para desenvolver.','Construir texto argumentativo com tese, argumentos, contra-argumento e conclusão.','Revisar o texto observando consistência e clareza argumentativa.'),
 ('Módulo 12 — leitura crítica e confronto de perspectivas','Ler o módulo 12 e registrar pontos que exigem esclarecimento.','Comparar perspectivas filosóficas estudadas; discutir fundamentos e implicações.','Responder às questões de síntese do módulo 12.'),
 ('Produção textual em sala 3 e revisão para a prova','Revisar os módulos 11 e 12 e textos produzidos.','Produção textual em sala 3, seguida de retomada dos conceitos para a prova.','Revisar o resumo final e preparar dúvidas para avaliação.'),
 ('Prova de Filosofia — módulos 11 e 12','Revisar o conteúdo dos módulos 11 e 12.','Realização da prova sobre os módulos 11 e 12, conforme organização pedagógica da escola.','Organizar o material para devolutiva e recuperação da aprendizagem.')
]
INV_ACTIVITIES=[
 ('Questão de investigação e formulação de hipóteses','Apresentar questão aberta, identificar variáveis e formular hipóteses verificáveis.'),
 ('Estratégias de resolução e comparação de caminhos','Resolver problema em grupos, confrontando estratégias distintas e explicitando justificativas.'),
 ('Revisão ENEM — interpretação e modelagem','Analisar questão contextualizada do ENEM, representar os dados e comparar métodos de resolução.'),
 ('Investigação prática e registro de dados','Executar atividade prática de investigação, coletar dados e produzir registros organizados.'),
 ('Conjecturas, exemplos e contraexemplos','Produzir conjecturas, procurar contraexemplos e discutir limites de generalização.'),
 ('Trabalho colaborativo: padrões e regularidades','Investigar padrões, construir tabelas ou representações e justificar conclusões.'),
 ('Revisão ENEM — resolução orientada','Resolver em classe problemas com maior exigência de interpretação e argumentação.'),
 ('Comunicação dos resultados da investigação','Apresentar conclusões em equipes, descrever procedimentos e discutir a confiabilidade dos resultados.'),
 ('Oficina de revisão ENEM — diagnóstico e correção','Realizar revisão com itens ENEM e corrigir os erros por tipo de raciocínio.'),
 ('Síntese investigativa e autoavaliação','Organizar o portfólio das investigações, rever conjecturas e identificar avanços e dificuldades.')
]

def proposed_lesson(cls,subject,sequence):
 if subject=='Filosofia':
  t,reading,inclass,prep=PHIL[(sequence-1)%len(PHIL)]
  return dict(tema=t,leitura=reading,em_classe=inclass,preparacao=prep,
              versiculo='O coração do sábio adquire conhecimento.',referencia='Provérbios 18:15',
              avaliacao=sequence in (7,12))
 grade=int(cls[0]);
 anchor={1:('função quadrática e transformações geométricas','estatística e análise de dados'),
         2:('cilindro, cone e esfera','geometria e relações espaciais'),
         3:('números complexos','polinômios e suas raízes')}[grade]
 topic=anchor[0] if sequence<=max(4,len(timeline(cls,'Investigação Matemática'))//2) else anchor[1]
 action, activity=INV_ACTIVITIES[(sequence-1)%len(INV_ACTIVITIES)]
 return dict(tema=f'{action} — {topic}',
   leitura=f'Retomar as anotações do módulo de Investigação Matemática e os conceitos de {topic}. Páginas específicas ainda não fornecidas.',
   em_classe=f'{activity} Temática de apoio: {topic}.',
   preparacao='Registrar o problema, os procedimentos, a conclusão e as dúvidas no caderno de investigação.',
   versiculo='Tudo quanto fizerdes, fazei-o de todo o coração.',referencia='Colossenses 3:23',avaliacao=False)

def make_html_proposed(cls,subject,day,periods,sequence,p):
 dbr=day.strftime('%d/%m/%Y')
 times=''.join(f'<li>{esc(x["inicio"])}–{esc(x["fim"])} — {esc(p["em_classe"])}</li>' for x in periods)
 return ('<p><img src="'+esc(HEADER_URL)+'" alt="Colégio Adventista de Itabuna — Escola para a vida" style="max-width:100%;height:auto" /></p>'
     +f'<p><strong>ENCONTRO {sequence:02d} — {cls[0]}º {cls[1:]} &nbsp; {dbr}</strong><br>{DAYS[day.weekday()].capitalize()}</p>'
     +f'<p style="text-align:center"><strong>CONTEÚDO DO BIMESTRE &nbsp; | &nbsp; {esc(p["tema"])}</strong></p>'
     +f'<table style="margin:auto;border-collapse:collapse"><tr><td style="border:1px solid #bbb;padding:8px;text-align:center"><strong>VERSÍCULO BÍBLICO</strong><br><em>“{esc(p["versiculo"])}”</em><br><strong>{esc(p["referencia"])}</strong></td></tr></table>'
     +f'<p>Olá, queridos alunos! Sigamos firmes em nossos estudos.</p><p>📌 <strong>Aula de {esc(subject)}</strong></p>'
     +f'<p>📖 <strong>Leitura prévia:</strong> {esc(p["leitura"])}</p>'
     +f'<p>🧠 <strong>Em classe:</strong></p><ul>{times}</ul>'
     +f'<p>✏️ <strong>Preparação do aluno:</strong> {esc(p["preparacao"])}</p>'
     +'<p>Um abraço!<br><strong>Professor Miquéias Amorim</strong></p>')

def main():
 timetable=[]; posted=[]; all_slots=defaultdict(list); issues=[];stats=[]
 for cls in GRADE:
  for sub in ['Matemática','Investigação Matemática','Filosofia']:
   arr=timeline(cls,sub)
   if not arr:continue
   if sub=='Matemática': slots,ls = distribute_math(cls)
   else:slots,ls=arr,[None for _ in arr]
   for p,l in zip(slots,ls):
    all_slots[(cls,sub,p['data'])].append((p,l))
  for (cl,subject,dstr), lines in list(all_slots.items()):
   if cl!=cls:continue
   d=date.fromisoformat(dstr)
   periods=[p for p,_ in lines];groups=[b for _,b in lines]
   sequence=sum(1 for z in posted if z['turma']==cls and z['disciplina']==subject)+1
   if subject=='Matemática':
    content=make_html_math(cls,d,groups,periods,sequence)
    nums=[l['numero'] for arr in groups for l in arr if l['numero'] is not None]
    compressed=any(len(arr)>1 for arr in groups)
    is_review=any(any(l['numero'] is None for l in arr) for arr in groups)
    assessment=any(n in [20,40] for n in nums)
    # Conteúdo condensado exige confirmação pedagógica individual.
    state='revisao_pedagogica' if compressed else 'pronto_para_conferencia'
    a='; '.join(dict.fromkeys(l['tema'] for arr in groups for l in arr))
    title=f'ENCONTRO {sequence:02d} — {cls[0]}º {cls[1:]} — {d.strftime("%d/%m/%Y")} | {a[:115]}'
    status_notes=('Agrupamento de '+str(len(nums))+' planos originais em '+str(len(periods))+' período(s) reais; exige aprovação.' if compressed else 'Requer conferência humana antes da publicação.')
   else:
    nums=[];compressed=False;is_review=False
    drafted=proposed_lesson(cls,subject,sequence)
    title=f'ENCONTRO {sequence:02d} — {cls[0]}º {cls[1:]} — {d.strftime("%d/%m/%Y")} | {drafted["tema"]}'
    content=make_html_proposed(cls,subject,d,periods,sequence,drafted)
    assessment=drafted['avaliacao']
    state='proposta_para_aprovacao'
    status_notes=f'Proposta nova elaborada a partir de diretrizes anteriores, não de planejamento completo anexado de {subject}. Conferir módulo, tema, leitura e avaliação antes de autorizar.'
   entry=dict(id=f'{dstr}_{cls}_{"MAT" if subject=="Matemática" else "INV" if subject=="Investigação Matemática" else "FIL"}',
      data=dstr,dia_semana=DAYS[d.weekday()],turma=cls,disciplina=subject,entity_id=89,group_id_sugerido=GROUPS[cls],
      horario=[dict(inicio=x['inicio'],fim=x['fim'],ordem=x['slot']) for x in periods],
      quantidade_periodos=len(periods),planos_originais=nums,origem='planejamento_docx' if subject=='Matemática' else 'proposta_baseada_em_diretrizes',
      status=state,observacao=status_notes,titulo=title,html=content,avaliacao=assessment,aula_complementar=is_review,condensacao=compressed)
   posted.append(entry)
   for p,_ in lines:timetable.append(dict(data=dstr,turma=cls,disciplina=subject,periodo=p['slot'],inicio=p['inicio'],fim=p['fim']))
 posted.sort(key=lambda e:(e['data'],e['horario'][0]['ordem'],e['turma'],e['disciplina']))
 # Source dates from uploaded lesson sheets are blanks by design.
 for cls in GRADE:
  items=[x for x in posted if x['turma']==cls and x['disciplina']=='Matemática']
  n_periods=sum(x['quantidade_periodos'] for x in items)
  n_base=sum(len(x['planos_originais']) for x in items)
  evals={num:next(x['data'] for x in items if num in x['planos_originais']) for num in (19,20,39,40)}
  stats.append(dict(turma=cls,matematica_periodos=n_periods,matematica_encontros=len(items),planos_base_distribuidos=n_base,
          deficit_vs_40=40-n_periods,planos_condensados=sum(x['condensacao'] for x in items),
          encontros_complementares=sum(x['aula_complementar'] for x in items),datas_avaliacoes=evals,
          investigacao_periodos=len(timeline(cls,'Investigação Matemática')),filosofia_periodos=len(timeline(cls,'Filosofia'))))
 for p in posted:
  if p['disciplina']!='Matemática':issues.append({'id':p['id'],'motivo':'conteúdo proposto sem plano-fonte completo; exige revisão','bloqueado':True})
  if p['condensacao']:issues.append({'id':p['id'],'motivo':'condensação de aulas originais em tempo menor','bloqueado':True})
 header_orig=SRC/'image(20261117-191047).png'
 im=Image.open(header_orig).convert('RGB').crop((40,154,523,195)); im.resize((966,82),Image.Resampling.LANCZOS).save(OUT/'imagens/cabecalho_referencia.png',optimize=True)
 OUT.mkdir(parents=True,exist_ok=True)
 payload={'versao':'1.0.0','ano':2026,'periodo':{'inicio':START.isoformat(),'fim':END.isoformat()},'escola':'Colégio Adventista de Itabuna',
 'professor':'Miquéias Amorim','origens':{'horario':'20260917_104548.jpg (transcrição manual revisada)',
   'planos':['Planejamento_Matematica_4_Bimestre_1oANOMA_MB_2026(1).docx','Planejamento_Matematica_4_Bimestre_2oANOMA_MB_2026(1).docx','Planejamento_Matematica_4_Bimestre_3oANOMA_MB_2026(1).docx'],
   'api':'HAR fornecido; rota /api/v1/dailies; nenhuma credencial copiada'},
 'cabecalho':{'imagem_local':'imagens/cabecalho_referencia.png','imagem_eclass':HEADER_URL,
  'nota':'Imagem local é recorte de referência da captura do usuário; HTML usa URL original fornecida, sujeita a disponibilidade.'},
 'feriados':[{'data':d.isoformat(),'descricao':v} for d,v in FERIADOS.items()],
 'pontos_a_conferir':[{'data':'2026-10-15','motivo':'Dia dos Professores — não é feriado nacional; confirmar se houve suspensão escolar'},
                     {'data':'2026-10-28','motivo':'Dia do Servidor Público — ponto facultativo em alguns órgãos; não presumido escola'},
                     {'data':'2026-12-08','motivo':'Não é feriado municipal de Itabuna; confirmar eventual calendário escolar interno'}],
 'horario_semanal':GRADE,'ids_turmas_referencia_har':GROUPS,
 'regras':{'um_post_por_turma_disciplina_data':True,'teste_plano':20,'prova_plano':40,'simulado_teste_plano':19,'simulado_prova_plano':39,
          'publicacao_automatica_ao_instalar':False,'revisao_humana_obrigatoria':True,
          'sem_postagem_feriado':True},
 'estatisticas':stats,'postagens':posted}
 (OUT/'planos_originais_matematica_120.json').write_text(json.dumps(COURSES,ensure_ascii=False,indent=2),encoding='utf-8')
 (OUT/'aulas_4bim_2026.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding='utf-8')
 (BASE/'relatorios'/'auditoria.json').write_text(json.dumps(dict(estatisticas=stats,alertas=issues,feriados=payload['feriados']),ensure_ascii=False,indent=2),encoding='utf-8')
 with (BASE/'relatorios'/'agenda.csv').open('w',encoding='utf-8-sig',newline='') as fo:
  w=csv.writer(fo,delimiter=';');w.writerow(['Data','Dia','Turma','Disciplina','Períodos','Horários','Planos','Situação','Título'])
  for x in posted:w.writerow([x['data'],x['dia_semana'],x['turma'],x['disciplina'],x['quantidade_periodos'],', '.join(p['inicio']+'-'+p['fim'] for p in x['horario']),', '.join(map(str,x['planos_originais'])),x['status'],x['titulo']])
 print('POSTS',len(posted),'PERIODS',len(timetable),'STATUS',dict(Counter(x['status'] for x in posted)))
 for s in stats:print(s)

if __name__=='__main__':main()

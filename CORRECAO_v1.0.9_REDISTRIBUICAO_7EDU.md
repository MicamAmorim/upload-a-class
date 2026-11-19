# Versão 1.0.9 — Redistribuição cronológica de conteúdos para o 7Edu

## O que foi corrigido

A v1.0.8 associava conteúdos **apenas às mesmas datas** do E-Class. Isso não é adequado porque o 7Edu tem um calendário diferente. A v1.0.9 cria um planejamento independente por **turma, disciplina e período**, sem alterar a base do E-Class.

### Fontes

- Calendário de 14 disciplinas exportado de `Grid_Read` em 19/11/2026: **221 datas e 277 períodos**. A origem é uma fotografia parcial; não prova que todos os dias do bimestre estejam liberados.
- Matemática: **40 planos de aula individuais por série** da base `planos_originais_matematica_120.json`, preservando tópicos, atividades e sequência.
- Investigação Matemática e Filosofia: propostas existentes do pacote E-Class, com necessidade de aprovação pedagógica; 2MA/Investigação foi adaptada do material de 2MB e também exige aprovação.

### Redistribuição

1. Ordenar as datas reais por turma/disciplinas e alocar as unidades cronologicamente por **período**.
2. Separar os 14 domingos `27/09/2026` da alocação: constam no portal, mas exigem verificação.
3. Preservar e bloquear todas as **19 datas já registradas**, inclusive uma no domingo; o calendário não mostra o conteúdo delas.
4. Bloquear e destacar as 5 datas que coincidem com 30/10/2026, feriado identificado no E-Class, até confirmação de que houve aula.
5. Projetar **78 datas/96 períodos** por recorrência semanal de 20/11 a 11/12, sem considerar feriados da base original. **Projeções não estão disponíveis no 7Edu e jamais são publicáveis.**
6. Se houver menos períodos do que unidades do plano, distribuir no máximo 2 unidades por período, sem combinar avaliações com outro conteúdo no mesmo período. Toda condensação exige aprovação.
7. Se ainda faltar capacidade, conservar unidades em `fila_sem_data` — **4 unidades em 1MA / Investigação Matemática** nesta projeção — sem inventar datas.
8. Se houver mais períodos do que conteúdo-fonte, destacar como sem planejamento definido; não criar temas fictícios.
9. As datas de teste/prova são candidatas, **não oficiais**: exigem confirmação explícita antes do envio.

### Proteções

- As datas oficiais do 7Edu são verificadas novamente na hora do envio, inclusive horários, períodos e duplicidade.
- O usuário aprova separadamente: condensação, propostas, sequência após registros históricos e datas de avaliação.
- O conteúdo já registrado no 7Edu é **desconhecido** nesta exportação; as associações nessas datas são hipóteses de sequência e **nunca serão republicadas**.
- A base do E-Class permanece idêntica. Revisões locais do 7Edu usam chaves diferentes das do E-Class.
- Nenhuma alteração foi efetuada no portal 7Edu durante a geração ou testes da versão 1.0.9.

## Instalando

Extraia `extension/` no local já instalado e use **Atualizar** em `edge://extensions/` ou `chrome://extensions/`, sem apagar a extensão. Abra o 7Edu e revise a disciplina antes de lançar qualquer aula. Faça no máximo um lançamento de teste, após confirmar os registros existentes.

## Atualizando quando novas datas forem abertas

Exporte outro `.md` do 7Edu e reexecute:

```bash
python ferramentas/redistribuir_aulas_7edu.py \
  novo_calendario.md \
  extension/data/aulas_4bim_2026.json \
  extension/data/planos_originais_matematica_120.json \
  extension/data/aulas_7edu_4bim_2026.json \
  relatorios/redistribuicao_aulas_7edu_2026.md
```

**Atenção:** a redistribuição automática pode mudar hipóteses de conteúdos, inclusive de datas registradas, quando surgem novas datas no meio do calendário. O relatório deve ser comparado ao histórico real do 7Edu, e eventuais conteúdos efetivamente ministrados devem ser confirmados pelo professor antes de qualquer novo lote. Não substituir uma base já validada sem comparar alterações.

## Testes offline

```bash
python ferramentas/testar_redistribuicao_7edu.py
node ferramentas/testar_7edu_mock.js
node ferramentas/testar_exportacao_calendario_7edu.js
node ferramentas/testar_worker.js
node ferramentas/testar_tipos_postagens_v105.js
node ferramentas/testar_autenticacao_v104.js
```

**Limitação não resolvida:** o HTTP 400 de um lançamento anterior no 7Edu não tem causa demonstrada. Nenhum teste local confirma aceitação de uma gravação na sessão real.

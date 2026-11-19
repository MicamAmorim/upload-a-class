# Atualização v1.0.7 — Datas reais e exportação Markdown do 7Edu

**19/11/2026 · Base: v1.0.6 (E-Class + 7Edu).**

## Motivação

O 7Edu usa um calendário distinto do calendário de planejamentos do E-Class. O log fornecido mostra que um lote foi interrompido após **12 tentativas**, com **11 concluídas** e **1 HTTP 400**. A causa exata do HTTP 400 **não está confirmada**. As capturas mostram linhas **registradas** (verdes), **pendentes** (vermelhas) e **previstas** (azul). Não se deve repetir automaticamente a aula que falhou sem confirmar seu estado no portal.

## Exportar calendário real do 7Edu — apenas leitura

1. Abra `https://7edu-br.educadventista.org/teacherportal/` e entre em **Aulas Ministradas** de qualquer disciplina.
2. Na extensão, escolha **7Edu**.
3. Use **Exportar disciplina aberta (.md)** para a página ativa ou **Exportar todas minhas disciplinas (.md)** para consultar as 14 seções elegíveis cadastradas (o número real depende da conta e do cadastro do ano).
4. O arquivo contém **turma, disciplina, data, número de períodos, horários e situação (registrado, pendente, futuro)**. Não contém tokens, IDs de docente, cookies ou conteúdo de alunos.
5. Envie o arquivo `.md` para remapear os conteúdos do planejamento. As datas ainda não disponibilizadas pelo 7Edu **não podem ser inventadas** nem tratadas como ausências letivas. Registros que já estão no 7Edu não devem ser publicados outra vez.

As linhas são lidas da resposta oficial `ClassMeeting/Grid_Read`, com datas em `ExpectedDate` (previstas) ou `RealizedDate` (registradas), e quantidade de aulas obtida pelo comprimento de `ClassMeetingList`. Um registro com `RealizedDate` preenchido é considerado registrado, mesmo que a data planejada no E-Class seja diferente. Se uma seção não puder ser lida, o exportador inclui um **alerta** e não inventa sua grade.

## Mudanças no lançamento

- **No modo 7Edu somente**, datas posteriores à data local atual ficam indisponíveis na seleção.
- Antes da primeira gravação de um lote 7Edu, é executada uma **pré-validação de leitura para cada item**. Exige data presente como linha prevista única no 7Edu, quantidade exata de períodos e horários correspondentes à grade oficial.
- Uma aula que já tenha `RealizedDate` será pulada, não alterada; divergência em qualquer item cancela o lote **antes da primeira gravação**.
- Um HTTP 400 na gravação é identificado como erro na rota `Save`, sem exposição do corpo da resposta. Como um POST pode ter produzido efeitos antes do erro, **não há repetição automática**.
- O fluxo de autenticação, rascunho e envio do E-Class segue como estava na v1.0.6; o JSON original de 284 postagens não foi modificado nesta atualização.

**Limitação:** a pré-validação não garante que o 7Edu aceitará o POST. O servidor pode aplicar outras regras e mudar entre consulta e gravação. O arquivo exportado é um retrato dos registros acessíveis na consulta, não um calendário oficial completo do ano. A versão 1.0.7 ainda não foi validada por um envio real no 7Edu.

## Instalação sem perder dados locais

Copie os novos arquivos de `extension/` **sobre a pasta já carregada no Edge/Chrome**. Em `edge://extensions/` ou `chrome://extensions/`, pressione **Atualizar**. Evite desinstalar: o navegador pode apagar revisões e o histórico local.

Teste primeiro **Exportar disciplina aberta**, confira as datas com a tabela do próprio 7Edu e depois **Exportar todas minhas disciplinas**. Antes de qualquer novo lote, confira os onze registros anteriores e a aula que recebeu HTTP 400.

## Testes offline

Execute `node ferramentas/testar_7edu_mock.js`, `node ferramentas/testar_exportacao_calendario_7edu.js` e os testes antigos de `ferramentas/`. Todos usam dados fictícios e não alteram portais reais.

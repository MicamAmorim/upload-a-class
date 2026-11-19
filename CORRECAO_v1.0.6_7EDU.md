# Atualização v1.0.6 — Lançamento supervisionado também no 7Edu

**Data:** 19/11/2026. **Base preservada:** v1.0.5 da extensão E-Class, incluindo 284 postagens, 348 períodos e todas as correções anteriores de autenticação e prevenção de duplicatas.

## O que mudou

- Seleção explícita entre **E-Class** e **7Edu (Aulas Ministradas)**. Quando a aba ativa é o 7Edu, o seletor o escolhe automaticamente.
- O **E-Class** conserva a publicação de HTML, a opção rascunho e as verificações anteriores.
- O **7Edu** recebe conteúdo convertido para **texto simples**, pois a interface original de lançamento usa `RealizedContentAll` em um campo de texto. O conteúdo exato pode ser conferido em **Prévia** antes de enviar.
- O adaptador do 7Edu consulta as disciplinas abertas para o docente autenticado, seleciona a turma e a disciplina por **nome e código**, identifica o **BIM04 pela data**, lê o `SectionItemId` da tela da respectiva disciplina, verifica as aulas já realizadas e busca os horários oficiais da data.
- O lançamento usa **apenas** os períodos cujos horários são compatíveis com o planejamento; discrepâncias bloqueiam a gravação. O formato do POST de `Save` segue a estrutura observada no HAR fornecido.
- Duplicatas são verificadas no servidor pelo campo `RealizedDate`, separadamente para cada turma e disciplina. Uma linha *prevista* com `ExpectedDate` e `RealizedDate` vazio é considerada pendente (não uma aula já ministrada).
- O 7Edu não oferece, nesse fluxo observado, a modalidade de **rascunho do E-Class**; a caixa de rascunho/publicação fica oculta no modo 7Edu. Não há envio automático ou repetição de POST após falha.
- Lançamentos de datas **futuras** são bloqueados: o recurso é para registrar aulas que já ocorreram.
- O registro de envios locais agora diferencia `posted_...` (E-Class) e `posted_7edu_...` (7Edu).

## Atualizar sem perder as alterações anteriores

1. Descompacte o ZIP completo v1.0.6 em uma pasta local, mas **não apague** a antiga antes de confirmar a instalação.
2. Para manter o ID e os dados locais da extensão existente, **copie os arquivos da nova `extension/` sobre a pasta `extension/` que você já carregou no Edge/Chrome** e clique em **Atualizar** em `edge://extensions/` ou `chrome://extensions/`. O navegador pode solicitar autorização para o novo domínio 7Edu.
3. A extensão não migra nem apaga os arquivos de planejamento, as edições salvas ou os registros anteriores de publicação E-Class. Não desinstale a versão antiga antes de copiar, pois a desinstalação pode eliminar seu histórico local.
4. Se preferir instalar separadamente, acesse a página de extensões, habilite o modo desenvolvedor e selecione a pasta `extension/` da nova versão. **A instalação separada usa armazenamento separado**; confira os registros no próprio portal antes de repetir um envio anterior.

## Como usar com o 7Edu

1. Faça login no **https://7edu-br.educadventista.org/teacherportal/** com sua própria conta. Acesse uma disciplina e entre em **Aulas Ministradas**. A página deve ter `/teacherportal/ClassMeeting?employeeId=...` no endereço.
2. Mantenha essa aba ativa, abra a extensão e selecione **7Edu**.
3. Clique em **Testar 7Edu (sem lançar)**. O teste lê as disciplinas e a lista de aulas para uma data do seu calendário, sem realizar qualquer gravação. O sistema identifica automaticamente a turma/disciplina mesmo se você abriu outra disciplina para chegar à página de Aulas Ministradas.
4. Filtre uma **aula passada que ainda não foi registrada**, abra **Prévia** e confira a versão em texto, os horários e a coerência pedagógica. Não selecione propostas não revisadas.
5. Selecione **uma** aula como teste e clique em **Lançar seleção no 7Edu**. Confirme explicitamente a alteração. Verifique o resultado **no diário web do 7Edu**.
6. Somente depois desse teste real, considere lotes maiores. Se ocorrer erro HTTP ou uma resposta inesperada após o envio, **confira a página do 7Edu antes de repetir**; a extensão não faz retry automático de gravação.

## Detalhes da integração confirmados no HAR

- Origem autorizada: `https://7edu-br.educadventista.org`.
- Leitura de disciplinas: `POST /teacherportal/Home/GetListOpenedSectionByEmployee`.
- Seleção da disciplina-filha: `POST /teacherportal/ClassMeeting` (HTML, campo `SectionItemId`).
- Leitura das aulas: `POST /teacherportal/ClassMeeting/Grid_Read`.
- Leitura dos horários: `POST /teacherportal/ClassMeeting/GetListScheduleTemplateItemByTerm`.
- Gravação de uma aula: `POST /teacherportal/ClassMeeting/Save` (JSON, retorno com identificador UUID).
- O `EmployeeId`, a turma, o período letivo, a disciplina e os IDs da grade são obtidos **ao vivo da sessão do próprio usuário** e das respostas do 7Edu; **não** são copiados do HAR.

## Testes realizados e limites

**Verificação offline:** 8 cenários de integração simulada 7Edu, mais os testes E-Class de autenticação/renovação, prevenção de duplicatas Aula × Atividade e 284 postagens do pacote. Foi validada a estrutura das rotas e do payload do HAR recebido. Consulte `ferramentas/testar_worker.js` e `ferramentas/auditar_har_7edu.py`.

**Não foi realizado um lançamento real no 7Edu.** Não há uma sessão autenticada do professor disponível aqui; mudanças internas no sistema, permissões individuais e restrições de datas só podem ser confirmadas no teste com uma aula real, com a conta do usuário. O adaptador bloqueia casos incertos, em vez de tentar preencher horários diferentes ou improvisar IDs.

**Segurança:** o HAR original contém potencialmente cookies e identificadores de sessão. Ele **não** está incluído em nenhum dos ZIPs. Não compartilhe esse HAR em repositórios públicos. A extensão não armazena nem extrai cookies, senhas ou tokens; suas chamadas 7Edu usam a sessão do próprio navegador em sua origem.

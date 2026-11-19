## Versão 1.0.10 — Filosofia (7Edu)

O 7Edu usa uma sequência própria para Filosofia nas turmas 2MA e 2MB, com os **módulos 8 a 12**, alternando **aulas expositivas e práticas de exercícios**. São **12 encontros na 2MA** (5 expositivos / 7 práticos) e **11 na 2MB** (5 expositivos / 6 práticos), com propostas detalhadas e exercícios. Datas ainda não abertas permanecem projetadas e bloqueadas. Não foi atribuída prova ou teste a uma data sem confirmação.

Fontes: `extension/data/plano_filosofia_7edu_2026.json`, `relatorios/plano_filosofia_7edu_modulos_8_12.md` e `CORRECAO_v1.0.10_FILOSOFIA_7EDU.md`. O E-Class original e as demais disciplinas do 7Edu foram preservados. Atualize os arquivos da extensão instalada sem excluir a pasta nem seu armazenamento local. Confirme o conteúdo já ministrado antes de qualquer lançamento.

---

## Versão 1.0.8 — Mapeamento auditado do 7Edu (19/11/2026)

- Mantém o arquivo E-Class original `extension/data/aulas_4bim_2026.json` (**284 postagens**) sem alterações.
- Usa `extension/data/aulas_7edu_4bim_2026.json` (**221 datas de 14 disciplinas**) somente no modo 7Edu.
- Somente datas com coincidência exata no planejamento original e horários/quantidade compatíveis são elegíveis; condições pedagógicas anteriores ainda exigem aprovação.
- Aulas já registradas, domingos atípicos (27/09), datas sem plano-fonte e datas futuras ficam bloqueadas.
- Exportação `.md` continua disponível para coletar novos dias abertos pelo 7Edu.
- Detalhes em `CORRECAO_v1.0.8_REMAPEAMENTO_7EDU.md` e `relatorios/auditoria_remapeamento_7edu_2026.md`.

> **Histórico: 1.0.7 (19/11/2026).** Correção de segurança e calendário do 7Edu: exportação `.md` por disciplina ou de todas as disciplinas, com data, número de aulas, horários e situação. O 7Edu passa a pré-validar todo o lote antes da primeira gravação. O calendário do E-Class segue **independente**. Leia [`CORRECAO_v1.0.7_CALENDARIO_7EDU.md`](CORRECAO_v1.0.7_CALENDARIO_7EDU.md).

> **Histórico: 1.0.6 (19/11/2026).** A extensão agora lança aulas no E-Class **e** no 7Edu. O E-Class manteve seu fluxo; o 7Edu usa o diário de "Aulas Ministradas" e o formato de gravação identificado no HAR. **Leia `CORRECAO_v1.0.6_7EDU.md` para instalar, testar e conhecer as limitações.** Os parágrafos abaixo descrevem a origem e o histórico da versão 1.0.4/1.0.5.

> **Histórico: 1.0.4 (17/11/2026).** A extensão agora tenta renovar o Bearer por uma rota oficial do portal se uma consulta GET receber 401. O refresh é feito apenas na aba autenticada; o token não é salvo na extensão. Não há repetição automática de POST. Consulte `CORRECAO_v1.0.4.md`. Informações sobre autenticação de versões anteriores abaixo são históricas e não descrevem integralmente a v1.0.4.

> **Atualização 1.0.3:** a extensão agora usa o token da sessão do próprio portal exclusivamente no contexto da página. Consulte `CORRECAO_v1.0.3.md` para a explicação e precauções.

# Aulas do 4º bimestre de 2026 — E-Class + 7Edu (extensão v1.0.10)

**Colégio Adventista de Itabuna · Prof. Miquéias Amorim · 21/09 a 11/12/2026**

Este pacote contém o calendário completo obtido da fotografia do horário escolar e os 120 planos originais de Matemática extraídos dos três arquivos DOCX (40 planos por série). Nenhuma credencial do HAR foi copiada ou incluída. O HAR original **não acompanha este pacote**.

## Arquivos

- `extension/`: extensão Chrome/Edge Manifest V3, para carregar sem compactação.
- `extension/data/aulas_4bim_2026.json`: **284 postagens por dia, turma e disciplina**, com horário exato, conteúdo em HTML, status e origem.
- `extension/data/imagens/cabecalho_referencia.png`: cópia de referência do cabeçalho (recorte da captura fornecida); o HTML usa a URL original indicada pelo professor.
- `relatorios/calendario_visual.html`: calendário de consulta sem precisar instalar nada; abra com duplo clique.
- `relatorios/agenda.csv`: tabela importável no Excel.
- `relatorios/auditoria.json`: alertas, quantidades por turma e propostas de datas de avaliações.
- `ferramentas/gerar_plano.py`: código-fonte do gerador, que lê os arquivos DOCX originais na pasta `/mnt/data`; para reproduzir localmente, ajustar `SRC` e instalar `python-docx` e `Pillow`.

## Como instalar a extensão

1. Extraia o ZIP (não tente instalar a extensão diretamente do ZIP).
2. Abra `edge://extensions/` (Edge) ou `chrome://extensions/` (Chrome).
3. Ative **Modo do desenvolvedor**.
4. Escolha **Carregar sem compactação** e indique a pasta **`extension`** (a pasta que contém `manifest.json`).
5. Acesse `https://portal.educacaoadventista.org.br/` com a conta habilitada para publicar aulas, selecione **2026** e a unidade **Itabuna**, e abra o calendário de aulas para gerar as requisições do portal.
6. **Recarregue o portal** com a extensão ativa. Ela extrai apenas metadados de contexto `x-portal-*` das requisições locais (não captura nem salva cookies, senhas, Authorization ou tokens).
7. Clique no ícone da extensão, filtre as aulas e use **Prévia**. Selecione primeiro **uma aula em uma data de teste**, deixe **Publicar** desmarcado e envie como **rascunho** para validar no sistema.
8. Depois de verificar a turma, a disciplina, a data e o HTML dentro do E-Class, selecione as demais. Para efetivamente publicar, marque **Publicar**. A extensão pedirá confirmação antes de modificar o E-Class.
9. Caso a extensão indique **Contexto não identificado**, abra o calendário no portal e atualize a página. Caso indique **HTTP 403 / bloqueio de requisição**, não tente contornar a permissão: revise a sessão, os papéis e a autorização com a escola.

**Importante:** a rota `/api/v1/dailies` foi observada no HAR em criação real, mas **nenhuma publicação viva foi testada** neste ambiente. O primeiro rascunho no portal é o teste de integração necessário. O fluxo não apaga nem altera postagens existentes.

## Regras pedagógicas e impedimentos

- A sequência **original** dos planos 01–40 de cada série foi preservada, assim como os versículos, as leituras, os exercícios e as preparações. Planos 19/39 = simulados; 20/40 = avaliações.
- **Uma postagem por turma, disciplina e dia**, com lista dos períodos daquele encontro. Exemplo: dois períodos seguidos, uma única postagem com dois blocos horários.
- 1º MA tem apenas **20 períodos de Matemática** nas datas letivas, para **40** aulas planejadas; 1º MB tem **34 períodos**. O arquivo inclui toda a sequência em propostas condensadas, **mas não afirma que a carga de 45 minutos de cada plano possa ser realizada integralmente**. Essas postagens só se tornam selecionáveis após a caixa “Aprovo explicitamente a condensação”. Recomenda-se ajustar a programação com a coordenação em vez de presumir viabilidade.
- 2º MA, 2º MB e 3º MA têm **44 períodos de Matemática**; 3º MB tem **48**. Os períodos extras recebem **retomadas e exercícios**, marcados como atividades complementares geradas, não como planos originais.
- **Investigação Matemática** (90 períodos) e **Filosofia** (24 períodos) foram posicionadas no calendário, mas **não foram enviados planos dessas disciplinas**. Suas **114 postagens permanecem bloqueadas**, sem conteúdo inventado; o JSON deixa lugar para preenchimento.
- Foram excluídos 12/10, 30/10, 02/11 e 20/11. 15/11 cai em domingo. O dia 08/12 não é feriado municipal de Itabuna.
- **15/10**, Dia dos Professores, não foi excluído sem confirmação da escola. Também é necessário conferir recessos, jornadas, semanas de provas, 2ª chamada e outros eventos do calendário escolar interno, não disponível.
- As datas de teste e prova foram **propostas** conforme o encaixe no horário e a sequência dos planos: **não são datas oficiais confirmadas**. Revisar antes da publicação.
- A extensão valida turmas de 2026 pelo cadastro ao vivo no E-Class, consulta a disciplina ao vivo, confere postagens já existentes para evitar duplicatas e salva localmente apenas registros dos envios feitos.
- Postagens com conteúdo pendente nunca são enviadas. A extensão **não publica automaticamente** ao instalar ou carregar a página; somente após seleção e confirmação humana.

## Feriados: fontes oficiais

- Relação de feriados municipais de Itabuna no TJBA (2026): https://www7.tjba.jus.br/secao/lerPublicacao.wsp?tmp.id=41226&tmp.mostrarDiv=sim&tmp.secao=9
- Calendário nacional de feriados 2026, incluindo 20 de novembro: https://www.tre-ba.jus.br/legislacao/compilada/portaria-da-presidencia/2025/portaria-no-396-de-16-de-junho-de-2025

## Segurança

- Sem credenciais, cookies, senhas, token ou HAR no ZIP.
- As chamadas são realizadas na aba autenticada do portal, com a origem correta e contexto da sessão atual; as requisições não são direcionadas a sites terceiros.
- A extensão não possui função de exclusão, edição ou alteração em massa de aulas existentes.
- Duplicatas ou conflitos de mesma data/turma/disciplina são ignorados e não sobrescritos.
- Se ocorrer erro depois do envio e antes do retorno com o identificador, **verifique diretamente o E-Class antes de repetir**.


Leia também `CORRECAO_v1.0.1.md` antes de atualizar a extensão.


## Correção v1.0.2 — expiração de autenticação

O HAR posterior fornecido pelo professor mostra que a extensão recebeu `401 errors.token_expired` em uma consulta, e que o portal executou a mesma consulta com `200` posteriormente, com os mesmos cabeçalhos `x-portal-*`. O portal conseguiu criar e remover uma postagem. Isso **não prova** que a extensão consegue renovar sessão por conta própria.

- O teste de conexão é **somente leitura**. Se retornar `AUTH_EXPIRED`, abra o calendário do E-Class na interface normal, confirme a listagem de turmas e tente novamente; não copie tokens nem desative a segurança do navegador.
- Antes de um lote, a extensão executa uma consulta real para confirmar autenticação. Se falhar, **não inicia nenhum envio**.
- O cabeçalho `Accept` agora corresponde ao cliente nativo observado no HAR. O efeito no servidor depende do estado real da sessão.
- Não há repetição automática de POST em caso de erro; isso evita duplicatas após respostas ambíguas.
- A mensagem de contexto escolar identificado não é confundida com autenticação confirmada.
- Nenhum HAR, cookie, senha nem token de autenticação integra o pacote.

**Não garantido:** não existe neste pacote integração com o mecanismo interno de renovação de token do portal, pois o HAR não demonstra uma API pública de renovação. A validação real requer o botão "Testar conexão (sem publicar)" na sessão do usuário.

## Atualização v1.0.5 — Aulas versus Atividades

A API `GET /posts` também retorna Atividades. A consulta de duplicatas agora usa `worker_id=1` (Aulas), ignorando Atividades (`worker_id=2`) mesmo que a turma, a disciplina e a data sejam as mesmas. Conflitos entre duas Aulas são separados de registros ignorados na interface. Consulte `CORRECAO_v1.0.5.md` para detalhes e instruções de teste.


## Integração adicional: 7Edu (v1.0.6)

No popup, escolha **Sistema de destino**: E-Class ou 7Edu. Para o 7Edu, abra uma disciplina em `https://7edu-br.educadventista.org/teacherportal/` e acesse **Aulas Ministradas**. A extensão usa exclusivamente a sessão autenticada no navegador, identifica turmas e horários no cadastro do 7Edu, converte o conteúdo HTML para texto simples e bloqueia horários não correspondentes, datas futuras e aulas já ministradas. É obrigatório fazer uma leitura de teste e conferir **um lançamento isolado** antes de enviar lotes. O 7Edu não tem a opção de rascunho nesse fluxo.

O processo completo, a atualização que preserva o armazenamento da v1.0.5, os endpoints confirmados no HAR e as limitações constam em `CORRECAO_v1.0.6_7EDU.md`.

## 7Edu — redistribuição cronológica v1.0.9

A base `extension/data/aulas_7edu_4bim_2026.json` agora distribui conteúdos **por período real** nas datas do 7Edu, e não pela coincidência de datas com o E-Class. Usamos os 40 planos individuais de Matemática por série e as propostas existentes de Investigação Matemática/Filosofia. A base E-Class original não é alterada.

Datas futuras são projeções da recorrência semanal **não confirmadas pelo portal** e aparecem bloqueadas, até nova exportação do calendário. Datas registradas e dias atípicos também ficam bloqueados. Há uma fila de conteúdos sem data quando a previsão de períodos é insuficiente.

Consulte `CORRECAO_v1.0.9_REDISTRIBUICAO_7EDU.md` e `relatorios/redistribuicao_aulas_7edu_2026.md` antes de publicar. O script para remapear após novas datas está em `ferramentas/redistribuir_aulas_7edu.py`.

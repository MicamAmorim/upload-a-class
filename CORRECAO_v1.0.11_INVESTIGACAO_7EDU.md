# Versão 1.0.11 — Investigação Matemática no 7Edu

## Alteração solicitada

Nas seis turmas (1MA, 1MB, 2MA, 2MB, 3MA, 3MB), **todas as 92 entradas** do 4º bimestre de Investigação Matemática no cadastro do **7Edu** passaram a usar exatamente:

> Atividades propostas

O **título**, o campo **`conteudo_7edu`** enviado ao diário e a **prévia HTML** contêm somente essa expressão. A extensão não acrescenta automaticamente datas, temas, roteiros ou identificadores ao texto do lançamento. As unidades-fonte permanecem em metadados para rastreabilidade pedagógica, sem integrar o texto enviado ao 7Edu.

O gerador também aplica a mesma padronização ao refazer o calendário, para não restaurar os textos antigos. O popup ignora *overrides* locais antigos de Investigação no modo 7Edu (sem apagar o armazenamento local), e impede edição livre desse texto fixo. A checagem do 7Edu recusa texto divergente para essa disciplina.

## O que não mudou

- Todos os dias, períodos, turmas, identificadores de calendário, alocações, estados e aprovações obrigatórias continuam iguais.
- Datas futuras/projetadas, domingos atípicos, feriados a conferir e registros anteriores continuam bloqueados.
- A base do **E-Class** e os conteúdos de **Matemática e Filosofia** do 7Edu não foram alterados.
- Nenhum registro foi publicado no portal. A integração real continua dependendo de teste autorizado com uma aula, pois o antigo HTTP 400 ainda não teve causa comprovada.

## Verificação

Execute em uma pasta descompactada do pacote completo:

```sh
python ferramentas/testar_investigacao_v111.py
python ferramentas/testar_redistribuicao_7edu.py
python ferramentas/testar_filosofia_7edu.py
node ferramentas/testar_conteudo_investigacao_v111.js
node ferramentas/testar_7edu_mock.js
```

A atualização substitui o código e o JSON da extensão, preservando o armazenamento local (instale sobre a pasta existente e recarregue em `edge://extensions/`). Confira a prévia antes de enviar uma aula individual. **Não repita lotes com falha HTTP 400 sem revisão do diário.**

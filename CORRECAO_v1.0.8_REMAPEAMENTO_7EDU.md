# Versão 1.0.8 — Dados independentes e remapeamento do calendário 7Edu

**Dados de entrada:** exportação Markdown das 14 disciplinas do 4º bimestre, consulta de 19/11/2026.

## O que foi realizado

- A base do E-Class, `extension/data/aulas_4bim_2026.json`, continua com suas **284 postagens** originais, sem alterações.
- Nova base exclusiva do 7Edu, `extension/data/aulas_7edu_4bim_2026.json`, contém **221 datas, 277 períodos e 14 disciplinas**.
- Em **169 datas**, foi encontrado um plano E-Class da **mesma turma, disciplina e data**, com quantidade de períodos e horários compatíveis. Dessas, **95** podem ser conferidas, **70** são propostas de Investigação Matemática/Filosofia e **4** são planejamentos condensados. Estas últimas 74 ainda exigem aprovação pedagógica explícita.
- **52 entradas** ficam bloqueadas: 14 domingos 27/09 (incluindo uma aula marcada como registrada), 18 outras datas registradas e 20 datas sem plano correspondente.
- O relatório contém **19 datas marcadas como já registradas** no portal, incluindo a de domingo; todas são bloqueadas.
- **97 encontros E-Class** não têm uma data correspondente no retrato 7Edu exportado. Isso inclui encontros posteriores à data de consulta e não é prova de ausência de aulas no sistema.
- No 7Edu, não se usam mais datas e horários da base E-Class como fonte de verdade: o seletor, a prévia e o lote utilizam a base exclusiva remapeada e com bloqueios.
- Revisões locais de conteúdo passam a ter armazenamento separado: `aula_overrides` (E-Class) e `aula_overrides_7edu` (7Edu).
- Antes de gravar, a extensão consulta novamente a grade e os horários reais de cada item; **não há POST automático em datas bloqueadas nem tentativa de repetir um POST que falhou**.

## Ponto que ainda precisa de revisão pedagógica

A exportação contém datas reais sem postagem original na mesma data. Essas **20 entradas não foram preenchidas com conteúdo de outro dia**, para não criar uma associação não comprovada:

- **1MA/Matemática:** inclui várias terças-feiras com uma aula, enquanto a base E-Class foi preparada majoritariamente para segundas com dois períodos.
- **2MA/Investigação Matemática:** está presente no 7Edu, mas não aparece na base E-Class com planos correspondentes.
- Outras datas pontuais podem existir. Consulte a tabela detalhada em `relatorios/auditoria_remapeamento_7edu_2026.md`.

**27/09/2026:** todos os 14 diários contêm essa data de domingo com dois períodos, possivelmente uma particularidade do calendário cadastrado. Ela exige confirmação humana; nenhuma linha dessa data foi liberada.

**Aulas registradas:** o `.md` identifica apenas a condição “Registrado”, não o conteúdo já publicado. A extensão impede novas postagens nessas datas. Confirmar o que foi efetivamente ministrado é uma tarefa pedagógica separada.

## Instalação

1. Feche o popup antigo da extensão.
2. Extraia a pasta `extension` deste pacote **sobre a pasta já usada** no Edge/Chrome (não desinstale a extensão).
3. Abra `edge://extensions/` ou `chrome://extensions/` e clique em **Atualizar**.
4. Confirme `1.0.8` em `manifest.json` e escolha o sistema **7Edu** na aba correta do portal.
5. Filtre a turma e confira com a própria tela do 7Edu o conteúdo, a data e as aprovações exigidas.
6. Faça primeiro um teste de leitura. Se decidir publicar, **teste somente um registro depois de conferir as datas já cadastradas**, antes de qualquer lote.

## Regerar com novo calendário

Quando novas datas estiverem abertas, exporte o `.md` do 7Edu e execute:

```bash
python ferramentas/remapear_calendario_7edu.py \
  novo_calendario.md \
  extension/data/aulas_4bim_2026.json \
  extension/data/aulas_7edu_4bim_2026.json \
  relatorios/auditoria_remapeamento_7edu_2026.md
```

Confira os dados antes de instalar a atualização. A extensão **não lê automaticamente arquivos do disco**; o script faz a conversão durante a preparação do pacote.

## Testes locais sem rede

```bash
python ferramentas/testar_remapeamento_7edu.py
node ferramentas/testar_7edu_mock.js
node ferramentas/testar_exportacao_calendario_7edu.js
node ferramentas/testar_worker.js
node ferramentas/testar_tipos_postagens_v105.js
node ferramentas/testar_autenticacao_v104.js
```

Testes de unidade não confirmam que o 7Edu aceite o payload de gravação na sessão real. A causa do HTTP 400 anterior continua **não identificada**. A atualização não lançou, alterou ou apagou nenhuma aula no portal.

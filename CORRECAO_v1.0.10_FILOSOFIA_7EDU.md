# v1.0.10 — Filosofia, módulos 8–12 (7Edu)

## Atualização solicitada

Planejamento das turmas **2MA** e **2MB** atualizado para os módulos:

- Módulo 8 — Filosofia ética
- Módulo 9 — Filosofia política
- Módulo 10 — Ideologia
- Módulo 11 — Filosofia da ciência
- Módulo 12 — Filosofia do trabalho

Para cada módulo há **uma aula expositiva e uma aula prática de exercícios**, com objetivos, roteiro de 45 minutos e exercícios. Há revisão integrada depois dos módulos; 2MA possui uma atividade prática adicional para preencher seu encontro projetado a mais.

- 2MA: 12 encontros planejados (**5 expositivos, 7 práticos**), dos quais 9 correspondem a datas atualmente exibidas no portal e 3 são **projeções**.
- 2MB: 11 encontros planejados (**5 expositivos, 6 práticos**), dos quais 8 correspondem a datas atualmente exibidas no portal e 3 são **projeções**.
- O domingo de 27/09 foi mantido na base, mas não recebeu conteúdo e continua bloqueado.
- Datas de avaliações formais propostas na versão anterior **não foram consideradas oficialmente confirmadas**. A versão 1.0.10 as substitui por aulas expositivas/práticas **somente no planejamento do 7Edu**. As propostas anteriores continuam no histórico Git e no arquivo-fonte do E-Class.
- A cronologia proposta não comprova conteúdos efetivamente ministrados; revisar os registros de cada turma e aprovar o plano antes de lançar, principalmente nas datas anteriores à consulta.

## Fontes e persistência

O conteúdo programático (somente títulos dos módulos) foi informado pelo professor. Os subtemas, roteiros e exercícios foram elaborados como **sugestões didáticas**; o material didático oficial dos módulos não foi fornecido.

- `extension/data/plano_filosofia_7edu_2026.json`: fonte autoritativa da nova sequência; não é substituída ao atualizar datas.
- `extension/data/aulas_7edu_4bim_2026.json`: calendário completo com as postagens de Filosofia atualizadas e demais disciplinas preservadas.
- `relatorios/plano_filosofia_7edu_modulos_8_12.md`: cronograma e roteiros completos.
- `relatorios/calendario_7edu_todas_disciplinas_2026.md`: fotografia original do calendário (sem credenciais), utilizada para reproduzir o remapeamento.
- `ferramentas/redistribuir_aulas_7edu.py`: foi modificado para utilizar a fonte de Filosofia explicitamente ao regenerar o calendário, evitando regressões para o plano antigo.
- `ferramentas/testar_filosofia_7edu.py`: testes de sequência, categorias, datas e proteção.

**Não foram enviadas aulas à plataforma.** A causa do HTTP 400 observado em versão anterior não foi definitivamente identificada; inicie com um único lançamento real após conferência.

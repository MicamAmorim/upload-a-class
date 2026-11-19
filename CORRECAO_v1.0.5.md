# E-Class 4º bimestre — Correção 1.0.5 (Aulas ≠ Atividades)

## Causa identificada em HAR

A rota de listagem `GET /api/v1/posts` mistura tipos diferentes de registro. O campo `worker_id` distingue o módulo: `1` = **Aulas** (criação em `POST /api/v1/dailies`); `2` = **Atividades**. A v1.0.4 verificava apenas mesma data, turma e disciplina e, por isso, ignorava indevidamente aulas quando já havia uma Atividade no mesmo dia.

## Alterações

- A consulta de duplicatas agora usa `GET /api/v1/posts?date_min=...&date_max=...&worker_id=1` e confirma `worker_id === 1` para todos os registros analisados.
- Atividades (`worker_id=2`) não bloqueiam uma Aula, ainda que tenham a mesma data, turma e disciplina.
- Aula existente com título igual: registro ignorado sem criar outro.
- Aula existente com título diferente: conflito explicitamente sinalizado para revisão manual, sem criar ou sobrescrever.
- Registro cujo tipo não foi informado pela API: interrupção segura, sem envio.
- Interface passa a mostrar contagem separada de `Conflitos`, sem confundi-los com aulas `Ignoradas`, e explicita o motivo do bloqueio.
- Teste de conexão consulta **apenas Aulas**, sem publicar.
- Mecanismo de renovação de autenticação e proteção contra reenvio de `POST` da v1.0.4 mantidos.
- 284 postagens e imagens do planejamento preservadas integralmente.

## Testes locais executados

- `python ferramentas/testar_pacote.py`
- `node ferramentas/testar_worker.js` — executa testes de autenticação e separação de tipos.
- `node --check extension/worker.js && node --check extension/popup.js`

**Limitação:** os testes são locais/simulados; a resposta real da API na sessão do usuário ainda precisa ser verificada. Faça um envio de uma única Aula como rascunho primeiro. A instalação não publica automaticamente.

## Atualização no Edge

1. Remova/desative a extensão anterior em `edge://extensions/`.
2. Extraia o ZIP em uma nova pasta e use **Carregar sem compactação** para selecionar `extension/`.
3. Atualize a aba E-Class; entre no calendário de **Aulas**.
4. Execute **Testar conexão (sem publicar)**.
5. Selecione uma Aula de teste, deixe **Publicar** desmarcado e envie apenas uma.
6. Confira que a Aula apareceu no módulo de Aulas, e não em Atividades, antes de enviar o lote.

Não compartilhe HARs brutos publicamente; eles podem conter dados de sessão.

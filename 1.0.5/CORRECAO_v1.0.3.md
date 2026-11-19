# Versão 1.0.3 — autenticação do E-Class com token da sessão

## Diagnóstico fundamentado no HAR de 17/11/2026

- A versão 1.0.2 consultava a API sem o cabeçalho HTTP `Authorization`. A API de turmas respondia `401 / errors.token_expired`.
- O cliente oficial usa um interceptor Angular que define `Authorization: Bearer <token>`.
- O módulo de armazenamento do aplicativo usa o prefixo `portal`, separador `-` e a chave de autenticação `token`, o que resulta na entrada `portal-token` do armazenamento local da página.
- O portal também possui um endpoint próprio `POST /api/v1/atualiza-token` para renovação; a extensão **não** tenta simular essa renovação nem captura respostas dela.

## Alteração técnica

A função de leitura/injeção executada em `world: 'MAIN'` lê `window.localStorage.getItem('portal-token')`, interpreta o JSON e usa o valor exclusivamente como cabeçalho `Authorization: Bearer ...` em chamadas às APIs oficiais do E-Class e API de usuário. O token não é retornado ao service worker, não é salvo pela extensão, nem aparece em logs, relatórios ou no JSON de aulas. A leitura ocorre em cada requisição para acompanhar a atualização normal do portal.

As requisições permanecem sem cookies (`credentials: 'omit'`). O teste de conexão e o bloqueio anterior de lote são preservados. Se o token estiver ausente, retorna `AUTH_CONTEXT_MISSING` antes da requisição. Se o servidor retornar 401, não inicia a publicação em lote.

## Testes locais

- `node ferramentas/testar_worker.js`: PASSOU — cabeçalho Bearer, leitura de token renovado, bloqueio sem token, 401, criação de rascunho simulada, idempotência e ausência de token nos stores simulados.
- `python ferramentas/testar_pacote.py`: PASSOU — 284 postagens, 348 períodos, 120 planos originais e bloqueio dos feriados.

**Limitação:** não houve publicação nem verificação autenticada em servidor real. Antes de qualquer lote, usar `Testar conexão (sem publicar)` e criar apenas uma aula de teste como rascunho. Nunca compartilhar HAR bruto em locais públicos: ele pode incluir credenciais de sessão nas respostas.

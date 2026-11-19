# Versão 1.0.2 — autenticação e lote

Diagnóstico do HAR de 17/11/2026: primeiro GET `/turmas-escola/89?strictUser=true` HTTP 401 (`errors.token_expired`), segunda tentativa originada do portal HTTP 200; depois GET disciplinas 200 e criação/exclusão de uma aula 200. Os cabeçalhos x-portal-* eram idênticos nas duas consultas.

**Mudanças:** cabeçalho Accept idêntico ao cliente do portal; erros de 401/403 descritivos; pré-validação GET obrigatória antes de publicar qualquer lote; zero tentativas automáticas de recriar POST; contexto escolar distinto de autenticação.

**Procedimento:** instale esta versão e mantenha somente uma versão ativa; acesse o portal e use normalmente seu calendário; acione Testar conexão (sem publicar); se OK, envie primeiro um rascunho de teste.

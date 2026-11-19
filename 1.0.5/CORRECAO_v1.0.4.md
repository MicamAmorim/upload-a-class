# v1.0.4 — renovação sob demanda da sessão do E-Class

## Por que a v1.0.3 ainda falhava

O HAR de 17/11 registra que o portal invoca `POST https://login.educacaoadventista.org.br/api/v1/atualiza-token` e recebe `token` e `expires_in`. A extensão v1.0.3, por sua vez, lia o `portal-token` local, mas não tentava renovar a credencial quando uma consulta recebia 401. Isso explica uma classe possível de falhas persistentes, mesmo com o calendário do E-Class funcionando. Ainda não temos um HAR específico da execução da v1.0.3, de modo que a causa exata da última tentativa não está comprovada.

## Alterações

- `GET`: quando a API devolve HTTP 401, faz uma tentativa de renovação pela rota oficial de login e **repete apenas esse GET, no máximo uma vez**.
- `POST /dailies`: exige uma credencial renovada antes de enviar; se o POST devolver erro, **não é repetido**.
- A renovação ocorre no próprio contexto MAIN da página do E-Class, com `credentials: omit`. O Bearer é mantido apenas temporariamente no fechamento de uma função da aba, nunca enviado ao worker, ao popup ou ao armazenamento da extensão.
- As URLs consultadas foram restritas às rotas de turmas, disciplinas, postagens e criação de aulas e a rota de atualização de token.
- Mantidos: verificação de acesso antes do lote, checagem de duplicidade, revisão de condensações/propostas e proteção contra reenvio.

## Como instalar e testar

1. Em `edge://extensions/`, remova ou desative a versão anterior; não mantenha duas versões do mesmo pacote ativas.
2. Extraia o ZIP, clique em **Carregar sem compactação** e escolha a pasta `extension`. Confirme que aparece **1.0.4**.
3. Faça login normalmente no E-Class, acesse a página de aulas e atualize com `Ctrl + Shift + R`.
4. Abra a extensão e clique em **Testar conexão (sem publicar)**. Esse botão faz consultas e, quando necessário, uma renovação de autenticação; **não cria nenhuma aula**.
5. Somente se o teste retornar **Conexão OK**, envie **uma única aula como rascunho**; confira sua presença no portal antes de qualquer lote.

## Limitações e segurança

- **Não é uma validação real da conta:** sem sua sessão autenticada, não podemos confirmar se a API de login aceitará a renovação na sua conta.
- Se aparecer `AUTH_REFRESH_FAILED`, não insista em lotes. Envie apenas o **texto do erro** e o status HTTP, nunca tokens, cookies ou HAR público.
- Se aparecer `AUTH_EXPIRED` após a renovação, interrompa; precisaremos analisar um registro sanitizado dessa tentativa.
- Teste local: `node ferramentas/testar_autenticacao_v104.js`; integridade: `python ferramentas/testar_pacote.py`. Ambos passaram em ambiente simulado.
- O conjunto de 284 postagens e seus conteúdos não foi alterado.

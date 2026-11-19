# Correção E-Class — versão 1.0.1

## O que foi corrigido

1. O HAR de exemplo comprova que as requisições para `api-usuario` e `api-eclass` são feitas **sem cookies e sem cabeçalho Authorization** e as respostas usam `Access-Control-Allow-Origin: *`. O código anterior forçava `credentials: include`, o que provocava o bloqueio CORS. A nova versão usa `credentials: omit` nas requisições efetuadas no contexto da página, mantendo os cabeçalhos operacionais `x-portal-*` coletados em tempo real da própria sessão.
2. Foi acrescentado **Testar conexão (sem publicar)**, que verifica turma, disciplina e consulta de postagens usando apenas GET.
3. **Interrupção no primeiro erro**: um lote com centenas de aulas não repete automaticamente requisições com falha; mostra erro e mantém as aulas restantes selecionadas.
4. Dados pedagógicos e JSON do planejamento preservados.

## Atualizar no Edge

1. Extraia o ZIP `Extensao_EClass_4Bim_2026_v1.0.1_CORRIGIDA.zip` em uma pasta nova.
2. Entre em `edge://extensions/` e remova ou desative temporariamente a versão anterior para evitar confusão.
3. Clique em **Carregar sem compactação** e selecione a pasta `extension` extraída (onde está o `manifest.json`).
4. Abra o portal E-Class, confirme escola Itabuna e ano letivo 2026; recarregue o calendário de aulas.
5. Abra a extensão e pressione **Testar conexão (sem publicar)**. O teste não cria aula.
6. Se o teste passar, envie **uma única aula como rascunho** para validar a gravação real. Confira no portal antes de enviar as demais.

**Não desative CORS**, nem use `--disable-web-security`. Não envie o HAR a terceiros: ele pode conter dados de sua sessão.

**Limitação:** a integração com conta real não foi executada neste ambiente. Testes locais usam respostas simuladas baseadas no formato do HAR. A correção resolve a causa identificada no código, mas o teste real ainda precisa ocorrer no navegador autenticado.

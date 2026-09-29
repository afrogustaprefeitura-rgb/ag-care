# AG Care — correção segura da importação do plano de ação

**Status:** proposta para revisão; não aplicar diretamente em produção sem homologação.

## Problema confirmado

A função `public.importar_plano_acao_n8n(bigint,text,jsonb)` atualmente apaga todas as ações do diagnóstico (`DELETE`) e depois insere tudo novamente. As tabelas `acoes_historico` e os logs de envio possuem chaves estrangeiras com `ON DELETE CASCADE`; portanto, reimportar o mesmo diagnóstico pode apagar o histórico e os registros de alertas associados.

## Estratégia proposta

1. Validar cliente, origem e array de ações antes de escrever.
2. Reconciliar por chave única `(cliente_id, origem, origem_id, acao, fase_plano)` usando `INSERT ... ON CONFLICT DO UPDATE`.
3. Preservar `id`, `status`, `concluido_em`, `ultimo_alerta_em` e o histórico das ações existentes.
4. Calcular novos prazos a partir de `clientes.data_diagnostico`, com fallback explícito para a data atual apenas quando a data do diagnóstico não existir.
5. Não excluir automaticamente ações ausentes no arquivo recebido. A remoção/arquivamento de ações que saíram do plano precisa de regra de negócio separada e auditável.
6. Rejeitar itens sem ação/fase válida e chaves duplicadas no mesmo JSON.
7. Restringir a execução da RPC a papéis técnicos autorizados; a automação atual usa credencial PostgreSQL do n8n, mas essa credencial deve ser confirmada no ambiente.

## Pontos que exigem decisão antes da implantação

- Se o prazo deve ser atualizado na reimportação quando a ação ainda está pendente e nunca recebeu alerta, ou se deve sempre ser preservado.
- Como tratar ações que foram removidas do Excel: arquivar, cancelar ou manter sem alteração.
- Quais valores de `status` são oficiais e como normalizar variações com/sem acento.
- Confirmar que a credencial PostgreSQL usada pelo n8n é técnica e não compartilhada com usuários.

## Testes obrigatórios em homologação

- Importar diagnóstico novo: cria as ações esperadas.
- Reimportar o mesmo JSON: não duplica ações.
- Reimportar com alteração descritiva: atualiza os campos previstos sem mudar o ID.
- Reimportar uma ação concluída: mantém status e data de conclusão.
- Reimportar ação com histórico e log de alerta: não apaga histórico/logs.
- Enviar JSON vazio, inválido ou com chaves duplicadas: falha de forma explícita sem apagar dados.
- Verificar o número de ações, IDs e registros de histórico antes/depois.
- Verificar execução das RPCs por `anon`, `authenticated` e papel técnico.

## Observação de implantação

Este arquivo é uma proposta de auditoria, não uma migração executável. A função final deve ser validada contra o mapeamento real do n8n e homologada antes de aplicar alterações ao banco ativo.

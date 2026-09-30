# AG Care — achados do workflow n8n e plano de homologação

**Data da inspeção:** 2026-09-29  
**Status:** auditoria estática dos JSONs enviados; nenhuma execução foi disparada e nenhum workflow foi alterado na instância n8n.

## 1. Importação do diagnóstico

### Achados confirmados no JSON
1. O nó `Execute a SQL query1` monta SQL por interpolação de `cliente_id`, `origem_id` e `JSON.stringify(acoes)`. Deve usar parâmetros vinculados do nó Postgres, não concatenar valores na consulta.
2. O nó `Code in JavaScript1` recebe diretamente a saída de `Code in JavaScript`, em paralelo com a chamada SQL. Ele prepara uma mensagem de sucesso sem depender do resultado de `importar_plano_acao_n8n`; pode anunciar sucesso se a importação falhar.
3. O nó de resumo espera receber `data.acoes`; isso funciona no ramo atual por receber o objeto anterior à importação, não a confirmação do banco. Após corrigir o fluxo, a confirmação deve vir da resposta SQL e os dados do resumo devem ser combinados explicitamente.
4. A chamada SQL atual depende de a função `importar_plano_acao_n8n` estar segura para reimportação. A versão implantada observada contém `DELETE` por cliente/origem/origem_id seguido de `INSERT`; isso pode apagar histórico e logs com chaves estrangeiras `ON DELETE CASCADE`.
5. A função `cadastrar_cliente_v9` também é chamada por SQL montado por concatenação no nó de cadastro. Embora haja escape de aspas simples, o padrão recomendado é consulta parametrizada.

## 2. Alertas

1. A consulta principal junta ações a `cliente_alertas_whatsapp`, mas o mesmo conjunto de resultados é encaminhado para envio ao Telegram. Portanto, a seleção de alertas Telegram depende de existir um destinatário WhatsApp para a empresa.
2. O nó Telegram usa um `chatId` fixo, em vez do campo do destinatário da empresa.
3. A consulta retorna `acao_id`, enquanto o nó de atualização usa `WHERE id = $1`; o mapeamento de parâmetro não está documentado/configurado no JSON examinado.
4. O caminho de WhatsApp usa um template placeholder e precisa de credenciais, número e template aprovados configurados na instância.
5. O fluxo inclui uma consulta REST à view de Telegram em um caminho separado, sem ligação funcional ao envio principal no JSON examinado.
6. Não há escrita confiável de sucesso/erro nas tabelas de histórico de envio após cada tentativa. O campo `ultimo_alerta_em` isolado não fornece auditoria por destinatário/canal.

## 3. Desenho recomendado

Separar os fluxos lógicos de importação e de alertas, mesmo que permaneçam no mesmo workflow n8n:

### Importação
- Receber arquivo e validar as abas/colunas necessárias.
- Validar o cadastro e normalizar datas.
- Criar/atualizar cliente e obter o ID.
- Construir as ações e validar descrição, fase, score e status.
- Chamar a função idempotente usando parâmetros SQL.
- Verificar que a função retornou a quantidade esperada.
- Só então enviar a confirmação de sucesso.
- Em falha, enviar erro operacional e não confirmar sucesso.

### Alertas
- Consultar ações abertas uma vez, independentemente do canal.
- Consultar separadamente destinatários Telegram e WhatsApp ativos.
- Gerar um item por ação + destinatário + canal.
- Evitar duplicatas com chave idempotente no log de envio.
- Registrar tentativa, resultado, identificador da mensagem e erro.
- Atualizar `ultimo_alerta_em` apenas conforme a regra aprovada; não marcar como enviado antes de o provedor confirmar.
- Não usar um destinatário pessoal fixo no workflow de produção.

## 4. Testes mínimos

### Importação
- Arquivo válido com 10 ações: criar 10.
- Reimportação idêntica: manter 10 e preservar IDs.
- Reimportação com descrição/score alterado: atualizar os campos definidos sem excluir histórico.
- Falha SQL: não enviar confirmação de sucesso.
- JSON inválido, vazio quando não permitido, fase inválida e duplicidade: falhar sem apagar dados.
- Diagnóstico de outra empresa com mesmo `origem_id`: nunca modificar ações da primeira empresa.

### Alertas
- Empresa sem destinatários: nenhum envio e nenhuma falsa marcação de sucesso.
- Só Telegram configurado: enviar somente Telegram.
- Só WhatsApp configurado: enviar somente WhatsApp.
- Ambos configurados: enviar para os destinatários ativos de cada canal.
- Ação concluída/cancelada: não enviar alerta de prazo.
- Falha de provedor: registrar erro e permitir retentativa controlada.
- Execução repetida no mesmo dia: não duplicar mensagens para o mesmo destinatário.

## 5. Dependências ainda não verificadas
- Credenciais e parâmetros configurados dentro da instância n8n não são todos representados nos JSONs exportados.
- Não foi possível confirmar o comportamento real dos provedores sem execução de teste.
- O contrato final dos status e a política de prazos devem ser acordados antes de ligar o fluxo.


## Validação estática do workflow de homologação v2 (2026-09-29)

Foi realizada uma verificação estática do arquivo `AG_Care_Workflow_Homologacao_v2.json` após os ajustes:
- JSON parseável.
- Workflow permanece inativo.
- Todas as conexões apontam para nós existentes.
- Código JavaScript dos nós passa na verificação sintática do Node.js.
- Consulta de importação utiliza parâmetros SQL.
- Merge configurado explicitamente como `append`.
- Consulta de alertas exclui status `cancelada` e `cancelado`.

**Limitação:** isso não equivale a uma execução no n8n. A consulta SQL de importação ainda não foi aplicada ao Supabase e o workflow não foi executado. Ainda é necessário confirmar a versão do n8n, as credenciais associadas e testar com destinatário de homologação. A confirmação por Telegram está intencionalmente bloqueada por um placeholder até que o chat administrativo de teste seja configurado.


## Revisão adicional do alerta de prazo — homologação v3

Foi gerado um novo arquivo local `AG_Care_Workflow_Homologacao_v3.json` (não ativo) com um ajuste no filtro SQL de alertas: além de verificar `concluido_em IS NULL`, agora exclui também status de conclusão conhecidos (`concluida`, `concluída`, `concluido`, `concluído`). Isso evita enviar lembretes quando o status já indica conclusão, mas a data de conclusão não foi preenchida.

Validações estáticas da v3:
- JSON parseável.
- 21 nós; workflow `active=false`.
- Todas as conexões referenciam nós existentes.
- 5 nós com JavaScript verificados sintaticamente; sem erros de sintaxe.

## Limitações restantes identificadas

- O schema exige `acoes_alertas_telegram_envios.enviado_em` mesmo para registros com `status='erro'`; o nó atual registra a hora da tentativa nesse campo, cujo nome sugere sucesso. Não alterei o schema de produção. Antes da produção, decidir entre adicionar `tentado_em`, permitir `enviado_em=NULL` nos erros, ou documentar formalmente que o campo significa horário da tentativa.
- A consulta de deduplicação impede reenvio quando já existe `status='enviado'` no mesmo dia para a mesma ação/destinatário; falhas podem ser retentadas.
- A conexão Postgres e a conta Telegram referenciadas no export precisam existir na instância de destino. Nenhum envio real foi executado.
- A função de importação proposta ainda não foi executada nem aplicada; a versão implantada continua usando `DELETE` seguido de `INSERT`.


## Retificação de estado — verificação direta no Supabase em 2026-09-30

As notas abaixo corrigem o estado da importação descrito na seção inicial, que é histórico e anterior à implantação da função segura.

- A função atualmente implantada `public.importar_plano_acao_n8n` usa `ON CONFLICT ... DO UPDATE`, sem `DELETE`; a definição direta no banco foi consultada.
- O índice parcial `ux_acoes_diagnostico_n8n` está presente e corresponde à chave de conflito.
- A versão local de homologação v3 permanece apenas validada estaticamente; não foi executada nem importada/ativada na instância n8n.
- O schema de envio Telegram exige `enviado_em` e aceita `status` igual a `enviado` ou `erro`. O registro de erro atualmente preencher esse campo com a hora da tentativa é uma ambiguidade semântica ainda pendente; nenhuma mudança de schema foi feita.
- O alerta do Supabase sobre as funções `usuario_admin()` e `usuario_tem_cliente(bigint)` foi confirmado. Elas são chamadas por políticas RLS e não devem ser modificadas ou ter EXECUTE revogado sem teste controlado da autorização.
- A integração real continua bloqueada até identificar o papel SQL usado pelo nó Postgres do n8n. A função de importação é `SECURITY INVOKER`; `service_role` não possui grants DML diretos sobre `public.acoes` segundo a consulta atual, então não presumir que chamada via API e chamada via conexão SQL se comportam da mesma forma.

Próxima ordem de trabalho: (1) revisar o JSON v3 nó por nó e os parâmetros do Postgres; (2) confirmar usuário/role efetivo da conexão n8n sem revelar segredo; (3) executar teste de importação em homologação com rollback ou dados sintéticos; (4) testar alertas com destinatário de teste e verificar log de sucesso/falha; (5) só então considerar ativação.


## Revisão estática adicional da homologação v3 — 2026-09-30

O JSON local foi reaberto e os nós/parametrizações foram inspecionados; isso continua sendo revisão estática, sem execução na instância n8n.

### Pontos confirmados
- O nó Telegram de alertas está configurado com `onError: continueErrorOutput`, e a saída de erro está ligada ao nó `Falha de Envio (sem UPDATE)`.
- A consulta de seleção filtra ações com `concluido_em IS NULL`, exclui os status de conclusão/cancelamento conhecidos e busca prazos até três dias à frente, incluindo vencidas.
- O nó de sucesso atualiza `ultimo_alerta_em` somente após o nó de envio retornar sucesso; a gravação do log usa `ON CONFLICT`.
- A importação usa parâmetros do nó Postgres para os argumentos de `importar_plano_acao_n8n`; o resumo depende do resultado SQL e compara a quantidade retornada com a quantidade preparada.
- O cadastro usa parâmetros vinculados para chamar `cadastrar_cliente_v9`.

### Pendências adicionais
1. **Histórico de erros não é imutável:** o log de Telegram tem unicidade por ação/destinatário/data e o caminho de erro faz `ON CONFLICT DO UPDATE`. Isso permite nova tentativa, mas substitui o estado/erro anterior em vez de manter uma linha por tentativa. Decidir se o requisito é estado atual por dia ou auditoria de cada tentativa.
2. **Nome do timestamp:** o caminho de falha preenche `enviado_em` com o horário da tentativa mesmo quando `status='erro'`. Não altera o envio, mas o nome do campo é ambíguo. Antes de produção, documentar essa semântica ou planejar uma coluna `tentado_em`/estrutura de tentativas.
3. **Data brasileira do cadastro:** a função `normalizarData` do nó `Code - Preparar Cadastro` aceita números de série do Excel e strings ISO `YYYY-MM-DD`, mas devolve `null` para strings brasileiras como `29/09/2026`. Confirmar o formato real da planilha; se datas brasileiras forem possíveis, implementar parser explícito e testes de datas inválidas antes da homologação.
4. **Credenciais externas:** o JSON contém referências a credenciais Postgres e Telegram por nome/ID interno. Isso não confirma que existam na instância de destino nem que o papel SQL tenha os privilégios necessários. Não compartilhar nem inserir senhas/tokens no JSON.
5. **Política de reimportação:** a função retorna número de linhas inseridas/atualizadas; uma atualização idempotente pode preservar o status operacional existente. A comparação estrita entre quantidade retornada e quantidade de ações da planilha é adequada somente se cada ação de entrada corresponde a uma linha distinta após validação; deve continuar coberta por testes de duplicidade/chave natural.

### Próximos testes de homologação
- Testar data ISO, número serial Excel, data brasileira, vazio e data inválida.
- Simular envio Telegram bem-sucedido e falho com destinatário de teste; verificar `ultimo_alerta_em`, `status`, `erro` e identificador da mensagem.
- Reexecutar após falha no mesmo dia e confirmar a política desejada para tentativas/log.
- Testar importação com nova execução idêntica, mudança de score e mudança de descrição; observar IDs, status, histórico e quantidade retornada.
- Confirmar o papel SQL da credencial Postgres na instância n8n e seus privilégios mínimos antes de executar a importação real.


## Homologação v4 — parser explícito de data (2026-09-30)

Foi criado localmente o arquivo `AG_Care_Workflow_Homologacao_v4.json`, mantendo o workflow inativo e os 21 nós da v3. A alteração está restrita à função `normalizarData` do nó `Code - Preparar Cadastro`:
- aceita data serial numérica do Excel;
- aceita data ISO `AAAA-MM-DD`;
- aceita data brasileira `DD/MM/AAAA`;
- valida calendário (por exemplo, rejeita `31/02/2026`);
- mantém campo vazio como `null`;
- lança erro explícito para formato desconhecido, em vez de converter silenciosamente para `null`.

Validações locais realizadas: JSON válido, workflow inativo, conexões apontam para nós existentes, sintaxe JavaScript válida; testes unitários isolados passaram para ISO, data brasileira, serial Excel, campo vazio e rejeição de data/formato inválido.

**Limitação:** v4 ainda não foi importado nem executado na instância n8n. A data de cadastro só é necessária para o campo `data_diagnostico`; confirme que os formatos reais da planilha estão cobertos antes de homologar. Nenhuma credencial ou token foi alterado.

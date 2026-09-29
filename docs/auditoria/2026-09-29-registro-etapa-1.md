# AG Care — registro da etapa 1 de correção

**Data:** 2026-09-29  
**Ambiente:** projeto Supabase `rbuadfgwktyiljvggkgm`  
**Status atualizado:** a função `importar_plano_acao_n8n` foi substituída pela versão idempotente em 2026-09-29 após teste transacional com rollback. O workflow n8n continua sem execução integrada.

## Alteração de segurança já aplicada no Supabase

Foram revogadas as permissões de execução para `PUBLIC`, `anon` e `authenticated` nas funções:
- `public.cadastrar_cliente_v9(text,text,text,text,text,date,text,text)`
- `public.importar_plano_acao_n8n(bigint,text,jsonb)`

Foi concedida execução explícita a `service_role` para as duas funções.

## Verificação após a alteração

Consulta de privilégios efetivos confirmou para ambas:
- `anon`: EXECUTE = false
- `authenticated`: EXECUTE = false
- `service_role`: EXECUTE = true
- usuário técnico usado na sessão de inspeção: EXECUTE = true

O fluxo n8n examinado utiliza nó Postgres com credencial de banco, e não chamadas `supabase.rpc()` no frontend do repositório. A credencial configurada na instância n8n ainda deve ser confirmada antes de testar importação.

## Workflow de homologação separado

Foi preparado um JSON separado, inativo, com:
- consultas de cadastro e importação parametrizadas;
- confirmação de importação só depois do retorno SQL e validação de quantidade;
- seleção de alertas Telegram por destinatário ativo, em vez de depender da tabela de WhatsApp;
- destino Telegram dinâmico por destinatário;
- registro de sucesso e erro em `acoes_alertas_telegram_envios`;
- chat administrativo da confirmação substituído por placeholder.

Esse JSON é um artefato de homologação, não está implantado na instância n8n e exige validação manual de credenciais, comportamento de erros e teste controlado antes de importar/ativar.

## O que ainda NÃO foi alterado

- Função `cadastrar_cliente_v9` no banco.
- RLS/políticas de tabela.
- Configuração de proteção contra senhas comprometidas no Supabase Auth.
- Workflow ativo da instância n8n.
- Código da aplicação na branch principal do GitHub.

## Próximos testes

1. Confirmar a credencial técnica n8n e executar um teste sem dados reais ou num projeto de homologação.
2. Testar o SQL proposto contra o schema atual e ajustar eventuais incompatibilidades antes de aplicar.
3. Validar reimportação sem exclusão, preservação de IDs/histórico e tratamento de status.
4. Importar o JSON de homologação com workflow inativo e revisar cada credencial/nó.
5. Testar Telegram com um destinatário de homologação e confirmar logs de sucesso e falha.


## Atualização — função de importação implantada e verificada

A função `public.importar_plano_acao_n8n(bigint,text,jsonb)` foi atualizada no Supabase com a proposta idempotente registrada em `2026-09-29-importar-plano-acao-segura.sql`.

### Verificações realizadas
- Definição implantada não contém `DELETE FROM public.acoes`.
- Definição implantada contém `ON CONFLICT ... DO UPDATE`.
- `SECURITY DEFINER = false` (função executa com privilégios do chamador).
- `anon` e `authenticated` não possuem EXECUTE; `service_role` possui EXECUTE.
- Teste transacional com `ROLLBACK`: criação inicial, reimportação com variação de travessão na fase, preservação do mesmo ID, status operacional e `ultimo_alerta_em), além da rejeição de status inválido.
- Após o rollback, não restaram linhas de teste; totais confirmados: 3 clientes, 30 ações e 9 registros de histórico.

### Limitações
- Teste foi realizado por SQL no banco, não pelo workflow real do n8n.
- A função usa `SECURITY INVOKER`; a credencial real do n8n precisa ter os privilégios de tabela necessários.
- Mudança de descrição da ação muda a chave natural e pode gerar nova linha, pois `acao` faz parte do índice único. Isso deve ser tratado na lógica de negócio antes de assumir que renomeações atualizam a mesma ação.
- Ainda não houve teste de envio Telegram/WhatsApp nem execução integrada de importação.

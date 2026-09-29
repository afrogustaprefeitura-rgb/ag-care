# AG Care — registro da etapa 1 de correção

**Data:** 2026-09-29  
**Ambiente:** projeto Supabase `rbuadfgwktyiljvggkgm`  
**Importante:** a função `importar_plano_acao_n8n` ainda NÃO foi substituída. O SQL idempotente continua sendo proposta de homologação.

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

- Corpo da função `importar_plano_acao_n8n` no banco.
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

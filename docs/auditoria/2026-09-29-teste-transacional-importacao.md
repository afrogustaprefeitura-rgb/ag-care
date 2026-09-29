# AG Care — relatório de teste transacional da importação

**Data:** 2026-09-29  
**Ambiente:** projeto Supabase ativo, usando transação com ROLLBACK.  
**Escopo:** teste de compilação e comportamento básico da função proposta; sem persistência de dados de teste.

## Testes executados

1. A definição proposta foi instalada somente dentro de uma transação aberta para o teste.
2. Importação de uma ação sintética com `origem_id='__AGCARE_ROLLBACK_TEST__'` retornou uma ação afetada.
3. A ação sintética foi marcada como `em andamento` e recebeu `ultimo_alerta_em`.
4. A mesma ação foi reimportada com fase escrita usando hífen simples e campos descritivos atualizados.
5. Asserções PL/pgSQL verificaram que o ID permaneceu igual, o status operacional foi preservado, o timestamp de alerta permaneceu preenchido e a reimportação afetou uma linha.
6. A transação foi revertida com `ROLLBACK`.

## Resultado observado

- A consulta de verificação posterior retornou **0 linhas de teste persistidas**.
- A tabela `acoes` continuou com **30 ações**.
- A definição implantada depois do rollback continuou contendo o `DELETE` antigo. Portanto, a função proposta **não foi deixada instalada**.

## Limites deste teste

- Não testa os dados reais de um diagnóstico nem a execução do workflow n8n.
- Não valida envio de alertas ou gravação de histórico por todos os triggers.
- Não resolve a identidade de uma ação quando a descrição (`acao`) ou a fase muda: ambos fazem parte da chave única. Uma descrição alterada pode gerar uma nova linha enquanto a linha anterior permanece, porque a proposta deliberadamente não exclui ações ausentes.
- Antes de substituir a função, deve ser definida uma estratégia de identidade estável para as ações ou aprovada a política para ações renomeadas/removidas.
- Ainda é necessário testar JSON inválido, array vazio, status inválido, fase inválida, duplicatas e falhas de permissão.

## Conclusão

A proposta passou no teste transacional limitado de compilação, inserção, reimportação, preservação de ID/status/último alerta e rollback. Isso é evidência útil, mas **não é homologação completa nem autorização para produção**.

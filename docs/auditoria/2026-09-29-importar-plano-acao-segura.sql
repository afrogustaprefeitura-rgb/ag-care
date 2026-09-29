-- AG Care — proposta de correção da importação
-- STATUS: rascunho para homologação. NÃO executar diretamente em produção.
-- Objetivos: importação idempotente, sem DELETE, preservar status/conclusão/alertas/histórico.
-- Pré-requisito: confirmar que o índice único ux_acoes_diagnostico_n8n permanece como descrito.
-- Esta proposta mantém a regra atual de prazo (CURRENT_DATE + 30/60/90) para evitar
-- mudar a semântica do negócio sem aprovação. A data do diagnóstico pode ser considerada depois.

CREATE OR REPLACE FUNCTION public.importar_plano_acao_n8n(
  p_cliente_id bigint,
  p_origem_id text,
  p_acoes jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_count integer;
BEGIN
  IF p_cliente_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.clientes WHERE id = p_cliente_id
  ) THEN
    RAISE EXCEPTION 'Cliente inexistente ou p_cliente_id inválido';
  END IF;

  IF p_origem_id IS NULL OR btrim(p_origem_id) = '' THEN
    RAISE EXCEPTION 'p_origem_id é obrigatório';
  END IF;

  IF p_acoes IS NULL OR jsonb_typeof(p_acoes) <> 'array' THEN
    RAISE EXCEPTION 'p_acoes deve ser um array JSON';
  END IF;

  IF jsonb_array_length(p_acoes) = 0 THEN
    RAISE EXCEPTION 'p_acoes não pode ser um array vazio';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_acoes) AS x(status text)
    WHERE x.status IS NOT NULL
      AND lower(btrim(x.status)) NOT IN (
        'pendente', 'em andamento', 'bloqueada',
        'concluida', 'concluída', 'concluido', 'concluído',
        'nao iniciado', 'não iniciado'
      )
  ) THEN
    RAISE EXCEPTION 'Status de ação inválido';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_acoes) AS x(acao text, fase_plano text)
    WHERE NULLIF(btrim(x.acao), '') IS NULL
       OR NULLIF(btrim(x.fase_plano), '') IS NULL
       OR replace(replace(lower(btrim(x.fase_plano)), '–', '-'), '—', '-') NOT IN
          ('0-30 dias', '31-60 dias', '61-90 dias')
  ) THEN
    RAISE EXCEPTION 'Cada ação precisa ter descrição e fase válida (0–30, 31–60 ou 61–90 dias)';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_acoes) AS x(acao text, fase_plano text)
    GROUP BY btrim(x.acao), replace(replace(lower(btrim(x.fase_plano)), '–', '-'), '—', '-')
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'O JSON contém ações duplicadas com a mesma descrição e fase';
  END IF;

  INSERT INTO public.acoes (
    cliente_id, acao, status, prazo, prioridade,
    area, problema, maturidade, impacto, urgencia, score,
    responsavel, indicador_sucesso, meta, evidencia, fase_plano,
    origem, origem_id, concluido_em
  )
  SELECT
    p_cliente_id,
    btrim(x.acao),
    CASE
      WHEN lower(btrim(COALESCE(x.status, ''))) IN ('não iniciado', 'nao iniciado', '') THEN 'pendente'
      WHEN lower(btrim(COALESCE(x.status, ''))) IN ('concluida', 'concluído', 'concluido', 'concluída') THEN 'concluída'
      WHEN lower(btrim(COALESCE(x.status, ''))) IN ('em andamento', 'bloqueada', 'pendente') THEN lower(btrim(x.status))
      ELSE btrim(x.status)
    END,
    CASE replace(replace(lower(btrim(x.fase_plano)), '–', '-'), '—', '-')
      WHEN '0-30 dias' THEN CURRENT_DATE + 30
      WHEN '31-60 dias' THEN CURRENT_DATE + 60
      WHEN '61-90 dias' THEN CURRENT_DATE + 90
    END,
    CASE
      WHEN COALESCE(x.score, 0) >= 70 THEN 'muito alta'
      WHEN COALESCE(x.score, 0) >= 60 THEN 'alta'
      WHEN COALESCE(x.score, 0) >= 40 THEN 'média'
      ELSE 'normal'
    END,
    x.area, x.problema, x.maturidade, x.impacto, x.urgencia, x.score,
    x.responsavel, x.indicador_sucesso, x.meta, x.evidencia,
    CASE replace(replace(lower(btrim(x.fase_plano)), '–', '-'), '—', '-')
      WHEN '0-30 dias' THEN '0–30 dias'
      WHEN '31-60 dias' THEN '31–60 dias'
      WHEN '61-90 dias' THEN '61–90 dias'
    END,
    'AG-DIAGNOSTICO', p_origem_id,
    CASE
      WHEN lower(btrim(COALESCE(x.status, ''))) IN ('concluida', 'concluído', 'concluido', 'concluída')
      THEN now()
      ELSE NULL
    END
  FROM jsonb_to_recordset(p_acoes) AS x(
    acao text,
    status text,
    fase_plano text,
    area text,
    problema text,
    maturidade numeric(5,2),
    impacto integer,
    urgencia integer,
    score numeric(6,1),
    responsavel text,
    indicador_sucesso text,
    meta text,
    evidencia text
  )
  ON CONFLICT (cliente_id, origem, origem_id, acao, fase_plano)
    WHERE origem = 'AG-DIAGNOSTICO' AND origem_id IS NOT NULL
  DO UPDATE SET
    area = EXCLUDED.area,
    problema = EXCLUDED.problema,
    maturidade = EXCLUDED.maturidade,
    impacto = EXCLUDED.impacto,
    urgencia = EXCLUDED.urgencia,
    score = EXCLUDED.score,
    prioridade = EXCLUDED.prioridade,
    responsavel = EXCLUDED.responsavel,
    indicador_sucesso = EXCLUDED.indicador_sucesso,
    meta = EXCLUDED.meta,
    evidencia = EXCLUDED.evidencia,
    updated_at = now();
    -- Intencionalmente preserva id, status, prazo, concluido_em e ultimo_alerta_em
    -- para não apagar histórico nem reiniciar o andamento durante reimportação.

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

-- Revisar com o modelo de permissões e credencial real do n8n antes de habilitar:
-- REVOKE EXECUTE ON FUNCTION public.importar_plano_acao_n8n(bigint, text, jsonb) FROM PUBLIC, anon, authenticated;
-- Não conceder EXECUTE a papéis de navegador. A credencial técnica do n8n deve ter
-- somente as permissões necessárias e ser validada em homologação.

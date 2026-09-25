const SUPABASE_URL='https://rbuadfgwktyiljvggkgm.supabase.co';
const SUPABASE_KEY='sb_publishable_FVMZJrWEgVJ94nfiQiv9JQ_9Vsf5hII';
const db=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const app=document.getElementById('app');
let S={user:null,profile:null,clients:[],actions:[],client:null};
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=x=>x?new Date(x+'T00:00:00').toLocaleDateString('pt-BR'):'—';
function login(msg=''){app.innerHTML=`<main class="auth"><div class="authbox"><div class="logo">AG<span>CARE</span></div><h1>Entrar</h1><p>Gestão, diagnóstico e plano de ação.</p>${msg?`<div class="error">${esc(msg)}</div>`:''}<form id="f"><label>E-mail<input id="e" type="email" required></label><label>Senha<input id="p" type="password" required></label><button>Entrar</button></form><button type="button" onclick="forgot()" class="linkbtn">Esqueci minha senha</button></div></main>`;document.getElementById('f').onsubmit=async e=>{e.preventDefault();const b=e.submitter;b.disabled=true;b.textContent='Entrando…';const {error}=await db.auth.signInWithPassword({email:document.getElementById('e').value,password:document.getElementById('p').value});if(error)login(error.message)}}
function forgot(){app.innerHTML='<main class="auth"><div class="authbox"><div class="logo">AG<span>CARE</span></div><h1>Recuperar acesso</h1><p>Informe seu e-mail para receber um link.</p><form id="rf"><label>E-mail<input id="re" type="email" required></label><button>Enviar link</button></form><button class="linkbtn" id="back">Voltar</button></div></main>';document.getElementById('back').onclick=()=>login();document.getElementById('rf').onsubmit=async e=>{e.preventDefault();const email=document.getElementById('re').value.trim();const fn=['reset','Password','ForEmail'].join('');const r=await db.auth[fn](email,{redirectTo:'https://afrogustaprefeitura-rgb.github.io/ag-care/reset.html'});if(r.error)return alert(r.error.message);alert('Se o e-mail existir, o link foi enviado.');login()}}function error(m){app.innerHTML=`<main class="auth"><div class="authbox"><div class="logo">AG<span>CARE</span></div><h2>Acesso não configurado</h2><div class="error">${esc(m)}</div><button onclick="login()">Voltar</button></div></main>`}
function shell(title,body){app.innerHTML=`<div class="layout"><aside><div class="logo">AG<span>CARE</span></div><small>${esc(S.profile.papel)}</small><nav><a href="#" onclick="go('dash')">Dashboard</a><a href="#" onclick="go('actions')">Plano de Ação</a>${S.profile.papel==='admin'?'<a href="#" onclick="go(\'clients\')">Empresas</a>':''}</nav><div class="side"><b>${esc(S.profile.nome||S.user.email)}</b><span>${esc(S.user.email)}</span><button class="out" onclick="db.auth.signOut()">Sair</button></div></aside><main class="main"><header><div><small>AG CARE</small><h1>${esc(title)}</h1></div><span class="tag">${esc(S.profile.papel)}</span></header>${body}</main></div>`}
async function load(){const {data:p,error}=await db.from('perfis_usuario').select('id,nome,papel,ativo').eq('id',S.user.id).maybeSingle();if(error)return errorBox(error.message);if(!p||!p.ativo)return errorBox('Usuário sem perfil ativo.');S.profile=p;if(p.papel==='admin'){const r=await db.from('clientes').select('*').order('nome');if(r.error)return errorBox(r.error.message);S.clients=r.data||[];await admin()}else{const l=await db.from('cliente_usuarios').select('cliente_id').eq('usuario_id',S.user.id);if(l.error)return errorBox(l.error.message);const ids=[...new Set((l.data||[]).map(x=>x.cliente_id))];if(!ids.length)return errorBox('Usuário ainda não está vinculado a uma empresa.');const c=await db.from('clientes').select('*').in('id',ids).order('nome');if(c.error)return errorBox(c.error.message);S.clients=c.data||[];S.client=S.clients[0];await client()}}
function errorBox(m){error(m)}
function inviteForm(){app.innerHTML=`<div class="layout"><aside><div class="logo">AG<span>CARE</span></div><small>admin</small><nav><a href="#" onclick="admin()">Dashboard</a><a href="#" onclick="admin()">Empresas</a></nav><div class="side"><b>${esc(S.profile.nome||S.user.email)}</b><span>${esc(S.user.email)}</span><button class="out" onclick="db.auth.signOut()">Sair</button></div></aside><main class="main"><header><div><small>AG CARE</small><h1>Convidar usuário</h1></div><span class="tag">admin</span></header><section class="panel"><p>O usuário receberá um e-mail para definir a senha e acessar a empresa selecionada.</p><form id="inviteForm"><label>Nome<input id="inome" required></label><label>E-mail<input id="iemail" type="email" required></label><label>Empresa<select id="icliente" required>${S.clients.map(c=>`<option value="${c.id}">${esc(c.nome)}</option>`).join('')}</select></label><button>Enviar convite</button><button type="button" class="linkbtn" onclick="admin()">Cancelar</button></form></section></main></div>`;document.getElementById('inviteForm').onsubmit=inviteUser}
async function inviteUser(e){e.preventDefault();const b=e.submitter;b.disabled=true;b.textContent='Enviando…';const {data:{session}}=await db.auth.getSession();if(!session)return login('Sua sessão expirou.');const r=await db.functions.invoke('admin-invite-client-v2',{body:{nome:document.getElementById('inome').value.trim(),email:document.getElementById('iemail').value.trim(),cliente_id:Number(document.getElementById('icliente').value)}});if(r.error){b.disabled=false;b.textContent='Enviar convite';return alert(r.error.message)}const data=r.data||{};if(data.error){b.disabled=false;b.textContent='Enviar convite';return alert(data.error)}await admin();alert('Convite enviado com sucesso.');}
function table(a){return `<section class="panel"><h2>Plano de ação</h2><table><thead><tr><th>Ação</th><th>Área</th><th>Fase</th><th>Prazo</th><th>Score</th><th>Status</th></tr></thead><tbody>${a.map(x=>`<tr><td>${esc(x.acao)}</td><td>${esc(x.area)}</td><td>${esc(x.fase_plano)}</td><td>${date(x.prazo)}</td><td>${x.score??'—'}</td><td>${esc(x.status)}</td></tr>`).join('')}</tbody></table></section>`}




async function admin(){const r=await db.from('acoes').select('*').is('concluido_em',null).order('prazo');if(r.error)return errorBox(r.error.message);S.actions=r.data||[];const critical=S.actions.filter(x=>+x.score>=70).length;const due=S.actions.filter(x=>x.prazo&&new Date(x.prazo+'T00:00:00')<=new Date()).length;const done=await db.from('acoes').select('id',{count:'exact',head:true}).not('concluido_em','is',null);const doneCount=done.count||0;shell('Dashboard Admin',`<div class="grid"><div class="card"><span>Empresas</span><b>${S.clients.length}</b></div><div class="card"><span>Ações abertas</span><b>${S.actions.length}</b></div><div class="card"><span>Score ≥ 70</span><b>${critical}</b></div><div class="card"><span>Vencidas/hoje</span><b>${due}</b></div></div><section class="panel"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><h2>Empresas</h2><button class="mini" onclick="inviteForm()">+ Convidar usuário</button></div><p class="muted">Ações concluídas no sistema: <b>${doneCount}</b></p><table><thead><tr><th>Empresa</th><th>Diagnóstico</th><th>Responsável</th><th>Ações abertas</th><th></th></tr></thead><tbody>${S.clients.map(c=>`<tr><td><b>${esc(c.nome)}</b><small>${esc(c.segmento)}</small></td><td>${esc(c.id_diagnostico)}</td><td>${esc(c.responsavel)}</td><td>${S.actions.filter(a=>a.cliente_id===c.id).length}</td><td><button class="mini" onclick="adminClient(${c.id})">Gerenciar</button></td></tr>`).join('')}</tbody></table></section>`)}
async function adminClient(id){const c=S.clients.find(x=>x.id===id);const r=await db.from('acoes').select('*').eq('cliente_id',id).order('concluido_em',{ascending:true}).order('prazo');if(r.error)return error(r.error.message);const actions=r.data||[];S.actions=actions;shell('Gerenciar empresa',`<button class="back" onclick="admin()">← Voltar</button><section class="hero"><small>${esc(c.id_diagnostico)}</small><h2>${esc(c.nome)}</h2><p>${esc(c.cidade_uf)} · ${esc(c.responsavel)}</p></section><section class="panel"><div class="panelhead"><h2>Plano de ação</h2><button class="mini" onclick="actionForm(null,${id})">+ Nova ação</button></div><table><thead><tr><th>Ação</th><th>Área</th><th>Fase</th><th>Prazo</th><th>Score</th><th>Status</th><th></th></tr></thead><tbody>${actions.map(x=>`<tr class="${x.concluido_em?'done':''}"><td><b>${esc(x.acao)}</b><small>${esc(x.problema||'')}</small></td><td>${esc(x.area)}</td><td>${esc(x.fase_plano)}</td><td>${date(x.prazo)}</td><td>${x.score??'—'}</td><td><span class="status">${esc(x.concluido_em?'Concluída':x.status)}</span></td><td><button class="mini" onclick="actionForm(${x.id},${id})">Editar</button></td></tr>`).join('')}</tbody></table></section>`)}

function actionForm(actionId,clienteId){const a=actionId?S.actions.find(x=>x.id===actionId):null;const c=S.clients.find(x=>x.id===clienteId);app.innerHTML=`<div class="layout"><aside><div class="logo">AG<span>CARE</span></div><small>admin</small><nav><a href="#" onclick="admin()">Dashboard</a><a href="#" onclick="adminClient(${clienteId})">Empresa</a></nav><div class="side"><b>${esc(S.profile.nome||S.user.email)}</b><span>${esc(S.user.email)}</span><button class="out" onclick="db.auth.signOut()">Sair</button></div></aside><main class="main"><header><div><small>AG CARE · ${esc(c.nome)}</small><h1>${a?'Editar ação':'Nova ação'}</h1></div><span class="tag">admin</span></header><section class="panel"><form id="actionForm"><label>Ação<input id="facao" value="${esc(a?.acao||'')}" required></label><label>Área<input id="farea" value="${esc(a?.area||'')}" required></label><label>Problema<input id="fproblema" value="${esc(a?.problema||'')}"></label><label>Prazo<input id="fprazo" type="date" value="${a?.prazo||''}" required></label><label>Responsável<input id="fresp" value="${esc(a?.responsavel||c.responsavel||'')}"></label><label>Prioridade<select id="fprior"><option ${a?.prioridade==='muito alta'?'selected':''}>muito alta</option><option ${a?.prioridade==='critica'?'selected':''}>critica</option><option ${a?.prioridade==='alta'?'selected':''}>alta</option><option ${a?.prioridade==='média'?'selected':''}>média</option><option ${(!a||a?.prioridade==='normal')?'selected':''}>normal</option><option ${a?.prioridade==='baixa'?'selected':''}>baixa</option></select></label><label>Fase do plano<select id="ffase"><option ${a?.fase_plano==='0–30 dias'?'selected':''}>0–30 dias</option><option ${a?.fase_plano==='31–60 dias'?'selected':''}>31–60 dias</option><option ${a?.fase_plano==='61–90 dias'?'selected':''}>61–90 dias</option></select></label><label>Status<select id="fstatus"><option ${!a||a?.status==='pendente'?'selected':''}>pendente</option><option ${a?.status==='em andamento'?'selected':''}>em andamento</option><option ${a?.status==='bloqueada'?'selected':''}>bloqueada</option><option ${a?.status==='concluída'?'selected':''}>concluída</option></select></label><div class="formactions"><button>Salvar ação</button><button type="button" class="linkbtn" onclick="adminClient(${clienteId})">Cancelar</button></div></form></section>${a?'<section class="panel"><div class="panelhead"><h2>Histórico</h2></div><div id="history">Carregando…</div></section>':''}</main></div>`;document.getElementById('actionForm').onsubmit=e=>saveAction(e,actionId,clienteId);if(a)loadHistory(actionId)}

async function loadHistory(id){const r=await db.from('acoes_historico').select('evento,dados,created_at').eq('acao_id',id).order('created_at',{ascending:false});const el=document.getElementById('history');if(!el)return;if(r.error){el.innerHTML='<div class="error">'+esc(r.error.message)+'</div>';return}el.innerHTML=(r.data||[]).map(h=>`<div class="history"><b>${esc(h.evento)}</b><span>${new Date(h.created_at).toLocaleString('pt-BR')}</span></div>`).join('')||'<p class="muted">Sem histórico.</p>'}

async function saveAction(e,id,clienteId){e.preventDefault();const status=document.getElementById('fstatus').value;const payload={cliente_id:clienteId,acao:document.getElementById('facao').value.trim(),area:document.getElementById('farea').value.trim(),problema:document.getElementById('fproblema').value.trim()||null,prazo:document.getElementById('fprazo').value,responsavel:document.getElementById('fresp').value.trim()||null,prioridade:document.getElementById('fprior').value,fase_plano:document.getElementById('ffase').value,status,concluido_em:status==='concluída'?new Date().toISOString():null};if(!id){payload.origem='MANUAL';payload.origem_id=null;}const r=id?await db.from('acoes').update(payload).eq('id',id):await db.from('acoes').insert(payload);if(r.error)return alert(r.error.message);await adminClient(clienteId);alert(id?'Ação atualizada.':'Ação criada.');}
async function client(){
  const r=await db.from('acoes').select('*').eq('cliente_id',S.client.id).order('prazo');
  if(r.error)return errorBox(r.error.message);
  const all=r.data||[];
  S.actions=all.filter(x=>!x.concluido_em);
  const open=S.actions;
  const completed=all.filter(x=>!!x.concluido_em);
  const today=new Date(); today.setHours(0,0,0,0);
  const plus7=new Date(today); plus7.setDate(plus7.getDate()+7);
  const overdue=open.filter(x=>x.prazo&&new Date(x.prazo+'T00:00:00')<today);
  const next7=open.filter(x=>x.prazo&&new Date(x.prazo+'T00:00:00')>=today&&new Date(x.prazo+'T00:00:00')<=plus7);
  const total=all.length;
  const progress=total?Math.round(completed.length/total*100):0;
  const avgScore=all.length?Math.round((all.reduce((s,x)=>s+(Number(x.score)||0),0)/all.length)*10)/10:0;
  const high=all.filter(x=>(Number(x.score)||0)>=70).length;
  const phases=['0–30 dias','31–60 dias','61–90 dias'].map((phase,i)=>{
    const items=all.filter(x=>x.fase_plano===phase);
    const done=items.filter(x=>!!x.concluido_em).length;
    const pct=items.length?Math.round(done/items.length*100):0;
    return {phase,done,total:items.length,pct,label:['0–30','31–60','61–90'][i]};
  });
  const h=await db.from('acoes_historico').select('acao_id,evento,dados,created_at').eq('cliente_id',S.client.id).order('created_at',{ascending:false}).limit(8);
  const history=h.error?[]:(h.data||[]);
  const actionMap=Object.fromEntries(all.map(x=>[x.id,x]));
  shell('Painel da empresa',`
    <div class='client-dashboard'>
      <section class='client-welcome'><div><small>ACOMPANHAMENTO AG CARE</small><h2>${esc(S.client.nome)}</h2><p>${esc(S.client.segmento)} · ${esc(S.client.cidade_uf)}</p></div><div class='client-progress'><b>${progress}%</b><span>do plano concluído</span></div></section>
      <div class='client-kpis'>
        <div class='client-kpi'><span>Plano concluído</span><b>${progress}%</b><small>${completed.length} de ${total} ações</small></div>
        <div class='client-kpi'><span>Ações atrasadas</span><b>${overdue.length}</b><small>${overdue.length?'Precisam de atenção':'Nenhuma pendência vencida'}</small></div>
        <div class='client-kpi'><span>Próximos 7 dias</span><b>${next7.length}</b><small>com prazo nesta janela</small></div>
        <div class='client-kpi'><span>Score médio</span><b>${avgScore||'—'}</b><small>${high} ações com score ≥ 70</small></div>
      </div>
      <section class='client-panel'><div class='client-panel-head'><div><small>PLANO DE AÇÃO</small><h2>Progresso por etapa</h2></div><span class='client-badge'>${completed.length}/${total} concluídas</span></div><div class='phase-list'>
        ${phases.map(p=>`<div class='phase-row'><div class='phase-top'><b>${p.label} dias</b><span>${p.done}/${p.total} · ${p.pct}%</span></div><div class='progress-track'><i style='width:${p.pct}%'></i></div></div>`).join('')}
      </div></section>
      <div class='client-two-col'>
        <section class='client-panel'><div class='client-panel-head'><div><small>ATENÇÃO</small><h2>Ações atrasadas</h2></div><span class='client-count danger'>${overdue.length}</span></div>${overdue.length?overdue.map(x=>`<div class='client-action-row danger-row'><div><b>${esc(x.acao)}</b><small>${esc(x.area||'')} · prazo ${date(x.prazo)}</small></div><span>${esc(x.prioridade||'normal')}</span></div>`).join(''):'<div class=\'empty-client\'>Nenhuma ação atrasada.</div>'}</section>
        <section class='client-panel'><div class='client-panel-head'><div><small>PRÓXIMOS PASSOS</small><h2>Próximos 7 dias</h2></div><span class='client-count'>${next7.length}</span></div>${next7.length?next7.map(x=>`<div class='client-action-row'><div><b>${esc(x.acao)}</b><small>${esc(x.area||'')} · ${date(x.prazo)}</small></div><span>${esc(x.status||'pendente')}</span></div>`).join(''):'<div class=\'empty-client\'>Nenhuma ação vence nos próximos 7 dias.</div>'}</section>
      </div>
      <section class='client-panel'><div class='client-panel-head'><div><small>INDICADORES</small><h2>Visão do diagnóstico</h2></div></div><div class='indicator-grid'>
        <div><span>Score médio das ações</span><b>${avgScore||'—'}</b></div><div><span>Ações prioritárias</span><b>${high}</b></div><div><span>Em andamento</span><b>${all.filter(x=>x.status==='em andamento'&&!x.concluido_em).length}</b></div><div><span>Bloqueadas</span><b>${all.filter(x=>x.status==='bloqueada'&&!x.concluido_em).length}</b></div>
      </div></section>
      <section class='client-panel'><div class='client-panel-head'><div><small>MOVIMENTAÇÕES</small><h2>Últimas movimentações</h2></div></div>
        ${history.length?history.map(x=>`<div class='movement'><div class='movement-dot'></div><div><b>${esc(x.evento)}</b><p>${esc(actionMap[x.acao_id]?.acao||'Ação')}</p></div><time>${new Date(x.created_at).toLocaleString('pt-BR')}</time></div>`).join(''):'<div class=\'empty-client\'>Ainda não há movimentações registradas.</div>'}
      </section>
      <section class='client-panel'><div class='client-panel-head'><div><small>ACOMPANHAMENTO</small><h2>Histórico das ações</h2></div><span class='client-badge'>${total} ações</span></div><div class='client-actions-grid'>${all.map(x=>`<article class='client-action-card'><div class='client-action-top'><div><small>${esc(x.area||'Sem área')} · ${esc(x.fase_plano||'Sem fase')}</small><h3>${esc(x.acao)}</h3></div><span class='status-pill'>${esc(x.concluido_em?'concluída':(x.status||'pendente'))}</span></div><div class='client-action-meta'><span>Prazo <b>${date(x.prazo)}</b></span><span>Score <b>${x.score??'—'}</b></span><span>Prioridade <b>${esc(x.prioridade||'normal')}</b></span></div>${x.concluido_em?'<div class="client-action-done">✓ Ação concluída</div>':`<div class="client-action-footer">${x.prazo&&new Date(x.prazo+'T00:00:00')<today?'<div class="client-action-overdue">⚠ Ação atrasada</div>':''}<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="mini" onclick="clientEditAction(${x.id})">Editar ação</button><button class="mini" onclick="complete(${x.id})">Concluir ação</button></div></div>`}</article>`).join('')}</div></section>
    </div>`);
}
function clientEditAction(id){
  const a=S.actions.find(x=>x.id===id);
  if(!a)return alert('Ação não encontrada.');
  app.innerHTML=`<main class="auth"><div class="authbox" style="max-width:720px"><div class="logo">AG<span>CARE</span></div><h1>Editar ação</h1><p>Atualize os dados da ação.</p><form id="clientEditForm">
  <label>Ação<input id="ce_acao" required value="${esc(a.acao)}"></label>
  <label>Área<input id="ce_area" required value="${esc(a.area||'')}"></label>
  <label>Problema<input id="ce_problema" value="${esc(a.problema||'')}"></label>
  <label>Prazo<input id="ce_prazo" type="date" required value="${a.prazo||''}"></label>
  <label>Responsável<input id="ce_resp" value="${esc(a.responsavel||'')}"></label>
  <label>Status<select id="ce_status"><option ${a.status==='pendente'?'selected':''}>pendente</option><option ${a.status==='em andamento'?'selected':''}>em andamento</option><option ${a.status==='bloqueada'?'selected':''}>bloqueada</option><option ${a.status==='concluída'?'selected':''}>concluída</option></select></label>
  <div class="formactions"><button>Salvar alterações</button><button type="button" class="linkbtn" onclick="client()">Cancelar</button></div>
  </form></div></main>`;
  document.getElementById('clientEditForm').onsubmit=async e=>{
    e.preventDefault();
    const status=document.getElementById('ce_status').value;
    const payload={acao:document.getElementById('ce_acao').value.trim(),area:document.getElementById('ce_area').value.trim(),problema:document.getElementById('ce_problema').value.trim()||null,prazo:document.getElementById('ce_prazo').value,responsavel:document.getElementById('ce_resp').value.trim()||null,status,concluido_em:status==='concluída'?new Date().toISOString():null};
    const r=await db.from('acoes').update(payload).eq('id',id).eq('cliente_id',S.client.id);
    if(r.error)return alert(r.error.message);
    await client();
    alert('Ação alterada com sucesso.');
  };
}
async function complete(id){const r=await db.from('acoes').update({status:'concluída',concluido_em:new Date().toISOString()}).eq('id',id);if(r.error)return alert(r.error.message);await client();alert('Ação marcada como concluída.');}
function go(v){event?.preventDefault();if(S.profile.papel==='admin')return admin();return client()}
async function start(){
  const recovery=()=>location.search.includes('recovery=1')||location.hash.includes('type=recovery');
  let recoveryHandled=false;
  const showRecovery=()=>{
    if(recoveryHandled)return;
    recoveryHandled=true;
    app.innerHTML='<main class="auth"><div class="authbox"><div class="logo">AG<span>CARE</span></div><h1>Nova senha</h1><p>Defina sua nova senha de acesso.</p><form id="pf"><label>Nova senha<input id="np" type="password" minlength="6" required></label><label>Confirmar senha<input id="cp" type="password" minlength="6" required></label><button>Salvar nova senha</button></form></div></main>';
    document.getElementById('pf').onsubmit=async e=>{
      e.preventDefault();
      const np=document.getElementById('np').value;
      if(np!==document.getElementById('cp').value)return alert('As senhas não conferem.');
      const r=await db.auth.updateUser({password:np});
      if(r.error)return alert(r.error.message);
      await db.auth.signOut();
      history.replaceState({},'',window.location.pathname);
      login('Senha atualizada. Entre com sua nova senha.');
    };
  };
  db.auth.onAuthStateChange(async(event,session)=>{
    if(event==='PASSWORD_RECOVERY'&&session){showRecovery();return;}
    if(session&&!recovery()&&!recoveryHandled){S.user=session.user;await load();}
    else if(!session&&!recovery()&&!recoveryHandled)login();
  });
  const {data:{session}}=await db.auth.getSession();
  if(recovery()&&session){showRecovery();return;}
  if(session&&!recoveryHandled){S.user=session.user;await load();return;}
  if(!session&&!recovery())login();
}start();
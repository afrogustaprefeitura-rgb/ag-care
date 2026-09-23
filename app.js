const SUPABASE_URL='https://rbuadfgwktyiljvggkgm.supabase.co';
const SUPABASE_KEY='sb_publishable_FVMZJrWEgVJ94nfiQiv9JQ_9Vsf5hII';
const db=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const app=document.getElementById('app');
let S={user:null,profile:null,clients:[],actions:[],client:null};
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=x=>x?new Date(x+'T00:00:00').toLocaleDateString('pt-BR'):'—';
function login(msg=''){app.innerHTML=`<main class="auth"><div class="authbox"><div class="logo">AG<span>CARE</span></div><h1>Entrar</h1><p>Gestão, diagnóstico e plano de ação.</p>${msg?`<div class="error">${esc(msg)}</div>`:''}<form id="f"><label>E-mail<input id="e" type="email" required></label><label>Senha<input id="p" type="password" required></label><button>Entrar</button></form><button type="button" onclick="forgot()" class="linkbtn">Esqueci minha senha</button></div></main>`;document.getElementById('f').onsubmit=async e=>{e.preventDefault();const b=e.submitter;b.disabled=true;b.textContent='Entrando…';const {error}=await db.auth.signInWithPassword({email:document.getElementById('e').value,password:document.getElementById('p').value});if(error)login(error.message)}}
function forgot(){app.innerHTML='<main class="auth"><div class="authbox"><div class="logo">AG<span>CARE</span></div><h1>Recuperar acesso</h1><p>Informe seu e-mail para receber um link.</p><form id="rf"><label>E-mail<input id="re" type="email" required></label><button>Enviar link</button></form><button class="linkbtn" id="back">Voltar</button></div></main>';document.getElementById('back').onclick=()=>login();document.getElementById('rf').onsubmit=async e=>{e.preventDefault();const email=document.getElementById('re').value.trim();const fn=['reset','Password','ForEmail'].join('');const r=await db.auth[fn](email,{redirectTo:window.location.origin+window.location.pathname+'?recovery=1'});if(r.error)return alert(r.error.message);alert('Se o e-mail existir, o link foi enviado.');login()}}function error(m){app.innerHTML=`<main class="auth"><div class="authbox"><div class="logo">AG<span>CARE</span></div><h2>Acesso não configurado</h2><div class="error">${esc(m)}</div><button onclick="login()">Voltar</button></div></main>`}
function shell(title,body){app.innerHTML=`<div class="layout"><aside><div class="logo">AG<span>CARE</span></div><small>${esc(S.profile.papel)}</small><nav><a href="#" onclick="go('dash')">Dashboard</a><a href="#" onclick="go('actions')">Plano de Ação</a>${S.profile.papel==='admin'?'<a href="#" onclick="go(\'clients\')">Empresas</a>':''}</nav><div class="side"><b>${esc(S.profile.nome||S.user.email)}</b><span>${esc(S.user.email)}</span><button class="out" onclick="db.auth.signOut()">Sair</button></div></aside><main class="main"><header><div><small>AG CARE</small><h1>${esc(title)}</h1></div><span class="tag">${esc(S.profile.papel)}</span></header>${body}</main></div>`}
async function load(){const {data:p,error}=await db.from('perfis_usuario').select('id,nome,papel,ativo').eq('id',S.user.id).maybeSingle();if(error)return errorBox(error.message);if(!p||!p.ativo)return errorBox('Usuário sem perfil ativo.');S.profile=p;if(p.papel==='admin'){const r=await db.from('clientes').select('*').order('nome');if(r.error)return errorBox(r.error.message);S.clients=r.data||[];await admin()}else{const l=await db.from('cliente_usuarios').select('cliente_id').eq('usuario_id',S.user.id);if(l.error)return errorBox(l.error.message);const ids=[...new Set((l.data||[]).map(x=>x.cliente_id))];if(!ids.length)return errorBox('Usuário ainda não está vinculado a uma empresa.');const c=await db.from('clientes').select('*').in('id',ids).order('nome');if(c.error)return errorBox(c.error.message);S.clients=c.data||[];S.client=S.clients[0];await client()}}
function errorBox(m){error(m)}
async function admin(){const r=await db.from('acoes').select('*').is('concluido_em',null).order('prazo');if(r.error)return errorBox(r.error.message);S.actions=r.data||[];const critical=S.actions.filter(x=>+x.score>=70).length;const due=S.actions.filter(x=>x.prazo&&new Date(x.prazo+'T00:00:00')<=new Date()).length;shell('Dashboard Admin',`<div class="grid"><div class="card"><span>Empresas</span><b>${S.clients.length}</b></div><div class="card"><span>Ações abertas</span><b>${S.actions.length}</b></div><div class="card"><span>Score ≥ 70</span><b>${critical}</b></div><div class="card"><span>Vencidas/hoje</span><b>${due}</b></div></div><section class="panel"><h2>Empresas</h2><table><thead><tr><th>Empresa</th><th>Diagnóstico</th><th>Responsável</th><th>Ações</th><th></th></tr></thead><tbody>${S.clients.map(c=>`<tr><td><b>${esc(c.nome)}</b><small>${esc(c.segmento)}</small></td><td>${esc(c.id_diagnostico)}</td><td>${esc(c.responsavel)}</td><td>${S.actions.filter(a=>a.cliente_id===c.id).length}</td><td><button class="mini" onclick="adminClient(${c.id})">Ver</button></td></tr>`).join('')}</tbody></table></section>`)}
async function adminClient(id){const c=S.clients.find(x=>x.id===id);const r=await db.from('acoes').select('*').eq('cliente_id',id).order('prazo');if(r.error)return error(r.error.message);shell('Empresa',`<button class="back" onclick="admin()">← Voltar</button><section class="hero"><small>${esc(c.id_diagnostico)}</small><h2>${esc(c.nome)}</h2><p>${esc(c.cidade_uf)} · ${esc(c.responsavel)}</p></section>${table(r.data||[])}`)}
function table(a){return `<section class="panel"><h2>Plano de ação</h2><table><thead><tr><th>Ação</th><th>Área</th><th>Fase</th><th>Prazo</th><th>Score</th><th>Status</th></tr></thead><tbody>${a.map(x=>`<tr><td>${esc(x.acao)}</td><td>${esc(x.area)}</td><td>${esc(x.fase_plano)}</td><td>${date(x.prazo)}</td><td>${x.score??'—'}</td><td>${esc(x.status)}</td></tr>`).join('')}</tbody></table></section>`}
async function client(){const r=await db.from('acoes').select('*').eq('cliente_id',S.client.id).is('concluido_em',null).order('prazo');if(r.error)return errorBox(r.error.message);S.actions=r.data||[];const a=S.actions[0],p1=S.actions.filter(x=>x.fase_plano==='0–30 dias').length,p2=S.actions.filter(x=>x.fase_plano==='31–60 dias').length,p3=S.actions.filter(x=>x.fase_plano==='61–90 dias').length;shell('Minha empresa',`<section class="hero"><small>${esc(S.client.id_diagnostico)}</small><h2>${esc(S.client.nome)}</h2><p>${esc(S.client.segmento)} · ${esc(S.client.cidade_uf)}</p></section><div class="grid"><div class="card"><span>Ações abertas</span><b>${S.actions.length}</b></div><div class="card"><span>0–30 dias</span><b>${p1}</b></div><div class="card"><span>31–60 dias</span><b>${p2}</b></div><div class="card"><span>61–90 dias</span><b>${p3}</b></div></div>${a?`<section class="next"><small>PRÓXIMA AÇÃO</small><h2>${esc(a.acao)}</h2><p>Prazo: <b>${date(a.prazo)}</b> · Score: <b>${a.score??'—'}</b></p><button onclick="complete(${a.id})">Marcar como concluída</button></section>`:'<section class="success">🎉 Nenhuma ação aberta.</section>'}${table(S.actions)}`)}
async function complete(id){const r=await db.from('acoes').update({status:'concluída',concluido_em:new Date().toISOString()}).eq('id',id);if(r.error)return alert(r.error.message);await client()}
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
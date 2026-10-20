/* CotizaFlow Beta: manual, opt-in cloud backup. Public Supabase publishable key only. */
import { validateBackup } from './backup.mjs';
const API='https://nrwbnjjaqilgreqhpcov.supabase.co';
const KEY='sb_publishable_7aOw4W695bp3CIMYTO9E6Q_5VChQ6so';
const DATA_KEY='cotizaflow-v1';
const SESSION_KEY='cotizaflow-cloud-session-v1';
let session=null;
try { session=JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null'); } catch { session=null; }
const css=document.createElement('style');
css.textContent=`#cf-cloud-toggle{position:fixed;right:16px;bottom:16px;z-index:1000;background:#0b766a;color:white;border:0;border-radius:30px;padding:12px 18px;font:700 14px system-ui;box-shadow:0 5px 25px #1235;cursor:pointer}#cf-cloud-dialog{border:0;border-radius:14px;padding:22px;max-width:min(92vw,460px);width:100%;box-shadow:0 10px 50px #1238;color:#193a47}#cf-cloud-dialog::backdrop{background:#0929369c}#cf-cloud-dialog h2{margin:0 0 12px}#cf-cloud-dialog p{font-size:13px;line-height:1.55}#cf-cloud-dialog input{width:100%;padding:10px;border:1px solid #abc4c5;border-radius:8px;box-sizing:border-box;margin:5px 0 12px}#cf-cloud-dialog button{padding:10px;border-radius:7px;border:1px solid #bbcfd1;background:white;color:#174650;cursor:pointer;margin:4px}#cf-cloud-dialog button.primary{background:#0b766a;color:white}#cf-cloud-status{white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px;min-height:20px}`;
document.head.append(css);
const toggle=document.createElement('button');toggle.id='cf-cloud-toggle';toggle.textContent='☁ Respaldo nube (beta)';document.body.append(toggle);
const dialog=document.createElement('dialog');dialog.id='cf-cloud-dialog';dialog.innerHTML=`<h2>☁ Respaldo en la nube</h2><p>Beta opcional. Tus datos siguen guardándose en este navegador. La nube solo cambia cuando pulsas Subir o Restaurar. Guarda primero un JSON desde Ajustes.</p><form id="cf-login" autocomplete="on"><label>Correo electrónico<input id="cf-email" type="email" required autocomplete="email"></label><label>Contraseña<input id="cf-password" type="password" required minlength="8" autocomplete="current-password"></label><button type="button" id="cf-signup">Crear cuenta</button><button type="submit" class="primary">Iniciar sesión</button><div style="margin-top:5px"><button type="button" id="cf-forgot" style="background:transparent;border:0;padding:7px 3px;font-size:12.5px;text-decoration:underline;text-underline-offset:3px;color:#0b766a;min-height:42px">¿Olvidaste tu contraseña?</button></div></form><form id="cf-reset-form" hidden><h3>Crear nueva contraseña</h3><p>Has abierto un enlace de recuperación de acceso.</p><label for="cf-new-password">Nueva contraseña (mínimo 10 caracteres)</label><input id="cf-new-password" type="password" autocomplete="new-password" minlength="10" maxlength="128" required><button id="cf-reset-save" type="submit" class="primary">Guardar contraseña</button></form><div id="cf-session" hidden><p id="cf-who"></p><button id="cf-push" class="primary">↑ Subir respaldo actual</button><button id="cf-pull">↓ Restaurar respaldo de nube</button><button id="cf-signout">Cerrar sesión</button></div><p id="cf-cloud-status" role="status" aria-live="polite"></p><button id="cf-close">Cerrar</button>`;
document.body.append(dialog);
const $=id=>dialog.querySelector('#'+id);
const state=msg=>{$('cf-cloud-status').textContent=msg;};
function renderSession(){let logged=!!session?.access_token;$('cf-login').hidden=logged;$('cf-session').hidden=!logged;$('cf-who').textContent=logged?'Sesión iniciada: '+(session.user?.email||'usuario'):'';}
function saveSession(s){session=s;if(s)sessionStorage.setItem(SESSION_KEY,JSON.stringify(s));else sessionStorage.removeItem(SESSION_KEY);renderSession();}
async function auth(path,payload){let r=await fetch(`${API}/auth/v1/${path}`,{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify(payload)});let j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.msg||j.error_description||j.message||`HTTP ${r.status}`);return j;}
async function token(){if(!session?.access_token)throw Error('Inicia sesión primero.');if(session.expires_at && Date.now()/1000>session.expires_at-60){const n=await auth('token?grant_type=refresh_token',{refresh_token:session.refresh_token});saveSession({...n,expires_at:Math.floor(Date.now()/1000)+n.expires_in});}return session.access_token;}
async function dataRequest(method,body){const access=await token();const response=await fetch(`${API}/rest/v1/cotizaflow_user_data?user_id=eq.${encodeURIComponent(session.user.id)}&select=data,version,updated_at`,{method,headers:{apikey:KEY,Authorization:`Bearer ${access}`,'Content-Type':'application/json',...(method==='POST'?{Prefer:'resolution=merge-duplicates,return=representation'}:{})},...(body?{body:JSON.stringify(body)}:{})});const j=await response.json().catch(()=>null);if(!response.ok)throw Error(j?.message||`Error de nube ${response.status}`);return j;}
let recoveryToken=null;
const resetURL=new URL(location.href);
const fragment=new URLSearchParams(resetURL.hash.slice(1));
if(fragment.get('type')==='recovery'&&fragment.has('access_token')){
 recoveryToken=fragment.get('access_token');
 history.replaceState(history.state,'',location.pathname+location.search);
}
function renderRecovery(){
 $('cf-login').hidden=!!recoveryToken||!!session?.access_token;
 $('cf-session').hidden=!!recoveryToken||!session?.access_token;
 $('cf-reset-form').hidden=!recoveryToken;
}
function showCloud(){state(recoveryToken?'Escribe una contraseña nueva para recuperar el acceso.':'');renderSession();renderRecovery();dialog.showModal();}
toggle.onclick=showCloud;$('cf-close').onclick=()=>dialog.close();
$('cf-forgot').onclick=async()=>{
 const email=$('cf-email').value.trim();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){state('Escribe primero tu correo electrónico para recuperar el acceso.');$('cf-email').focus();return;}
 const btn=$('cf-forgot');btn.disabled=true;btn.textContent='Enviando enlace…';state('Solicitando correo de recuperación…');
 try{
  const redirectTo=new URL(location.pathname,location.origin).href;
  const response=await fetch(API+'/auth/v1/recover?redirect_to='+encodeURIComponent(redirectTo),{
    method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify({email})
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(data.error_description||data.msg||data.message||'El servidor no pudo enviar el correo');
  state('Solicitud recibida. Si el correo corresponde a una cuenta, recibirás un enlace. Revisa también spam.');
 }catch(err){state('No se pudo solicitar el enlace: '+String(err.message||'Error').slice(0,140));}
 finally{btn.disabled=false;btn.textContent='¿Olvidaste tu contraseña?';}
};
$('cf-reset-form').onsubmit=async e=>{
 e.preventDefault();
 if(!recoveryToken){state('Solicita un enlace nuevo para cambiar la contraseña.');return;}
 const pass=$('cf-new-password').value;
 if(pass.length<10){state('La nueva contraseña debe tener 10 caracteres como mínimo.');return;}
 const btn=$('cf-reset-save');btn.disabled=true;state('Actualizando contraseña…');
 try{
  const response=await fetch(API+'/auth/v1/user',{method:'PUT',headers:{apikey:KEY,Authorization:'Bearer '+recoveryToken,'Content-Type':'application/json'},body:JSON.stringify({password:pass})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(data.msg||data.message||data.error_description||'El enlace expiró');
  $('cf-new-password').value='';recoveryToken=null;saveSession(null);renderRecovery();state('Contraseña actualizada. Ya puedes iniciar sesión con tu correo.');
 }catch(err){state('No se pudo cambiar la contraseña: '+String(err.message||'Error').slice(0,130));}
 finally{btn.disabled=false;}
};
if(recoveryToken)queueMicrotask(showCloud);
$('cf-login').onsubmit=async e=>{e.preventDefault();state('Iniciando sesión…');try{const j=await auth('token?grant_type=password',{email:$('cf-email').value.trim(),password:$('cf-password').value});saveSession({...j,expires_at:Math.floor(Date.now()/1000)+j.expires_in});$('cf-password').value='';state('Sesión iniciada.');}catch(e){state('No se pudo iniciar sesión: '+e.message);}};
$('cf-signup').onclick=async()=>{const email=$('cf-email').value.trim(),password=$('cf-password').value;if(!email||password.length<8){state('Ingresa correo válido y contraseña de al menos 8 caracteres.');return;}state('Creando cuenta…');try{await auth('signup?redirect_to='+encodeURIComponent(new URL(location.pathname,location.origin).href),{email,password});$('cf-password').value='';state('Revisa tu correo y confirma la cuenta antes de iniciar sesión.');}catch(e){state('No se pudo crear la cuenta: '+e.message);}};
$('cf-push').onclick=async()=>{try{const raw=localStorage.getItem(DATA_KEY);if(!raw)throw Error('No hay datos locales para respaldar.');const data=validateBackup(JSON.parse(raw));const json=JSON.stringify(data);if(new TextEncoder().encode(json).length>1900000)throw Error('El respaldo supera el límite seguro de 1,9 MB.');const current=await dataRequest('GET');if(!confirm(current?.length?'¿Guardar nueva versión del respaldo? Los cambios recientes de OTRO dispositivo podrían impedir la subida para protegerlos.':'¿Subir estos datos a tu cuenta? Guarda también un JSON en Ajustes.'))return;state('Subiendo…');const access=await token();const expected=current?.[0]?.version||0;const response=await fetch(`${API}/rest/v1/rpc/cotizaflow_safe_save`,{method:'POST',headers:{apikey:KEY,Authorization:`Bearer ${access}`,'Content-Type':'application/json'},body:JSON.stringify({p_expected:expected,p_data:data})});if(!response.ok)throw Error('No se pudo guardar sin conflictos: '+response.status);const result=await response.json();if(!result?.[0]?.saved)throw Error('Otra versión fue guardada desde otro dispositivo. Primero restaura o exporta y compara tus datos; nada se sobrescribió.');state('Respaldo subido correctamente (versión '+result[0].server_version+').');}catch(e){state('No se pudo subir: '+e.message);}};
$('cf-pull').onclick=async()=>{try{state('Buscando respaldo…');const records=await dataRequest('GET');if(!records?.length){state('Todavía no hay respaldo en esta cuenta.');return;}const data=validateBackup(records[0].data);if(!confirm('ATENCIÓN: esto REEMPLAZA todos los datos locales de CotizaFlow. Se descargará también una copia del estado actual antes de reemplazarlo. ¿Continuar?')){state('Restauración cancelada.');return;}const backup=localStorage.getItem(DATA_KEY);const localCopy=new Blob([backup||'{}'],{type:'application/json'});const localUrl=URL.createObjectURL(localCopy);const backupLink=document.createElement('a');backupLink.href=localUrl;backupLink.download='cotizaflow-antes-de-restaurar-'+new Date().toISOString().slice(0,10)+'.json';backupLink.click();setTimeout(()=>URL.revokeObjectURL(localUrl),60000);try{localStorage.setItem(DATA_KEY,JSON.stringify(data));}catch(e){if(backup!==null)localStorage.setItem(DATA_KEY,backup);throw e;}state('Restaurado. Recargando…');location.reload();}catch(e){state('No se pudo restaurar: '+e.message);}};
$('cf-signout').onclick=()=>{saveSession(null);$('cf-password').value='';state('Sesión cerrada en este navegador.');};
renderSession();

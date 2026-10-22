/* Shared Supabase Auth CAPTCHA integration. It stays disabled until all three apps
   have passed coordinated login, registration and password recovery tests. */
export const AUTH_CAPTCHA_ENABLED=false;
export const AUTH_CAPTCHA_SITEKEY='0x4AAAAAAFgm_-8sMbLzw3nP';
export function createAuthCaptcha(container){
 const host=typeof container==='string'?document.querySelector(container):container;
 if(!host)throw Error('Falta el contenedor de verificación de seguridad.');
 // Opt-in visual QA never enables server enforcement or sends the QA token to Auth.
 const QA_PREVIEW=!AUTH_CAPTCHA_ENABLED&&new URLSearchParams(location.search).get('turnstile_qa')==='1';
 let widget=null,token='',loaded=false;
 const reset=()=>{
  token='';
  if(widget!==null&&window.turnstile?.reset)window.turnstile.reset(widget);
 };
 const activate=()=>{
  if((!AUTH_CAPTCHA_ENABLED&&!QA_PREVIEW)||loaded)return;
  loaded=true;
  host.hidden=false;
  if(QA_PREVIEW){
   const info=document.createElement('p');info.textContent='Prueba visual de Turnstile: la autenticación sigue sin CAPTCHA obligatorio.';host.prepend(info);
   const status=document.createElement('p');status.setAttribute('data-turnstile-qa-status','');status.textContent='Esperando desafío de seguridad…';host.append(status);
  }
  if(!AUTH_CAPTCHA_SITEKEY)throw Error('No se configuró la verificación de seguridad.');
  const script=document.createElement('script');
  script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  script.async=true;script.defer=true;
  script.onload=()=>{
   widget=window.turnstile.render(host,{
    sitekey:AUTH_CAPTCHA_SITEKEY,
    theme:'auto',
    callback:value=>{token=value;if(QA_PREVIEW){host.dataset.qaStatus='verified';const status=host.querySelector('[data-turnstile-qa-status]');if(status)status.textContent='Desafío completado (solo prueba visual).';}},
    'expired-callback':()=>{token='';},
    'error-callback':()=>{token='';return true;}
   });
  };
  script.onerror=()=>{loaded=false;token='';host.textContent='No se pudo cargar la verificación de seguridad. Revisa tu conexión e intenta de nuevo.';};
  document.head.appendChild(script);
 };
 const requiredToken=()=>{
  if(!AUTH_CAPTCHA_ENABLED)return undefined;
  if(!token)throw Error('Completa la verificación de seguridad para continuar.');
  return token;
 };
 return {activate,reset,requiredToken,enabled:AUTH_CAPTCHA_ENABLED};
}

import { expect, type Page } from '@playwright/test';
import { emptyState, type AppState } from '../src/domain';

export const testUid='ritmo-isolated-test';
export async function isolatedAccount(page:Page,initial:AppState=emptyState()){
 await page.addInitScript(({uid,state})=>{localStorage.setItem('ritmo_onboarding_completed','true');const key=`ritmo-${uid}-v1`;if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({...state,ownerUid:uid}));},{uid:testUid,state:initial});
 await page.route('https://**/*',route=>route.abort());
 await page.route('**/__ritmo/**',route=>route.fulfill({status:404,body:'{}',contentType:'application/json'}));
 // Test-only network interception. Production auth is unchanged; this browser
 // cannot touch the user's Firestore or invoke a real provider.
 await page.route('**/src/firebase.ts',async route=>{const response=await route.fetch();let source=await response.text();const changed=source.replace(/export const db = [\s\S]*?;\n/,'export const db = null;\n');if(changed===source)throw new Error('Firestore test isolation could not be installed.');await route.fulfill({response,body:changed});});
 await page.route('https://identitytoolkit.googleapis.com/**',async route=>{
  const now=Math.floor(Date.now()/1000);const encode=(value:unknown)=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const token=`${encode({alg:'none',typ:'JWT'})}.${encode({aud:'ai-gym-and-diet-manager',iss:'https://securetoken.google.com/ai-gym-and-diet-manager',sub:testUid,user_id:testUid,email:'isolated@example.invalid',email_verified:true,iat:now,exp:now+3600,auth_time:now,firebase:{identities:{email:['isolated@example.invalid']},sign_in_provider:'password'}})}.test-only`;
  const identity={localId:testUid,email:'isolated@example.invalid',emailVerified:true,displayName:'Teste isolado',providerUserInfo:[{providerId:'password',email:'isolated@example.invalid',rawId:'isolated@example.invalid'}]};
  await route.fulfill({contentType:'application/json',body:JSON.stringify(route.request().url().includes('accounts:lookup')?{users:[identity]}:{...identity,registered:true,idToken:token,refreshToken:'test-only-refresh-token',expiresIn:'3600'})});
 });
 await page.goto('/#home');
 await page.getByRole('textbox',{name:'E-mail',exact:true}).fill('isolated@example.invalid');
 await page.getByLabel('Senha',{exact:true}).fill('Test-only-password-123');
 await page.getByRole('button',{name:'Entrar na minha conta',exact:true}).click();
 await expect(page.getByRole('navigation',{name:'Navegação móvel'})).toBeVisible();
}

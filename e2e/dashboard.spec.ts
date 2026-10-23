import { test, expect } from '@playwright/test';
import { emptyState, ingredient, foods, createSession, type Plan } from '../src/domain';
import { isolatedAccount, testUid } from './isolatedAccount';

test('PWA chat renders a DeepSeek reply without modifying workout plans',async({page})=>{
 const state=emptyState();state.profile.aiConsent=true;await isolatedAccount(page,state);
 await page.route('**/api/ai',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({provider:'deepseek',candidates:[{content:{parts:[{text:JSON.stringify({answer:'Teste recebido. Nenhum registro foi alterado.',dailyNote:'Teste técnico.',facts:[]})}]}}]})}));
 await page.keyboard.press('Control+k');const modal=page.getByRole('dialog',{name:'Converse com seu Ritmo'});
 await modal.getByPlaceholder('Conte como foi seu dia ou o que quer ajustar…').fill('Responda teste recebido, sem alterar registros.');
 await modal.getByRole('button',{name:'Enviar',exact:true}).click();
 await expect(modal.getByText('Teste recebido. Nenhum registro foi alterado.',{exact:true})).toBeVisible();
 const saved=await page.evaluate(uid=>JSON.parse(localStorage.getItem(`ritmo-${uid}-v1`)!),testUid);
 expect(saved.plans).toEqual([]);expect(saved.chat.filter((m:{role:string})=>m.role==='assistant')).toHaveLength(1);
});

test('chat explains depleted DeepSeek balance without claiming an answer or changing plans',async({page})=>{
 const state=emptyState();state.profile.aiConsent=true;await isolatedAccount(page,state);
 await page.route('**/api/ai',route=>route.fulfill({status:402,contentType:'application/json',body:JSON.stringify({error:{message:'Saldo esgotado'}})}));
 await page.keyboard.press('Control+k');const modal=page.getByRole('dialog',{name:'Converse com seu Ritmo'});
 await modal.getByPlaceholder('Conte como foi seu dia ou o que quer ajustar…').fill('Como está meu progresso?');await modal.getByRole('button',{name:'Enviar',exact:true}).click();
 await expect(modal.getByRole('alert')).toContainText('saldo do DeepSeek está esgotado');
 const saved=await page.evaluate(uid=>JSON.parse(localStorage.getItem(`ritmo-${uid}-v1`)!),testUid);expect(saved.plans).toEqual([]);expect(saved.chat.filter((m:{role:string})=>m.role==='assistant')).toHaveLength(0);
});

test('plan adjustment opens directly below the selected exercise, including bi-sets',async({page})=>{
 const state=emptyState();
 const exercise=(id:string,name:string,supersetId?:string)=>({id,name,muscle:'Peito',sets:3,reps:12,load:20,rest:60,origin:'usuario' as const,...(supersetId?{supersetId}:{})});
 state.plans=[{id:'inline-plan',name:'Plano para ajuste',days:[1],subtitle:'',origin:'usuario',version:1,exercises:[exercise('a','Exercício A','pair'),exercise('b','Exercício B','pair'),exercise('c','Exercício C')]}];
 await isolatedAccount(page,state);await page.getByRole('button',{name:'Treinos',exact:true}).click();await page.getByRole('button',{name:'Editar Plano para ajuste',exact:true}).click();
 const modal=page.getByRole('dialog',{name:'Revisar plano',exact:true});
 for(const name of ['Exercício A','Exercício C','Exercício B']){
  const button=modal.getByRole('button',{name:`Ajustar ${name}`,exact:true});await button.click();
  await expect(modal.locator('.plan-inline-editor')).toHaveCount(1);
  await expect(modal.getByRole('region',{name:`Ajuste de ${name}`,exact:true})).toBeVisible();
  expect(await button.evaluate(el=>el.parentElement?.nextElementSibling?.classList.contains('plan-inline-editor'))).toBe(true);
  await expect(button).toHaveAttribute('aria-expanded','true');
  const layout=await modal.evaluate(el=>{const group=el.querySelector('.plan-superset-card')!,bar=group.querySelector('.plan-superset-bar')!,items=group.querySelector('.plan-superset-items')!,editor=el.querySelector('.plan-inline-editor')!,form=editor.querySelector('form')!;return {stacked:items.getBoundingClientRect().top>=bar.getBoundingClientRect().bottom,overflow:el.scrollWidth>el.clientWidth,editorOverflow:editor.scrollWidth>editor.clientWidth,formInside:form.getBoundingClientRect().left>=editor.getBoundingClientRect().left&&form.getBoundingClientRect().right<=editor.getBoundingClientRect().right};});
  expect(layout).toEqual({stacked:true,overflow:false,editorOverflow:false,formInside:true});
  if(name==='Exercício A')await page.screenshot({path:`test-results/${test.info().project.name}-inline-mobile.png`,fullPage:true});
 }
 const editor=modal.getByRole('region',{name:'Ajuste de Exercício B',exact:true});
 await editor.getByLabel('Carga (kg)',{exact:true}).fill('25');await editor.getByRole('button',{name:'Aplicar ajuste',exact:true}).click();await expect(modal.locator('.plan-inline-editor')).toHaveCount(0);
 await modal.getByRole('button',{name:'Salvar plano',exact:true}).click();
 const saved=await page.evaluate(uid=>JSON.parse(localStorage.getItem(`ritmo-${uid}-v1`)!),testUid);expect(saved.plans[0].exercises[1].load).toBe(25);
 await page.setViewportSize({width:1280,height:900});await page.getByRole('button',{name:'Editar Plano para ajuste',exact:true}).click();await page.getByRole('button',{name:'Ajustar Exercício C',exact:true}).click();await page.screenshot({path:`test-results/${test.info().project.name}-inline-desktop.png`,fullPage:true});
 expect(await modal.evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(false);
});

test('iPhone challenge, clean Home, useful Diary and persistent account-scoped collapse',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 const state=emptyState();await isolatedAccount(page,state);
 await expect(page.getByRole('heading',{name:'Seu dia, com contexto'})).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'Sua conta, seus registros'})).toHaveCount(0);
 await page.getByRole('button',{name:'Começar meu desafio'}).click();
 const modal=page.getByRole('dialog',{name:'Começar meu desafio'});
 const start=await page.evaluate(()=>{const d=new Date();d.setDate(d.getDate()-3);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;});
 await modal.getByLabel('Data de início',{exact:true}).fill(start);
 await modal.getByRole('button',{name:'Salvar desafio'}).click();
 await expect(page.getByLabel('Dia 4 de 60',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
 await page.screenshot({path:`test-results/${test.info().project.name}-challenge.png`,fullPage:true});
 const week=page.getByRole('button',{name:/Sua semana em um olhar/});await expect(week).toHaveAttribute('aria-expanded','false');await week.click();await expect(week).toHaveAttribute('aria-expanded','true');await page.reload();await expect(page.getByLabel('Dia 4 de 60',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:/Sua semana em um olhar/})).toHaveAttribute('aria-expanded','true');
 await page.getByRole('button',{name:'Diário',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Resumo do dia'})).toBeVisible();
 await page.getByRole('checkbox',{name:/Terminei de conferir os registros deste dia/}).check();
 await expect(page.getByText('Você marcou os registros deste dia como revisados.')).toBeVisible();
 const calendar=page.getByRole('button',{name:/Calendário do mês/});await expect(calendar).toHaveAttribute('aria-expanded','false');await calendar.click();await expect(page.getByRole('button',{name:'Mês anterior'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
 await page.screenshot({path:`test-results/${test.info().project.name}-diary.png`,fullPage:true});
 await page.getByRole('button',{name:'Perfil',exact:true}).click();const recovery=page.getByRole('button',{name:/Conta, recuperação e backup/});await expect(recovery).toHaveAttribute('aria-expanded','false');await recovery.click();await expect(page.getByRole('heading',{name:'Sua conta, seus registros'})).toBeVisible();
 const saved=await page.evaluate(uid=>JSON.parse(localStorage.getItem(`ritmo-${uid}-v1`)!),testUid);expect(saved.profile.season.days).toBe(60);expect(saved.ownerUid).toBe(testUid);expect(errors).toEqual([]);
});

test('Diary exposes real food, completed sets, body details and weekly context',async({page})=>{
 const state=emptyState();const d=new Date();const date=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
 state.meals=[{id:'meal',date,time:'12:30',name:'Almoço de teste',method:'manual',items:[ingredient(foods[0],100)],notes:'',updatedAt:new Date().toISOString()}];
 const plan:Plan={id:'p',name:'Treino de teste',days:[1],subtitle:'',origin:'usuario',version:1,exercises:[{id:'ex',name:'Supino de teste',muscle:'Peito',sets:2,reps:12,load:20,rest:60,origin:'usuario'}]};state.plans=[plan];const session=createSession(plan,date);session.exercises[0].logs[1].done=true;session.finishedAt=new Date().toISOString();state.sessions=[session];state.water[date]=500;
 await isolatedAccount(page,state);await page.getByRole('button',{name:'Diário',exact:true}).click();
 await expect(page.getByText('Almoço de teste',{exact:true})).toBeVisible();await page.getByText('Exercícios, séries e cargas',{exact:true}).click();await expect(page.getByText('Supino de teste',{exact:false})).toBeVisible();await expect(page.getByText('2: 20 kg × 12 reps',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Treino',exact:true}).click();await expect(page.getByText('Almoço de teste',{exact:true})).toHaveCount(0);await expect(page.getByText('Treino de teste',{exact:true})).toBeVisible();
});

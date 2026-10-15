import { test, expect, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Isolated test browser, never the user's signed-in browser or Firebase account.
  await page.addInitScript(() => localStorage.setItem('ritmo_onboarding_completed', 'true'));
  await page.route('https://**/*', route => route.abort());
});

async function createDuo(page: Page) {
  await page.goto('/#workouts');
  await expect(page.getByRole('heading', { name: 'Seu esforço, em perspectiva' })).toBeVisible();
  await page.getByRole('button', { name: 'Novo plano', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Criar plano de treino' });
  await modal.getByPlaceholder('Treino A · Membros inferiores').fill('Teste isolado · Dupla');
  await modal.getByRole('combobox', { name: 'Exercício', exact: true }).fill('supino');
  await modal.getByRole('option', { name: /Supino Reto com Barra/ }).click();
  await expect(modal.locator('input[name="load"]')).toHaveValue('');
  await modal.getByRole('checkbox', { name: /Exercício duplo/ }).check();
  await modal.getByRole('combobox', { name: 'Segundo exercício da dupla', exact: true }).fill('rosca direta');
  await modal.getByRole('option', { name: /Rosca Direta com Barra W/ }).click();
  await modal.getByRole('button', { name: 'Adicionar dupla' }).click();
  await modal.getByRole('button', { name: 'Salvar plano' }).click();
  await expect(modal).toBeHidden();
  await page.getByRole('button', { name: 'Iniciar sessão', exact: true }).click();
}

test('manual catalogue, bi-set, frictionless numbers, rest, reload and progression', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await createDuo(page);
  const load = page.getByRole('textbox', { name: 'Supino Reto com Barra, série 1, carga', exact: true });
  const reps = page.getByRole('textbox', { name: 'Supino Reto com Barra, série 1, repetições', exact: true });
  await expect(load).toHaveValue('');
  await expect(load).toHaveAttribute('placeholder', '0');
  await expect(load).toHaveCSS('font-size', '16px');
  const beforeTyping = await page.evaluate(() => localStorage.getItem('ritmo-local-v1'));
  await load.fill('22,5');
  expect(await page.evaluate(() => localStorage.getItem('ritmo-local-v1'))).toBe(beforeTyping);
  await reps.fill('');
  await expect(reps).toHaveValue('');
  await reps.pressSequentially('12');
  await expect(reps).toHaveValue('12');
  await page.getByRole('button', { name: 'Concluir série 1 de Supino Reto com Barra', exact: true }).click();
  await expect(page.getByRole('timer')).toHaveCount(0);
  await page.getByRole('button', { name: 'Concluir série 1 de Rosca Direta com Barra W', exact: true }).click();
  await expect(page.getByRole('timer')).toBeVisible();
  const timerText = await page.getByRole('timer').locator('strong').innerText();
  const nextLoad = page.getByRole('textbox', { name: 'Supino Reto com Barra, série 2, carga', exact: true });
  await nextLoad.fill('35');
  await expect.poll(() => page.getByRole('timer').locator('strong').innerText()).not.toBe(timerText);
  await expect(nextLoad).toHaveValue('35');
  await page.getByRole('button', { name: 'Encerrar descanso', exact: true }).click();
  await page.screenshot({ path: `test-results/${test.info().project.name}-training.png`, fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  await page.reload();
  await page.getByRole('button', { name: 'Ver rodada 1 da dupla' }).click();
  await expect(page.getByRole('textbox', { name: 'Supino Reto com Barra, série 1, carga', exact: true })).toHaveValue('22.5');
  await expect(page.getByRole('textbox', { name: 'Supino Reto com Barra, série 1, repetições', exact: true })).toHaveValue('12');
  await page.getByRole('button', { name: 'Finalizar treino' }).click();
  await expect(page.getByRole('heading', { name: 'Seu esforço, em perspectiva' })).toBeVisible();
  await expect(page.getByText('22,5 kg × 12', { exact: true })).toBeVisible();
  await page.screenshot({ path: `test-results/${test.info().project.name}-dashboard.png`, fullPage: true });
  await page.getByRole('button', { name: 'Editar Teste isolado · Dupla' }).click();
  await page.getByRole('button', { name: 'Ajustar Supino Reto com Barra' }).click();
  const editor = page.locator('form').filter({ has: page.getByRole('heading', { name: 'Ajustar exercício' }) });
  await editor.getByLabel('Carga (kg)', { exact: true }).fill('25');
  await editor.getByRole('button', { name: 'Aplicar ajuste' }).click();
  await page.getByRole('button', { name: 'Salvar plano' }).click();
  // Editing the plan must never rewrite the historical workout.
  await expect(page.getByText('22,5 kg × 12', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('daily review uses actual logs and marks changed data as stale (provider mocked)', async ({ page }) => {
  await createDuo(page);
  await page.getByRole('button', { name: 'Concluir série 1 de Supino Reto com Barra', exact: true }).click();
  await page.getByRole('button', { name: 'Finalizar treino' }).click();
  let summary = '';
  await page.route('**/v1/systemone', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await page.route('https://generativelanguage.googleapis.com/**', async route => {
    summary = route.request().postDataJSON().contents[0].parts[0].text;
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ title: 'Revisão simulada para teste', body: 'Seu treino foi registrado. Este conteúdo testa o fluxo, não o provedor real.' }) }] } }] }) });
  });
  await page.goto('/#home');
  await page.getByRole('button', { name: 'Avaliar meu dia com IA' }).click();
  await expect(page.getByRole('heading', { name: 'Revisão simulada para teste' })).toBeVisible();
  expect(summary).toContain('Supino Reto com Barra');
  expect(summary).toContain('waterMl');
  expect(summary).toContain('exerciseProgress');
  expect(summary).toContain('reviewed');
  // Change a daily log without navigating away from the generated review.
  await page.getByRole('button', { name: 'Adicionar 250 ml de água' }).click();
  await expect(page.getByText('Seus registros mudaram. Atualize a revisão para considerar os novos dados.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Revisão simulada para teste' })).toBeHidden();
});

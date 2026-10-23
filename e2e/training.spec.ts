import { test, expect, type Page } from '@playwright/test';
import { isolatedAccount } from './isolatedAccount';

test.beforeEach(async ({ page }) => {
  await isolatedAccount(page);
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
  const beforeTyping = await page.evaluate(() => localStorage.getItem('ritmo-ritmo-isolated-test-v1'));
  await load.fill('22,5');
  expect(await page.evaluate(() => localStorage.getItem('ritmo-ritmo-isolated-test-v1'))).toBe(beforeTyping);
  await reps.fill('');
  await expect(reps).toHaveValue('');
  await reps.pressSequentially('12');
  await expect(reps).toHaveValue('12');
  await page.getByRole('button', { name: 'Concluir série 1 de Supino Reto com Barra', exact: true }).click();
  await expect(page.getByRole('timer')).toHaveCount(0);
  await page.getByRole('button', { name: 'Concluir série 1 de Rosca Direta com Barra W', exact: true }).click();
  await expect(page.getByRole('timer')).toBeVisible();
  const timerText = await page.getByRole('timer').locator('.timer-dial strong').innerText();
  const nextLoad = page.getByRole('textbox', { name: 'Supino Reto com Barra, série 2, carga', exact: true });
  await nextLoad.fill('35');
  await expect.poll(() => page.getByRole('timer').locator('.timer-dial strong').innerText()).not.toBe(timerText);
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

test('replacement is mobile-friendly, accepts comma loads and preserves the original plan', async ({ page }) => {
  await createDuo(page);
  await page.getByRole('button', { name: 'Substituir exercício Supino Reto com Barra', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Substituir exercício', exact: true });
  await modal.getByRole('combobox', { name: 'Novo exercício', exact: true }).fill('Crucifixo Reto');
  await modal.getByRole('option', { name: /Crucifixo Reto com Halteres/ }).first().click();
  await modal.getByLabel('Carga inicial (kg)', { exact: true }).fill('22,5');
  await modal.getByLabel('Repetições', { exact: true }).fill('12');
  await modal.getByRole('button', { name: 'Tempo curto', exact: true }).click();
  await expect(modal.getByRole('button', { name: 'Tempo curto', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.screenshot({ path: `test-results/${test.info().project.name}-replacement.png`, fullPage: true });
  await modal.getByRole('button', { name: 'Confirmar substituição', exact: true }).click();
  await expect(modal).toBeHidden();
  await expect(page.getByRole('textbox', { name: 'Crucifixo Reto com Halteres, série 1, carga', exact: true })).toHaveValue('22.5');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('ritmo-ritmo-isolated-test-v1')!));
  expect(saved.plans[0].exercises[0].name).toBe('Supino Reto com Barra');
  expect(saved.sessions[0].exercises[0].name).toBe('Crucifixo Reto com Halteres');
});

test('completed workouts are available in the new Diary without generating an AI review', async ({ page }) => {
  await createDuo(page);
  await page.getByRole('button', { name: 'Concluir série 1 de Supino Reto com Barra', exact: true }).click();
  await page.getByRole('button', { name: 'Finalizar treino' }).click();
  await page.goto('/#home');
  await expect(page.getByRole('button', { name: 'Avaliar meu dia com IA' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Adicionar 250 ml de água' }).click();
  await page.getByRole('button', { name: 'Diário', exact: true }).click();
  await expect(page.getByText('Teste isolado · Dupla', { exact: true })).toBeVisible();
  await page.getByText('Exercícios, séries e cargas', { exact: true }).click();
  await expect(page.getByText('Supino Reto com Barra', { exact: false })).toBeVisible();
  await expect(page.getByText('0,25 L · total do dia', { exact: true })).toBeVisible();
});

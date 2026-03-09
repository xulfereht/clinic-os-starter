import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, request as playwrightRequest, test as setup } from '@playwright/test';
import { E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD } from '../../scripts/lib/e2e-admin-config.js';

const authFile = path.join(process.cwd(), 'tests/e2e/.auth/admin.json');

setup('관리자 세션 생성', async ({ baseURL }) => {
  await fs.mkdir(path.dirname(authFile), { recursive: true });

  const request = await playwrightRequest.newContext({ baseURL });
  const response = await request.post('/api/auth/admin-login', {
    data: {
      email: E2E_ADMIN_EMAIL,
      password: E2E_ADMIN_PASSWORD,
    },
  });

  expect(response.ok()).toBeTruthy();

  const payload = await response.json();
  expect(payload.success).toBeTruthy();

  await request.storageState({ path: authFile });
  await request.dispose();
});

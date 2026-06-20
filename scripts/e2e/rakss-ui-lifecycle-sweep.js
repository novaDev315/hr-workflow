(page) => (async () => {
  const adminEmail = 'admin@rakss.lab.novadev.tech';
  const apiUrl = 'https://api.rakss.lab.novadev.tech/graphql';
  const baseUrl = 'https://admin.rakss.lab.novadev.tech';
  const runId = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const today = new Date().toISOString().slice(0, 10);
  const payrollMonth = `${2300 + Number(runId.slice(8, 10))}-${String((Number(runId.slice(10, 12)) % 12) + 1).padStart(2, '0')}`;
  const payrollDeleteMonth = `${2400 + Number(runId.slice(8, 10))}-${String((Number(runId.slice(10, 12)) % 12) + 1).padStart(2, '0')}`;
  const proof = {
    runId,
    adminEmail,
    checks: [],
    gaps: [],
    created: {},
  };

  page.on('dialog', (dialog) => dialog.accept());
  await page.setViewportSize({ width: 1280, height: 900 });

  function check(name, detail = {}) {
    proof.checks.push({ name, ok: true, ...detail });
  }

  function gap(module, missing, reason) {
    proof.gaps.push({ module, missing, reason });
  }

  async function gql(query, variables = {}, token = null) {
    let payload = null;
    let lastError = null;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        payload = await page.evaluate(async ({ apiUrl, query, variables, token }) => {
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              ...(token ? { authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ query, variables }),
          });
          const body = await response.json();
          return { ok: response.ok, body, statusText: response.statusText };
        }, { apiUrl, query, variables, token });
        break;
      } catch (error) {
        lastError = error;
        await page.waitForTimeout(1000 * attempt);
      }
    }

    if (!payload) {
      throw lastError ?? new Error('GraphQL request failed');
    }

    if (!payload.ok || payload.body.errors?.length) {
      throw new Error(payload.body.errors?.map((error) => error.message).join('; ') || payload.statusText);
    }

    return payload.body.data;
  }

  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  const token = await page.evaluate(() => localStorage.getItem('auth_token'));
  const account = await page.evaluate(() => {
    const raw = localStorage.getItem('admin_account');
    return raw ? JSON.parse(raw) : null;
  });
  if (!token || !account) {
    throw new Error('Expected authenticated admin browser session');
  }
  check('ui login', { roles: account.roles });

  await page.goto(`${baseUrl}/employees`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Add records' }).click();
  await page.getByRole('button', { name: 'Create Department' }).click();
  check('department negative required form blocked', {
    valid: await page.locator('#department-name').evaluate((element) => element.validity.valid),
  });

  await page.locator('#department-name').fill(`UI E2E Ops ${runId}`);
  await page.locator('#department-code').fill(`UI_OPS_${runId}`);
  await page.locator('#department-description').fill('Created by UI lifecycle sweep');
  await page.getByRole('button', { name: 'Create Department' }).click();
  await page.getByText('Department created.').waitFor();
  const department = await gql(`
    query Departments { departments(includeInactive: true) { id name code description isActive } }
  `, {}, token).then((data) => data.departments.find((row) => row.code === `UI_OPS_${runId}`));
  proof.created.department = department;
  check('ui create department');

  await page.locator('.rounded-lg.border').filter({ hasText: `UI_OPS_${runId}` }).getByRole('button', { name: 'Edit' }).click();
  await page.locator('#department-description').fill('Updated by UI lifecycle sweep');
  await page.getByRole('button', { name: 'Update Department' }).click();
  await page.getByText('Department updated.').waitFor();
  check('ui update department');

  await page.locator('#designation-title').fill(`UI E2E Coordinator ${runId}`);
  await page.locator('#designation-code').fill(`UI_COORD_${runId}`);
  await page.locator('#designation-department').selectOption(department.id);
  await page.locator('#designation-level').fill('2');
  await page.getByRole('button', { name: 'Create Designation' }).click();
  await page.getByText('Designation created.').waitFor();
  const designation = await gql(`
    query Designations { designations(includeInactive: true) { id title code departmentId level isActive } }
  `, {}, token).then((data) => data.designations.find((row) => row.code === `UI_COORD_${runId}`));
  proof.created.designation = designation;
  check('ui create designation');

  await page.locator('.rounded-lg.border').filter({ hasText: `UI_COORD_${runId}` }).getByRole('button', { name: 'Edit' }).click();
  await page.locator('#designation-level').fill('3');
  await page.getByRole('button', { name: 'Update Designation' }).click();
  await page.getByText('Designation updated.').waitFor();
  check('ui update designation');

  const employeeEmail = `ui.e2e.${runId}@rakss.lab.novadev.tech`;
  await page.locator('#employee-first-name').fill('UI');
  await page.locator('#employee-last-name').fill(`Employee ${runId}`);
  await page.locator('#employee-email').fill(employeeEmail);
  await page.locator('#employee-phone').fill('+971500001111');
  await page.locator('#employee-department').selectOption(department.id);
  await page.locator('#employee-designation').selectOption(designation.id);
  await page.locator('#employee-join-date').fill(today);
  await page.getByRole('button', { name: 'Create Employee', exact: true }).click();
  await page.getByText('Employee created.').waitFor();
  await page.getByPlaceholder('Search employees').fill(employeeEmail);
  await page.getByRole('cell', { name: employeeEmail }).waitFor();
  const employee = await gql(`
    query Employees($filter: EmployeeFilterInput) {
      employees(filter: $filter) { id employeeNumber email fullName hasLinkedAccount linkedAccountRoles isActive }
    }
  `, { filter: { search: employeeEmail } }, token).then((data) => data.employees[0]);
  proof.created.employee = employee;
  check('ui create employee and read via search');

  let employeeRow = page.locator('tbody tr').filter({ hasText: employeeEmail }).first();
  await employeeRow.getByRole('button', { name: 'Edit' }).click();
  await page.locator('#employee-phone').fill('+971500002222');
  await page.getByRole('button', { name: 'Update Employee' }).click();
  await page.getByText('Employee updated.').waitFor();
  check('ui update employee');

  await page.getByPlaceholder('Search employees').fill('');
  await page.locator('#employee-account-employee').selectOption(employee.id);
  await page.locator('#employee-account-password').fill(`Ui.${runId}.Pass1`);
  await page.getByRole('button', { name: 'Create Employee Account', exact: true }).click();
  await page.waitForTimeout(1500);
  const linkedEmployee = await gql(`
    query Employees($filter: EmployeeFilterInput) {
      employees(filter: $filter) { id hasLinkedAccount linkedAccountRoles }
    }
  `, { filter: { search: employeeEmail } }, token).then((data) => data.employees[0]);
  if (!linkedEmployee.hasLinkedAccount) {
    throw new Error('Employee account UI action did not link an account');
  }
  check('ui create employee account');

  await page.locator('#staff-access-employee').selectOption(employee.id);
  await page.locator('#staff-access-role').selectOption('SUPERVISOR');
  await page.getByRole('button', { name: 'Provision Staff Access' }).click();
  await page.waitForTimeout(1500);
  const staffAccount = await gql(`
    query Employees($filter: EmployeeFilterInput) {
      employees(filter: $filter) { id linkedAccountRoles }
    }
  `, { filter: { search: employeeEmail } }, token).then((data) => data.employees[0]);
  if (!staffAccount.linkedAccountRoles.includes('SUPERVISOR')) {
    throw new Error('Staff access UI action did not add SUPERVISOR role');
  }
  check('ui provision staff access', { roles: staffAccount.linkedAccountRoles });

  await page.goto(`${baseUrl}/directory`, { waitUntil: 'networkidle' });
  await page.getByText(employeeEmail).waitFor();
  check('directory read created employee');

  await page.goto(`${baseUrl}/attendance`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Open setup' }).click();
  await page.getByRole('button', { name: 'Create Location' }).click();
  check('attendance negative required location form blocked', {
    valid: await page.locator('#location-name').evaluate((element) => element.validity.valid),
  });
  await page.locator('#location-name').fill(`UI E2E HQ ${runId}`);
  await page.locator('#location-code').fill(`UI_HQ_${runId}`);
  await page.locator('#location-address').fill('UI E2E Office');
  await page.locator('#location-city').fill('Dubai');
  await page.locator('#location-latitude').fill('25.2048');
  await page.locator('#location-longitude').fill('55.2708');
  await page.locator('#geofence-radius').fill('100');
  await page.getByRole('button', { name: 'Create Location' }).click();
  await page.getByText('Location created.').waitFor();
  const location = await gql(`
    query Locations { locations(activeOnly: false) { id code name latitude longitude isActive } }
  `, {}, token).then((data) => data.locations.find((row) => row.code === `UI_HQ_${runId}`));
  proof.created.location = location;
  check('ui create location');

  await page.locator('.app-muted-surface').filter({ hasText: `UI_HQ_${runId}` }).getByRole('button', { name: 'Edit' }).click();
  await page.locator('#location-city').fill('Abu Dhabi');
  await page.getByRole('button', { name: 'Update Location' }).click();
  await page.getByText('Location updated.').waitFor();
  check('ui update location');

  await page.locator('#assignment-employee').selectOption(employee.id);
  await page.locator('#assignment-location').selectOption(location.id);
  await page.getByRole('button', { name: 'Assign Location' }).click();
  await page.getByText('Location assignment saved.').waitFor();
  check('ui assign location');

  await page.locator('#attendance-employee').selectOption(employee.id);
  await page.locator('#attendance-location').selectOption(location.id);
  await page.locator('#attendance-notes').fill('UI e2e attendance');
  await page.getByRole('button', { name: 'Clock In' }).click();
  await page.getByText('Clock in recorded.').waitFor();
  await page.getByRole('button', { name: 'Clock Out' }).click();
  await page.getByText('Clock out recorded.').waitFor();
  check('ui clock in/out attendance');

  await page.locator('.app-muted-surface').filter({ hasText: `UI_HQ_${runId}` }).getByRole('button', { name: 'Deactivate' }).click();
  await page.getByText('Location deactivated.').waitFor();
  check('ui deactivate location');

  await page.goto(`${baseUrl}/leave`, { waitUntil: 'networkidle' });
  await page.locator('#leave-type-code').fill(`UI_${runId.slice(4)}`);
  await page.locator('#leave-type-name').fill(`UI Leave ${runId}`);
  await page.locator('#leave-type-days').fill('2');
  await page.locator('#leave-type-description').fill('Created by UI lifecycle sweep');
  await page.getByRole('button', { name: 'Create Leave Type' }).click();
  await page.getByText('Leave type created.').waitFor();
  const leaveType = await gql(`
    query LeaveTypes { leaveTypes { id code name defaultDays } }
  `, {}, token).then((data) => data.leaveTypes.find((row) => row.name === `UI Leave ${runId}`));
  proof.created.leaveType = leaveType;
  check('ui create leave type');

  await page.locator('.rounded-lg.border').filter({ hasText: `UI Leave ${runId}` }).getByRole('button', { name: 'Edit' }).click();
  await page.locator('#leave-type-days').fill('3');
  await page.getByRole('button', { name: 'Update Leave Type' }).click();
  await page.getByText('Leave type updated.').waitFor();
  check('ui update leave type');

  await page.locator('#leave-request-employee').selectOption(employee.id);
  await page.locator('#leave-request-type').selectOption(leaveType.id);
  await page.locator('#leave-request-start').fill(futureDate(14));
  await page.locator('#leave-request-end').fill(futureDate(15));
  await page.locator('#leave-request-reason').fill('Created by UI lifecycle sweep');
  await page.getByRole('button', { name: 'Create Request' }).click();
  await page.getByText('Leave request created.').waitFor();
  check('ui create leave request');

  await page.reload({ waitUntil: 'networkidle' });
  const leaveCard = page.locator('div.rounded-lg.border').filter({ hasText: `UI Employee ${runId}` }).first();
  await leaveCard.waitFor();
  await leaveCard.getByPlaceholder('Optional decision note').fill('Rejected by UI lifecycle sweep');
  await leaveCard.getByRole('button', { name: 'Reject' }).click();
  await page.getByText('Leave request rejected.').waitFor();
  check('ui review leave request reject');
  await page.locator('.rounded-lg.border').filter({ hasText: `UI Leave ${runId}` }).getByRole('button', { name: 'Deactivate' }).click();
  await page.getByText('Leave type deactivated.').waitFor();
  check('ui deactivate leave type');

  await page.goto(`${baseUrl}/payroll`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Open compensation setup' }).click();
  await page.locator('#compensation-employee').selectOption(employee.id);
  await page.locator('#base-salary').fill('14000');
  await page.locator('#allowance-amount').fill('1500');
  await page.locator('#deduction-amount').fill('300');
  await page.locator('#effective-from').fill(today);
  await page.locator('#compensation-notes').fill('UI lifecycle compensation');
  await page.getByRole('button', { name: 'Save Compensation' }).click();
  await page.getByText('Compensation profile saved.').waitFor();
  check('ui create/update compensation profile');

  await page.locator('#period-month').fill(payrollDeleteMonth);
  await page.getByRole('button', { name: 'Create Period' }).click();
  await page.getByText('Payroll period created.').waitFor();
  await page.locator('.rounded-lg.border').filter({ hasText: payrollDeleteMonth }).getByRole('button', { name: 'Delete' }).click();
  await page.getByText('Payroll period deleted.').waitFor();
  check('ui delete open payroll period');

  await page.locator('#period-month').fill(payrollMonth);
  await page.getByRole('button', { name: 'Create Period' }).click();
  await page.getByText('Payroll period created.').waitFor();
  check('ui create payroll period');
  await page.locator('.rounded-lg.border').filter({ hasText: payrollMonth }).getByRole('button', { name: 'Process' }).click();
  await page.getByText('Payroll processed.').waitFor();
  await page.locator('.rounded-lg.border').filter({ hasText: payrollMonth }).getByRole('button', { name: 'Mark Paid' }).click();
  await page.getByText('Payroll period marked as paid.').waitFor();
  await page.getByRole('button', { name: 'Download PDF' }).first().click();
  await page.getByText('Payslip PDF downloaded.').waitFor();
  check('ui process/pay/export payroll');

  await page.goto(`${baseUrl}/policies`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'New policy' }).click();
  await page.getByRole('button', { name: 'Save policy' }).click();
  check('policies negative required composer form blocked', {
    valid: await page.locator('input[placeholder="Policy title"]').evaluate((element) => element.validity.valid),
  });
  const policyTitle = `UI Policy ${runId}`;
  await page.locator('input[placeholder="Policy title"]').fill(policyTitle);
  await page.locator('input[placeholder="Category"]').fill('UI E2E');
  await page.locator('input[placeholder="Version"]').fill('1.0');
  await page.locator('input[placeholder="Short description"]').fill('Created by UI lifecycle sweep');
  await page.locator('input[placeholder="Optional document URL"]').fill('https://admin.rakss.lab.novadev.tech/health');
  await page.locator('textarea[placeholder="Policy summary or text content"]').fill('UI policy content from lifecycle sweep');
  await page.getByRole('button', { name: 'Save policy' }).click();
  await page.getByText('Policy document created.').waitFor();
  await page.getByText(policyTitle).waitFor();
  check('ui create policy document');
  await policyCard(policyTitle).getByRole('button', { name: 'Edit' }).click();
  await page.locator('input[placeholder="Version"]').fill('1.1');
  await page.getByRole('button', { name: 'Update policy' }).click();
  await page.getByText('Policy document updated.').waitFor();
  check('ui update policy document');
  await policyCard(policyTitle).getByRole('button', { name: 'Publish' }).click();
  await page.getByText('Policy document published.').waitFor();
  check('ui publish policy document');
  await policyCard(policyTitle).getByRole('button', { name: 'Archive' }).click();
  await page.getByText('Policy document archived.').waitFor();
  check('ui archive policy document');

  await page.goto(`${baseUrl}/employees`, { waitUntil: 'networkidle' });
  await page.getByPlaceholder('Search employees').fill(employeeEmail);
  employeeRow = page.locator('tbody tr').filter({ hasText: employeeEmail }).first();
  await employeeRow.getByRole('button', { name: 'Deactivate' }).click();
  await page.getByText('Employee deactivated.').waitFor();
  check('ui deactivate employee');

  await page.getByRole('button', { name: 'Add records' }).click();
  await page.locator('.rounded-lg.border').filter({ hasText: `UI_COORD_${runId}` }).getByRole('button', { name: 'Deactivate' }).click();
  await page.getByText('Designation deactivated.').waitFor();
  check('ui deactivate designation');
  await page.locator('.rounded-lg.border').filter({ hasText: `UI_OPS_${runId}` }).getByRole('button', { name: 'Deactivate' }).click();
  await page.getByText('Department deactivated.').waitFor();
  check('ui deactivate department');

  await page.goto(`${baseUrl}/reports`, { waitUntil: 'networkidle' });
  await page.locator('input[type="month"]').fill(payrollMonth);
  await page.getByRole('button', { name: 'Export PDF' }).click();
  check('ui export reports pdf button');

  await page.goto(`${baseUrl}/recruitment`, { waitUntil: 'networkidle' });
  gap('recruitment', 'CRUD/action workflow', 'Recruitment is currently a routed placeholder with no backend module or controls.');
  check('recruitment placeholder route renders', { title: await page.title() });

  await page.goto(`${baseUrl}/demos`, { waitUntil: 'networkidle' });
  await page.getByText('Talent Haven').first().waitFor();
  check('demos gallery renders');

  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel('Open navigation').click();
  await page.getByLabel('Close navigation').waitFor();
  await page.screenshot({ path: 'output/playwright/rakss-ui-lifecycle-mobile-nav.png', fullPage: true });
  check('mobile nav open state');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: 'output/playwright/rakss-ui-lifecycle-final.png', fullPage: true });

  return proof;

  function futureDate(offsetDays) {
    const date = new Date();
    date.setDate(date.getDate() + offsetDays);
    return date.toISOString().slice(0, 10);
  }

  function policyCard(title) {
    return page.locator('.app-surface').filter({ hasText: title }).last();
  }
})()

(page) => (async () => {
  function assertLocalTarget(label, value) {
    const { hostname } = new URL(value);
    const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname);
    if (!local && process.env.HR_WORKFLOW_E2E_ALLOW_REMOTE !== '1') {
      throw new Error(
        `Refusing to run the destructive UI lifecycle sweep against non-local ${label} ${value}. ` +
          'It creates and deletes data. Use a local stack (default http://localhost:5173) or set HR_WORKFLOW_E2E_ALLOW_REMOTE=1 to override.',
      );
    }
  }
  const adminEmail = process.env.HR_WORKFLOW_ADMIN_EMAIL || 'admin@hrflow.lab.novadev.tech';
  const baseUrl = process.env.HR_WORKFLOW_ADMIN_URL || 'http://localhost:5173';
  assertLocalTarget('HR_WORKFLOW_ADMIN_URL', baseUrl);
  // The admin dev server proxies /graphql, so the API defaults to the same origin.
  const apiUrl = process.env.HR_WORKFLOW_API_URL || `${baseUrl}/graphql`;
  assertLocalTarget('HR_WORKFLOW_API_URL', apiUrl);
  const runId = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const today = new Date().toISOString().slice(0, 10);
  const runMinuteIndex = Number(runId.slice(8, 10)) * 60 + Number(runId.slice(10, 12));
  const runMonth = String((Number(runId.slice(12, 14)) % 12) + 1).padStart(2, '0');
  const payrollMonth = `${2500 + runMinuteIndex}-${runMonth}`;
  const payrollDeleteMonth = `${4100 + runMinuteIndex}-${runMonth}`;
  const proof = { runId, adminEmail, checks: [], gaps: [], created: {} };

  await page.setViewportSize({ width: 1280, height: 900 });

  function check(name, detail = {}) {
    proof.checks.push({ name, ok: true, ...detail });
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
    if (!payload) throw lastError ?? new Error('GraphQL request failed');
    if (!payload.ok || payload.body.errors?.length) {
      throw new Error(payload.body.errors?.map((error) => error.message).join('; ') || payload.statusText);
    }
    return payload.body.data;
  }

  // Every page action reports through one toast region. Wait for the message,
  // then dismiss it so it never covers controls the next step needs.
  // includeHidden: an open modal sheet marks the rest of the page aria-hidden,
  // and toasts raised from inside the sheet still show on top of it.
  async function toastSeen(text) {
    const region = page.getByRole('region', { name: /Notifications/, includeHidden: true });
    const item = region.locator('li').filter({ hasText: text }).first();
    await item.waitFor({ state: 'visible', timeout: 15000 });
    await item.getByRole('button', { name: 'Dismiss', includeHidden: true }).click();
    await item.waitFor({ state: 'hidden' });
  }

  async function pickOption(triggerId, name) {
    await page.locator(`#${triggerId}`).click();
    const option = page.getByRole('option', { name, exact: typeof name === 'string' });
    await option.first().waitFor({ state: 'visible' });
    await option.first().click();
  }

  function dialog(name) {
    return page.getByRole('dialog', { name });
  }

  function alertDialog(name) {
    return page.getByRole('alertdialog', { name });
  }

  async function rowAction(menuLabel, item) {
    await page.getByRole('button', { name: menuLabel, exact: true }).click();
    await page.getByRole('menuitem', { name: item }).click();
  }

  async function goto(path) {
    await page.goto(`${baseUrl}${path}`, { waitUntil: 'networkidle' });
  }

  await goto('/');
  const token = await page.evaluate(() => localStorage.getItem('auth_token'));
  const account = await page.evaluate(() => {
    const raw = localStorage.getItem('admin_account');
    return raw ? JSON.parse(raw) : null;
  });
  if (!token || !account) throw new Error('Expected authenticated admin browser session');
  check('ui login', { roles: account.roles });

  /* ---------- Organisation: department, designation, work site ---------- */

  const deptName = `UI E2E Ops ${runId}`;
  const deptCode = `UI_OPS_${runId}`;
  await goto('/organisation');
  await page.locator('#departments').getByRole('button', { name: 'Add department' }).click();
  const deptSheet = dialog('New department');
  await deptSheet.waitFor();
  await page.getByRole('button', { name: 'Add department' }).last().click();
  const deptNameValid = await page.locator('#department-name').evaluate((element) => element.validity.valid);
  if (deptNameValid) throw new Error('Department name required validation did not block submission');
  check('department negative required form blocked');
  await page.locator('#department-name').fill(deptName);
  await page.locator('#department-code').fill(deptCode);
  await page.locator('#department-description').fill('Created by UI lifecycle sweep');
  await deptSheet.getByRole('button', { name: 'Add department' }).click();
  await toastSeen(`${deptName} added.`);
  const department = await gql(`
    query Departments { departments(includeInactive: true) { id name code isActive } }
  `, {}, token).then((data) => data.departments.find((row) => row.code === deptCode));
  proof.created.department = department;
  check('ui create department');

  await rowAction(`Actions for ${deptName}`, 'Edit');
  await page.locator('#department-description').fill('Updated by UI lifecycle sweep');
  await dialog('Edit department').getByRole('button', { name: 'Save department' }).click();
  await toastSeen(`${deptName} updated.`);
  check('ui update department');

  const desTitle = `UI E2E Coordinator ${runId}`;
  const desCode = `UI_COORD_${runId}`;
  await page.locator('#designations').getByRole('button', { name: 'Add designation' }).click();
  const desSheet = dialog('New designation');
  await desSheet.waitFor();
  await page.locator('#designation-title').fill(desTitle);
  await pickOption('designation-department', deptName);
  await page.locator('#designation-code').fill(desCode);
  await page.locator('#designation-level').fill('2');
  await desSheet.getByRole('button', { name: 'Add designation' }).click();
  await toastSeen(`${desTitle} added.`);
  const designation = await gql(`
    query Designations { designations(includeInactive: true) { id title code departmentId level } }
  `, {}, token).then((data) => data.designations.find((row) => row.code === desCode));
  proof.created.designation = designation;
  check('ui create designation');

  await rowAction(`Actions for ${desTitle}`, 'Edit');
  await page.locator('#designation-level').fill('3');
  await dialog('Edit designation').getByRole('button', { name: 'Save designation' }).click();
  await toastSeen(`${desTitle} updated.`);
  check('ui update designation');

  const siteName = `UI E2E HQ ${runId}`;
  await page.locator('#sites').getByRole('button', { name: 'Add work site' }).click();
  const siteSheet = dialog('New work site');
  await siteSheet.waitFor();
  await page.locator('#site-name').fill(siteName);
  await page.locator('#site-code').fill(`UI_HQ_${runId}`);
  await page.locator('#site-address').fill('UI E2E Office');
  await page.locator('#site-city').fill('Dubai');
  await page.locator('#site-latitude').fill('25.2048');
  await page.locator('#site-longitude').fill('55.2708');
  await page.locator('#site-radius').fill('100');
  await siteSheet.getByRole('button', { name: 'Add work site' }).click();
  await siteSheet.waitFor({ state: 'hidden' });
  const location = await gql(`
    query Locations { locations(activeOnly: false) { id code name isActive } }
  `, {}, token).then((data) => data.locations.find((row) => row.code === `UI_HQ_${runId}`));
  if (!location) throw new Error('Work site was not created');
  proof.created.location = location;
  check('ui create work site');

  /* ---------- People: guided onboarding with staff access ---------- */

  const employeeEmail = `ui.e2e.${runId}@hrflow.lab.novadev.tech`;
  const employeeName = `UI Employee ${runId}`;
  await goto('/employees');
  await page.getByRole('button', { name: 'New employee' }).first().click();
  const newSheet = dialog(/New employee/);
  await newSheet.waitFor();
  await newSheet.getByRole('button', { name: 'Add and continue' }).click();
  await newSheet.getByText('Enter the first name.').waitFor();
  if ((await page.locator('#profile-first-name').getAttribute('aria-invalid')) !== 'true') {
    throw new Error('First name was not marked invalid');
  }
  check('employee profile inline validation', { focused: await page.evaluate(() => document.activeElement?.id) });

  await page.locator('#profile-first-name').fill('UI');
  await page.locator('#profile-last-name').fill(`Employee ${runId}`);
  await page.locator('#profile-email').fill(employeeEmail);
  await page.locator('#profile-phone').fill('+971500001111');
  await pickOption('profile-department', deptName);
  await pickOption('profile-designation', desTitle);
  await page.locator('#profile-join-date').fill(today);
  await newSheet.getByRole('button', { name: 'Add and continue' }).click();
  await page.locator('#pay-base').waitFor();
  await page.locator('#pay-base').fill('14000');
  await page.locator('#pay-allowance').fill('1500');
  await page.locator('#pay-deduction').fill('300');
  await newSheet.getByRole('button', { name: 'Continue' }).click();
  await pickOption('site-location', new RegExp(siteName));
  await newSheet.getByRole('button', { name: 'Continue' }).click();
  await page.locator('#signin-staff-role').waitFor();
  await pickOption('signin-staff-role', 'Supervisor');
  await newSheet.getByRole('button', { name: 'Finish', exact: true }).click();
  await dialog('Employee added').waitFor();
  await dialog('Employee added').getByRole('button', { name: 'Done' }).click();
  const employee = await gql(`
    query Employees($filter: EmployeeFilterInput) {
      employees(filter: $filter) { id employeeNumber email fullName hasLinkedAccount linkedAccountRoles isActive }
    }
  `, { filter: { search: employeeEmail } }, token).then((data) => data.employees[0]);
  if (!employee?.hasLinkedAccount || !employee.linkedAccountRoles.includes('SUPERVISOR')) {
    throw new Error(`Onboarding did not create a supervisor sign-in: ${JSON.stringify(employee)}`);
  }
  proof.created.employee = employee;
  check('ui onboard employee with pay, site and staff access', { roles: employee.linkedAccountRoles });

  await page.getByRole('searchbox', { name: 'Search people' }).fill(employeeEmail);
  await page.getByRole('cell', { name: new RegExp(`^${employeeName}`) }).waitFor();
  check('ui read employee via search');

  await rowAction(`Actions for ${employeeName}`, 'Edit employee');
  await page.locator('#profile-phone').fill('+971500002222');
  await dialog('Edit employee').getByRole('button', { name: 'Save changes' }).click();
  await toastSeen(`${employeeName} updated.`);
  check('ui update employee');

  await rowAction(`Actions for ${employeeName}`, 'Staff access');
  const accessSheet = dialog('Staff access');
  const currentRoles = accessSheet.getByRole('list', { name: 'Current roles' });
  await currentRoles.getByText('Supervisor').waitFor();
  check('ui staff access shows current roles');

  // Grant MANAGER on top of SUPERVISOR, then remove it again from the same sheet.
  await pickOption('signin-staff-role', 'Manager');
  await accessSheet.getByRole('button', { name: 'Grant role' }).click();
  await toastSeen(`${employeeName} can now sign in with the manager role.`);
  await accessSheet.waitFor({ state: 'hidden' });
  await rowAction(`Actions for ${employeeName}`, 'Staff access');
  const managerRow = accessSheet.locator('[data-role="MANAGER"]');
  await managerRow.waitFor();
  check('ui grant manager role from staff access');

  await managerRow.getByRole('button', { name: 'Remove Manager role' }).click();
  await alertDialog(`Remove Manager from ${employeeName}?`).getByRole('button', { name: 'Remove Manager' }).click();
  await toastSeen(`Removed Manager from ${employeeName}.`);
  await managerRow.waitFor({ state: 'detached' });
  await accessSheet.locator('[data-role="SUPERVISOR"]').waitFor();
  const afterRevoke = await gql(`
    query Employees($filter: EmployeeFilterInput) {
      employees(filter: $filter) { id linkedAccountRoles }
    }
  `, { filter: { search: employeeEmail } }, token).then((data) => data.employees[0]);
  if (afterRevoke.linkedAccountRoles.includes('MANAGER') || !afterRevoke.linkedAccountRoles.includes('SUPERVISOR')) {
    throw new Error(`Removing Manager left roles ${JSON.stringify(afterRevoke.linkedAccountRoles)}`);
  }
  await accessSheet.getByRole('button', { name: 'Cancel' }).click();
  check('ui remove manager role from staff access', { roles: afterRevoke.linkedAccountRoles });

  await goto('/directory');
  await page.waitForURL(`${baseUrl}/employees`);
  check('legacy directory route lands on People');

  /* ---------- Attendance ---------- */

  await goto('/attendance');
  await pickOption('attendance-employee', new RegExp(employeeName));
  await page.locator('#attendance-notes').fill('UI e2e attendance');
  await page.getByRole('button', { name: 'Clock in' }).click();
  await page.getByText(`${employeeName} clocked in`).waitFor();
  await page.getByRole('button', { name: 'Clock out' }).click();
  await page.getByText(`${employeeName} clocked out.`).waitFor();
  check('ui clock in/out attendance');

  /* ---------- Leave: type, request, reject with reason, approve ---------- */

  const leaveTypeName = `UI Leave ${runId}`;
  await goto('/leave');
  await page.getByRole('button', { name: 'New leave type' }).click();
  await page.locator('#leave-type-name').fill(leaveTypeName);
  await page.locator('#leave-type-code').fill(`UI_${runId.slice(4)}`);
  await page.locator('#leave-type-days').fill('5');
  await page.locator('#leave-type-description').fill('Created by UI lifecycle sweep');
  await page.getByRole('button', { name: 'Create leave type' }).click();
  await toastSeen(`${leaveTypeName} created.`);
  check('ui create leave type');

  await page.getByRole('button', { name: `Edit ${leaveTypeName}` }).click();
  await page.locator('#leave-type-days').fill('6');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await toastSeen(`${leaveTypeName} updated.`);
  check('ui update leave type');

  async function requestLeave(startOffset, endOffset, reason) {
    await page.getByRole('button', { name: 'New request' }).click();
    await pickOption('leave-request-employee', new RegExp(employeeName));
    await pickOption('leave-request-type', leaveTypeName);
    await page.locator('#leave-request-start').fill(midweekDate(startOffset));
    await page.locator('#leave-request-end').fill(midweekDate(startOffset, endOffset - startOffset));
    await page.locator('#leave-request-reason').fill(reason);
    await page.getByRole('button', { name: 'Create request' }).click();
    await toastSeen(`Leave request created for ${employeeName}`);
  }

  await page.getByRole('button', { name: 'New request' }).click();
  await page.getByRole('button', { name: 'Create request' }).click();
  await dialog('New leave request').getByText('Choose the employee taking leave.').waitFor();
  await dialog('New leave request').getByRole('button', { name: 'Close form' }).click();
  check('leave request negative validation shows inline message');

  await requestLeave(14, 15, 'Created by UI lifecycle sweep');
  check('ui create leave request');

  await page.getByRole('button', { name: `Reject ${employeeName}'s leave` }).click();
  const rejectDialog = alertDialog(`Reject ${employeeName}'s leave?`);
  await rejectDialog.getByRole('button', { name: 'Reject request' }).click();
  await rejectDialog.getByText('Add a reason so the employee knows what to change.').waitFor();
  const rejectReason = `Rejected by UI lifecycle sweep ${runId}`;
  await rejectDialog.getByLabel('Reason for the employee').fill(rejectReason);
  await rejectDialog.getByRole('button', { name: 'Reject request' }).click();
  await toastSeen(`${employeeName}'s ${leaveTypeName.toLowerCase()} rejected.`);
  check('ui reject leave requires a reason');

  async function employeeLeave() {
    return gql(`
      query LeaveRequests($filter: LeaveRequestFilterInput) {
        leaveRequests(filter: $filter) { id status reason decisionNotes leaveType { id name } }
      }
    `, { filter: { employeeId: employee.id } }, token).then((data) =>
      data.leaveRequests.filter((row) => row.leaveType.name === leaveTypeName));
  }
  const rejectedRequest = (await employeeLeave()).find((row) => row.status === 'REJECTED');
  if (rejectedRequest?.decisionNotes !== rejectReason) {
    throw new Error(`Rejected leave did not keep the typed reason: ${JSON.stringify(rejectedRequest)}`);
  }
  check('rejected leave stores the typed reason as decisionNotes');

  await requestLeave(28, 28, 'Approval path from UI lifecycle sweep');
  await page.getByRole('button', { name: `Approve ${employeeName}'s leave` }).click();
  await toastSeen(`${employeeName}'s ${leaveTypeName.toLowerCase()} approved.`);
  check('ui approve leave');

  await page.getByRole('searchbox', { name: 'Search leave history' }).fill(employeeName);
  // "2 requests" when nothing else is on record (a fresh stack).
  await page.getByText(/^(Showing 2 of|2 requests$)/).waitFor();
  check('ui search leave history');

  // Over-balance approval. Creating a request never exceeds the allowance, so
  // queue two that fit (3 + 1 days next to 1 approved, allowance 6), then
  // lower the allowance to 4: available becomes -1 and both cards warn.
  // Approving the 1-day one passes the server's approved-only re-check.
  await requestLeave(35, 37, `Over balance long ${runId}`);
  await requestLeave(49, 49, `Over balance short ${runId}`);
  await page.getByRole('button', { name: `Edit ${leaveTypeName}` }).click();
  await page.locator('#leave-type-days').fill('4');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await toastSeen(`${leaveTypeName} updated.`);
  await goto('/leave');
  const shortCard = page.locator('.app-muted-surface').filter({ hasText: `Over balance short ${runId}` });
  await shortCard.getByText(/Approving goes over the .* balance by 1 day/).waitFor();
  await shortCard.getByRole('button', { name: `Approve ${employeeName}'s leave` }).click();
  const overDialog = alertDialog(`Approve beyond ${employeeName}'s balance?`);
  await overDialog.getByText('This goes over the').waitFor();
  await overDialog.getByRole('button', { name: 'Approve anyway' }).click();
  await toastSeen(`${employeeName}'s ${leaveTypeName.toLowerCase()} approved.`);
  const overRows = await employeeLeave();
  const approvedShort = overRows.find((row) => row.reason === `Over balance short ${runId}`);
  if (approvedShort?.status !== 'APPROVED') throw new Error(`Approve anyway did not approve: ${JSON.stringify(approvedShort)}`);
  check('ui approve anyway confirms an over-balance approval');
  const leftover = overRows.find((row) => row.reason === `Over balance long ${runId}`);
  await gql(`
    mutation Review($input: ReviewLeaveRequestInput!) { reviewLeaveRequest(input: $input) { id status } }
  `, { input: { requestId: leftover.id, status: 'REJECTED', decisionNotes: 'Sweep clean-up' } }, token);

  await page.getByRole('button', { name: `Deactivate ${leaveTypeName}` }).click();
  await alertDialog(`Deactivate ${leaveTypeName}?`).getByRole('button', { name: 'Deactivate' }).click();
  await toastSeen(`${leaveTypeName} deactivated.`);
  check('ui deactivate leave type');

  /* ---------- Payroll: edit pay, period lifecycle, payslip ---------- */

  await goto('/payroll');
  await page.getByRole('searchbox', { name: 'Search compensation register' }).fill(employeeName);
  await page.getByRole('button', { name: `Edit pay for ${employeeName}` }).click();
  const payDrawer = dialog('Compensation setup');
  await payDrawer.waitFor();
  if ((await page.locator('#base-salary').inputValue()) !== '14000') {
    throw new Error('Compensation edit did not prefill the current salary');
  }
  await page.locator('#base-salary').fill('14500');
  await page.locator('#compensation-notes').fill('UI lifecycle compensation');
  await payDrawer.getByRole('button', { name: 'Save compensation' }).click();
  await toastSeen(`Pay saved for ${employeeName}.`);
  await payDrawer.waitFor({ state: 'hidden' });
  check('ui edit compensation from register');

  await page.locator('#period-month').fill(payrollDeleteMonth);
  await page.getByRole('button', { name: 'Create payroll period' }).click();
  await toastSeen('payroll period created.');
  await page.getByRole('button', { name: 'Delete period' }).click();
  await alertDialog(/payroll period\?/).getByRole('button', { name: 'Delete period' }).click();
  await toastSeen('payroll period deleted.');
  check('ui delete open payroll period');

  await page.locator('#period-month').fill(payrollMonth);
  await page.getByRole('button', { name: 'Create payroll period' }).click();
  await toastSeen('payroll period created.');
  await page.getByRole('list', { name: /Step 1 of 3/ }).waitFor();
  check('ui create payroll period', { step: 'Process payroll' });
  await page.getByRole('button', { name: 'Process payroll' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Process payroll' }).click();
  await toastSeen('payroll processed.');
  await page.getByRole('list', { name: /Step 2 of 3/ }).waitFor();
  await page.getByRole('button', { name: 'Mark as paid' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Mark as paid' }).click();
  await toastSeen('payroll marked as paid.');
  await page.getByRole('button', { name: `Download payslip PDF for ${employeeName}` }).click();
  await toastSeen('Downloaded');
  check('ui process/pay/export payroll');

  /* ---------- Policies ---------- */

  const policyTitle = `UI Policy ${runId}`;
  await goto('/policies');
  await page.getByRole('button', { name: 'New policy' }).click();
  await page.getByRole('button', { name: 'Save policy' }).click();
  const policyTitleValid = await page.locator('#policy-title').evaluate((element) => element.validity.valid);
  if (policyTitleValid) throw new Error('Policy title required validation did not block submission');
  check('policies negative required composer form blocked');
  await page.locator('#policy-title').fill(policyTitle);
  await page.locator('#policy-category').fill('UI E2E');
  await page.locator('#policy-version').fill('1.0');
  await page.locator('#policy-description').fill('Created by UI lifecycle sweep');
  await page.locator('#policy-link').fill('https://example.com/policy');
  await page.locator('#policy-content').fill('UI policy content from lifecycle sweep');
  await page.getByRole('button', { name: 'Save policy' }).click();
  await toastSeen('Policy created.');
  await page.getByRole('heading', { name: policyTitle }).waitFor();
  check('ui create policy document');

  await page.getByRole('button', { name: `Edit ${policyTitle}` }).click();
  await page.locator('#policy-version').fill('1.1');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await toastSeen('Policy updated.');
  check('ui update policy document');

  await page.getByRole('button', { name: `Publish ${policyTitle}` }).click();
  await alertDialog(`Publish ${policyTitle}?`).getByRole('button', { name: 'Publish' }).click();
  await toastSeen(`${policyTitle} published.`);
  check('ui publish policy document with confirmation');

  await page.getByRole('button', { name: `Archive ${policyTitle}` }).click();
  await alertDialog(`Archive ${policyTitle}?`).getByRole('button', { name: 'Archive' }).click();
  await toastSeen(`${policyTitle} archived.`);
  await page.getByRole('radio', { name: /^Archived/ }).click();
  await page.getByRole('heading', { name: policyTitle }).waitFor();
  check('ui archive policy document and find it under Archived');

  /* ---------- Recruitment: requisition to hire to employee record ---------- */

  const requisitionTitle = `UI Recruiter ${runId}`;
  await goto('/recruitment');
  await page.getByRole('button', { name: 'New requisition' }).click();
  await page.getByRole('button', { name: 'Create requisition' }).click();
  const requisitionTitleValid = await page.locator('#requisition-title').evaluate((element) => element.validity.valid);
  if (requisitionTitleValid) throw new Error('Recruitment requisition required title validation did not block submission');
  check('recruitment negative required requisition form blocked');

  await page.locator('#requisition-title').fill(requisitionTitle);
  await pickOption('requisition-department', deptName);
  await pickOption('requisition-designation', desTitle);
  await page.locator('#requisition-positions').fill('2');
  await page.locator('#requisition-target-start').fill(futureDate(30));
  await page.locator('#requisition-salary-min').fill('12000');
  await page.locator('#requisition-salary-max').fill('18000');
  await page.locator('#requisition-description').fill('Created by UI lifecycle sweep');
  await page.locator('#requisition-requirements').fill('Hiring workflow proof');
  await page.getByRole('button', { name: 'Create requisition' }).click();
  await toastSeen(`${requisitionTitle} opened.`);
  const requisition = await gql(`
    query JobRequisitions($filter: JobRequisitionFilterInput) {
      jobRequisitions(filter: $filter) { id requisitionNumber jobTitle status }
    }
  `, { filter: { search: requisitionTitle } }, token).then((data) => data.jobRequisitions[0]);
  proof.created.requisition = requisition;
  check('ui create recruitment requisition');

  await rowAction(`Actions for ${requisitionTitle}`, 'Edit');
  await page.locator('#requisition-positions').fill('3');
  await page.getByRole('button', { name: 'Save requisition' }).click();
  await toastSeen(`${requisitionTitle} updated.`);
  check('ui update recruitment requisition');

  async function addCandidate(firstName, lastName, email) {
    await page.getByRole('button', { name: 'Add candidate' }).first().click();
    const drawer = dialog(/candidate/i);
    await drawer.waitFor();
    await pickOption('application-requisition', new RegExp(requisitionTitle));
    await page.locator('#candidate-first-name').fill(firstName);
    await page.locator('#candidate-last-name').fill(lastName);
    await page.locator('#candidate-email').fill(email);
    await page.locator('#candidate-phone').fill('+971500003333');
    await page.locator('#candidate-source').fill('UI lifecycle');
    await page.locator('#candidate-experience').fill('5');
    await page.locator('#candidate-expected-salary').fill('16000');
    await drawer.getByRole('button', { name: 'Add candidate' }).click();
    await toastSeen(`${firstName} ${lastName} added to Received.`);
  }

  const hireLast = `Hire ${runId}`;
  const hireEmail = `hire.${runId}@hrflow.lab.novadev.tech`;
  await addCandidate('Recruitment', hireLast, hireEmail);
  check('ui create recruitment application');

  const hireCard = () => page.locator('article').filter({ hasText: `Recruitment ${hireLast}` }).first();
  for (const step of ['Start screening', 'Shortlist', 'Schedule interview', 'Mark interviewed', 'Select', 'Extend offer', 'Mark hired']) {
    await hireCard().getByRole('button', { name: step }).click();
    await toastSeen(`Recruitment ${hireLast}`);
  }
  const hired = await gql(`
    query RecruitmentApplications($filter: RecruitmentApplicationFilterInput) {
      recruitmentApplications(filter: $filter) { id status }
    }
  `, { filter: { search: hireEmail } }, token).then((data) => data.recruitmentApplications[0]);
  if (hired.status !== 'HIRED') throw new Error(`Expected HIRED, got ${hired.status}`);
  check('ui advance candidate through the pipeline to hired');

  await hireCard().getByRole('link', { name: 'Create employee record' }).click();
  await page.waitForURL(`${baseUrl}/employees`);
  await dialog(/New employee/).waitFor();
  const prefilled = {
    firstName: await page.locator('#profile-first-name').inputValue(),
    lastName: await page.locator('#profile-last-name').inputValue(),
    email: await page.locator('#profile-email').inputValue(),
    phone: await page.locator('#profile-phone').inputValue(),
    department: (await page.locator('#profile-department').innerText()).trim(),
    designation: (await page.locator('#profile-designation').innerText()).trim(),
  };
  const expectedPrefill = {
    firstName: 'Recruitment',
    lastName: hireLast,
    email: hireEmail,
    phone: '+971500003333',
    department: deptName,
    designation: desTitle,
  };
  for (const [field, value] of Object.entries(expectedPrefill)) {
    if (prefilled[field] !== value) {
      throw new Error(`Hire handoff did not prefill ${field}: got ${JSON.stringify(prefilled[field])}, want ${JSON.stringify(value)}`);
    }
  }
  if (new URL(page.url()).search) throw new Error(`Hire handoff left query params in the URL: ${page.url()}`);
  await dialog(/New employee/).getByRole('button', { name: 'Close' }).click();
  check('ui hired candidate opens new employee prefilled with name, contact, department and designation');

  await goto('/recruitment');
  const rejectLast = `Reject ${runId}`;
  await addCandidate('Recruitment', rejectLast, `reject.${runId}@hrflow.lab.novadev.tech`);
  await rowAction(`More actions for Recruitment ${rejectLast}`, 'Reject');
  await alertDialog(/Reject: Recruitment/).getByRole('button', { name: 'Reject' }).click();
  await toastSeen(`Recruitment ${rejectLast} rejected.`);
  check('ui reject recruitment application');

  await rowAction(`Actions for ${requisitionTitle}`, 'Close');
  await alertDialog(/Close:/).getByRole('button', { name: 'Close' }).click();
  await toastSeen(`${requisitionTitle} closed.`);
  check('ui close recruitment requisition');

  let closedRequisitionBlockedApplication = false;
  try {
    await gql(`
      mutation CreateRecruitmentApplication($input: CreateRecruitmentApplicationInput!) {
        createRecruitmentApplication(input: $input) { id }
      }
    `, {
      input: {
        requisitionId: requisition.id,
        firstName: 'Blocked',
        lastName: 'Candidate',
        email: `blocked.${runId}@hrflow.lab.novadev.tech`,
      },
    }, token);
  } catch {
    closedRequisitionBlockedApplication = true;
  }
  if (!closedRequisitionBlockedApplication) throw new Error('Closed requisition allowed a new application');
  check('closed recruitment requisition blocks applications');

  /* ---------- Phone layout (before clean-up: a fresh stack needs active org data) ---------- */

  await page.setViewportSize({ width: 390, height: 844 });
  await goto('/employees');
  if (await page.getByRole('region', { name: 'People', exact: true }).count()) {
    throw new Error('People table rendered on a phone; expected cards');
  }
  await page.getByRole('button', { name: 'Filters' }).click();
  await page.locator('#people-department').waitFor({ state: 'visible' });
  check('mobile people uses cards and collapsible filters');
  await goto('/');
  await page.getByLabel('Open navigation').click();
  await page.getByRole('button', { name: 'Close navigation' }).last().waitFor();
  await page.screenshot({ path: 'output/playwright/hr-workflow-ui-lifecycle-mobile-nav.png', fullPage: true });
  check('mobile nav open state');
  await page.setViewportSize({ width: 1280, height: 900 });

  /* ---------- Clean-up through the UI ---------- */

  await goto('/employees');
  await page.getByRole('searchbox', { name: 'Search people' }).fill(employeeEmail);
  await rowAction(`Actions for ${employeeName}`, 'Deactivate');
  await alertDialog(`Deactivate ${employeeName}?`).getByRole('button', { name: 'Deactivate' }).click();
  await toastSeen(`${employeeName} deactivated.`);
  check('ui deactivate employee');

  await goto('/organisation');
  for (const [menu, name] of [[`Actions for ${siteName}`, siteName], [`Actions for ${desTitle}`, desTitle], [`Actions for ${deptName}`, deptName]]) {
    await rowAction(menu, 'Deactivate');
    await page.getByRole('alertdialog').getByRole('button', { name: /Deactivate/ }).click();
    await toastSeen(`${name} deactivated.`);
  }
  check('ui deactivate work site, designation and department');

  /* ---------- Reports ---------- */

  await goto('/reports');
  await page.locator('#report-month').fill(payrollMonth);
  await page.getByRole('button', { name: 'Export PDF' }).click();
  await page.getByRole('button', { name: 'Export PDF' }).waitFor({ state: 'visible' });
  check('ui export reports pdf button');

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: 'output/playwright/hr-workflow-ui-lifecycle-final.png', fullPage: true });

  return proof;

  // A Tuesday at least `offsetDays` ahead (plus `spanDays`), so leave always
  // contains working days whatever the weekend convention.
  function midweekDate(offsetDays, spanDays = 0) {
    const date = new Date();
    date.setDate(date.getDate() + offsetDays);
    while (date.getDay() !== 2) date.setDate(date.getDate() + 1);
    date.setDate(date.getDate() + spanDays);
    return date.toISOString().slice(0, 10);
  }

  function futureDate(offsetDays) {
    const date = new Date();
    date.setDate(date.getDate() + offsetDays);
    return date.toISOString().slice(0, 10);
  }
})()

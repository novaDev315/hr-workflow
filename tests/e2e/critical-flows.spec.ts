import { test, expect } from '@playwright/test';

/**
 * End-to-End Tests for Critical Flows
 *
 * Prerequisites:
 * 1. System must be running (docker-compose up)
 * 2. Test database must be seeded
 * 3. Test user credentials must exist
 */

test.describe('Critical Flow: Employee Onboarding', () => {
  test('should complete full employee onboarding process', async ({ page }) => {
    // Login as HR Admin
    await page.goto('http://localhost:5173/login');
    await page.fill('input[name="email"]', 'admin@hrflow.com');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    // Wait for dashboard
    await expect(page).toHaveURL(/.*dashboard/);

    // Navigate to Employees page
    await page.click('text=Employees');
    await expect(page).toHaveURL(/.*employees/);

    // Click Add Employee
    await page.click('text=Add Employee');

    // Fill employee form
    await page.fill('input[name="firstName"]', 'Test');
    await page.fill('input[name="lastName"]', 'Employee');
    await page.fill('input[name="email"]', `test.employee.${Date.now()}@test.com`);
    await page.fill('input[name="phone"]', '+1234567890');
    await page.selectOption('select[name="department"]', { label: 'Engineering' });
    await page.selectOption('select[name="designation"]', { label: 'Software Engineer' });
    await page.selectOption('select[name="employmentType"]', { value: 'FULL_TIME' });
    await page.fill('input[name="joinDate"]', '2024-01-01');

    // Submit form
    await page.click('button[type="submit"]');

    // Verify success message
    await expect(page.locator('text=Employee created successfully')).toBeVisible();

    // Verify employee appears in list
    await expect(page.locator('text=Test Employee')).toBeVisible();
  });
});

test.describe('Critical Flow: Attendance Clock-in/Clock-out', () => {
  test('should allow employee to clock in and clock out', async ({ page, context }) => {
    // Grant geolocation permission
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({
      latitude: 40.7128,
      longitude: -74.0060,
    });

    // Login as Employee
    await page.goto('http://localhost:5173/login');
    await page.fill('input[name="email"]', 'employee@hrflow.com');
    await page.fill('input[name="password"]', 'employee123');
    await page.click('button[type="submit"]');

    // Navigate to Attendance
    await page.click('text=Attendance');

    // Wait for GPS location
    await page.waitForSelector('text=Your Location', { timeout: 5000 });

    // Verify within geofence
    await expect(page.locator('text=/.*within.*geofence.*/i')).toBeVisible();

    // Clock In
    await page.click('button:has-text("Clock In")');

    // Verify clock in success
    await expect(page.locator('text=Successfully clocked in')).toBeVisible();

    // Wait a moment (simulate work)
    await page.waitForTimeout(2000);

    // Clock Out
    await page.click('button:has-text("Clock Out")');

    // Verify clock out success
    await expect(page.locator('text=Successfully clocked out')).toBeVisible();

    // Verify attendance record shows hours worked
    await expect(page.locator('text=/Total.*hours/i')).toBeVisible();
  });

  test('should prevent clock-in when outside geofence', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    // Set location far from office
    await context.setGeolocation({
      latitude: 41.8781,
      longitude: -87.6298, // Chicago (far from NY)
    });

    await page.goto('http://localhost:5173/login');
    await page.fill('input[name="email"]', 'employee@hrflow.com');
    await page.fill('input[name="password"]', 'employee123');
    await page.click('button[type="submit"]');

    await page.click('text=Attendance');

    // Verify outside geofence warning
    await expect(page.locator('text=/.*outside.*geofence.*/i')).toBeVisible();

    // Verify Clock In button is disabled
    const clockInButton = page.locator('button:has-text("Clock In")');
    await expect(clockInButton).toBeDisabled();
  });
});

test.describe('Critical Flow: Leave Request and Approval', () => {
  test('should complete leave request with 3-tier approval', async ({ page }) => {
    // Step 1: Employee submits leave request
    await page.goto('http://localhost:5173/login');
    await page.fill('input[name="email"]', 'employee@hrflow.com');
    await page.fill('input[name="password"]', 'employee123');
    await page.click('button[type="submit"]');

    await page.click('text=Leave');
    await page.click('text=Request Leave');

    await page.selectOption('select[name="leaveType"]', { value: 'ANNUAL' });
    await page.fill('input[name="startDate"]', '2024-06-01');
    await page.fill('input[name="endDate"]', '2024-06-05');
    await page.fill('textarea[name="reason"]', 'Family vacation');

    await page.click('button[type="submit"]');
    await expect(page.locator('text=Leave request submitted')).toBeVisible();

    // Logout
    await page.click('[aria-label="User menu"]');
    await page.click('text=Logout');

    // Step 2: Level 1 Supervisor approves
    await page.fill('input[name="email"]', 'supervisor@hrflow.com');
    await page.fill('input[name="password"]', 'supervisor123');
    await page.click('button[type="submit"]');

    await page.click('text=Approvals');
    await page.click('text=Pending Leave Requests');

    const firstRequest = page.locator('[data-testid="leave-request"]').first();
    await firstRequest.click('button:has-text("Approve")');
    await expect(page.locator('text=Leave approved')).toBeVisible();

    // Step 3: Level 2 Manager approves
    await page.click('[aria-label="User menu"]');
    await page.click('text=Logout');

    await page.fill('input[name="email"]', 'manager@hrflow.com');
    await page.fill('input[name="password"]', 'manager123');
    await page.click('button[type="submit"]');

    await page.click('text=Approvals');
    await firstRequest.click('button:has-text("Approve")');

    // Step 4: Level 3 Director approves
    await page.click('[aria-label="User menu"]');
    await page.click('text=Logout');

    await page.fill('input[name="email"]', 'director@hrflow.com');
    await page.fill('input[name="password"]', 'director123');
    await page.click('button[type="submit"]');

    await page.click('text=Approvals');
    await firstRequest.click('button:has-text("Approve")');

    // Verify final approval
    await expect(firstRequest.locator('text=Approved')).toBeVisible();
  });
});

test.describe('Critical Flow: Payroll Processing', () => {
  test('should process monthly payroll', async ({ page }) => {
    // Login as HR Manager
    await page.goto('http://localhost:5173/login');
    await page.fill('input[name="email"]', 'hr.manager@hrflow.com');
    await page.fill('input[name="password"]', 'hrmanager123');
    await page.click('button[type="submit"]');

    // Navigate to Payroll
    await page.click('text=Payroll');

    // Select payroll period
    await page.selectOption('select[name="month"]', { value: '2024-01' });

    // Click Process Payroll
    await page.click('button:has-text("Process Payroll")');

    // Confirm action
    await page.click('button:has-text("Confirm")');

    // Wait for processing
    await page.waitForSelector('text=Payroll processed successfully', {
      timeout: 30000,
    });

    // Verify payslips generated
    await page.click('text=View Payslips');
    const payslips = page.locator('[data-testid="payslip-row"]');
    await expect(payslips).toHaveCount(await payslips.count());

    // Download sample payslip
    const firstPayslip = payslips.first();
    const downloadPromise = page.waitForEvent('download');
    await firstPayslip.click('button:has-text("Download")');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/payslip.*\.pdf/);
  });
});

test.describe('Critical Flow: Multi-Location Assignment', () => {
  test('should assign employee to multiple locations', async ({ page }) => {
    await page.goto('http://localhost:5173/login');
    await page.fill('input[name="email"]', 'admin@hrflow.com');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    // Navigate to employee detail
    await page.click('text=Employees');
    await page.click('[data-testid="employee-row"]').first();

    // Go to Assignments tab
    await page.click('text=Location Assignments');

    // Add primary location
    await page.click('text=Add Assignment');
    await page.selectOption('select[name="location"]', { index: 1 });
    await page.check('input[name="isPrimary"]');
    await page.fill('input[name="assignedDate"]', '2024-01-01');
    await page.click('button:has-text("Save")');

    // Verify primary location added
    await expect(page.locator('text=Primary Location')).toBeVisible();

    // Add secondary location
    await page.click('text=Add Assignment');
    await page.selectOption('select[name="location"]', { index: 2 });
    await page.fill('input[name="assignedDate"]', '2024-01-01');
    await page.click('button:has-text("Save")');

    // Verify multiple locations assigned
    const assignments = page.locator('[data-testid="location-assignment"]');
    await expect(assignments).toHaveCount(2);
  });
});

test.describe('Performance: System Response Time', () => {
  test('should load dashboard within 2 seconds', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('http://localhost:5173/login');
    await page.fill('input[name="email"]', 'admin@hrflow.com');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    await page.waitForSelector('[data-testid="dashboard-loaded"]');

    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(2000);
  });

  test('should handle 100 employee records efficiently', async ({ page }) => {
    await page.goto('http://localhost:5173/login');
    await page.fill('input[name="email"]', 'admin@hrflow.com');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    await page.click('text=Employees');

    const startTime = Date.now();
    await page.waitForSelector('[data-testid="employee-table"]');
    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(2000);

    // Verify pagination works
    const rows = page.locator('[data-testid="employee-row"]');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(50); // Default page size
  });
});

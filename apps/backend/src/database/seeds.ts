export const DATABASE_SEED_STATEMENTS = [
      `
        INSERT INTO leave_types (id, code, name, default_days, description, is_active)
        VALUES
          ('seed-leave-casual', 'CASUAL', 'Casual Leave', 12, 'General personal leave allowance', TRUE),
          ('seed-leave-sick', 'SICK', 'Sick Leave', 12, 'Leave allowance for illness and recovery', TRUE),
          ('seed-leave-earned', 'EARNED', 'Earned Leave', 18, 'Accrued annual leave allowance', TRUE)
        ON CONFLICT (code) DO NOTHING
      `,
      `
        INSERT INTO policy_documents (
          id, title, category, version, effective_date, description, status, document_url, content, published_at
        )
        VALUES
          (
            'seed-policy-handbook',
            'Employee Handbook',
            'Handbook',
            '2.0',
            '2024-01-01',
            'Complete guide for employees and company expectations',
            'PUBLISHED',
            null,
            'Welcome to the company. This handbook covers conduct, attendance, leave, payroll, and workplace expectations.',
            NOW()
          ),
          (
            'seed-policy-leave',
            'Leave Policy',
            'Leave Policy',
            '1.5',
            '2024-01-01',
            'Leave types, balances, approval workflow, and employee responsibilities',
            'PUBLISHED',
            null,
            'Employees must request leave through the HR system. Managers and HR approve leave based on policy and staffing needs.',
            NOW()
          ),
          (
            'seed-policy-security',
            'IT Security Policy',
            'IT Policy',
            '2.1',
            '2024-03-01',
            'Security, password hygiene, and acceptable use requirements',
            'PUBLISHED',
            null,
            'Employees must safeguard credentials, use approved devices, and report security incidents immediately.',
            NOW()
          )
        ON CONFLICT (title, version) DO NOTHING
      `
];

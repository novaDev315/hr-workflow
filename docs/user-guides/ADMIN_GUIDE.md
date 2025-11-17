# HRFlow Pro - Administrator User Guide

**Version**: 2.0
**Last Updated**: November 2024
**Audience**: HR Administrators, HR Managers, System Administrators

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Dashboard Overview](#dashboard-overview)
3. [Employee Management](#employee-management)
4. [Attendance Management](#attendance-management)
5. [Leave Management](#leave-management)
6. [Payroll Processing](#payroll-processing)
7. [Recruitment & Hiring](#recruitment--hiring)
8. [Reports & Analytics](#reports--analytics)
9. [System Configuration](#system-configuration)
10. [Troubleshooting](#troubleshooting)
11. [FAQ](#faq)

---

## Getting Started

### Logging In

1. Open your web browser and navigate to: `http://your-company-domain.com/hrflow`
2. Enter your administrator credentials:
   - **Email**: Your admin email address
   - **Password**: Your secure password
3. Click **"Sign In"**

> **Screenshot**: Login page showing email and password fields with "Sign In" button

### First-Time Setup

After logging in for the first time:

1. **Update Your Profile**
   - Click your avatar in the top-right corner
   - Select "Profile Settings"
   - Update your personal information

2. **Configure Notifications**
   - Go to Settings → Notifications
   - Enable email/push notifications as needed

3. **Review Dashboard**
   - Familiarize yourself with the dashboard layout
   - Review pending approvals and alerts

> **Screenshot**: Profile settings page with personal information fields

---

## Dashboard Overview

The dashboard provides a real-time overview of your HR operations.

### Key Metrics

1. **Employee Statistics**
   - Total Active Employees
   - New Hires This Month
   - Employee Turnover Rate
   - Department Distribution

2. **Attendance Overview**
   - Today's Attendance Rate
   - Pending Approval Count
   - Late Arrivals
   - Early Departures

3. **Leave Summary**
   - Pending Leave Requests
   - Employees on Leave Today
   - Leave Balance Alerts

4. **Payroll Status**
   - Current Period Status
   - Pending Payroll Items
   - Last Processed Date

### Quick Actions

- **Add New Employee** - Quickly onboard a new team member
- **Approve Attendance** - Review and approve pending attendance
- **Process Payroll** - Initiate payroll processing
- **Generate Reports** - Create custom reports

> **Screenshot**: Main dashboard showing key metrics cards (Employee Statistics, Attendance Overview, Leave Summary, Payroll Status) with graphs and quick action buttons

---

## Employee Management

### Adding a New Employee

1. Navigate to **Employees** → **Add Employee**
2. Fill in the required information:

   **Personal Information**:
   - First Name *
   - Last Name *
   - Email Address * (must be unique)
   - Phone Number
   - Date of Birth
   - Gender
   - Marital Status

   **Employment Information**:
   - Department * (select from dropdown)
   - Designation/Job Title *
   - Employment Type * (Full-time, Part-time, Contract, etc.)
   - Join Date *
   - Reporting Manager (select supervisor)
   - Employment Status (default: Active)

   **Contact Information**:
   - Permanent Address
   - Current Address
   - Emergency Contact Name
   - Emergency Contact Phone
   - Emergency Contact Relationship

   **Banking Information**:
   - Bank Name
   - Account Number
   - IFSC Code (or routing number)

3. Click **"Create Employee"**
4. The system will auto-generate an Employee Number (e.g., EMP20240001)

> **Screenshot**: Add Employee form showing all fields for Personal Information, Employment Information, Contact Information, and Banking Information sections

### Managing Employee Records

#### Viewing Employee Details

1. Go to **Employees** → **All Employees**
2. Use the search bar to find an employee:
   - Search by name, employee number, email, or department
3. Click on an employee row to view full details

> **Screenshot**: Employee list page showing searchable table with columns for Employee Number, Name, Department, Designation, Status, and Actions

#### Editing Employee Information

1. Open the employee's detail page
2. Click **"Edit"** button
3. Modify the required fields
4. Click **"Save Changes"**
5. Changes will be logged in the audit trail

#### Managing Employee Status

To change an employee's status:

1. Open employee detail page
2. Click **"Change Status"** dropdown
3. Select new status:
   - **Active** - Currently working
   - **On Leave** - Temporarily away
   - **Suspended** - Temporarily suspended
   - **Terminated** - Employment ended
   - **Resigned** - Voluntarily left
   - **Retired** - Retired from service
4. Provide a reason (required for Terminated/Suspended)
5. Click **"Confirm"**

#### Uploading Employee Documents

1. Go to employee detail page
2. Click **"Documents"** tab
3. Click **"Upload Document"**
4. Select document type:
   - ID Proof (Aadhaar, PAN, Passport, etc.)
   - Educational Certificates
   - Experience Letters
   - Offer Letter
   - Employment Contract
   - Medical Certificates
   - Other
5. Choose file and upload
6. Document will be stored securely in MinIO storage

#### Managing Salary Structure

1. Open employee detail page
2. Go to **"Salary"** tab
3. Click **"Add Salary Structure"**
4. Enter salary components:
   - **Basic Salary** * (required)
   - **HRA** (House Rent Allowance)
   - **Conveyance Allowance**
   - **Medical Allowance**
   - **Special Allowance**
   - **Other Allowances**

   **Deductions**:
   - **PF Contribution** (Provident Fund)
   - **ESI Contribution** (Employee State Insurance)
   - **Professional Tax**

5. Set **Effective From** date
6. Click **"Save"**
7. Previous salary structures will be automatically marked as inactive

> **Screenshot**: Salary structure form showing Basic Salary, HRA, Allowances, and Deductions fields with Effective From date

### Employee Directory

The searchable employee directory allows quick access to employee information.

**Features**:
- Real-time search across name, employee ID, department, and designation
- Grid view with contact information
- Click-to-call phone numbers
- Click-to-email addresses
- Filter by department or designation

**Usage**:
1. Go to **Directory**
2. Type in the search box
3. Results update in real-time
4. Click on an employee card to view full profile

---

## Attendance Management

### Understanding the 3-Tier Approval Workflow

HRFlow Pro uses a robust 3-tier approval system:

```
Employee Clock In/Out
        ↓
[Tier 1] Supervisor Review
        ↓ (Approved)
[Tier 2] Operations Manager Review
        ↓ (Approved)
[Tier 3] Manager/Director Final Approval
        ↓ (Approved)
    APPROVED → Ready for Payroll
```

At any tier, the approver can:
- **Approve** - Move to next tier
- **Reject** - Stop workflow and request correction
- **Request Revision** - Ask employee to clarify/correct

> **Screenshot**: Flowchart diagram showing 3-tier approval workflow from Employee Clock In/Out through Tier 1, Tier 2, Tier 3 to final APPROVED status

### Reviewing Attendance Records

1. Go to **Attendance** → **Pending Approvals**
2. You'll see a list of attendance records requiring your approval level
3. Each record shows:
   - Employee Name and Number
   - Date
   - Clock In Time (with GPS coordinates)
   - Clock Out Time (with GPS coordinates)
   - Total Hours Worked
   - Overtime Hours
   - Status Flags (Late, Early Departure)
   - Distance from Location

> **Screenshot**: Pending Approvals list showing attendance records with employee details, clock in/out times, GPS status, and approval actions

### Individual Approval

1. Click on an attendance record to open details
2. Review the information:
   - **GPS Validation**: Check if employee was within geofence (100m radius)
   - **Work Hours**: Verify total hours match expected shift
   - **Anomalies**: Check for late arrival or early departure
3. Add comments (optional but recommended)
4. Click one of:
   - **Approve** - Move to next approval tier
   - **Reject** - Reject with reason
   - **Request Changes** - Ask for correction

### Bulk Approval

For multiple records at once:

1. Go to **Attendance** → **Pending Approvals**
2. Check the checkbox next to each record you want to approve
3. Or click **"Select All"** to select all on current page
4. Click **"Bulk Approve"** button
5. Confirm the action
6. All selected records will move to the next approval tier

> **Screenshot**: Bulk approval interface with checkboxes next to attendance records and "Bulk Approve" button highlighted

### Handling Attendance Corrections

Employees may request corrections for missed clock-ins or errors:

1. Go to **Attendance** → **Correction Requests**
2. Review correction details:
   - Original attendance data
   - Requested changes
   - Employee's reason
3. Verify the request
4. **Approve** or **Reject** with comments

> **Screenshot**: Attendance correction request detail showing original vs requested changes with employee's reason and approve/reject buttons

### Locking Attendance for Payroll

Before processing payroll, attendance must be locked:

1. Go to **Attendance** → **Lock for Payroll**
2. Select the period (e.g., January 2024)
3. System will show:
   - Total approved records
   - Pending approvals (will be excluded)
   - Any anomalies requiring attention
4. Review the summary
5. Click **"Lock Attendance"**
6. Locked records cannot be modified without HR override

### HR Override

In exceptional cases, HR can override locked attendance:

1. Go to **Attendance** → **Locked Records**
2. Find the record requiring override
3. Click **"HR Override"**
4. Enter:
   - Corrected values
   - Detailed reason (required for audit)
5. Confirm override
6. Record will be unlocked, modified, and re-locked
7. All changes are logged in audit trail

---

## Leave Management

### Leave Types Configuration

HRFlow Pro supports multiple leave types:

- **Annual Leave** - Yearly paid vacation
- **Sick Leave** - For illness/medical reasons
- **Casual Leave** - Short-term personal leave
- **Maternity Leave** - For maternity-related absence
- **Paternity Leave** - For paternity-related absence
- **Unpaid Leave** - Leave without pay
- **Compensatory Off** - Comp off for working on holidays

**Configuring Leave Types**:

1. Go to **Settings** → **Leave Types**
2. Click **"Add Leave Type"** or edit existing
3. Set:
   - Leave Type Name
   - Annual Allocation (days per year)
   - Carry Forward Rules
   - Encashment Eligibility
   - Notice Period Required
   - Maximum Consecutive Days
4. Save configuration

### Reviewing Leave Requests

1. Navigate to **Leave** → **Pending Requests**
2. View requests with details:
   - Employee Name
   - Leave Type
   - Duration (From Date - To Date)
   - Total Days
   - Current Balance
   - Reason
   - Approval Status

### Approving/Rejecting Leave

**Individual Approval**:
1. Click on a leave request
2. Review:
   - Leave balance (ensure sufficient balance)
   - Team calendar (check if too many people are on leave)
   - Critical work periods
3. Add comments
4. Click **"Approve"** or **"Reject"**

> **Screenshot**: Leave request detail page showing employee info, leave type, dates, balance status, team calendar, and approve/reject buttons

**Bulk Operations**:
1. Select multiple requests using checkboxes
2. Click **"Bulk Approve"** or **"Bulk Reject"**
3. Confirm action

### Leave Balance Management

**Viewing Balances**:
1. Go to **Leave** → **Leave Balances**
2. Search for an employee
3. View current balances by leave type

**Manual Adjustment**:
1. Click **"Adjust Balance"**
2. Enter adjustment amount (positive or negative)
3. Provide reason (required)
4. Save adjustment
5. Change will be logged in audit trail

### Team Calendar

View team leave schedules:

1. Go to **Leave** → **Team Calendar**
2. Select department/team
3. View calendar with:
   - Employees on leave (color-coded by leave type)
   - Available headcount
   - Upcoming leaves
4. Export calendar to PDF if needed

> **Screenshot**: Team calendar view showing monthly grid with employees on leave color-coded by leave type and headcount availability indicator

---

## Payroll Processing

### Payroll Workflow Overview

```
1. Lock Attendance (All approvals complete)
        ↓
2. System calculates salary based on:
   - Attendance hours
   - Leave deductions (unpaid leave)
   - Salary structure
   - Tax calculations
        ↓
3. HR Reviews calculations
        ↓
4. Process Payroll
        ↓
5. Generate Payslips (PDF)
        ↓
6. Distribute payslips to employees
```

### Processing Monthly Payroll

1. **Ensure Prerequisites**:
   - All attendance for the month is approved and locked
   - All leave records are processed
   - Salary structures are up to date

2. **Navigate to Payroll**:
   - Go to **Payroll** → **Process Payroll**

3. **Select Period**:
   - Choose Month and Year (e.g., January 2024)
   - Click **"Calculate"**

4. **Review Calculations**:
   - System shows summary:
     - Total employees
     - Total gross salary
     - Total deductions
     - Total net salary
     - Tax calculations
   - Review individual calculations:
     - Each employee's gross salary
     - Working days vs present days
     - Deductions (for unpaid leave, loans, etc.)
     - Tax deductions
     - Net payable amount

> **Screenshot**: Payroll summary page showing list of employees with gross salary, deductions, taxes, and net payable columns, plus total summary at top

5. **Make Adjustments (if needed)**:
   - Click on an employee to view details
   - If correction needed, click **"Adjust"**
   - Enter adjustment amount and reason
   - Save adjustment

6. **Process Payroll**:
   - Once all calculations verified
   - Click **"Process Payroll"**
   - Confirm action
   - System will:
     - Finalize all calculations
     - Generate payslips (PDF)
     - Update payroll records
     - Send notifications to employees

### Managing Salary Components

**Adding/Modifying Components**:

1. Go to **Payroll** → **Salary Components**
2. Click **"Add Component"** or edit existing
3. Configure:
   - Component Name (e.g., "Transport Allowance")
   - Component Type (Earning/Deduction)
   - Calculation Method (Fixed/Percentage/Formula)
   - Tax Treatment (Taxable/Non-taxable)
   - Applicability (All employees/Specific departments)
4. Save component

### Tax Configuration

**Setting Up Tax Slabs**:

1. Go to **Settings** → **Tax Configuration**
2. Add tax slabs:
   - Income Range (From - To)
   - Tax Rate (%)
   - Deduction Amount
3. Configure:
   - Standard Deduction
   - HRA Exemption Rules
   - 80C Deductions
   - Other exemptions
4. Save configuration

### Managing Employee Loans

**Recording a Loan**:

1. Go to employee detail page
2. Click **"Loans"** tab
3. Click **"Add Loan"**
4. Enter:
   - Loan Amount
   - Interest Rate (if any)
   - EMI Amount (monthly deduction)
   - Start Date
   - Number of Installments
5. Save loan record
6. System will automatically deduct EMI from monthly salary

**Viewing Loan Status**:
- Go to **Payroll** → **Loans**
- View all active loans with:
  - Principal amount
  - Paid amount
  - Remaining balance
  - Next EMI date

### Payslip Distribution

**Individual Payslip**:
1. Go to **Payroll** → **Payslips**
2. Select month/year
3. Click on employee name
4. Click **"Download PDF"**
5. Share via email or print

**Bulk Distribution**:
1. Go to **Payroll** → **Payslips**
2. Select period
3. Click **"Email All Payslips"**
4. System sends secure email with PDF attachment to all employees

---

## Recruitment & Hiring

### Job Requisitions

**Creating a Job Opening**:

1. Go to **Recruitment** → **Job Requisitions**
2. Click **"New Requisition"**
3. Fill in details:
   - Job Title *
   - Department *
   - Number of Positions *
   - Employment Type *
   - Experience Level (Entry/Mid/Senior)
   - Job Description *
   - Responsibilities
   - Requirements/Qualifications
   - Salary Range (optional)
   - Priority (Low/Medium/High/Critical)
4. Click **"Create Requisition"**
5. System generates unique REQ number (e.g., REQ20240001)

> **Screenshot**: Create Job Requisition form showing fields for Job Title, Department, Positions, Job Description, Requirements, and Priority dropdown

**Managing Requisitions**:
- **Open Requisitions**: Active job openings
- **Filled**: Positions that have been filled
- **Closed**: Cancelled or expired requisitions

### Application Tracking

**Viewing Applications**:

1. Go to **Recruitment** → **Applications**
2. Filter by:
   - Job Requisition
   - Application Status
   - Date Range
3. View application details:
   - Candidate Name
   - Contact Information
   - Current CTC / Expected CTC
   - Experience
   - Resume (download link)
   - Application Status

**Application Workflow**:

```
RECEIVED → SCREENING → SHORTLISTED → INTERVIEW_SCHEDULED
    → INTERVIEWED → SELECTED → OFFER_EXTENDED → HIRED
```

Or at any stage: → REJECTED

**Processing Applications**:

1. Click on application
2. Review candidate details
3. Update status:
   - **Screen**: Initial review
   - **Shortlist**: Move forward
   - **Reject**: With reason
4. Add notes/comments
5. Schedule interview if shortlisted

> **Screenshot**: Application tracking board showing applications in different stages (RECEIVED, SCREENING, SHORTLISTED, INTERVIEWED, etc.) with candidate cards in each column

### Interview Management

**Scheduling an Interview**:

1. Go to **Recruitment** → **Interviews**
2. Click **"Schedule Interview"**
3. Select:
   - Application/Candidate
   - Interview Round (Technical/HR/Final)
   - Date and Time
   - Duration
   - Interview Mode (In-person/Video/Phone)
   - Interviewers (select from employees)
   - Location or Meeting Link
4. Click **"Schedule"**
5. System sends notifications to interviewers and candidate

**Recording Interview Feedback**:

1. After interview, go to **Interviews**
2. Click on the interview record
3. Add feedback:
   - Technical Skills Rating (1-5)
   - Communication Skills Rating
   - Cultural Fit Rating
   - Overall Rating
   - Detailed Comments
   - Recommendation (Strong Yes/Yes/Maybe/No/Strong No)
4. Save feedback

### Offer Management

**Creating a Job Offer**:

1. Go to **Recruitment** → **Offers**
2. Click **"Create Offer"**
3. Select candidate/application
4. Fill offer details:
   - Position
   - Department
   - Joining Date
   - Base Salary *
   - Allowances
   - Bonus (if any)
   - Benefits Summary
   - Work Location
   - Reporting Manager
5. Generate offer letter
6. System creates unique OFFER number (e.g., OFFER20240001)

**Sending Offer**:
1. Review generated offer letter
2. Click **"Send Offer"**
3. Email sent to candidate
4. Status: OFFER_SENT

**Tracking Offer Status**:
- **Pending**: Offer sent, awaiting response
- **Accepted**: Candidate accepted
- **Rejected**: Candidate declined
- **Expired**: Offer validity expired

---

## Reports & Analytics

### Executive Dashboard

**Accessing Dashboards**:

1. Go to **Reports** → **Dashboards**
2. Select dashboard type:
   - **Executive Dashboard**: Overall HR metrics
   - **Recruitment Dashboard**: Hiring pipeline stats
   - **Attendance Trends**: Attendance patterns
   - **Department Analytics**: Department-wise breakdown

**Key Metrics Available**:

- **Employee Metrics**:
  - Total employees
  - New hires vs exits
  - Turnover rate
  - Department distribution
  - Designation distribution

- **Attendance Metrics**:
  - Average attendance rate
  - Late arrivals trend
  - Overtime hours
  - Location-wise attendance

- **Leave Metrics**:
  - Leave utilization rate
  - Most common leave types
  - Leave balance summary
  - Peak leave periods

- **Payroll Metrics**:
  - Total payroll cost
  - Average salary by department
  - Salary distribution
  - Tax collections

> **Screenshot**: Executive Dashboard showing charts and graphs for Employee Metrics, Attendance Metrics, Leave Metrics, and Payroll Metrics with trend lines

### Generating Reports

**Available Reports**:

1. **Employee Reports**:
   - Employee List (with filters)
   - New Hires Report
   - Exit Report
   - Birthday Report
   - Probation Due Report

2. **Attendance Reports**:
   - Daily Attendance Register
   - Monthly Attendance Summary
   - Late Arrival Report
   - Early Departure Report
   - Overtime Report
   - Location-wise Attendance

3. **Leave Reports**:
   - Leave Balance Report
   - Leave Utilization Report
   - Leave History
   - Department Leave Summary

4. **Payroll Reports**:
   - Salary Register
   - Payroll Summary
   - Tax Deduction Report
   - Bank Transfer Report
   - Loan Deduction Report

**Generating a Report**:

1. Go to **Reports** → **Generate Report**
2. Select report category
3. Choose specific report
4. Set filters:
   - Date Range
   - Department(s)
   - Employment Type
   - Other relevant filters
5. Select output format:
   - **View Online**: Display in browser
   - **Export to Excel**: Download .xlsx file
   - **Export to PDF**: Download .pdf file
6. Click **"Generate"**
7. Report will be generated and displayed/downloaded

> **Screenshot**: Report generation interface showing report type selection, filter options (date range, department, etc.), and output format buttons (Excel, PDF, View Online)

### Custom Reports

**Creating Custom Reports**:

1. Go to **Reports** → **Custom Reports**
2. Click **"Create New Report"**
3. Configure:
   - Report Name
   - Data Source (Employee/Attendance/Leave/Payroll)
   - Columns to Include
   - Filters
   - Grouping
   - Sorting
4. Preview report
5. Save configuration
6. Report will be available in your saved reports

---

## System Configuration

### Location Management

**Adding a Client**:

1. Go to **Settings** → **Locations** → **Clients**
2. Click **"Add Client"**
3. Enter client details:
   - Client Name *
   - Client Code * (unique identifier)
   - Industry
   - Contact Person
   - Contact Email
   - Contact Phone
   - Address
4. Save client

**Adding a Location**:

1. Go to **Settings** → **Locations** → **Add Location**
2. Select client
3. Enter location details:
   - Location Name *
   - Location Code *
   - **GPS Coordinates** *:
     - Latitude (e.g., 40.7128)
     - Longitude (e.g., -74.0060)
     - You can click "Use Current Location" if on-site
   - **Geofence Radius** * (default: 100 meters)
     - Range: 50m - 500m
   - Address *
   - Contact Person at Location
   - **Default Shift Times**:
     - Shift Start (e.g., 09:00)
     - Shift End (e.g., 18:00)
4. Save location

> **Screenshot**: Add Location form showing fields for Location Name, Code, GPS Coordinates (Latitude/Longitude), Geofence Radius slider (50-500m), Address, and Shift Times

**Assigning Employees to Locations**:

1. Open employee detail page
2. Go to **"Locations"** tab
3. Click **"Add Assignment"**
4. Select:
   - Location
   - Is Primary Location? (checkbox)
   - Assigned Date
5. Save assignment
6. Employee can now clock in/out at this location

### Department & Designation Management

**Managing Departments**:

1. Go to **Settings** → **Organization** → **Departments**
2. Click **"Add Department"**
3. Enter:
   - Department Name *
   - Department Code * (unique)
   - Description
4. Save department

**Managing Designations**:

1. Go to **Settings** → **Organization** → **Designations**
2. Click **"Add Designation"**
3. Enter:
   - Title * (e.g., "Senior Software Engineer")
   - Code * (unique)
   - Department (select)
   - Level (1-10, for hierarchy)
   - Description
4. Save designation

### Policy Documents Management

**Uploading Policy Documents**:

1. Go to **Settings** → **Policy Documents**
2. Click **"Upload Policy"**
3. Fill in:
   - Document Title *
   - Category * (HR Policy, Leave Policy, Code of Conduct, etc.)
   - Version * (e.g., 1.0)
   - Description
   - **Access Control**:
     - Public (all employees)
     - Specific Departments (select departments)
     - Specific Designations (select roles)
   - Effective From Date *
   - Effective To Date (optional)
4. Upload PDF file
5. Set status:
   - **Draft**: Not yet published
   - **Review**: Under review
   - **Approved**: Approved but not published
   - **Published**: Visible to employees
6. Click **"Save"**

> **Screenshot**: Policy document upload form showing Title, Category, Version, Access Control (Public/Specific Departments/Designations), Status dropdown, and file upload area

**Versioning**:
- When updating a policy, previous versions are preserved
- Employees can view version history
- Audit trail tracks all changes

### User Management

**Creating Admin Users**:

1. Go to **Settings** → **Users & Permissions**
2. Click **"Add User"**
3. Select or create linked employee
4. Assign roles:
   - **Super Admin**: Full system access
   - **HR Manager**: HR operations
   - **Supervisor**: Team management and approvals
   - **Payroll Manager**: Payroll processing
   - **Recruitment Manager**: Hiring operations
5. Set permissions for each module
6. Generate login credentials
7. Send welcome email with credentials

---

## Troubleshooting

### Common Issues and Solutions

#### Issue: Employee Cannot Clock In (Outside Geofence)

**Symptoms**: Employee gets "Outside geofence" error on mobile app

**Solutions**:
1. Verify GPS coordinates of location:
   - Go to Settings → Locations
   - Check latitude/longitude are correct
   - Use Google Maps to confirm
2. Check geofence radius:
   - Default is 100m, increase if needed (up to 500m)
   - Consider building layout and GPS accuracy
3. Verify employee is assigned to that location:
   - Check employee's location assignments
   - Ensure assignment is active

#### Issue: Attendance Not Moving Through Approval Workflow

**Symptoms**: Attendance stuck at one approval level

**Solutions**:
1. Check approver assignments:
   - Go to Settings → Approval Rules
   - Verify approvers are set for each tier
2. Verify approver has correct permissions:
   - Settings → Users & Permissions
   - Ensure user has "Approve Attendance" permission
3. Check for system notifications:
   - Approver may not be receiving notifications
   - Verify email settings

#### Issue: Payroll Calculation Incorrect

**Symptoms**: Net salary doesn't match expected amount

**Solutions**:
1. Verify attendance records:
   - Check all attendance is locked
   - Verify overtime hours are correct
2. Check salary structure:
   - Open employee salary details
   - Verify all components are correct
   - Check effective dates
3. Review deductions:
   - Verify loan EMIs
   - Check tax calculations
   - Review manual adjustments
4. Check leave deductions:
   - Ensure unpaid leaves are counted correctly

#### Issue: Reports Not Generating

**Symptoms**: Report generation fails or hangs

**Solutions**:
1. Check date range:
   - Very large date ranges may timeout
   - Try smaller date range
2. Check filters:
   - Remove filters one by one to identify issue
3. Clear browser cache:
   - Press Ctrl+Shift+Delete
   - Clear cache and reload
4. Try different export format:
   - If Excel fails, try PDF
5. Contact system administrator if issue persists

---

## FAQ

### General Questions

**Q: How do I reset my password?**
A: Click "Forgot Password" on the login page. Enter your email and follow the instructions sent to your inbox.

**Q: Can I access the system from mobile?**
A: Yes, the web admin panel is responsive and works on mobile browsers. However, employees should use the mobile app for clock-in/out.

**Q: How often is the dashboard data updated?**
A: Dashboard data is real-time. Refresh the page to see latest updates.

### Employee Management

**Q: Can I bulk import employees?**
A: Yes, go to Employees → Import. Download the Excel template, fill it out, and upload. System will validate and import all records.

**Q: What happens when I change an employee's department?**
A: The change takes effect immediately. All related records (attendance approvals, leave balances) will be updated. The change is logged in audit trail.

**Q: Can employees have multiple managers?**
A: Each employee has one primary reporting manager. However, they can have different approvers for attendance, leave, etc.

### Attendance

**Q: What if an employee forgets to clock out?**
A: Employee can submit an attendance correction request. Supervisor can approve the correction with the actual clock-out time.

**Q: Can I approve attendance in advance?**
A: No, attendance can only be approved after the employee has clocked out.

**Q: What is the maximum geofence radius?**
A: Maximum is 500 meters. Default is 100 meters. Adjust based on location size and GPS accuracy needs.

**Q: How accurate is GPS tracking?**
A: GPS accuracy is typically 5-10 meters in open areas. Accuracy may be reduced indoors or in dense urban areas.

### Leave Management

**Q: Can employees apply for partial day leave?**
A: Not currently. Leave must be in full days. For partial days, mark attendance normally.

**Q: What happens to unused leave balance?**
A: Depends on leave type configuration. Some leave types allow carry-forward, others don't. Configure in Settings → Leave Types.

**Q: Can I approve leave requests in bulk?**
A: Yes, select multiple requests using checkboxes and click "Bulk Approve".

### Payroll

**Q: When should I process payroll?**
A: Process payroll after the month ends and all attendance is approved and locked. Typically between 1st and 5th of the following month.

**Q: Can I reprocess payroll if I made a mistake?**
A: No, payroll cannot be reprocessed once finalized. You must make adjustments in the next payroll cycle or issue a supplementary payment.

**Q: Are payslips automatically emailed to employees?**
A: Yes, when you click "Email All Payslips", system sends secure PDFs to all employees' registered email addresses.

**Q: How do I handle mid-month joiners?**
A: System automatically calculates pro-rated salary based on working days. No manual calculation needed.

### Reports

**Q: Can I schedule reports to run automatically?**
A: Not in current version. This feature is planned for a future release.

**Q: Why is my Excel export showing numbers as text?**
A: Some spreadsheet programs may import numbers as text. Use "Text to Columns" feature in Excel to convert.

**Q: Can I share reports with others?**
A: Yes, export to PDF or Excel and share the file. Ensure you follow company data privacy policies.

---

## Need More Help?

If you can't find the answer in this guide:

1. **Check the Knowledge Base**: [Internal KB Link]
2. **Contact IT Support**: support@yourcompany.com
3. **System Administrator**: [Admin Name/Email]
4. **Submit a Ticket**: [Ticket System URL]

---

**Document Version**: 2.0
**Last Updated**: November 2024
**Feedback**: Please send documentation feedback to docs@yourcompany.com

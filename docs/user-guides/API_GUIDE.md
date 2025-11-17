# HRFlow Pro - API Documentation

**Version**: 2.0
**Last Updated**: November 2024
**API Type**: GraphQL Federation
**Audience**: Developers, Integration Teams

---

## Table of Contents

1. [Introduction](#introduction)
2. [Authentication](#authentication)
3. [GraphQL Endpoints](#graphql-endpoints)
4. [Employee Service API](#employee-service-api)
5. [Attendance Service API](#attendance-service-api)
6. [Leave Service API](#leave-service-api)
7. [Location Service API](#location-service-api)
8. [Payroll Service API](#payroll-service-api)
9. [Recruitment Service API](#recruitment-service-api)
10. [Analytics Service API](#analytics-service-api)
11. [Error Handling](#error-handling)
12. [Rate Limiting](#rate-limiting)
13. [Best Practices](#best-practices)
14. [Code Examples](#code-examples)

---

## Introduction

HRFlow Pro provides a comprehensive GraphQL API built on Apollo Federation v2. The system consists of multiple microservices, each exposing its own GraphQL subgraph, unified through the API Gateway.

### Architecture

```
┌─────────────────────┐
│   API Gateway       │
│   Port: 4000        │
│   /graphql          │
└──────────┬──────────┘
           │
     ┌─────┴─────────────────────┐
     │                           │
┌────▼────┐  ┌──────▼──────┐  ┌─▼─────────┐
│Employee │  │ Attendance  │  │  Leave    │
│:3001    │  │ :3002       │  │  :3003    │
└─────────┘  └─────────────┘  └───────────┘
     │              │                │
┌────▼────┐  ┌──────▼──────┐  ┌─▼──────────┐
│Location │  │  Payroll    │  │Recruitment │
│:3004    │  │  :3005      │  │  :3006     │
└─────────┘  └─────────────┘  └────────────┘
           │
     ┌─────▼────────┐
     │  Analytics   │
     │  :3007       │
     └──────────────┘
```

### Base URLs

- **Production**: `https://api.yourcompany.com/graphql`
- **Staging**: `https://staging-api.yourcompany.com/graphql`
- **Development**: `http://localhost:4000/graphql`

### GraphQL Playground

Access the interactive GraphQL Playground at:
- Production: `https://api.yourcompany.com/graphql`
- Development: `http://localhost:4000/graphql`

---

## Authentication

### JWT Authentication

HRFlow Pro uses JWT (JSON Web Tokens) for authentication.

#### Login

```graphql
mutation Login {
  login(email: "user@example.com", password: "password123") {
    accessToken
    refreshToken
    user {
      id
      email
      role
    }
  }
}
```

**Response**:
```json
{
  "data": {
    "login": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "user": {
        "id": "user-123",
        "email": "user@example.com",
        "role": "EMPLOYEE"
      }
    }
  }
}
```

#### Using the Access Token

Include the access token in the `Authorization` header:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Token Expiry

- **Access Token**: Expires in 1 hour
- **Refresh Token**: Expires in 7 days

#### Refreshing Tokens

```graphql
mutation RefreshToken {
  refreshToken(refreshToken: "your-refresh-token") {
    accessToken
    refreshToken
  }
}
```

---

## GraphQL Endpoints

### API Gateway (Federated)

**URL**: `http://localhost:4000/graphql`

The API Gateway combines all services into a single GraphQL schema using Apollo Federation.

### Individual Service Endpoints

Direct access to services (for development/debugging):

- **Employee Service**: `http://localhost:3001/graphql`
- **Attendance Service**: `http://localhost:3002/graphql`
- **Leave Service**: `http://localhost:3003/graphql`
- **Location Service**: `http://localhost:3004/graphql`
- **Payroll Service**: `http://localhost:3005/graphql`
- **Recruitment Service**: `http://localhost:3006/graphql`
- **Analytics Service**: `http://localhost:3007/graphql`

---

## Employee Service API

### Types

```graphql
type Employee {
  id: ID!
  employeeNumber: String!
  firstName: String!
  lastName: String!
  fullName: String!
  email: String!
  phone: String
  dateOfBirth: Date
  gender: Gender
  maritalStatus: MaritalStatus
  department: Department!
  designation: Designation!
  supervisor: Employee
  employmentType: EmploymentType!
  joinDate: Date!
  status: EmployeeStatus!
  documents: [EmployeeDocument!]!
  salaryStructures: [SalaryStructure!]!
  currentSalary: SalaryStructure
  createdAt: DateTime!
  updatedAt: DateTime!
}

type Department {
  id: ID!
  name: String!
  code: String!
  description: String
  isActive: Boolean!
  employees: [Employee!]!
}

type Designation {
  id: ID!
  title: String!
  code: String!
  department: Department!
  level: Int!
  description: String
  isActive: Boolean!
}

type SalaryStructure {
  id: ID!
  employee: Employee!
  basicSalary: Decimal!
  hra: Decimal!
  conveyanceAllowance: Decimal!
  medicalAllowance: Decimal!
  specialAllowance: Decimal!
  otherAllowances: Decimal!
  pfContribution: Decimal!
  esiContribution: Decimal!
  professionalTax: Decimal!
  grossSalary: Decimal!
  netSalary: Decimal!
  effectiveFrom: Date!
  effectiveTo: Date
  isCurrent: Boolean!
}

enum EmployeeStatus {
  ACTIVE
  ON_LEAVE
  SUSPENDED
  TERMINATED
  RESIGNED
  RETIRED
}

enum EmploymentType {
  FULL_TIME
  PART_TIME
  CONTRACT
  INTERNSHIP
  CONSULTANT
}
```

### Queries

#### Get Employee by ID

```graphql
query GetEmployee($id: ID!) {
  employee(id: $id) {
    id
    employeeNumber
    firstName
    lastName
    email
    department {
      name
    }
    designation {
      title
    }
    currentSalary {
      grossSalary
      netSalary
    }
  }
}
```

**Variables**:
```json
{
  "id": "emp-123"
}
```

#### Search Employees

```graphql
query SearchEmployees($filter: EmployeeFilter, $pagination: PaginationInput) {
  employees(filter: $filter, pagination: $pagination) {
    data {
      id
      employeeNumber
      firstName
      lastName
      email
      department {
        name
      }
      status
    }
    total
    hasMore
  }
}
```

**Variables**:
```json
{
  "filter": {
    "search": "John",
    "departmentIds": ["dept-123"],
    "status": ["ACTIVE"]
  },
  "pagination": {
    "limit": 20,
    "offset": 0
  }
}
```

### Mutations

#### Create Employee

```graphql
mutation CreateEmployee($input: CreateEmployeeInput!) {
  createEmployee(input: $input) {
    id
    employeeNumber
    firstName
    lastName
    email
  }
}
```

**Variables**:
```json
{
  "input": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "phone": "+1234567890",
    "departmentId": "dept-123",
    "designationId": "desig-123",
    "employmentType": "FULL_TIME",
    "joinDate": "2024-01-01"
  }
}
```

#### Update Employee

```graphql
mutation UpdateEmployee($id: ID!, $input: UpdateEmployeeInput!) {
  updateEmployee(id: $id, input: $input) {
    id
    firstName
    lastName
    status
  }
}
```

#### Create Salary Structure

```graphql
mutation CreateSalary($input: CreateSalaryStructureInput!) {
  createSalaryStructure(input: $input) {
    id
    basicSalary
    grossSalary
    netSalary
    effectiveFrom
  }
}
```

---

## Attendance Service API

### Types

```graphql
type Attendance {
  id: ID!
  employee: Employee!
  location: Location!
  attendanceDate: Date!
  clockInTime: DateTime!
  clockInLatitude: Float!
  clockInLongitude: Float!
  clockInDistance: Int!
  clockOutTime: DateTime
  clockOutLatitude: Float
  clockOutLongitude: Float
  clockOutDistance: Int
  totalHours: Float
  regularHours: Float
  overtimeHours: Float
  status: AttendanceStatus!
  isLate: Boolean!
  lateByMinutes: Int
  isEarlyDeparture: Boolean
  tier1Status: ApprovalStatus
  tier2Status: ApprovalStatus
  tier3Status: ApprovalStatus
  finalApprovalStatus: ApprovalStatus
  isLockedForPayroll: Boolean!
}

enum AttendanceStatus {
  CLOCKED_IN
  CLOCKED_OUT
  PENDING_L1
  PENDING_L2
  PENDING_L3
  APPROVED
  REJECTED
  LOCKED_FOR_PAYROLL
}

enum ApprovalStatus {
  PENDING
  APPROVED
  REJECTED
  REVISED
}
```

### Queries

#### Get Today's Attendance

```graphql
query GetTodayAttendance {
  todayAttendance {
    id
    clockInTime
    clockOutTime
    totalHours
    status
  }
}
```

#### Get Attendance Records

```graphql
query GetAttendance($filter: AttendanceFilter, $pagination: PaginationInput) {
  attendances(filter: $filter, pagination: $pagination) {
    data {
      id
      employee {
        employeeNumber
        firstName
        lastName
      }
      attendanceDate
      clockInTime
      clockOutTime
      totalHours
      overtimeHours
      status
    }
    total
  }
}
```

### Mutations

#### Clock In

```graphql
mutation ClockIn($input: ClockInInput!) {
  clockIn(input: $input) {
    id
    clockInTime
    clockInDistance
    status
  }
}
```

**Variables**:
```json
{
  "input": {
    "employeeId": "emp-123",
    "locationId": "loc-123",
    "latitude": 40.7128,
    "longitude": -74.0060
  }
}
```

#### Clock Out

```graphql
mutation ClockOut($attendanceId: ID!, $latitude: Float!, $longitude: Float!) {
  clockOut(attendanceId: $attendanceId, latitude: $latitude, longitude: $longitude) {
    id
    clockOutTime
    totalHours
    regularHours
    overtimeHours
    status
  }
}
```

#### Approve Attendance (Tier)

```graphql
mutation ApproveAttendance($attendanceId: ID!, $tier: Int!, $status: ApprovalStatus!, $comments: String) {
  approveTier(attendanceId: $attendanceId, tier: $tier, status: $status, comments: $comments) {
    id
    tier1Status
    tier2Status
    tier3Status
    finalApprovalStatus
  }
}
```

**Example**:
```json
{
  "attendanceId": "att-123",
  "tier": 1,
  "status": "APPROVED",
  "comments": "Approved by supervisor"
}
```

#### Bulk Approve

```graphql
mutation BulkApprove($attendanceIds: [ID!]!, $tier: Int!) {
  bulkApprove(attendanceIds: $attendanceIds, tier: $tier) {
    count
  }
}
```

---

## Leave Service API

### Types

```graphql
type Leave {
  id: ID!
  employee: Employee!
  leaveType: LeaveType!
  startDate: Date!
  endDate: Date!
  numberOfDays: Float!
  reason: String!
  status: LeaveStatus!
  tier1Approver: Employee
  tier1Status: ApprovalStatus
  tier2Approver: Employee
  tier2Status: ApprovalStatus
  tier3Approver: Employee
  tier3Status: ApprovalStatus
  appliedAt: DateTime!
}

type LeaveBalance {
  id: ID!
  employee: Employee!
  leaveType: LeaveType!
  totalDays: Float!
  usedDays: Float!
  remainingDays: Float!
  year: Int!
}

enum LeaveType {
  ANNUAL
  SICK
  CASUAL
  MATERNITY
  PATERNITY
  UNPAID
  COMPENSATORY
}

enum LeaveStatus {
  PENDING_L1
  PENDING_L2
  PENDING_L3
  APPROVED
  REJECTED
  CANCELLED
}
```

### Queries

#### Get Leave Balance

```graphql
query GetLeaveBalance($employeeId: ID!) {
  leaveBalance(employeeId: $employeeId) {
    leaveType
    totalDays
    usedDays
    remainingDays
  }
}
```

#### Get Leave Requests

```graphql
query GetLeaveRequests($filter: LeaveFilter) {
  leaves(filter: $filter) {
    data {
      id
      employee {
        firstName
        lastName
      }
      leaveType
      startDate
      endDate
      numberOfDays
      reason
      status
    }
  }
}
```

### Mutations

#### Apply for Leave

```graphql
mutation ApplyLeave($input: CreateLeaveInput!) {
  createLeave(input: $input) {
    id
    leaveType
    startDate
    endDate
    numberOfDays
    status
  }
}
```

**Variables**:
```json
{
  "input": {
    "employeeId": "emp-123",
    "leaveType": "ANNUAL",
    "startDate": "2024-06-01",
    "endDate": "2024-06-05",
    "reason": "Family vacation"
  }
}
```

#### Approve Leave

```graphql
mutation ApproveLeave($leaveId: ID!, $tier: Int!, $status: ApprovalStatus!, $comments: String) {
  approveLeave(leaveId: $leaveId, tier: $tier, status: $status, comments: $comments) {
    id
    status
    tier1Status
    tier2Status
    tier3Status
  }
}
```

---

## Location Service API

### Types

```graphql
type Location {
  id: ID!
  client: Client!
  name: String!
  code: String!
  latitude: Float!
  longitude: Float!
  geofenceRadius: Int!
  address: String!
  city: String
  state: String
  defaultShiftStart: Time!
  defaultShiftEnd: Time!
  isActive: Boolean!
}

type Client {
  id: ID!
  name: String!
  code: String!
  contactPerson: String
  contactEmail: String
  contactPhone: String
  locations: [Location!]!
}
```

### Queries

#### Get Active Locations

```graphql
query GetActiveLocations {
  activeLocations {
    id
    name
    latitude
    longitude
    geofenceRadius
    address
  }
}
```

#### Verify Geofence

```graphql
query VerifyGeofence($locationId: ID!, $latitude: Float!, $longitude: Float!) {
  verifyGeofence(locationId: $locationId, latitude: $latitude, longitude: $longitude) {
    isWithinGeofence
    distance
    radius
    distanceFromBoundary
  }
}
```

**Response**:
```json
{
  "data": {
    "verifyGeofence": {
      "isWithinGeofence": true,
      "distance": 45,
      "radius": 100,
      "distanceFromBoundary": 55
    }
  }
}
```

---

## Payroll Service API

### Types

```graphql
type Payroll {
  id: ID!
  employee: Employee!
  month: Int!
  year: Int!
  workingDays: Int!
  presentDays: Int!
  paidLeaveDays: Int!
  unpaidLeaveDays: Int!
  basicSalary: Decimal!
  grossSalary: Decimal!
  totalDeductions: Decimal!
  netSalary: Decimal!
  status: PayrollStatus!
  processedAt: DateTime
}

type Payslip {
  id: ID!
  payroll: Payroll!
  pdfUrl: String!
  generatedAt: DateTime!
}

enum PayrollStatus {
  DRAFT
  CALCULATED
  PROCESSED
  PAID
}
```

### Queries

#### Get Payroll

```graphql
query GetPayroll($employeeId: ID!, $month: Int!, $year: Int!) {
  payroll(employeeId: $employeeId, month: $month, year: $year) {
    id
    workingDays
    presentDays
    basicSalary
    grossSalary
    totalDeductions
    netSalary
    status
  }
}
```

#### Get Payslip

```graphql
query GetPayslip($payrollId: ID!) {
  payslip(payrollId: $payrollId) {
    id
    pdfUrl
    generatedAt
  }
}
```

### Mutations

#### Process Payroll

```graphql
mutation ProcessPayroll($month: Int!, $year: Int!) {
  processPayroll(month: $month, year: $year) {
    totalEmployees
    totalGrossSalary
    totalDeductions
    totalNetSalary
    status
  }
}
```

---

## Recruitment Service API

### Types

```graphql
type JobRequisition {
  id: ID!
  requisitionNumber: String!
  jobTitle: String!
  department: Department!
  numberOfPositions: Int!
  employmentType: EmploymentType!
  experienceLevel: ExperienceLevel!
  description: String!
  status: RequisitionStatus!
  applications: [Application!]!
}

type Application {
  id: ID!
  applicationNumber: String!
  requisition: JobRequisition!
  firstName: String!
  lastName: String!
  email: String!
  phone: String!
  currentCTC: Decimal
  expectedCTC: Decimal
  resumeUrl: String
  status: ApplicationStatus!
}

enum ApplicationStatus {
  RECEIVED
  SCREENING
  SHORTLISTED
  INTERVIEW_SCHEDULED
  INTERVIEWED
  SELECTED
  OFFER_EXTENDED
  HIRED
  REJECTED
}
```

### Queries & Mutations

#### Create Job Requisition

```graphql
mutation CreateRequisition($input: CreateRequisitionInput!) {
  createJobRequisition(input: $input) {
    id
    requisitionNumber
    jobTitle
    status
  }
}
```

#### Submit Application

```graphql
mutation SubmitApplication($input: CreateApplicationInput!) {
  submitApplication(input: $input) {
    id
    applicationNumber
    status
  }
}
```

---

## Analytics Service API

### Queries

#### Executive Dashboard

```graphql
query GetExecutiveDashboard {
  executiveDashboard {
    employees {
      totalActive
      newHires
      exits
      turnoverRate
    }
    attendance {
      averageRate
      lateArrivals
      overtimeHours
    }
    leave {
      totalRequests
      approvedLeaves
      pendingLeaves
    }
    payroll {
      totalCost
      averageSalary
    }
  }
}
```

#### Generate Report

```graphql
query GenerateReport($category: ReportCategory!, $filters: ReportFilters!) {
  generateReport(category: $category, filters: $filters) {
    reportData
    generatedAt
  }
}
```

---

## Error Handling

### Error Types

HRFlow Pro uses standard GraphQL error responses:

```json
{
  "errors": [
    {
      "message": "Employee not found",
      "extensions": {
        "code": "NOT_FOUND",
        "statusCode": 404
      }
    }
  ]
}
```

### Common Error Codes

| Code | Description |
|------|-------------|
| `UNAUTHENTICATED` | Missing or invalid authentication token |
| `FORBIDDEN` | Insufficient permissions |
| `NOT_FOUND` | Requested resource not found |
| `BAD_USER_INPUT` | Invalid input provided |
| `INTERNAL_SERVER_ERROR` | Server error |
| `CONFLICT` | Resource conflict (e.g., duplicate email) |

---

## Rate Limiting

- **Rate Limit**: 1000 requests per hour per IP
- **Headers**:
  - `X-RateLimit-Limit`: Total allowed requests
  - `X-RateLimit-Remaining`: Remaining requests
  - `X-RateLimit-Reset`: Reset timestamp

---

## Best Practices

### 1. Request Only What You Need

```graphql
# Good: Request only required fields
query {
  employee(id: "emp-123") {
    id
    firstName
    lastName
  }
}

# Bad: Request everything
query {
  employee(id: "emp-123") {
    id
    firstName
    lastName
    email
    phone
    address
    # ... many more fields
  }
}
```

### 2. Use Pagination

```graphql
query {
  employees(pagination: { limit: 20, offset: 0 }) {
    data {
      id
      firstName
    }
    total
    hasMore
  }
}
```

### 3. Handle Errors Gracefully

```javascript
try {
  const result = await client.query({ query: GET_EMPLOYEE });
} catch (error) {
  if (error.graphQLErrors) {
    error.graphQLErrors.forEach(err => {
      console.error(`GraphQL Error: ${err.message}`);
    });
  }
}
```

### 4. Use Variables

```graphql
# Good: Use variables
query GetEmployee($id: ID!) {
  employee(id: $id) {
    firstName
  }
}

# Bad: Hardcode values
query {
  employee(id: "emp-123") {
    firstName
  }
}
```

---

## Code Examples

### JavaScript/TypeScript with Apollo Client

```typescript
import { ApolloClient, InMemoryCache, gql, createHttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';

// Create HTTP link
const httpLink = createHttpLink({
  uri: 'http://localhost:4000/graphql',
});

// Auth link with JWT
const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('accessToken');
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    }
  };
});

// Initialize Apollo Client
const client = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache(),
});

// Login
const LOGIN = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      accessToken
      refreshToken
    }
  }
`;

const { data } = await client.mutate({
  mutation: LOGIN,
  variables: {
    email: 'user@example.com',
    password: 'password123',
  },
});

localStorage.setItem('accessToken', data.login.accessToken);

// Clock In
const CLOCK_IN = gql`
  mutation ClockIn($input: ClockInInput!) {
    clockIn(input: $input) {
      id
      clockInTime
      status
    }
  }
`;

const clockInResult = await client.mutate({
  mutation: CLOCK_IN,
  variables: {
    input: {
      employeeId: 'emp-123',
      locationId: 'loc-123',
      latitude: 40.7128,
      longitude: -74.0060,
    },
  },
});
```

### Python with GQL

```python
from gql import gql, Client
from gql.transport.requests import RequestsHTTPTransport

# Setup
transport = RequestsHTTPTransport(
    url='http://localhost:4000/graphql',
    headers={'Authorization': f'Bearer {access_token}'},
)

client = Client(transport=transport, fetch_schema_from_transport=True)

# Query employees
query = gql('''
    query GetEmployees($filter: EmployeeFilter) {
        employees(filter: $filter) {
            data {
                id
                firstName
                lastName
                email
            }
        }
    }
''')

result = client.execute(query, variable_values={
    'filter': {
        'search': 'John',
        'status': ['ACTIVE']
    }
})

print(result['employees']['data'])
```

### cURL

```bash
# Login
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation { login(email: \"user@example.com\", password: \"password123\") { accessToken } }"
  }'

# Get Employee
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "query": "query { employee(id: \"emp-123\") { firstName lastName } }"
  }'
```

---

## Support

For API support:
- **Email**: api-support@yourcompany.com
- **Documentation**: https://docs.yourcompany.com/api
- **GraphQL Playground**: http://localhost:4000/graphql (development)

---

**Document Version**: 2.0
**Last Updated**: November 2024
**API Version**: v2.0

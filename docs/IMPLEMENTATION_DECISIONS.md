# HRFlow Pro - Implementation Decisions
## Clarifications and Technical Decisions

**Version:** 2.0
**Last Updated:** November 16, 2024
**Status:** Approved

---

## Table of Contents

1. [Overview](#overview)
2. [Infrastructure Decisions](#infrastructure-decisions)
3. [Authentication Strategy](#authentication-strategy)
4. [GPS Geofencing Configuration](#gps-geofencing-configuration)
5. [Multi-Location Assignment Strategy](#multi-location-assignment-strategy)
6. [Payroll Error Handling](#payroll-error-handling)
7. [Impact Analysis](#impact-analysis)
8. [Implementation Priority](#implementation-priority)

---

## Overview

This document captures the critical implementation decisions made during the PRD clarification process. These decisions directly impact the system architecture, development approach, and operational procedures.

**Decision-Making Date:** November 16, 2024
**Decision Authority:** Product Owner & Technical Lead
**Review Status:** Approved for Implementation

---

## Infrastructure Decisions

### Decision: On-Premise Docker Compose Deployment

**Question Addressed:**
> "What is the deployment infrastructure preference for HRFlow Pro?"

**Decision:**
- **Selected Option**: On-Premise deployment using Docker/Docker Compose
- **Alternative Options Considered**:
  - AWS Cloud (EKS, RDS, ElastiCache)
  - Azure Cloud (AKS, Azure Database)
  - GCP Cloud (GKE, Cloud SQL)

**Rationale:**

1. **Data Sovereignty:**
   - Complete control over sensitive employee data
   - Meets regulatory requirements for data residency
   - No third-party cloud provider access to HR data

2. **Cost Predictability:**
   - Fixed infrastructure costs (no per-usage billing)
   - No egress charges for data transfer
   - Better long-term cost projection

3. **Compliance:**
   - Easier to maintain SOC 2 Type II compliance
   - Direct control over security infrastructure
   - Simplified audit processes

4. **Performance:**
   - Low latency for local network access
   - No internet dependency for core operations
   - Optimized for on-premise network topology

**Technical Implementation:**

```yaml
Orchestration: Docker Compose
Containerization: Docker
Database: PostgreSQL 15 (containerized)
Cache: Redis (containerized)
Object Storage: MinIO (self-hosted S3-compatible)
Message Queue: RabbitMQ (containerized)
Monitoring: Prometheus + Grafana
Logging: ELK Stack (Elasticsearch, Logstash, Kibana)
```

**Migration Path:**
- If future scalability requires, system can be migrated to Kubernetes
- Docker Compose configuration is compatible with Kubernetes manifests
- Microservices architecture supports cloud migration

**Impact:**
- Development: Requires Docker Compose expertise
- Operations: Need on-premise infrastructure management skills
- Timeline: +2 weeks for Docker infrastructure setup
- Cost: Initial hardware investment required

**Related Documents:**
- See: [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment guide

---

## Authentication Strategy

### Decision: Email/Password First, Biometric Later

**Question Addressed:**
> "Which authentication method should be implemented first for the mobile app?"

**Decision:**
- **Selected Option**: Email/Password authentication (Phase 1)
- **Future Enhancement**: Biometric authentication (Phase 2)
- **Alternative Options Considered**:
  - Biometric first (Face ID/Fingerprint)
  - SSO Integration (SAML/OAuth)

**Rationale:**

1. **Universal Compatibility:**
   - Works on all devices regardless of hardware capabilities
   - No dependency on biometric sensors
   - Simpler fallback mechanisms

2. **Development Timeline:**
   - Faster implementation (4-6 weeks vs 8-10 weeks)
   - Well-established patterns and libraries
   - Easier testing and validation

3. **User Familiarity:**
   - Employees already familiar with email/password
   - Lower training requirements
   - Reduced support overhead

4. **Security Foundation:**
   - Establishes strong password policies
   - Enables account recovery workflows
   - Foundation for adding 2FA later

**Technical Implementation:**

**Phase 1 (MVP) - Weeks 1-6:**
```javascript
Authentication Flow:
1. Email/Password with secure password hashing (bcrypt)
2. JWT access tokens (1 hour expiry)
3. Refresh tokens (7 days expiry)
4. Session management with Redis
5. Basic security features:
   - Rate limiting (5 failed attempts = 15 min lockout)
   - Account lockout after 10 failed attempts
   - Password complexity requirements
   - Password expiry (90 days)
```

**Phase 2 (Enhanced Security) - Weeks 12-16:**
```javascript
Additional Features:
1. Biometric Authentication (Face ID/Fingerprint)
   - Platform-specific implementation (iOS/Android)
   - Fallback to Email/Password
   - Local biometric storage

2. Two-Factor Authentication (2FA)
   - TOTP-based (Google Authenticator compatible)
   - SMS-based (optional)
   - Backup codes for recovery

3. Advanced Security:
   - Device fingerprinting
   - Anomaly detection
   - Geolocation verification
```

**Password Policy:**
```yaml
Requirements:
  minimum_length: 12
  require_uppercase: true
  require_lowercase: true
  require_numbers: true
  require_special_chars: true
  disallow_common_passwords: true
  prevent_password_reuse: 5  # last 5 passwords

Expiry:
  password_expiry_days: 90
  expiry_warning_days: 7
  force_change_first_login: true
```

**Impact:**
- Development: -4 weeks compared to biometric-first approach
- User Experience: Temporary trade-off (familiar but less convenient)
- Security: Strong foundation, enhanced in Phase 2
- Testing: Simpler test scenarios in Phase 1

**Migration Plan:**
- Phase 1: All users use Email/Password
- Phase 2: Biometric authentication optional for users with capable devices
- No breaking changes to existing authentication

---

## GPS Geofencing Configuration

### Decision: Standard 100m Radius

**Question Addressed:**
> "What is the GPS accuracy requirement for attendance clock-in validation?"

**Decision:**
- **Selected Option**: Standard 100 meters geofence radius
- **Alternative Options Considered**:
  - Strict 50m (high accuracy)
  - Flexible 200m (wide radius)
  - Configurable per location

**Rationale:**

1. **Balanced Accuracy:**
   - Works in most environments (outdoor and indoor)
   - Accounts for typical GPS drift (5-15 meters)
   - Reduces false rejections from GPS inaccuracy

2. **Practical Usability:**
   - Prevents "buddy punching" while allowing legitimate access
   - Works in parking lots and building entrances
   - Minimal user frustration from GPS issues

3. **Urban Environment Compatibility:**
   - Accounts for signal interference in dense areas
   - Works near tall buildings with GPS reflection
   - Suitable for multi-story buildings

4. **Emergency Flexibility:**
   - Admin can override for special cases
   - Per-location radius adjustment available
   - Manual verification fallback exists

**Technical Implementation:**

```javascript
// Geofence Validation Algorithm
function validateGeofence(employeeCoords, locationCoords, radius = 100) {
  const distance = calculateHaversineDistance(
    employeeCoords.latitude,
    employeeCoords.longitude,
    locationCoords.latitude,
    locationCoords.longitude
  );

  return {
    isWithinGeofence: distance <= radius,
    distance: Math.round(distance),
    geofenceRadius: radius,
    accuracyWarning: distance > (radius * 0.8) // Warn if near boundary
  };
}

// Haversine Distance Formula
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distance in meters
}
```

**Database Configuration:**

```sql
-- Default radius in client_locations table
CREATE TABLE client_locations (
    -- ... other fields ...
    geofence_radius_meters INT DEFAULT 100, -- Standard 100m
    -- ... other fields ...
);

-- Allow per-location override
UPDATE client_locations
SET geofence_radius_meters = 150
WHERE location_type = 'large_campus';

UPDATE client_locations
SET geofence_radius_meters = 50
WHERE location_type = 'small_office';
```

**User Experience:**

```
Clock-In Scenarios:

1. Within Geofence (< 100m):
   ✅ "You are at ABC Corp HQ"
   Distance: 45m
   [Clock In] button enabled

2. Near Boundary (80-100m):
   ⚠️ "You are near ABC Corp HQ"
   Distance: 92m (check your position)
   [Clock In] button enabled with warning

3. Outside Geofence (> 100m):
   ❌ "You are too far from ABC Corp HQ"
   Distance: 125m (move closer)
   [Request Manual Override] button available

4. GPS Unavailable:
   ⚠️ "GPS signal weak"
   [Retry GPS] or [Request Manual Override]
```

**Override Capabilities:**

```yaml
Location-Specific Override:
  - Large campuses: 150-200m
  - Small offices: 50-75m
  - Indoor facilities: 100-150m
  - High-security sites: 50m

Manual Override:
  - Supervisor approval required
  - Reason must be provided
  - Logged in audit trail
  - Time-limited (24 hours)
```

**Impact:**
- Development: Standard implementation, no additional complexity
- User Experience: Minimal GPS-related issues expected
- Security: Adequate for preventing buddy punching
- Operations: Flexibility for special cases available

---

## Multi-Location Assignment Strategy

### Decision: Multiple Active Assignments

**Question Addressed:**
> "What is the multi-client location assignment strategy for employees?"

**Decision:**
- **Selected Option**: Multiple Active assignments with daily location tracking
- **Alternative Options Considered**:
  - Single Primary location only
  - Scheduled Rotation (pre-planned)
  - Dynamic Assignment (real-time)

**Rationale:**

1. **Operational Flexibility:**
   - Employees can work at multiple sites
   - Support for rotating schedules
   - Coverage for staff shortages

2. **Realistic Staffing Model:**
   - Reflects actual security/staffing industry practices
   - Employees often cover multiple locations
   - Simplifies resource allocation

3. **Accurate Attendance Tracking:**
   - Daily records specify actual location worked
   - GPS coordinates confirm location
   - Enables location-specific reporting

4. **Scalability:**
   - Supports complex deployment scenarios
   - No artificial constraints on assignments
   - Future-proof for business growth

**Technical Implementation:**

**Database Schema Changes:**

```sql
-- REMOVED: Single assignment constraint
-- CONSTRAINT one_current_assignment_per_employee
--     EXCLUDE (employee_id WITH =) WHERE (is_current = TRUE)

-- Now employees can have multiple is_current = TRUE assignments

-- Example multi-location employee:
INSERT INTO location_assignments VALUES
  ('uuid1', 'emp-001', 'client-abc', 'loc-hq', 'Security Guard', '2024-11-01', NULL, TRUE),
  ('uuid2', 'emp-001', 'client-abc', 'loc-warehouse', 'Security Guard', '2024-11-01', NULL, TRUE),
  ('uuid3', 'emp-001', 'client-xyz', 'loc-office', 'Security Guard', '2024-11-15', NULL, TRUE);

-- Daily attendance specifies actual location
INSERT INTO attendance VALUES
  ('att-001', 'emp-001', '2024-11-16', 'loc-hq', ...),      -- Worked at HQ
  ('att-002', 'emp-001', '2024-11-17', 'loc-warehouse', ...); -- Worked at Warehouse
```

**GraphQL Schema Updates:**

```graphql
type Employee {
  # Changed from single to multiple
  currentLocations: [LocationAssignment!]!  # All active assignments
  primaryLocation: LocationAssignment       # Designated primary/default

  # Location-specific queries
  activeAssignments(
    clientId: ID
    startDate: Date
    endDate: Date
  ): [LocationAssignment!]!
}

type LocationAssignment {
  employee: Employee!
  client: Client!
  location: ClientLocation!
  roleAtSite: String!
  isPrimary: Boolean!          # Designates primary location
  isCurrent: Boolean!
  startDate: Date!
  endDate: Date
  shiftPattern: ShiftPattern
}

query employeeLocations($employeeId: ID!) {
  employee(id: $employeeId) {
    currentLocations {
      location {
        locationName
        address
      }
      isPrimary
      roleAtSite
    }
  }
}
```

**Business Rules:**

```javascript
const multiLocationRules = {
  assignments: {
    maxActiveLocations: 5,        // Prevent excessive assignments
    requirePrimaryLocation: true,  // At least one primary
    preventConflictingShifts: true // No overlapping shifts
  },

  attendance: {
    requireLocationSelection: true, // Choose location at clock-in
    validateGeofence: true,         // Must be at selected location
    trackActualLocation: true,      // GPS confirms location
    allowLocationChange: false      // Can't change after clock-in
  },

  scheduling: {
    validateCoverage: true,         // Ensure location staffing
    preventDoubleBooking: true,     // Can't be at 2 places
    allowFlexibleRotation: true     // Support rotation schedules
  },

  reporting: {
    groupByLocation: true,          // Location-specific reports
    trackUtilization: true,         // Multi-location utilization
    identifyConflicts: true         // Flag scheduling conflicts
  }
};
```

**User Interface - Employee View:**

```
Your Current Assignments:

📍 PRIMARY LOCATION
   ABC Corp HQ
   123 Business Ave, NYC
   Role: Security Supervisor
   Schedule: Mon-Wed, 8 AM - 5 PM
   [View Details] [Clock In]

📍 SECONDARY LOCATION
   ABC Corp Warehouse
   456 Industrial Rd, NJ
   Role: Security Guard
   Schedule: Thu-Fri, 8 AM - 5 PM
   [View Details] [Clock In]

📍 ON-CALL LOCATION
   XYZ Corp Office
   789 Office Park, NYC
   Role: Relief Security
   Schedule: As needed
   [View Details]
```

**Admin Dashboard - Location Staffing:**

```
ABC Corp HQ - Today's Staffing
━━━━━━━━━━━━━━━━━━━━━━━━━━━

ASSIGNED: 50 employees
├─ Primary Assignment: 45
├─ Secondary Assignment: 3
└─ On-Call: 2

PRESENT: 48 / 50
├─ Clocked In: 46
├─ On Leave: 2
└─ Absent: 2

MULTI-LOCATION EMPLOYEES:
├─ John Doe (EMP-001) - Also assigned to Warehouse
├─ Jane Smith (EMP-015) - Also assigned to Regional Office
└─ [View All]
```

**Impact:**
- Development: Moderate complexity increase for multi-location queries
- User Experience: More flexibility for employees and managers
- Reporting: Enhanced location-specific insights
- Scalability: Better support for complex deployment scenarios

**Migration from Single-Location:**
```sql
-- Script to handle existing single-location employees
UPDATE location_assignments
SET is_primary = TRUE
WHERE is_current = TRUE;

-- No data loss or breaking changes
-- Existing employees continue with single location
-- New assignments can add additional locations
```

---

## Payroll Error Handling

### Decision: HR Override with Audit Trail

**Question Addressed:**
> "What should happen when an employee's attendance reaches the payroll locked state but contains errors?"

**Decision:**
- **Selected Option**: HR Override capability with comprehensive audit trail
- **Alternative Options Considered**:
  - Block entire payroll batch processing
  - Process and adjust errors in next cycle
  - Partial processing (clean records only)

**Rationale:**

1. **Operational Continuity:**
   - Prevents payroll delays for entire organization
   - Allows correction of individual errors
   - Maintains salary disbursement schedule

2. **Accountability:**
   - Complete audit trail of all corrections
   - Identifies who made changes and why
   - Supports compliance and auditing

3. **Flexibility:**
   - Handles emergency corrections
   - Supports exceptional circumstances
   - Balances control with practicality

4. **Error Recovery:**
   - Systematic correction process
   - Re-approval after corrections
   - Prevents data corruption

**Technical Implementation:**

**GraphQL Mutation:**

```graphql
mutation UnlockPayrollAttendance(
  $attendanceIds: [ID!]!
  $reason: String!
  $hrApproverId: ID!
) {
  unlockPayrollLockedAttendance(
    attendanceIds: $attendanceIds
    reason: $reason
    hrApproverId: $hrApproverId
  ) {
    successful
    failed
    unlockedAttendance {
      id
      employeeCode
      date
      previousStatus
      newStatus
    }
    errors {
      attendanceId
      errorMessage
      errorCode
    }
    auditLogEntries {
      id
      userId
      action
      reason
      timestamp
    }
  }
}
```

**Workflow Process:**

```
HR Override Workflow:
━━━━━━━━━━━━━━━━━━━

1. Error Detection
   ├─ HR reviews payroll batch
   ├─ Identifies incorrect attendance records
   └─ Notes: clock-in time wrong, missing clock-out, etc.

2. Unlock Request
   ├─ HR initiates unlock via admin panel
   ├─ Selects specific attendance records
   ├─ Provides detailed justification
   └─ System validates HR_MANAGER role

3. System Actions
   ├─ Creates audit log entry
   ├─ Unlocks attendance records
   ├─ Changes status: LOCKED_FOR_PAYROLL → PENDING_L3
   ├─ Sends notifications to stakeholders
   └─ Prevents payroll batch processing until resolved

4. Correction Process
   ├─ HR makes necessary corrections
   ├─ Supervisor reviews changes
   ├─ Operations Manager approves
   ├─ Manager verifies
   └─ System re-locks for payroll

5. Audit Trail
   ├─ Original data preserved
   ├─ All changes logged
   ├─ Approver chain tracked
   └─ Compliance report generated
```

**Security Controls:**

```javascript
const payrollOverrideControls = {
  authorization: {
    requiredRole: "HR_MANAGER",
    requiresMFA: true,              // Two-factor auth required
    ipWhitelisting: true,           // Only from office network
    timeRestriction: "business_hours" // 8 AM - 6 PM only
  },

  validation: {
    maxUnlocksPerBatch: 50,         // Prevent mass unlock abuse
    requireReason: true,
    minimumReasonLength: 20,        // Detailed explanation required
    preventOldRecords: true,        // Max 48 hours after lock
    requireManagerApproval: true    // Manager must approve unlock
  },

  audit: {
    logAllActions: true,
    retainOriginalData: true,       // Preserve before state
    trackIPAddress: true,
    trackUserAgent: true,
    immutableAuditLog: true,        // Cannot be deleted
    realTimeAlerts: true            // Alert on unlock actions
  },

  notifications: {
    notifyFinanceManager: true,
    notifySystemAdmin: true,
    notifyOperationsManager: true,
    emailDigest: "daily",           // Daily summary of unlocks
    slackAlert: true                // Real-time Slack notification
  }
};
```

**Database Schema:**

```sql
-- Audit table for payroll unlocks
CREATE TABLE payroll_unlock_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attendance_id UUID NOT NULL REFERENCES attendance(id),
    unlocked_by UUID NOT NULL REFERENCES users(id),
    unlock_reason TEXT NOT NULL,
    unlock_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    original_status VARCHAR(50),
    original_data JSONB,              -- Preserve original state
    correction_data JSONB,            -- New data after correction
    relock_timestamp TIMESTAMP,
    relock_by UUID REFERENCES users(id),
    ip_address INET,
    user_agent TEXT,
    approval_chain JSONB,             -- Track re-approval
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for audit queries
CREATE INDEX idx_payroll_unlock_audit_date
    ON payroll_unlock_audit(unlock_timestamp);
CREATE INDEX idx_payroll_unlock_audit_user
    ON payroll_unlock_audit(unlocked_by);
```

**Admin UI - Unlock Interface:**

```
Unlock Payroll-Locked Attendance
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ WARNING: This action will unlock attendance records that
   have been finalized for payroll processing.

Selected Records: 3

1. [EMP-001] John Doe - 2024-11-15
   Current Status: LOCKED_FOR_PAYROLL
   Issue: Clock-out time missing

2. [EMP-045] Jane Smith - 2024-11-16
   Current Status: LOCKED_FOR_PAYROLL
   Issue: Wrong location recorded

3. [EMP-089] Bob Johnson - 2024-11-17
   Current Status: LOCKED_FOR_PAYROLL
   Issue: Overtime hours incorrect

Unlock Reason: (required, minimum 20 characters)
┌────────────────────────────────────────────────┐
│ Clock-out times missing due to GPS signal     │
│ loss. Confirmed actual clock-out times with   │
│ site supervisor. Need to update before        │
│ payroll processing.                            │
└────────────────────────────────────────────────┘

Approval Required: [X] Finance Manager
                   [X] Operations Manager

[Cancel] [Request Manager Approval]

Audit Trail:
- This action will be logged
- Stakeholders will be notified
- Original data will be preserved
- Records will require re-approval
```

**Compliance Report:**

```
Payroll Unlock Audit Report
November 2024
━━━━━━━━━━━━━━━━━━━━━━━━━━

Total Unlocks: 12
Unique Employees: 8
Unlock Reasons:
  - GPS signal issues: 5
  - Missing clock-out: 4
  - Location errors: 2
  - Time correction: 1

Unlocked By:
  - HR Manager A: 7
  - HR Manager B: 5

Average Time to Re-lock: 2.3 hours
Re-approval Success Rate: 100%

Compliance Status: ✅ All unlocks properly justified
                   ✅ All changes re-approved
                   ✅ Audit trail complete
```

**Impact:**
- Development: +3 weeks for unlock workflow and audit trail
- Operations: Requires HR training on unlock procedures
- Security: Enhanced audit and compliance capabilities
- User Experience: Prevents payroll delays, improves accuracy

---

## Impact Analysis

### Overall Project Impact

| Area | Impact | Details |
|------|--------|---------|
| **Timeline** | +2 weeks | Docker setup, authentication phasing |
| **Cost** | +15% | On-premise hardware, no cloud costs |
| **Complexity** | Medium | Balanced approach, manageable scope |
| **Risk** | Low | Proven technologies, incremental delivery |
| **Scalability** | High | Architecture supports future growth |
| **Compliance** | Improved | Better data control, audit capabilities |

### Development Phases

**Phase 1: Foundation (Weeks 1-8)**
- Docker Compose infrastructure setup
- Email/Password authentication
- Basic attendance tracking with 100m geofence
- Single-location assignment support
- Payroll processing without unlock feature

**Phase 2: Multi-Location (Weeks 9-12)**
- Multiple active assignments implementation
- Enhanced location tracking
- Location-specific reporting
- Rotation schedule support

**Phase 3: Advanced Features (Weeks 13-16)**
- Biometric authentication
- Two-factor authentication
- HR payroll override with audit trail
- Advanced analytics and reporting

**Phase 4: Enhancement (Weeks 17-20)**
- Performance optimization
- Advanced monitoring and alerting
- Additional integrations
- User experience improvements

---

## Implementation Priority

### High Priority (Must-Have for MVP)

1. ✅ Docker Compose infrastructure
2. ✅ Email/Password authentication
3. ✅ 100m geofence configuration
4. ✅ Basic attendance workflow
5. ✅ Single-location assignments

### Medium Priority (Important for Phase 2)

6. ✅ Multiple location assignments
7. ✅ HR payroll override
8. ⏳ Enhanced reporting
9. ⏳ Mobile app optimization
10. ⏳ Performance tuning

### Low Priority (Nice-to-Have / Phase 3+)

11. ⏳ Biometric authentication
12. ⏳ Two-factor authentication
13. ⏳ Advanced analytics
14. ⏳ AI-powered insights
15. ⏳ Third-party integrations

---

## Sign-Off

**Approved By:**
- [ ] Product Owner
- [ ] Technical Lead
- [ ] Engineering Manager
- [ ] Security Officer
- [ ] Compliance Officer

**Date Approved:** _______________

**Next Steps:**
1. Update project plan with new timeline
2. Brief development team on decisions
3. Update sprint planning with priorities
4. Begin Phase 1 implementation

---

**Document Version:** 1.0
**Document Owner:** Product Management
**Last Reviewed:** November 16, 2024

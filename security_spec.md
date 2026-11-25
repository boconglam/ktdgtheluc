# Security Specification: Thể Lực THPT 53/2008

## 1. Data Invariants

1. **PII & Account Isolation**: Documents in `/users/{userId}` contain email addresses and RBAC privileges (`role`, `canCloudSync`, `status`). Only the document owner (`request.auth.uid == userId`) or a verified `super_admin` may `get` a user profile. Self-registration cannot assign `super_admin`, `admin`, or `canCloudSync: true` unless the authenticated, email-verified user matches the bootstrapped Super Admin email (`boconglam@gmail.com`).
2. **Cloud Sync Authorization Invariant**: No client may create, update, or delete documents in `/schools`, `/students`, or `/assessments` unless the authenticated user has `email_verified == true` AND is either the bootstrapped Super Admin or holds an active `/users/{uid}` profile with `canCloudSync == true` and `status == 'active'`.
3. **Referential Integrity**: A `StudentProfile` in `/students/{studentId}` cannot be created without an existing parent `/schools/{schoolId}` document. A `FitnessAssessment` in `/assessments/{assessmentId}` cannot be created without existing `/students/{studentId}` and `/schools/{schoolId}` documents.
4. **Immutability & Temporal Integrity**: `uid`, `ownerUid`, `recordedByUid`, `studentId`, `schoolId`, and `createdAt` are immutable after creation. All `createdAt` and `updatedAt` timestamps must strictly equal `request.time`.
5. **Terminal State Locking**: Once a `FitnessAssessment` transitions to `status == 'finalized'`, non-admin staff cannot modify or delete it; only an authorized `super_admin` or `admin` with `canCloudSync == true` may revise it.
6. **Zero Query Trust**: Every `allow list` rule evaluates `resource.data` directly against `request.auth.uid` (or bootstrap Super Admin claim) without calling `get()` or `exists()`.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)

1. **Privilege Escalation on Registration**: Non-bootstrap user creates `/users/{uid}` with `{ role: 'super_admin', canCloudSync: true }`.
2. **Role Self-Promotion on Update**: Staff user updates their own `/users/{uid}` with `{ role: 'admin', canCloudSync: true }`.
3. **Email Spoofing**: Attacker authenticates with bootstrap email while `email_verified == false` and attempts to list `/users` or write `/schools`.
4. **Unauthorized Cloud Sync**: User with `canCloudSync: false` attempts to `create` a document in `/students/{studentId}` or `/assessments/{assessmentId}`.
5. **Shadow / Ghost Field Injection**: Authorized admin attempts to `create` `/students/{studentId}` with an extra unexpected key `{ isAdminOverride: true }`.
6. **Orphaned Student Record**: Authorized admin attempts to `create` `/students/{studentId}` referencing a non-existent `schoolId: 'non_existent_school'`.
7. **Orphaned Assessment Record**: Authorized admin attempts to `create` `/assessments/{assessmentId}` referencing a non-existent `studentId`.
8. **ID Poisoning (Resource Exhaustion)**: User attempts to `create` `/students/{2000-char-invalid-id}` with invalid characters or length > 128.
9. **Timestamp Forgery**: Authorized admin creates `/assessments/{id}` with backdated `createdAt: Timestamp(2020-01-01)` instead of `request.time`.
10. **Owner Hijack / Identity Spoofing**: Authorized user creates `/students/{id}` with `ownerUid: 'someone_else_uid'`.
11. **Terminal State Bypass**: Staff user with `canCloudSync: true` attempts to modify `situpsCount` on an assessment whose existing `status` is `'finalized'`.
12. **Blanket List Scraping**: Unrelated signed-in user attempts to `list` `/students` or `/assessments` without `request.auth.uid` present in `resource.data.authorizedUids`.

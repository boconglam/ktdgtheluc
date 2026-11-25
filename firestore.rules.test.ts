/**
 * Security Rules Adversarial Verification Suite ("Dirty Dozen")
 * Run against Firebase Emulator Suite when testing locally with @firebase/rules-unit-testing.
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  collection: string;
  operation: 'create' | 'update' | 'get' | 'list' | 'delete';
  expected: 'PERMISSION_DENIED';
  payload?: Record<string, unknown>;
}

export const DIRTY_DOZEN_TEST_CASES: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Self-assign super_admin role on user creation',
    collection: 'users/staff_uid_1',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: {
      uid: 'staff_uid_1',
      email: 'teacher@school.edu.vn',
      displayName: 'Giao vien A',
      role: 'super_admin',
      canCloudSync: true,
      status: 'active',
    },
  },
  {
    id: 2,
    name: 'Staff updates own canCloudSync and role',
    collection: 'users/staff_uid_1',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    payload: {
      role: 'admin',
      canCloudSync: true,
    },
  },
  {
    id: 3,
    name: 'Unverified email spoofing bootstrap Super Admin',
    collection: 'users',
    operation: 'list',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Staff with canCloudSync=false attempts cloud write to students',
    collection: 'students/stu_001',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: {
      id: 'stu_001',
      fullName: 'Nguyen Van A',
      schoolId: 'school_main',
      ownerUid: 'staff_uid_1',
    },
  },
  {
    id: 5,
    name: 'Shadow ghost field injection on student creation',
    collection: 'students/stu_002',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: {
      id: 'stu_002',
      fullName: 'Tran Thi B',
      shadowFlag: true,
    },
  },
  {
    id: 6,
    name: 'Orphaned student referencing missing schoolId',
    collection: 'students/stu_003',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: {
      id: 'stu_003',
      schoolId: 'missing_school_999',
    },
  },
  {
    id: 7,
    name: 'Orphaned assessment referencing missing studentId',
    collection: 'assessments/assess_001',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: {
      id: 'assess_001',
      studentId: 'missing_student_999',
    },
  },
  {
    id: 8,
    name: 'Path ID poisoning with invalid characters / excessive length',
    collection: 'students/invalid$id!with*bad#chars',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Client-forged createdAt timestamp instead of request.time',
    collection: 'assessments/assess_002',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: {
      createdAt: '2020-01-01T00:00:00Z',
    },
  },
  {
    id: 10,
    name: 'Identity spoofing ownerUid != request.auth.uid',
    collection: 'students/stu_004',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: {
      ownerUid: 'other_admin_uid',
    },
  },
  {
    id: 11,
    name: 'Non-admin modifying finalized assessment record',
    collection: 'assessments/assess_finalized',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    payload: {
      situpsCount: 30,
    },
  },
  {
    id: 12,
    name: 'Unauthorized user scraping students list without authorizedUids membership',
    collection: 'students',
    operation: 'list',
    expected: 'PERMISSION_DENIED',
  },
];

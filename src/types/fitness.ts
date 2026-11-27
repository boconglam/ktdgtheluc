export type UserRole = 'super_admin' | 'admin' | 'staff';
export type Gender = 'nam' | 'nu';
export type SchoolLevel = 'tat_ca' | 'tieu_hoc' | 'thcs' | 'thpt' | 'dai_hoc';
export type BmiStandardPreset = 'vn_wpro' | 'who_global' | 'custom';
export type GradeLevel = number; // 1-5 Tiểu học, 6-9 THCS, 10-12 THPT, 13-16 ĐH/CĐ
export type FitnessGrade = 'tot' | 'dat' | 'chua_dat';
export type EnduranceMode = '5min_m' | 'distance_s';
export type CaptureMethod = 'camera_ai' | 'manual';
export type AssessmentStatus = 'draft' | 'finalized';

export interface BmiStandardConfig {
  preset: BmiStandardPreset;
  countryLabel: string;
  underweightMax: number;
  normalMax: number;
  overweightMax: number;
  obese1Max: number;
  ageAdjustUnder18: boolean;
}

export const BLUEPRINT_LIMITS = {
  ID_MAX: 128,
  ID_REGEX: /^[a-zA-Z0-9_-]+$/,
  EMAIL_MAX: 254,
  NAME_MAX: 120,
  MANAGING_AUTHORITY_MAX: 200,
  SCHOOL_NAME_MAX: 200,
  SCHOOL_YEAR_MAX: 40,
  LOCATION_MAX: 80,
  DOC_CODE_MAX: 60,
  SIGNER_TITLE_MAX: 100,
  COUNTRY_LABEL_MAX: 100,
  STUDENT_CODE_MAX: 40,
  CLASS_NAME_MAX: 30,
  NOTES_MAX: 500,
  TERM_LABEL_MAX: 80,
  TESTED_AT_MAX: 40,
  BMI_CATEGORY_MAX: 40,
  MAX_AUTHORIZED_UIDS: 30,
  MAX_ASSIGNED_CLASSES: 30,
} as const;

export interface UserAccount {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  canCloudSync: boolean;
  canViewStudents: boolean;
  canEditStudents: boolean;
  canRecordTests: boolean;
  canExportPdf: boolean;
  assignedClasses: string[];
  status: 'active' | 'disabled';
  inviteId?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface UserInvite {
  id: string;
  email: string;
  displayName: string;
  role: 'admin' | 'staff';
  canCloudSync: boolean;
  canViewStudents: boolean;
  canEditStudents: boolean;
  canRecordTests: boolean;
  canExportPdf: boolean;
  assignedClasses: string[];
  status: 'active' | 'disabled';
  createdByUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SchoolAdminConfig {
  id: string;
  managingAuthority: string;
  schoolName: string;
  schoolYear: string;
  locationName: string;
  documentCode: string;
  signerTitle: string;
  signerName: string;
  preparerName: string;
  schoolLevel?: SchoolLevel;
  bmiPreset?: BmiStandardPreset;
  bmiCountryLabel?: string;
  bmiUnderweightMax?: number;
  bmiNormalMax?: number;
  bmiOverweightMax?: number;
  bmiObese1Max?: number;
  bmiAgeAdjust?: boolean;
  ownerUid: string;
  authorizedUids: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface StudentProfile {
  id: string;
  schoolId: string;
  studentCode: string;
  fullName: string;
  className: string;
  gradeLevel: GradeLevel;
  gender: Gender;
  birthYear: number;
  age: number;
  notes: string;
  ownerUid: string;
  authorizedUids: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface FitnessAssessment {
  id: string;
  studentId: string;
  schoolId: string;
  termLabel: string;
  schoolYear: string;
  testedAt: string;
  ageAtTest: number;
  gender: Gender;
  heightCm: number;
  weightKg: number;
  bmi: number;
  bmiCategory: string;
  situpsCount: number;
  situpsGrade: FitnessGrade;
  longJumpCm: number;
  longJumpGrade: FitnessGrade;
  enduranceMode: EnduranceMode;
  enduranceValue: number;
  enduranceGrade: FitnessGrade;
  overallGrade: FitnessGrade;
  captureMethod: CaptureMethod;
  status: AssessmentStatus;
  recordedByUid: string;
  authorizedUids: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface LocalWorkspaceBundle {
  format: 'the-luc-thpt-53-2008-workspace';
  version: 1;
  exportedAt: string;
  exportedBy: string;
  schoolConfig: SchoolAdminConfig;
  students: StudentProfile[];
  assessments: FitnessAssessment[];
}

export enum UserRole {
  ADMIN = 'admin',
  INITIATOR = 'initiator',
  SIGNER = 'signer',
  VIEWER = 'viewer',
}

export enum ContractStatus {
  DRAFT = 'draft',
  SIGNING = 'signing',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
  VOIDED = 'voided',
  EXPIRED = 'expired',
}

export enum SigningMode {
  SEQUENTIAL = 'sequential',
  PARALLEL = 'parallel',
}

export enum SignerStatus {
  PENDING = 'pending',
  SIGNING = 'signing',
  SIGNED = 'signed',
  REJECTED = 'rejected',
  SKIPPED = 'skipped',
}

export enum SignMethod {
  HANDWRITE = 'handwrite',
  SEAL = 'seal',
}

export enum TemplateCategory {
  PURCHASE = 'purchase',
  SERVICE = 'service',
  NDA = 'nda',
  LABOR = 'labor',
  CUSTOM = 'custom',
}

export enum NotificationChannel {
  EMAIL = 'email',
  SMS = 'sms',
  BOTH = 'both',
}

export enum NotificationType {
  SIGN_REQUEST = 'sign_request',
  SIGN_REMINDER = 'sign_reminder',
  SIGN_COMPLETED = 'sign_completed',
  CONTRACT_REJECTED = 'contract_rejected',
  CONTRACT_CANCELLED = 'contract_cancelled',
  CONTRACT_VOIDED = 'contract_voided',
  CONTRACT_EXPIRED = 'contract_expired',
  ARCHIVE_REMINDER = 'archive_reminder',
}

export enum ContractTag {
  URGENT = 'urgent',
  FINANCIAL = 'financial',
  LEGAL = 'legal',
  HR = 'hr',
  PROCUREMENT = 'procurement',
  SALES = 'sales',
}

export enum VoidRequestStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  REJECTED = 'rejected',
}

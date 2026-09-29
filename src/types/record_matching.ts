/**
 * Record Matching Domain Types
 * Phase 17: Connect the 3D property to government land records
 */

export interface AttributeCheckItem {
  attributeName: string;
  unitValue: string | number;
  recordValue: string | number;
  isMatch: boolean;
  delta?: string;
  notes?: string;
}

export interface UnitRecordMatchData {
  unitNumber: string;
  floor: number;
  isMatched: boolean;
  statusBadge: '✓ RECORD MATCHED' | '⚠ RECORD MISMATCH';
  unit: {
    unitNumber: string;
    floor: number;
    areaSqM: number;
    x: number;
    y: number;
    z: number;
    geometryType: string;
    twoDParcel: string;
  };
  record: {
    recordId: string;
    deedNumber: string;
    ctsNumber: string;
    ulpin: string;
    ownerName: string;
    floor: number;
    recordedAreaSqM: number;
    registrationDate: string;
    encumbrance: string;
    parcel: string;
  };
  checks: AttributeCheckItem[];
  mismatchReason?: string;
}

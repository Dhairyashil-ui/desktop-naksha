/**
 * Record Matching Domain Types
 * Phase 17 / Step 31: Real property-record matching:
 * 3D Unit + 2D Parcel + Property Record + Floor/Unit Record -> Match / Conflict / Unresolved.
 */

export interface AttributeCheckItem {
  attributeName: string;
  unitValue: string | number;
  recordValue: string | number;
  isMatch: boolean;
  delta?: string;
  notes?: string;
}

export interface SpatialCheckItem {
  checkName: string;
  isPassed: boolean;
  details: string;
  metrics?: Record<string, any>;
}

export interface UnitRecordMatchData {
  unitNumber: string;
  unitId?: string;
  unitAlias?: string;
  floor: number;
  matchStatus?: 'MATCH' | 'CONFLICT' | 'UNRESOLVED';
  isMatched: boolean;
  statusBadge: string;
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
  spatialChecks?: SpatialCheckItem[];
  mismatchReason?: string;
  remediationSuggestion?: string;
}

export interface RecordMatchingSummaryResponse {
  total_units: number;
  matched_count: number;
  conflict_count: number;
  unresolved_count: number;
  mismatch_count: number;
  match_percentage: number;
  units: UnitRecordMatchData[];
}

/**
 * Naksha 2.0 — Deliverable Package Types (Phase 19)
 * Represents the 4 statutory package builders:
 * 1. TBK Package
 * 2. GIB Package
 * 3. Vertical Property ZIP
 * 4. 3D Survey ZIP
 */

export interface PackageFileItem {
  path: string;
  size_str: string;
  size_bytes: number;
  checksum: string;
  description: string;
}

export interface PackageConstituent {
  name: string;
  category: string;
  primary_file: string;
  description: string;
  is_valid: boolean;
}

export interface DeliverablePackage {
  id: string;
  name: string;
  format_label: string;
  extension: string;
  category: string;
  description: string;
  total_size_str: string;
  total_size_bytes: number;
  file_count: number;
  constituents: PackageConstituent[];
  files: PackageFileItem[];
  status: 'READY' | 'GENERATING' | 'EXPORTED';
  validation_status: string;
  target_crs: string;
  checksum: string;
}

export interface DeliverablePackagesSummary {
  project_code: string;
  validation_status: string;
  total_packages: number;
  total_size_mb: number;
  packages: DeliverablePackage[];
}

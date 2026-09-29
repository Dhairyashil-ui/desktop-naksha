#!/usr/bin/env python3
"""
Naksha 2.0 Project Structure & Virtualization Engine
Implements the canonical physical storage tree while exposing the clean "10 Input Types" abstraction.
"""

import os
import sys
import json
import uuid
import shutil
import hashlib
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any

# Canonical 10 Input Categories defined in Phase 0 & Phase 1
CATEGORIES = [
    {"num": 1, "id": "CAT_01_PHOTOGRAMMETRY", "dir": "01_Photogrammetry", "name": "Photogrammetry", "exts": [".jpg", ".jpeg", ".tif", ".tiff", ".png", ".raw", ".dng"]},
    {"num": 2, "id": "CAT_02_LIDAR_POINT_CLOUD", "dir": "02_LiDAR", "name": "LiDAR / Point Cloud", "exts": [".las", ".laz", ".e57", ".ply", ".xyz"]},
    {"num": 3, "id": "CAT_03_GIS_CAD", "dir": "03_GIS_CAD", "name": "GIS / CAD", "exts": [".shp", ".shx", ".dbf", ".prj", ".gpkg", ".geojson", ".kml", ".dwg", ".dxf", ".dgn"]},
    {"num": 4, "id": "CAT_04_GNSS_SURVEY", "dir": "04_GNSS", "name": "GNSS / Survey", "exts": [".obs", ".nav", ".csv", ".txt", ".nmea", ".ubx"]},
    {"num": 5, "id": "CAT_05_DEM_ELEVATION", "dir": "05_DEM", "name": "DEM / Elevation", "exts": [".asc", ".dem", ".grd", ".xyz"]},
    {"num": 6, "id": "CAT_06_ARCHITECTURAL_BIM", "dir": "06_BIM", "name": "Architectural / BIM", "exts": [".ifc", ".rvt", ".nwd"]},
    {"num": 7, "id": "CAT_07_PROPERTY_VERTICAL_DATA", "dir": "07_Property_Data", "name": "Property & Vertical Data", "exts": [".xlsx", ".xls"]},
    {"num": 8, "id": "CAT_08_IMAGERY_ORTHOPHOTO", "dir": "08_Imagery", "name": "Imagery / Orthophoto", "exts": [".cog"]},
    {"num": 9, "id": "CAT_09_PROJECT_METADATA", "dir": "09_Metadata", "name": "Project / Metadata", "exts": [".json", ".xml", ".yaml", ".yml"]},
    {"num": 10, "id": "CAT_10_SUPPORTING_DOCS", "dir": "10_Documents", "name": "Supporting Documents", "exts": [".pdf", ".docx", ".doc"]}
]

# Phase 10 Canonical Status Definitions & Display Labels
DATASET_STATUSES = {
    "Missing": "No data uploaded",
    "Scanning": "Scanning...",
    "Invalid": "REJECTED",
    "Partial": "PARTIALLY READY",
    "Valid": "READY",
    "Processing": "PROCESSING",
    "Completed": "COMPLETE"
}

SYSTEM_DIRS = [
    ".naksha",
    "Project_Metadata",
    "Processing/scratch",
    "Processing/intermediate",
    "Processing/jobs",
    "Outputs/cog",
    "Outputs/copc",
    "Outputs/3d_tiles",
    "Outputs/vector_tiles",
    "Outputs/reports",
    "Logs"
]

class NakshaProjectEngine:
    def __init__(self, root_path: str):
        self.root = Path(root_path).resolve()

    def initialize_project(self, code: str, title: str, crs: str = "EPSG:4326", accuracy_tier: str = "TIER_1_CADASTRAL_LEGAL") -> Dict[str, Any]:
        """Scaffolds the canonical project tree on disk or mounted storage."""
        self.root.mkdir(parents=True, exist_ok=True)

        # 1. Create all 10 Category folders
        for cat in CATEGORIES:
            cat_dir = self.root / cat["dir"]
            cat_dir.mkdir(parents=True, exist_ok=True)

        # 2. Create System, Processing, Outputs, and Logs folders
        for sys_dir in SYSTEM_DIRS:
            (self.root / sys_dir).mkdir(parents=True, exist_ok=True)

        # 3. Create Project Metadata & Control Files
        manifest = {
            "projectId": str(uuid.uuid4()),
            "projectCode": code,
            "title": title,
            "targetCrs": crs,
            "accuracyTier": accuracy_tier,
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "updatedAt": datetime.now(timezone.utc).isoformat(),
            "schemaVersion": "2.0.0"
        }

        with open(self.root / "Project_Metadata" / "naksha_manifest.json", "w", encoding="utf-8") as f:
            json.dump(manifest, f, indent=2)

        with open(self.root / ".naksha" / "project.json", "w", encoding="utf-8") as f:
            json.dump(manifest, f, indent=2)

        # Initialize log files
        for log_name in ["ingestion.log", "validation.log", "pipeline.log", "errors.log"]:
            log_path = self.root / "Logs" / log_name
            if not log_path.exists():
                with open(log_path, "w", encoding="utf-8") as f:
                    f.write(f"[{datetime.now(timezone.utc).isoformat()}] [SYSTEM] Initialized {log_name}\n")

        return manifest

    def detect_category(self, filename: str) -> Dict[str, Any]:
        """Deterministic fingerprint matcher mapping files to one of the 10 Input Types."""
        lower = filename.lower()
        ext = Path(filename).suffix.lower()

        # Special semantic rules
        if "7_12" in lower or "ror" in lower or "khasra" in lower or "mutation" in lower:
            return CATEGORIES[6] # 07_Property_Data
        if "dtm" in lower or "dsm" in lower or "dem" in lower or "elevation" in lower:
            return CATEGORIES[4] # 05_DEM
        if "ortho" in lower or lower.endswith(".cog"):
            return CATEGORIES[7] # 08_Imagery
        if "gcp" in lower or "checkpoint" in lower or lower.endswith((".obs", ".nav")):
            return CATEGORIES[3] # 04_GNSS

        for cat in CATEGORIES:
            if ext in cat["exts"]:
                return cat

        return CATEGORIES[9] # Default: Supporting Documents

    def ingest_dataset_bundle(self, source_paths: List[str], dataset_name: str, target_category_num: Optional[int] = None) -> Dict[str, Any]:
        """
        Ingests a collection of files, routing them into the canonical folder structure
        while recording dataset-level metadata.
        """
        if not source_paths:
            raise ValueError("No files provided for ingestion.")

        # Determine Category
        if target_category_num and 1 <= target_category_num <= 10:
            category = CATEGORIES[target_category_num - 1]
        else:
            category = self.detect_category(Path(source_paths[0]).name)

        dataset_id = f"ds_{uuid.uuid4().hex[:8]}"
        destination_dir = self.root / category["dir"] / dataset_id
        destination_dir.mkdir(parents=True, exist_ok=True)

        copied_files = []
        total_size = 0

        for src in source_paths:
            p = Path(src)
            if not p.exists():
                continue
            dest_file = destination_dir / p.name
            shutil.copy2(p, dest_file)
            size = dest_file.stat().st_size
            total_size += size

            # Calculate SHA256
            hasher = hashlib.sha256()
            with open(dest_file, "rb") as f:
                while chunk := f.read(65536):
                    hasher.update(chunk)

            copied_files.append({
                "fileName": p.name,
                "sizeBytes": size,
                "sha256": hasher.hexdigest(),
                "relativePath": f"{category['dir']}/{dataset_id}/{p.name}"
            })

        dataset_meta = {
            "datasetId": dataset_id,
            "datasetName": dataset_name,
            "category": category["id"],
            "categoryNumber": category["num"],
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "fileCount": len(copied_files),
            "totalSizeBytes": total_size,
            "files": copied_files,
            "status": "READY"
        }

        with open(destination_dir / ".dataset.json", "w", encoding="utf-8") as f:
            json.dump(dataset_meta, f, indent=2)

        # Log ingestion
        with open(self.root / "Logs" / "ingestion.log", "a", encoding="utf-8") as f:
            f.write(f"[{datetime.now(timezone.utc).isoformat()}] [INGEST] Ingested {len(copied_files)} files into {category['dir']}/{dataset_id} ({dataset_name})\n")

        return dataset_meta

    def get_virtual_view(self) -> Dict[str, Any]:
        """
        THE VIRTUALIZATION ENGINE:
        Exposes ONLY the clean '10 Input Types' to the UI/User, hiding the underlying folder complexity.
        """
        manifest_file = self.root / "Project_Metadata" / "naksha_manifest.json"
        if manifest_file.exists():
            with open(manifest_file, "r", encoding="utf-8") as f:
                project_info = json.load(f)
        else:
            project_info = {
                "projectCode": self.root.name,
                "title": self.root.name,
                "targetCrs": "Unknown",
                "accuracyTier": "TIER_1_CADASTRAL_LEGAL"
            }

        virtual_channels = []

        for cat in CATEGORIES:
            cat_dir = self.root / cat["dir"]
            datasets = []
            total_files = 0
            total_bytes = 0

            if cat_dir.exists():
                for ds_dir in sorted(cat_dir.iterdir()):
                    if ds_dir.is_dir():
                        ds_meta_file = ds_dir / ".dataset.json"
                        if ds_meta_file.exists():
                            with open(ds_meta_file, "r", encoding="utf-8") as f:
                                ds_meta = json.load(f)
                                datasets.append(ds_meta)
                                total_files += ds_meta.get("fileCount", 0)
                                total_bytes += ds_meta.get("totalSizeBytes", 0)

            # Determine virtual card status and Phase 10 canonical status
            if len(datasets) == 0:
                status = "EMPTY"
                dataset_status = "Missing"
                badge = DATASET_STATUSES["Missing"] # "No data uploaded"
                metric = "0 files uploaded"
                score = 0.0
            else:
                status = "READY"
                dataset_status = "Valid"
                badge = DATASET_STATUSES["Valid"]   # "READY"
                score = 100.0
                mb_size = total_bytes / (1024 * 1024)
                if mb_size > 1024:
                    size_str = f"{mb_size / 1024:.2f} GB"
                else:
                    size_str = f"{mb_size:.1f} MB"
                metric = f"{total_files} file(s) ({size_str})"

            virtual_channels.append({
                "channelNumber": cat["num"],
                "categoryId": cat["id"],
                "displayName": cat["name"],
                "status": status,
                "datasetStatus": dataset_status,
                "statusDisplay": DATASET_STATUSES[dataset_status],
                "badge": badge,
                "readinessScore": score,
                "datasetCount": len(datasets),
                "primaryMetric": metric,
                "supportedExtensions": cat["exts"],
                "datasets": datasets
            })

        return {
            "projectCode": project_info.get("projectCode"),
            "title": project_info.get("title"),
            "targetCrs": project_info.get("targetCrs"),
            "accuracyTier": project_info.get("accuracyTier"),
            "channels": virtual_channels
        }


if __name__ == "__main__":
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')

    if len(sys.argv) < 2:
        print("Usage: python project_engine.py [init|status] [path]")
        sys.exit(1)

    cmd = sys.argv[1]
    target_path = sys.argv[2] if len(sys.argv) > 2 else "."

    engine = NakshaProjectEngine(target_path)

    if cmd == "init":
        res = engine.initialize_project("MH-PUN-DEMO", "Sample Survey Project")
        print(f"Project initialized at {engine.root}")
        print(json.dumps(res, indent=2))
    elif cmd == "status":
        view = engine.get_virtual_view()
        print("\n=== NAKSHA 2.0: 10 INPUT TYPES (VIRTUAL VIEW) ===")
        print(f"Project: {view['title']} ({view['projectCode']}) | CRS: {view['targetCrs']}")
        print("-" * 68)
        for ch in view["channels"]:
            status_symbol = "[OK]" if ch["status"] == "READY" else "[  ]"
            print(f"[{ch['channelNumber']:02d}] {ch['displayName']:<26} {status_symbol} {ch['statusDisplay']:<18} {ch['primaryMetric']}")
        print("-" * 68)


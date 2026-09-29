"""
Naksha 2.0 — Object Storage Subsystem (Phase 21)
MinIO / AWS S3 / Object Storage Client with local filesystem caching fallback.
Handles buckets:
- naksha-raw: Ingested imagery, LAS/LAZ, CAD, BIM, deeds
- naksha-processed: Point clouds, orthomosaics, 3D meshes, DEMs
- naksha-packages: Deliverable packages (TBK, GIB, Vertical Property, 3D Survey)
"""

import os
import io
import shutil
from typing import Optional, Dict, Any

S3_ENDPOINT = os.getenv("S3_ENDPOINT", "http://localhost:9000")
S3_ACCESS_KEY = os.getenv("S3_ACCESS_KEY", "minioadmin")
S3_SECRET_KEY = os.getenv("S3_SECRET_KEY", "minioadmin")
S3_BUCKET_RAW = os.getenv("S3_BUCKET_RAW", "naksha-raw")
S3_BUCKET_PROCESSED = os.getenv("S3_BUCKET_PROCESSED", "naksha-processed")
S3_BUCKET_PACKAGES = os.getenv("S3_BUCKET_PACKAGES", "naksha-packages")

# Local cache storage root for desktop shell
LOCAL_STORAGE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "storage_cache")
os.makedirs(LOCAL_STORAGE_DIR, exist_ok=True)

class ObjectStorageClient:
    def __init__(self):
        self.endpoint = S3_ENDPOINT
        self.is_connected = False
        self._init_client()

    def _init_client(self):
        try:
            import boto3
            from botocore.config import Config
            self.s3 = boto3.client(
                's3',
                endpoint_url=self.endpoint,
                aws_access_key_id=S3_ACCESS_KEY,
                aws_secret_access_key=S3_SECRET_KEY,
                config=Config(signature_version='s3v4', connect_timeout=2, read_timeout=2)
            )
            # Ping bucket list
            self.s3.list_buckets()
            self.is_connected = True
        except Exception:
            self.is_connected = False

    def upload_file(self, bucket: str, key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
        """Uploads file to S3/MinIO or local cache."""
        if self.is_connected:
            try:
                self.s3.put_object(Bucket=bucket, Key=key, Body=data, ContentType=content_type)
                return f"s3://{bucket}/{key}"
            except Exception:
                pass
        
        # Local fallback cache
        local_path = os.path.join(LOCAL_STORAGE_DIR, bucket, key)
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        with open(local_path, "wb") as f:
            f.write(data)
        return f"file://{local_path}"

    def download_file(self, bucket: str, key: str) -> Optional[bytes]:
        """Downloads file bytes from S3/MinIO or local cache."""
        if self.is_connected:
            try:
                obj = self.s3.get_object(Bucket=bucket, Key=key)
                return obj['Body'].read()
            except Exception:
                pass

        local_path = os.path.join(LOCAL_STORAGE_DIR, bucket, key)
        if os.path.exists(local_path):
            with open(local_path, "rb") as f:
                return f.read()
        return None

    def get_status(self) -> Dict[str, Any]:
        return {
            "service": "MinIO / S3 Object Storage",
            "connected": self.is_connected,
            "endpoint": self.endpoint,
            "buckets": [S3_BUCKET_RAW, S3_BUCKET_PROCESSED, S3_BUCKET_PACKAGES],
            "fallback_local_dir": LOCAL_STORAGE_DIR
        }

storage_client = ObjectStorageClient()

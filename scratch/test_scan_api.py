import requests
import json

BASE = "http://127.0.0.1:8000"

def test_api():
    # 1. Health
    r = requests.get(f"{BASE}/health")
    print("Health:", r.status_code)

    # 2. Dataset scan
    ds_id = "3aba37f1-bc2a-4273-a488-cebc552eebdf"
    print(f"Triggering scan for {ds_id}...")
    r = requests.post(f"{BASE}/api/v2/datasets/{ds_id}/scan")
    print("Scan status code:", r.status_code)
    if r.status_code == 200:
        data = r.json()
        print("Dataset:", data.get("name"))
        print("Status:", data.get("status"), "Val Status:", data.get("validation_status"))
        print("Completeness:", data.get("completeness"), "Quality:", data.get("quality"))
        print("Ready for Processing:", data.get("ready_for_processing"))
        print("CRS:", data.get("crs_detected"))
        print("Steps completed:", len(data.get("steps", [])))
        for s in data.get("steps", []):
            print(f"  [{s['status'].upper()}] Step {s['step_index']}: {s['name']} -> {s['detail']}")

    # 3. Test SSE stream
    print("\nTesting SSE Stream /scan/stream...")
    r_stream = requests.get(f"{BASE}/api/v2/datasets/{ds_id}/scan/stream", stream=True)
    print("Stream HTTP Status:", r_stream.status_code)
    for line in r_stream.iter_lines():
        if line:
            decoded = line.decode('utf-8')
            if decoded.startswith("data: "):
                payload = json.loads(decoded[6:])
                msg_type = payload.get("type")
                if msg_type == "step":
                    st = payload["data"]
                    print(f"  [STREAM STEP {st['step_index']}] {st['name']}: {st['status']} ({st['progress']}%)")
                elif msg_type == "complete":
                    res = payload["result"]
                    print(f"  [STREAM COMPLETE] Verdict: {res['status']}, C: {res['completeness']}%, Q: {res['quality']}%")

    else:
        print("Error:", r.text)

if __name__ == "__main__":
    test_api()

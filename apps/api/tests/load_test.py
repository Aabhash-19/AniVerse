import time
import httpx
import concurrent.futures

BASE_URL = "http://localhost:8000/api/v1"

def fetch_search():
    start = time.time()
    try:
        res = httpx.get(f"{BASE_URL}/search?q=titan", timeout=2)
        status = res.status_code
    except Exception as e:
        status = f"error: {type(e).__name__}"
    return time.time() - start, status

def run_load_test():
    print("🚀 Initiating concurrent load stress test simulation...")
    concurrency = 15
    total_runs = 60

    latencies = []
    statuses = []

    with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = [executor.submit(fetch_search) for _ in range(total_runs)]
        for fut in concurrent.futures.as_completed(futures):
            lat, status = fut.result()
            latencies.append(lat * 1000) # milliseconds
            statuses.append(status)

    successful = [l for l, s in zip(latencies, statuses) if s == 200]
    
    print("\n--- Stress Load Test Metrics ---")
    print(f"Total Requests Dispatched: {total_runs}")
    print(f"Concurrency level: {concurrency}")
    print(f"Status codes breakdown: {dict((s, statuses.count(s)) for s in set(statuses))}")
    if successful:
        print(f"Average latency for successful reads: {sum(successful) / len(successful):.2f} ms")
        print(f"Max latency: {max(successful):.2f} ms")
        print(f"Min latency: {min(successful):.2f} ms")
    else:
        print("❌ All concurrent requests failed or returned non-200 status codes. Ensure API server is active.")

if __name__ == "__main__":
    run_load_test()

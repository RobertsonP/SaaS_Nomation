#!/usr/bin/env python3
"""Clean up leftover test projects from E2E test runs."""
import json
import sys
import urllib.request

BASE = "http://localhost:3002"

def main():
    # Login
    req = urllib.request.Request(
        f"{BASE}/auth/login",
        data=json.dumps({"email": "test@test.com", "password": "test"}).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req) as resp:
        token = json.load(resp)["token"]

    # Get projects
    req = urllib.request.Request(f"{BASE}/projects", headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req) as resp:
        projects = json.load(resp)

    to_delete = [p for p in projects if p["id"] != "test-project-id"]
    print(f"Found {len(to_delete)} non-seeded projects to clean up")

    for p in to_delete:
        pid = p["id"]
        name = p["name"]
        req = urllib.request.Request(
            f"{BASE}/projects/{pid}",
            method="DELETE",
            headers={"Authorization": f"Bearer {token}"},
        )
        try:
            with urllib.request.urlopen(req) as resp:
                print(f"  Deleted: {name} ({pid})")
        except Exception as e:
            print(f"  Failed to delete {name}: {e}")

    print("Cleanup complete")

if __name__ == "__main__":
    main()

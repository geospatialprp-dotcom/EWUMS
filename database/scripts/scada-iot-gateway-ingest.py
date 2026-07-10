#!/usr/bin/env python3
"""
EWUMS SCADA/IoT telemetry gateway — posts Tharali project readings to EWUMS.

Uses only the Python standard library (urllib). Authenticates via JWT, re-logins on 401,
and posts all seven SCADA metrics per cycle (mirrors om-scada.service simulateSnapshot).

Environment variables:
  EWUMS_BASE_URL     API base URL (default: https://ewumsujs.com/api/v1)
  EWUMS_EMAIL        Login email (required)
  EWUMS_PASSWORD     Login password (required)
  PROJECT_CODE       Target project code (default: PRJ-DPR-DPRP202627KPG0001)
  INTERVAL_SECONDS   Seconds between cycles in loop mode (default: 300)

Usage:
  # One-shot (cron / manual test)
  EWUMS_EMAIL=scada@example.com EWUMS_PASSWORD=secret \\
    python3 database/scripts/scada-iot-gateway-ingest.py --once

  # Continuous daemon (INTERVAL_SECONDS between cycles)
  export EWUMS_EMAIL=scada@example.com EWUMS_PASSWORD=secret
  python3 database/scripts/scada-iot-gateway-ingest.py

  # VPS cron wrapper
  bash database/scripts/scada-iot-gateway-ingest.sh
"""

from __future__ import annotations

import argparse
import json
import os
import random
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import Any


def env(name: str, default: str | None = None) -> str:
    value = os.environ.get(name, default)
    if value is None or not str(value).strip():
        print(f"ERROR: {name} is required", file=sys.stderr)
        sys.exit(1)
    return str(value).strip()


def build_samples(project_code: str, recorded_at: str) -> list[dict[str, Any]]:
    """Generate realistic telemetry matching om-scada.service simulateSnapshot."""
    return [
        {
            "siteCategory": "reservoir",
            "metricKey": "water_level",
            "valueNumeric": round(55 + random.random() * 30, 2),
            "projectCode": project_code,
            "source": "iot",
            "recordedAt": recorded_at,
        },
        {
            "siteCategory": "pump_house",
            "metricKey": "pump_status",
            "valueText": "trip" if random.random() > 0.85 else "running",
            "projectCode": project_code,
            "source": "iot",
            "recordedAt": recorded_at,
        },
        {
            "siteCategory": "pump_house",
            "metricKey": "flow",
            "valueNumeric": round(12 + random.random() * 8, 2),
            "projectCode": project_code,
            "source": "iot",
            "recordedAt": recorded_at,
        },
        {
            "siteCategory": "pump_house",
            "metricKey": "pressure",
            "valueNumeric": round(2.5 + random.random() * 1.5, 2),
            "projectCode": project_code,
            "source": "iot",
            "recordedAt": recorded_at,
        },
        {
            "siteCategory": "electrical",
            "metricKey": "transformer_status",
            "valueText": "fault" if random.random() > 0.9 else "online",
            "projectCode": project_code,
            "source": "iot",
            "recordedAt": recorded_at,
        },
        {
            "siteCategory": "electrical",
            "metricKey": "power_available",
            "valueNumeric": 0 if random.random() > 0.92 else 1,
            "projectCode": project_code,
            "source": "iot",
            "recordedAt": recorded_at,
        },
        {
            "siteCategory": "chlorination",
            "metricKey": "residual_chlorine",
            "valueNumeric": round(0.1 + random.random() * 1.2, 3),
            "projectCode": project_code,
            "source": "iot",
            "recordedAt": recorded_at,
        },
    ]


class EwumsClient:
    def __init__(self, base_url: str, email: str, password: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.email = email
        self.password = password
        self.access_token: str | None = None

    def _request(
        self,
        method: str,
        path: str,
        body: dict[str, Any] | None = None,
        *,
        auth: bool = True,
        retry_on_401: bool = True,
    ) -> tuple[int, Any]:
        url = f"{self.base_url}{path}"
        data = None
        headers = {"Content-Type": "application/json", "Accept": "application/json"}
        if auth:
            if not self.access_token:
                self.login()
            headers["Authorization"] = f"Bearer {self.access_token}"
        if body is not None:
            data = json.dumps(body).encode("utf-8")

        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                raw = resp.read().decode("utf-8")
                return resp.status, json.loads(raw) if raw else None
        except urllib.error.HTTPError as exc:
            if exc.code == 401 and auth and retry_on_401:
                self.access_token = None
                self.login()
                return self._request(method, path, body, auth=auth, retry_on_401=False)
            detail = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"HTTP {exc.code} {method} {path}: {detail}") from exc

    def login(self) -> None:
        _, payload = self._request(
            "POST",
            "/auth/login",
            {"email": self.email, "password": self.password},
            auth=False,
            retry_on_401=False,
        )
        token = payload.get("accessToken") if isinstance(payload, dict) else None
        if not token:
            raise RuntimeError("Login succeeded but accessToken missing in response")
        self.access_token = token

    def ingest_reading(self, reading: dict[str, Any]) -> dict[str, Any]:
        _, payload = self._request("POST", "/om/scada/readings", reading)
        if not isinstance(payload, dict):
            raise RuntimeError("Unexpected ingest response")
        return payload


def run_cycle(client: EwumsClient, project_code: str) -> tuple[int, int]:
    recorded_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    samples = build_samples(project_code, recorded_at)
    posted = 0
    alerts = 0
    for sample in samples:
        result = client.ingest_reading(sample)
        posted += 1
        alerts += int(result.get("alertsGenerated") or 0)
    return posted, alerts


def main() -> None:
    parser = argparse.ArgumentParser(description="EWUMS SCADA/IoT telemetry gateway")
    parser.add_argument(
        "--once",
        action="store_true",
        help="Post one cycle and exit (for cron). Default: loop with INTERVAL_SECONDS.",
    )
    args = parser.parse_args()

    base_url = os.environ.get("EWUMS_BASE_URL", "https://ewumsujs.com/api/v1").strip()
    email = env("EWUMS_EMAIL")
    password = env("EWUMS_PASSWORD")
    project_code = os.environ.get("PROJECT_CODE", "PRJ-DPR-DPRP202627KPG0001").strip()
    interval = int(os.environ.get("INTERVAL_SECONDS", "300"))

    client = EwumsClient(base_url, email, password)
    client.login()
    print(f"Logged in as {email} -> {base_url} (project {project_code})")

    while True:
        started = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        try:
            posted, alerts = run_cycle(client, project_code)
            print(f"[{started}] cycle ok: readings={posted} alerts_generated={alerts}")
        except Exception as exc:
            print(f"[{started}] cycle failed: {exc}", file=sys.stderr)
            if args.once:
                sys.exit(1)

        if args.once:
            break
        time.sleep(max(interval, 1))


if __name__ == "__main__":
    main()

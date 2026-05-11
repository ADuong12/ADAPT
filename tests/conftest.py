"""Shared fixtures for ADAPT test suite."""
from __future__ import annotations

import pytest
import requests

BASE = "http://127.0.0.1:8000"
TEACHER_HEADERS = {"X-Teacher-Id": "1"}
ADMIN_HEADERS = {"X-Teacher-Id": "4"}


@pytest.fixture(scope="session")
def base_url() -> str:
    return BASE


@pytest.fixture
def h() -> dict:
    return dict(TEACHER_HEADERS)


@pytest.fixture
def admin_h() -> dict:
    return dict(ADMIN_HEADERS)


@pytest.fixture(scope="session")
def live_server(base_url: str) -> bool:
    try:
        r = requests.get(f"{base_url}/api/health", timeout=5)
        assert r.status_code == 200
        return True
    except Exception as e:
        pytest.fail(f"Server not reachable at {base_url}: {e}")

"""Integration tests for all ADAPT API endpoints.

Requires the uvicorn server to be running (python start_server.py).
Uses the seeded adapt.db with X-Teacher-Id header for fakeauth.
"""
from __future__ import annotations

import requests


def api(base_url: str, path: str, headers: dict | None = None, method: str = "GET", body: dict | None = None):
    url = f"{base_url}{path}"
    kwargs = {"headers": headers or {}}
    if body is not None:
        kwargs["json"] = body
    r = requests.request(method, url, timeout=10, **kwargs)
    return r


# ─── Health ────────────────────────────────────────────────────────────────

class TestHealth:
    def test_health(self, base_url, live_server):
        r = api(base_url, "/api/health")
        assert r.status_code == 200
        data = r.json()
        assert data["ok"] is True
        assert "adapt.db" in data["db"]

    def test_root(self, base_url):
        r = api(base_url, "/")
        assert r.status_code == 200
        data = r.json()
        assert data["service"] == "ADAPT"


# ─── Lessons ───────────────────────────────────────────────────────────────

class TestLessons:
    def test_list_lessons(self, base_url, h):
        r = api(base_url, "/api/lessons", headers=h)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 3  # seeded: Agent Lion, Acorn Was a Little Wild, Sharing Culture
        for lesson in data:
            assert "lesson_id" in lesson
            assert "title" in lesson
            assert "grade_level" in lesson

    def test_get_lesson(self, base_url, h):
        r = api(base_url, "/api/lessons/1", headers=h)
        assert r.status_code == 200
        lesson = r.json()
        assert lesson["lesson_id"] == 1
        assert lesson["title"]
        assert lesson["objectives"]

    def test_get_lesson_not_found(self, base_url, h):
        r = api(base_url, "/api/lessons/999", headers=h)
        assert r.status_code == 404

    def test_list_lessons_requires_auth(self, base_url):
        r = api(base_url, "/api/lessons")
        assert r.status_code == 401

    def test_list_lesson_source_files(self, base_url, h):
        r = api(base_url, "/api/lessons/1/source-files", headers=h)
        assert r.status_code == 200
        data = r.json()
        assert any(f["filename"].endswith(".docx") for f in data)
        assert any(f["filename"].endswith(".pptx") for f in data)
        for source in data:
            assert "source_path" in source
            assert source["file_type"] in {"docx", "pptx", "pdf"}

    def test_lesson_source_files_requires_auth(self, base_url):
        r = api(base_url, "/api/lessons/1/source-files")
        assert r.status_code == 401


# ─── Clusters ──────────────────────────────────────────────────────────────

class TestClusters:
    def test_list_clusters(self, base_url, h):
        r = api(base_url, "/api/clusters", headers=h)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 7  # seeded: 7 clusters
        for c in data:
            assert "cluster_id" in c
            assert "cluster_name" in c
            assert "kb_count" in c
            assert "student_count" in c

    def test_cluster_kbs(self, base_url, h):
        r = api(base_url, "/api/clusters/1/kbs", headers=h)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        for kb in data:
            assert "kb_id" in kb
            assert "kb_name" in kb

    def test_cluster_kbs_empty(self, base_url, h):
        r = api(base_url, "/api/clusters/999/kbs", headers=h)
        assert r.status_code == 200
        assert r.json() == []

    def test_update_cluster_kbs(self, base_url, h):
        r = api(base_url, "/api/clusters/1/kbs", headers=h)
        assert r.status_code == 200
        current_ids = [kb["kb_id"] for kb in r.json()]
        r = api(base_url, "/api/clusters/1/kbs", headers=h, method="PUT", body={"kb_ids": current_ids})
        assert r.status_code == 200
        assert [kb["kb_id"] for kb in r.json()] == current_ids


# ─── Knowledge Bases ───────────────────────────────────────────────────────

class TestKnowledgeBases:
    def test_list_kbs(self, base_url, h):
        r = api(base_url, "/api/knowledge-bases", headers=h)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 10
        for kb in data:
            assert "kb_id" in kb
            assert "kb_name" in kb
            assert "category" in kb


# ─── Teachers / Dashboard ──────────────────────────────────────────────────

class TestTeachers:
    def test_dashboard(self, base_url, h):
        r = api(base_url, "/api/teachers/1/dashboard", headers=h)
        assert r.status_code == 200
        data = r.json()
        assert "teacher" in data
        assert data["teacher"]["first_name"] == "Maria"
        assert "metrics" in data
        assert "recent_adaptations" in data
        assert "roster" in data
        assert data["metrics"]["students"] >= 1

    def test_dashboard_other_teacher_forbidden(self, base_url, h):
        r = api(base_url, "/api/teachers/2/dashboard", headers=h)
        assert r.status_code == 403

    def test_dashboard_admin_can_see_any(self, base_url, admin_h):
        r = api(base_url, "/api/teachers/2/dashboard", headers=admin_h)
        assert r.status_code == 200

    def test_classes(self, base_url, h):
        r = api(base_url, "/api/teachers/1/classes", headers=h)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        for cls in data:
            assert "class_name" in cls
            assert "students" in cls

    def test_classes_with_students(self, base_url, h):
        r = api(base_url, "/api/teachers/1/classes", headers=h)
        classes = r.json()
        total_students = sum(len(c["students"]) for c in classes)
        assert total_students >= 1
        # verify student shape
        student = classes[0]["students"][0]
        assert "first_name" in student
        assert "last_name" in student
        assert "cluster_name" in student

    def test_update_student_cluster(self, base_url, h):
        r = api(base_url, "/api/teachers/1/classes", headers=h)
        student = r.json()[0]["students"][0]
        cluster_id = student["cluster_id"] or 1
        r = api(
            base_url,
            f"/api/teachers/1/students/{student['student_id']}",
            headers=h,
            method="PATCH",
            body={"cluster_id": cluster_id},
        )
        assert r.status_code == 200
        assert r.json()["cluster_id"] == cluster_id


# ─── Auth ──────────────────────────────────────────────────────────────────

class TestAuth:
    def test_list_teachers_public(self, base_url):
        r = api(base_url, "/api/auth/teachers")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        for t in data:
            assert "teacher_id" in t
            assert "first_name" in t
            assert "role" in t

    def test_fake_login_by_id(self, base_url):
        r = api(base_url, "/api/auth/fake-login", method="POST", body={"teacher_id": 2})
        assert r.status_code == 200
        teacher = r.json()
        assert teacher["teacher_id"] == 2
        assert teacher["first_name"] == "James"

    def test_fake_login_default(self, base_url):
        r = api(base_url, "/api/auth/fake-login", method="POST", body={"username": "x", "password": "y"})
        assert r.status_code == 200
        # defaults to teacher_id=1
        assert r.json()["teacher_id"] == 1

    def test_fake_login_bad_id_falls_back(self, base_url):
        r = api(base_url, "/api/auth/fake-login", method="POST", body={"teacher_id": 999})
        assert r.status_code == 200  # falls back to first teacher

    def test_me(self, base_url, h):
        r = api(base_url, "/api/auth/me", headers=h)
        assert r.status_code == 200
        assert r.json()["teacher_id"] == 1

    def test_me_no_auth(self, base_url):
        r = api(base_url, "/api/auth/me")
        assert r.status_code == 401


# ─── Settings / LLM Config ─────────────────────────────────────────────────

class TestSettings:
    def test_get_config_initial(self, base_url, h):
        r = api(base_url, "/api/teachers/1/llm-config", headers=h)
        assert r.status_code == 200

    def test_put_config(self, base_url, h):
        r = api(base_url, "/api/teachers/1/llm-config", method="PUT", headers=h, body={
            "provider": "gemini",
            "model": "gemini-2.5-flash",
            "api_key": "sk-test-key-12345",
        })
        assert r.status_code == 200
        data = r.json()
        assert data["provider"] == "gemini"
        assert data["api_key_redacted"] != "sk-test-key-12345"  # redacted
        assert "…" in data["api_key_redacted"]

    def test_get_config_after_put(self, base_url, h):
        r = api(base_url, "/api/teachers/1/llm-config", headers=h)
        assert r.status_code == 200
        data = r.json()
        assert data["provider"] == "gemini"
        assert data["is_active"] is True

    def test_put_config_unknown_provider(self, base_url, h):
        r = api(base_url, "/api/teachers/1/llm-config", method="PUT", headers=h, body={
            "provider": "nonexistent",
            "api_key": "test",
        })
        assert r.status_code == 400

    def test_test_connection(self, base_url, h):
        r = api(base_url, "/api/teachers/1/llm-config/test", method="POST", headers=h)
        assert r.status_code == 200
        # Connection should fail since it's a test key, but the endpoint should return
        data = r.json()
        assert data["ok"] is False
        assert data["provider"] == "gemini"

    def test_settings_not_self_forbidden(self, base_url, h):
        r = api(base_url, "/api/teachers/2/llm-config", headers=h)
        assert r.status_code == 403

    def test_settings_admin_can_see_own(self, base_url, admin_h):
        r = api(base_url, "/api/teachers/4/llm-config", headers=admin_h)
        assert r.status_code == 200


# ─── Admin ─────────────────────────────────────────────────────────────────

class TestAdmin:
    def test_admin_overview_not_admin(self, base_url, h):
        r = api(base_url, "/api/institutions/1/overview", headers=h)
        assert r.status_code == 403

    def test_admin_overview_as_admin(self, base_url, admin_h):
        r = api(base_url, "/api/institutions/1/overview", headers=admin_h)
        assert r.status_code == 200
        data = r.json()
        assert "institution" in data
        assert "metrics" in data
        assert data["institution"]["name"] == "Lincoln Elementary"

    def test_admin_teachers(self, base_url, admin_h):
        r = api(base_url, "/api/institutions/1/teachers", headers=admin_h)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        assert len(r.json()) >= 1

    def test_admin_classes(self, base_url, admin_h):
        r = api(base_url, "/api/institutions/1/classes", headers=admin_h)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_admin_clusters(self, base_url, admin_h):
        r = api(base_url, "/api/institutions/1/clusters", headers=admin_h)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ─── Adaptation / Versioning Lifecycle ─────────────────────────────────────

class TestAdaptations:
    def test_get_adaptation(self, base_url, h):
        r = api(base_url, "/api/adaptations/1", headers=h)
        assert r.status_code == 200
        data = r.json()
        assert data["adapted_id"] == 1
        assert "head_version" in data
        assert "versions" in data
        assert len(data["versions"]) >= 1
        assert data["head_version"]["version_number"] >= 1

    def test_get_adaptation_not_found(self, base_url, h):
        r = api(base_url, "/api/adaptations/999", headers=h)
        assert r.status_code == 404

    def test_get_adaptation_forbidden(self, base_url, h):
        # Adaptation 4 belongs to teacher 2 (James Walker), teacher 1 shouldn't see it
        r = api(base_url, "/api/adaptations/4", headers=h)
        assert r.status_code == 403

    def test_list_versions(self, base_url, h):
        r = api(base_url, "/api/adaptations/1/versions", headers=h)
        assert r.status_code == 200
        versions = r.json()
        assert isinstance(versions, list)
        assert len(versions) >= 1
        for v in versions:
            assert "version_id" in v
            assert "version_number" in v
            assert "is_head" in v
            assert "created_at" in v

    def test_get_version_detail(self, base_url, h):
        r = api(base_url, "/api/adaptations/1/versions", headers=h)
        versions = r.json()
        vid = versions[0]["version_id"]
        r = api(base_url, f"/api/adaptations/1/versions/{vid}", headers=h)
        assert r.status_code == 200
        detail = r.json()
        assert "rendered_html" in detail
        assert len(detail["rendered_html"]) > 100
        assert "plan_json" in detail
        assert detail["plan_json"] is not None

    def test_print_version(self, base_url, h):
        r = api(base_url, "/api/adaptations/1/versions", headers=h)
        vid = r.json()[0]["version_id"]
        r = api(base_url, f"/api/adaptations/1/versions/{vid}/print", headers=h)
        assert r.status_code == 200
        assert "text/html" in r.headers.get("content-type", "")

    def test_export_version(self, base_url, h):
        r = api(base_url, "/api/adaptations/1/versions", headers=h)
        vid = r.json()[0]["version_id"]
        r = api(base_url, f"/api/adaptations/1/versions/{vid}/export.html", headers=h)
        assert r.status_code == 200
        assert "attachment" in r.headers.get("content-disposition", "")

    def test_feedback(self, base_url, h):
        r = api(base_url, "/api/adaptations/1/feedback", method="POST", headers=h, body={
            "rating": 5,
            "comments": "Great lesson plan!",
        })
        assert r.status_code == 200
        data = r.json()
        assert data["ok"] is True
        assert "feedback_id" in data

    def test_feedback_bad_rating(self, base_url, h):
        r = api(base_url, "/api/adaptations/1/feedback", method="POST", headers=h, body={
            "rating": 99,
        })
        assert r.status_code == 422  # validation error

    def test_rollback(self, base_url, h):
        r = api(base_url, "/api/adaptations/1/versions", headers=h)
        versions = r.json()
        # Pick the oldest version to rollback to
        oldest = versions[0]
        r = api(base_url, "/api/adaptations/1/rollback", method="POST", headers=h, body={
            "version_id": oldest["version_id"],
        })
        assert r.status_code == 200
        data = r.json()
        assert data["head_version"]["version_id"] == oldest["version_id"]

    def test_rollback_nonexistent(self, base_url, h):
        r = api(base_url, "/api/adaptations/1/rollback", method="POST", headers=h, body={
            "version_id": 999,
        })
        assert r.status_code == 404

    def test_version_not_found(self, base_url, h):
        r = api(base_url, "/api/adaptations/1/versions/999", headers=h)
        assert r.status_code == 404


# ─── Frontend Static Files ─────────────────────────────────────────────────

class TestFrontend:
    def test_login_html(self, base_url):
        r = api(base_url, "/app/login.html")
        assert r.status_code == 200
        assert "login" in r.text.lower()

    def test_dashboard_html(self, base_url):
        r = api(base_url, "/app/dashboard.html")
        assert r.status_code == 200

    def test_settings_html(self, base_url):
        r = api(base_url, "/app/settings.html")
        assert r.status_code == 200

    def test_print_html(self, base_url):
        r = api(base_url, "/app/print.html")
        assert r.status_code == 200

    def test_personalize_html(self, base_url):
        r = api(base_url, "/app/personalize.html")
        assert r.status_code == 200

    def test_results_html(self, base_url):
        r = api(base_url, "/app/results.html")
        assert r.status_code == 200

    def test_my_classes_html(self, base_url):
        r = api(base_url, "/app/my-classes.html")
        assert r.status_code == 200

    def test_lesson_library_html(self, base_url):
        r = api(base_url, "/app/lesson-library.html")
        assert r.status_code == 200

    def test_kb_browser_html(self, base_url):
        r = api(base_url, "/app/kb-browser.html")
        assert r.status_code == 200

    def test_style_css(self, base_url):
        r = api(base_url, "/app/style.css")
        assert r.status_code == 200
        assert "text/css" in r.headers.get("content-type", "")

    def test_api_js(self, base_url):
        r = api(base_url, "/app/api.js")
        assert r.status_code == 200
        assert len(r.text) > 100
        assert "ADAPT_API" in r.text

    def test_auth_js(self, base_url):
        r = api(base_url, "/app/auth.js")
        assert r.status_code == 200

    def test_missing_edited_file_download(self, base_url, h):
        r = api(base_url, "/api/lesson-file-edits/missing.docx", headers=h)
        assert r.status_code == 404

"""Backend tests for AgriSmart. Covers auth, farms, sensors, ML, chatbot, TTS, PDF, roles."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://farm-intel-30.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"

DEMO_EMAIL = "demo@farm.com"
DEMO_PASS = "pass123"
DEMO_FARM_ID = "df8042b5-cb29-43ce-8ac7-5c7d8f58e43d"


@pytest.fixture(scope="session")
def farmer_token():
    r = requests.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASS}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def farmer_headers(farmer_token):
    return {"Authorization": f"Bearer {farmer_token}"}


@pytest.fixture(scope="session")
def officer_creds():
    email = f"TEST_officer_{uuid.uuid4().hex[:8]}@ex.com"
    r = requests.post(f"{API}/auth/register", json={
        "email": email, "password": "pass123", "name": "TEST Officer", "role": "officer"
    }, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["user"]["role"] == "officer"
    return {"headers": {"Authorization": f"Bearer {data['token']}"}, "email": email, "user": data["user"]}


@pytest.fixture(scope="session")
def created_farm(farmer_headers):
    payload = {
        "name": f"TEST Farm {uuid.uuid4().hex[:6]}",
        "crop_type": "Rice", "field_size": 2.0, "area_unit": "acres",
        "location": {"lat": 13.08, "lng": 80.27, "address": "Chennai"},
        "soil_type": "Loamy", "water_source": "Canal", "season": "Kharif",
        "firebase_path": "farms/test/sensors",
    }
    r = requests.post(f"{API}/farms", json=payload, headers=farmer_headers, timeout=15)
    assert r.status_code == 200, r.text
    farm = r.json()
    yield farm
    requests.delete(f"{API}/farms/{farm['id']}", headers=farmer_headers, timeout=15)


# ---------- Auth ----------
class TestAuth:
    def test_login_returns_role_and_language(self):
        r = requests.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASS}, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "token" in d and "user" in d
        assert "role" in d["user"] and "language" in d["user"]

    def test_me(self, farmer_headers):
        r = requests.get(f"{API}/auth/me", headers=farmer_headers, timeout=15)
        assert r.status_code == 200
        assert r.json()["email"] == DEMO_EMAIL

    def test_update_language_valid(self, farmer_headers):
        r = requests.put(f"{API}/auth/language", json={"language": "ta"}, headers=farmer_headers, timeout=15)
        assert r.status_code == 200
        assert r.json()["language"] == "ta"
        # reset
        requests.put(f"{API}/auth/language", json={"language": "en"}, headers=farmer_headers, timeout=15)

    def test_update_language_invalid(self, farmer_headers):
        r = requests.put(f"{API}/auth/language", json={"language": "xx"}, headers=farmer_headers, timeout=15)
        assert r.status_code == 400

    def test_register_officer(self, officer_creds):
        assert officer_creds["user"]["role"] == "officer"

    def test_register_admin_downgraded(self):
        email = f"TEST_admin_{uuid.uuid4().hex[:8]}@ex.com"
        r = requests.post(f"{API}/auth/register", json={
            "email": email, "password": "pass123", "name": "Test", "role": "admin"
        }, timeout=15)
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "farmer"

    def test_invalid_token(self):
        r = requests.get(f"{API}/auth/me", headers={"Authorization": "Bearer invalid.token.value"}, timeout=15)
        assert r.status_code == 401


# ---------- Farms CRUD ----------
class TestFarms:
    def test_create_list_get(self, created_farm, farmer_headers):
        r = requests.get(f"{API}/farms", headers=farmer_headers, timeout=15)
        assert r.status_code == 200
        ids = [f["id"] for f in r.json()]
        assert created_farm["id"] in ids
        r2 = requests.get(f"{API}/farms/{created_farm['id']}", headers=farmer_headers, timeout=15)
        assert r2.status_code == 200
        assert r2.json()["name"] == created_farm["name"]

    def test_update(self, created_farm, farmer_headers):
        upd = {**created_farm, "field_size": 3.5}
        upd.pop("id", None); upd.pop("user_id", None); upd.pop("created_at", None)
        r = requests.put(f"{API}/farms/{created_farm['id']}", json=upd, headers=farmer_headers, timeout=15)
        assert r.status_code == 200
        assert r.json()["field_size"] == 3.5

    def test_other_user_farm_404(self, officer_creds):
        r = requests.get(f"{API}/farms/{DEMO_FARM_ID}", headers=officer_creds["headers"], timeout=15)
        assert r.status_code == 404


# ---------- Sensors ----------
class TestSensors:
    def test_sensors_current(self, farmer_headers):
        r = requests.get(f"{API}/farms/{DEMO_FARM_ID}/sensors", headers=farmer_headers, timeout=15)
        assert r.status_code == 200
        d = r.json()
        for k in ["soil_moisture", "soil_temperature", "ambient_temperature", "humidity", "light_intensity"]:
            assert k in d and k in d["metric_status"]
            assert d["metric_status"][k] in ["normal", "warning", "critical", "unknown"]
        assert d["source"] == "simulated"
        assert d["status"] in ["optimal", "warning", "critical"]
        assert "timestamp" in d and "last_updated" in d and "source_note" in d

    def test_history_24h(self, farmer_headers):
        r = requests.get(f"{API}/farms/{DEMO_FARM_ID}/sensors/history?hours=24", headers=farmer_headers, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["source"] == "simulated"
        assert 20 <= len(d["points"]) <= 30
        p = d["points"][0]
        assert "recorded_at" in p
        for k in ["soil_moisture", "soil_temperature", "ambient_temperature", "humidity", "light_intensity"]:
            assert k in p

    def test_history_168h_6h_step(self, farmer_headers):
        r168 = requests.get(f"{API}/farms/{DEMO_FARM_ID}/sensors/history?hours=168", headers=farmer_headers, timeout=15).json()
        # 168h with 6h step -> ~29 points; verify step size is 6h
        pts = r168["points"]
        assert 20 <= len(pts) <= 35
        from datetime import datetime
        t0 = datetime.fromisoformat(pts[0]["recorded_at"])
        t1 = datetime.fromisoformat(pts[1]["recorded_at"])
        assert abs((t1 - t0).total_seconds() - 6 * 3600) < 60


# ---------- Alerts ----------
class TestAlerts:
    def test_farm_alerts(self, farmer_headers):
        r = requests.get(f"{API}/farms/{DEMO_FARM_ID}/alerts", headers=farmer_headers, timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert "alerts" in d and "source" in d and "generated_at" in d
        for a in d["alerts"]:
            assert "id" in a and "type" in a and "severity" in a and "message" in a
            assert a["severity"] in ["critical", "warning", "ok"]


# ---------- Crop / ML ----------
class TestCropRecommend:
    def test_recommend(self, farmer_headers):
        r = requests.post(f"{API}/crop/recommend",
                          json={"temperature": 26, "humidity": 80, "ph": 6.5, "rainfall": 200},
                          headers=farmer_headers, timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d["method"] == "ml"
        assert isinstance(d["recommended_crop"], str)
        assert len(d["top_recommendations"]) == 5
        s = sum(t["confidence"] for t in d["top_recommendations"])
        assert s <= 1.05
        assert abs(d["metrics"]["test_accuracy"] - 0.9568) < 0.05

    def test_out_of_range_warning(self, farmer_headers):
        r = requests.post(f"{API}/crop/recommend",
                          json={"temperature": 60, "humidity": 80, "ph": 6.5, "rainfall": 200},
                          headers=farmer_headers, timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d.get("warnings") and any(isinstance(w, str) for w in d["warnings"])

    def test_autofill(self, farmer_headers):
        r = requests.get(f"{API}/farms/{DEMO_FARM_ID}/recommend-autofill", headers=farmer_headers, timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert "temperature" in d and "humidity" in d and "rainfall" in d
        assert d["ph"] is None
        assert "sources" in d and isinstance(d["sources"], dict)

    def test_crop_analyze_and_yield(self, farmer_headers):
        r = requests.post(f"{API}/crop/analyze?farm_id={DEMO_FARM_ID}", headers=farmer_headers, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert "method" in d and "data_source" in d
        r2 = requests.post(f"{API}/yield/predict?farm_id={DEMO_FARM_ID}", headers=farmer_headers, timeout=30)
        assert r2.status_code == 200
        d2 = r2.json()
        assert "method" in d2 and "data_source" in d2


# ---------- Irrigation ----------
class TestIrrigation:
    def test_irrigation(self, farmer_headers):
        r = requests.post(f"{API}/irrigation/recommend?farm_id={DEMO_FARM_ID}", headers=farmer_headers, timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d["decision"] in ["water_now", "wait", "not_needed"]
        assert isinstance(d["should_irrigate"], bool)
        for k in ["urgency", "reason", "timing", "factors", "method", "estimate_note", "data_source", "weather_available"]:
            assert k in d


# ---------- Fertilizer ----------
class TestFertilizer:
    def test_no_ai(self, farmer_headers):
        r = requests.post(f"{API}/fertilizer/recommend", headers=farmer_headers,
                          json={"farm_id": DEMO_FARM_ID, "nitrogen": 200, "phosphorus": 30, "potassium": 400, "include_ai": False},
                          timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == {"nitrogen": "low", "phosphorus": "medium", "potassium": "high"}
        assert len(d["recommendations"]) == 3
        assert d["ai_advice"] is None

    def test_all_null(self, farmer_headers):
        r = requests.post(f"{API}/fertilizer/recommend", headers=farmer_headers,
                          json={"farm_id": DEMO_FARM_ID, "nitrogen": None, "phosphorus": None, "potassium": None, "include_ai": False},
                          timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert all(v == "unknown" for v in d["status"].values())
        assert len(d["recommendations"]) == 2

    def test_with_ai(self, farmer_headers):
        r = requests.post(f"{API}/fertilizer/recommend", headers=farmer_headers,
                          json={"farm_id": DEMO_FARM_ID, "nitrogen": 200, "phosphorus": 30, "potassium": 400, "include_ai": True, "language": "en"},
                          timeout=60)
        assert r.status_code == 200
        d = r.json()
        assert d["ai_advice"] is not None and isinstance(d["ai_advice"], str)
        assert d["ai_note"] is not None


# ---------- Chatbot ----------
class TestChatbot:
    def test_chat_and_history(self, farmer_headers):
        # clear first
        requests.delete(f"{API}/chatbot/history?farm_id={DEMO_FARM_ID}", headers=farmer_headers, timeout=15)
        r = requests.post(f"{API}/chatbot", headers=farmer_headers,
                          json={"message": "Should I irrigate today?", "farm_id": DEMO_FARM_ID, "language": "en"},
                          timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert isinstance(d["response"], str) and d["farm_context"] is True
        h = requests.get(f"{API}/chatbot/history?farm_id={DEMO_FARM_ID}", headers=farmer_headers, timeout=15)
        assert h.status_code == 200
        msgs = h.json()
        assert len(msgs) == 2
        assert msgs[0]["role"] == "user" and msgs[1]["role"] == "assistant"
        # clear
        c = requests.delete(f"{API}/chatbot/history?farm_id={DEMO_FARM_ID}", headers=farmer_headers, timeout=15)
        assert c.status_code == 200
        h2 = requests.get(f"{API}/chatbot/history?farm_id={DEMO_FARM_ID}", headers=farmer_headers, timeout=15)
        assert len(h2.json()) == 0

    def test_quick_questions_ta(self, farmer_headers):
        r = requests.get(f"{API}/chatbot/quick-questions?language=ta", headers=farmer_headers, timeout=10)
        assert r.status_code == 200
        qs = r.json()["questions"]
        assert len(qs) == 5


# ---------- Voice TTS ----------
class TestTTS:
    def test_tts(self, farmer_headers):
        r = requests.post(f"{API}/voice/tts", headers=farmer_headers,
                          json={"text": "Hello farmer", "language": "en"}, timeout=60)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("audio/mpeg")
        assert len(r.content) > 1000


# ---------- Report ----------
class TestReport:
    def test_pdf(self, farmer_headers):
        r = requests.get(f"{API}/farms/{DEMO_FARM_ID}/report", headers=farmer_headers, timeout=60)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert "attachment" in r.headers.get("content-disposition", "")
        assert r.content.startswith(b"%PDF")


# ---------- System / info ----------
class TestSystem:
    def test_system_status(self):
        r = requests.get(f"{API}/system/status", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "firebase" in d
        assert set(["configured", "connected", "error", "expected_structure"]).issubset(d["firebase"].keys())
        assert d["weather"]["configured"] is True
        assert d["ai"]["configured"] is True
        assert d["ml"]["classifier_loaded"] is True
        assert isinstance(d["auth"]["roles"], list)

    def test_ml_info(self):
        r = requests.get(f"{API}/ml/info", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "regressor" in d and "classifier" in d

    def test_schemes(self):
        r = requests.get(f"{API}/schemes", timeout=15)
        assert r.status_code == 200
        s = r.json()
        assert len(s) == 11
        names = " ".join(str(x) for x in s)
        assert "PMKSY" in names and "MSP" in names


# ---------- Roles ----------
class TestRoles:
    def test_farmer_denied_admin_users(self, farmer_headers):
        r = requests.get(f"{API}/admin/users", headers=farmer_headers, timeout=15)
        assert r.status_code == 403

    def test_officer_officer_farms(self, officer_creds):
        r = requests.get(f"{API}/officer/farms", headers=officer_creds["headers"], timeout=15)
        assert r.status_code == 200
        farms = r.json()
        assert isinstance(farms, list)
        if farms:
            assert "owner_name" in farms[0]

    def test_officer_admin_stats(self, officer_creds):
        r = requests.get(f"{API}/admin/stats", headers=officer_creds["headers"], timeout=15)
        assert r.status_code == 200

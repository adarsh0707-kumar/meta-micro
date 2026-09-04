import os

os.environ["DATABASE_URL"] = "sqlite:///./smoke_test.db"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

client = TestClient(app)
client.__enter__()

print("== health ==")
r = client.get("/api/health")
print(r.status_code, r.json())
assert r.status_code == 200

print("== signup ==")
r = client.post(
    "/api/auth/signup",
    json={
        "institute_name": "Bright Future Coaching",
        "city": "Patna",
        "admin_name": "Adarsh Kumar",
        "email": "admin@brightfuturecoaching.co.in",
        "password": "supersecret123",
        "default_language": "hi",
    },
)
print(r.status_code, r.json())
assert r.status_code == 201
token = r.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

print("== me ==")
r = client.get("/api/auth/me", headers=headers)
print(r.status_code, r.json())
assert r.status_code == 200

print("== create batch ==")
r = client.post(
    "/api/batches",
    headers=headers,
    json={"name": "Class 10 Science", "subject": "Science", "schedule_days": "Mon-Fri", "timing": "4-6 PM", "monthly_fee": 1500},
)
print(r.status_code, r.json())
assert r.status_code == 201
batch_id = r.json()["id"]

print("== create student ==")
r = client.post(
    "/api/students",
    headers=headers,
    json={
        "name": "Rahul Kumar",
        "batch_id": batch_id,
        "parent_name": "Suresh Kumar",
        "parent_phone": "+919000000001",
        "monthly_fee": 1500,
    },
)
print(r.status_code, r.json())
assert r.status_code == 201
student_id = r.json()["id"]

print("== create fee ==")
r = client.post(
    "/api/fees",
    headers=headers,
    json={"student_id": student_id, "period": "2026-08", "amount_due": 1500, "due_date": "2026-08-10"},
)
print(r.status_code, r.json())
assert r.status_code == 201

print("== fees summary ==")
r = client.get("/api/fees/summary", headers=headers)
print(r.status_code, r.json())
assert r.status_code == 200

print("== create template ==")
r = client.post(
    "/api/templates",
    headers=headers,
    json={
        "name": "Fee Reminder Hindi",
        "category": "fee_reminder",
        "language": "hi",
        "body": "Namaste {parent_name}, {student_name} ki fees {monthly_fee} abhi baaki hai.",
    },
)
print(r.status_code, r.json())
assert r.status_code == 201
template_id = r.json()["id"]

print("== submit attendance ==")
r = client.post(
    "/api/attendance",
    headers=headers,
    json={"batch_id": batch_id, "date": "2026-08-24", "entries": [{"student_id": student_id, "status": "present"}]},
)
print(r.status_code, r.json())
assert r.status_code == 200

print("== provider status ==")
r = client.get("/api/messaging/provider-status", headers=headers)
print(r.status_code, r.json())
assert r.status_code == 200
assert r.json()["would_really_send"] is False  # log provider in tests

print("== preview fee reminder (sends nothing) ==")
r = client.post(
    "/api/messaging/preview",
    headers=headers,
    json={"template_id": template_id, "student_ids": [student_id]},
)
print(r.status_code, r.json())
assert r.status_code == 200
assert r.json()["deliverable_count"] == 1

print("== send without confirm is refused ==")
r = client.post(
    "/api/messaging/fee-reminders",
    headers=headers,
    json={"template_id": template_id, "student_ids": [student_id]},
)
print(r.status_code, r.json())
assert r.status_code == 400

print("== send fee reminder (log provider) ==")
r = client.post(
    "/api/messaging/fee-reminders",
    headers=headers,
    json={"template_id": template_id, "student_ids": [student_id], "confirm": True},
)
print(r.status_code, r.json())
assert r.status_code == 200
assert r.json()[0]["status"] == "sent"

print("== staff: create, edit, and the last-admin guard ==")
r = client.post(
    "/api/staff",
    headers=headers,
    json={"name": "Priya Singh", "email": "priya@example.in", "temp_password": "temppass123", "role": "teacher"},
)
print(r.status_code, r.json())
assert r.status_code == 201
staff_id = r.json()["id"]

r = client.put(
    f"/api/staff/{staff_id}",
    headers=headers,
    json={"name": "Priya Sharma", "email": "priya@example.in", "phone": "+919000000009"},
)
print(r.status_code, r.json())
assert r.status_code == 200 and r.json()["name"] == "Priya Sharma"

# The signup admin is the only active admin, so demoting them must be refused.
r = client.put("/api/staff/1/role", headers=headers, json={"role": "teacher"})
print(r.status_code, r.json())
assert r.status_code == 400

print("== institute settings and profile ==")
r = client.put(
    "/api/institute",
    headers=headers,
    json={"name": "Bright Future Coaching Centre", "city": "Patna", "default_language": "en"},
)
print(r.status_code, r.json())
assert r.status_code == 200

r = client.post(
    "/api/profile/password",
    headers=headers,
    json={"current_password": "wrong-password", "new_password": "brandnew12345"},
)
print(r.status_code, r.json())
assert r.status_code == 400  # wrong current password is refused

print("\nALL SMOKE TESTS PASSED")

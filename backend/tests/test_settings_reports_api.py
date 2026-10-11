API = "/api/v1"


def _project(client, **overrides):
    body = {
        "name": "Report Project",
        "owner": "Ravi",
        "budget": "1000",
        "budget_spent": "250",
        "start_date": "2026-10-01",
        "end_date": "2026-12-31",
    }
    body.update(overrides)
    return client.post(f"{API}/projects", json=body).json()["id"]


def _milestone(client, pid, name, due, status="Not Started"):
    body = {"name": name, "owner": "Anita", "due_date": due, "status": status}
    return client.post(f"{API}/projects/{pid}/milestones", json=body).json()["id"]


# ---------- reports ----------
def test_report_window_stats_and_buckets(client):
    pid = _project(client)
    _milestone(client, pid, "On time", "2026-10-06", "In Progress")
    _milestone(client, pid, "At risk", "2026-10-07", "At Risk")
    _milestone(client, pid, "Late", "2026-10-07", "Delayed")
    _milestone(client, pid, "Outside window", "2026-11-20")

    data = client.get(f"{API}/reports/data", params={"interval": "Week", "value": "2026-W41", "project_id": pid}).json()
    assert data["stats"]["range_label"] == "Oct 5 – Oct 11, 2026"
    assert (data["stats"]["on_track"], data["stats"]["at_risk"], data["stats"]["delayed"]) == (1, 1, 1)
    assert data["stats"]["milestones"] == 3
    assert [b["label"] for b in data["stats"]["trend"]] == ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    assert [b["total"] for b in data["stats"]["trend"]] == [0, 1, 2, 0, 0, 0, 0]
    assert data["budget"] == {"total": "1000.00", "spent": "250.00", "pct": 25}
    assert len(data["milestones"]) == 4


def test_report_periods_and_validation(client):
    pid = _project(client)
    month = client.get(f"{API}/reports/data", params={"interval": "Month", "value": "2026-09", "project_id": pid}).json()
    assert month["stats"]["range_label"] == "September 2026"
    year = client.get(f"{API}/reports/data", params={"interval": "Year", "value": "2026"}).json()
    assert [b["label"] for b in year["stats"]["trend"]] == ["Q1", "Q2", "Q3", "Q4"]
    day = client.get(f"{API}/reports/data", params={"interval": "Day", "value": "2026-10-09"}).json()
    assert day["stats"]["range_label"] == "Oct 9, 2026"

    for bad in ({"interval": "Week", "value": "nonsense"}, {"interval": "Month", "value": "2026-13"}, {"interval": "Day", "value": "2026-02-30"}):
        assert client.get(f"{API}/reports/data", params=bad).status_code == 400
    assert client.get(f"{API}/reports/data", params={"interval": "Decade", "value": "2026"}).status_code == 422


def test_report_datasets_include_risks_actions_and_dependencies(client):
    pid = _project(client)
    a = _milestone(client, pid, "Design", "2026-10-10")
    b = _milestone(client, pid, "Build", "2026-10-20")
    client.post(f"{API}/projects/{pid}/dependencies", json={"predecessor_id": a, "successor_id": b})
    client.post(f"{API}/risks", json={"project_id": pid, "title": "Delay risk", "owner": "A", "impact": "High", "likelihood": "High"})
    client.post(f"{API}/actions", json={"project_id": pid, "title": "Follow up", "owner": "A", "due_date": "2026-10-12", "milestone_id": a})

    data = client.get(f"{API}/reports/data", params={"interval": "Year", "value": "2026", "project_id": pid}).json()
    assert data["dependencies"][0]["dependency"] == "Design → Build"
    assert data["risks"][0]["title"] == "Delay risk" and data["risks"][0]["severity"] == "High"
    assert data["actions"][0]["milestone"] == "Design"
    assert data["performance"][0]["name"] == "Report Project"


def test_saved_reports_and_schedules_persist(client):
    pid = _project(client)
    saved = client.post(f"{API}/reports/saved", json={"title": "Weekly health", "report_type": "Project Health", "project_id": pid, "period": "Week"})
    assert saved.status_code == 201 and saved.json()["created_by"] == "tester"
    assert saved.json()["project_name"] == "Report Project"
    assert client.post(f"{API}/reports/saved", json={"title": "Ghost", "report_type": "Risk Report", "project_id": 999}).status_code == 404
    assert client.post(f"{API}/reports/saved", json={"title": "Bad", "report_type": "Nope"}).status_code == 422
    assert [r["title"] for r in client.get(f"{API}/reports/saved").json()] == ["Weekly health"]

    created = client.post(f"{API}/reports/schedules", json={"name": "Monthly ops", "frequency": "Monthly", "format": "Excel"}).json()
    assert created["is_active"] is True
    paused = client.patch(f"{API}/reports/schedules/{created['id']}", json={"is_active": False}).json()
    assert paused["is_active"] is False and paused["frequency"] == "Monthly"
    assert client.delete(f"{API}/reports/schedules/{created['id']}").status_code == 204
    assert client.get(f"{API}/reports/schedules").json() == []
    assert client.patch(f"{API}/reports/schedules/999", json={"is_active": True}).status_code == 404


def test_viewers_cannot_manage_schedules(client):
    client.actor.role = "viewer"
    assert client.post(f"{API}/reports/schedules", json={"name": "Nope"}).status_code == 403
    assert client.get(f"{API}/reports/schedules").status_code == 200


# ---------- settings ----------
def test_settings_default_then_persist_partial_updates(client):
    defaults = client.get(f"{API}/settings").json()
    assert defaults["email_notifications"] is True and defaults["sms_notifications"] is False
    assert defaults["notification_recipients"] == ["Project Manager", "Engineering Lead"]

    updated = client.patch(
        f"{API}/settings",
        json={"sms_notifications": True, "notification_recipients": [" Ops Team ", "Ops Team", "QA"], "date_format": "YYYY-MM-DD"},
    ).json()
    assert updated["sms_notifications"] is True
    assert updated["notification_recipients"] == ["Ops Team", "QA"]
    assert updated["email_notifications"] is True

    reloaded = client.get(f"{API}/settings").json()
    assert reloaded["date_format"] == "YYYY-MM-DD" and reloaded["sms_notifications"] is True


def test_settings_reject_unknown_keys_and_bad_values_and_viewers(client):
    assert client.patch(f"{API}/settings", json={"made_up_flag": True}).status_code == 422
    assert client.patch(f"{API}/settings", json={"date_format": "whenever"}).status_code == 422
    client.actor.role = "viewer"
    assert client.patch(f"{API}/settings", json={"ai_insights": False}).status_code == 403


def test_integrations_reflect_settings(client):
    client.patch(f"{API}/settings", json={"email_notifications": False})
    by_name = {i["name"]: i["status"] for i in client.get(f"{API}/settings/integrations").json()}
    assert by_name["Database"] == "Connected"
    assert by_name["Email"] == "Disabled"


# ---------- users ----------
def test_user_management_lifecycle(client):
    created = client.post(f"{API}/users", json={"username": "meera.s", "email": "meera@example.com", "role": "approver", "password": "Str0ng!Pass"})
    assert created.status_code == 201
    body = created.json()
    assert "password" not in body and "password_hash" not in body
    assert body["is_active"] is True

    assert client.post(f"{API}/users", json={"username": "meera.s", "password": "Str0ng!Pass"}).status_code == 409
    assert client.post(f"{API}/users", json={"username": "other", "email": "meera@example.com", "password": "Str0ng!Pass"}).status_code == 409
    assert client.post(f"{API}/users", json={"username": "weak", "password": "password"}).status_code == 400
    assert client.post(f"{API}/users", json={"username": "x y", "password": "Str0ng!Pass"}).status_code == 422

    changed = client.patch(f"{API}/users/{body['id']}", json={"role": "manager", "is_active": False}).json()
    assert (changed["role"], changed["is_active"]) == ("manager", False)
    assert client.patch(f"{API}/users/999", json={"role": "viewer"}).status_code == 404


def test_only_admins_manage_users_and_cannot_demote_themselves(client):
    with client.session() as db:
        from app.models.user import User

        db.add(User(username="tester", password_hash="x", role="admin"))
        db.commit()
        me = db.query(User).filter(User.username == "tester").one().id
    assert client.patch(f"{API}/users/{me}", json={"role": "viewer"}).status_code == 400
    assert client.patch(f"{API}/users/{me}", json={"is_active": False}).status_code == 400
    assert client.patch(f"{API}/users/{me}", json={"email": "me@example.com"}).status_code == 200

    client.actor.role = "manager"
    assert client.post(f"{API}/users", json={"username": "newbie", "password": "Str0ng!Pass"}).status_code == 403
    assert client.get(f"{API}/users").status_code == 200


# ---------- governance rules ----------
def test_governance_rules_can_be_toggled(client):
    with client.session() as db:
        from app.models.operations import GovernanceRule

        db.add(GovernanceRule(code="GOV-1", name="Late design", category="Engineering", severity="Red", condition_json='{"DelayDays":5}', action_json='{"Escalate":"PM"}', is_active=True))
        db.commit()
    rules = client.get(f"{API}/governance/rules").json()
    assert rules[0]["condition"] == {"DelayDays": 5} and rules[0]["is_active"] is True
    off = client.patch(f"{API}/governance/rules/{rules[0]['id']}", json={"is_active": False}).json()
    assert off["is_active"] is False
    assert client.patch(f"{API}/governance/rules/999", json={"is_active": True}).status_code == 404
    client.actor.role = "manager"
    assert client.patch(f"{API}/governance/rules/{rules[0]['id']}", json={"is_active": True}).status_code == 403

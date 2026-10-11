from datetime import date, timedelta

from app.models.reference import ProcessStage, ProcessTemplate

API = "/api/v1"


def _wizard_payload(**overrides):
    body = {
        "name": "Alpha - Expansion Plant",
        "project_type": "Expansion",
        "description": "Expansion of manufacturing plant.",
        "business_objective": "Increase capacity by 40%.",
        "scope": "New production line and utilities.",
        "plant": "Chennai",
        "country": "India",
        "business": "Apex Automotive",
        "sponsor": "Priya N.",
        "owner": "Ravi Kumar",
        "budget": "15200000",
        "budget_spent": "9800000",
        "resources": "Crane, installation crew",
        "start_date": "2026-10-01",
        "end_date": "2026-12-15",
        "status": "Execution",
        "health": "Watch",
        "risk_level": "High",
        "ai_agents_enabled": True,
    }
    body.update(overrides)
    return body


def _create(client, **overrides):
    return client.post(f"{API}/projects", json=_wizard_payload(**overrides))


def _milestone(client, project_id, **overrides):
    body = {"name": "Design Review", "owner": "Anita S.", "due_date": "2026-10-12"}
    body.update(overrides)
    return client.post(f"{API}/projects/{project_id}/milestones", json=body).json()


def _seed_template(client, stages=3):
    with client.session() as db:
        template = ProcessTemplate(name="Delivery", description="x")
        db.add(template)
        db.flush()
        for number in range(1, stages + 1):
            db.add(ProcessStage(template_id=template.id, name=f"Stage {number}", sequence=number))
        db.commit()
        return template.id


# ---------- projects wizard ----------
def test_wizard_fields_round_trip_through_create_and_detail(client):
    created = _create(client)
    assert created.status_code == 201
    body = created.json()
    assert body["location"] == "Chennai, India"
    assert body["health"] == "Watch"
    assert body["business"] == "Apex Automotive"

    detail = client.get(f"{API}/projects/{body['id']}").json()
    assert detail["description"] == "Expansion of manufacturing plant."
    assert detail["business_objective"] == "Increase capacity by 40%."
    assert detail["sponsor"] == "Priya N."
    assert detail["resources"] == "Crane, installation crew"
    assert detail["metrics"]["budget_spent_pct"] == 64
    assert detail["duration_days"] == 75


def test_blank_optional_fields_are_stored_as_null_and_code_is_trimmed(client):
    body = _create(client, description="   ", sponsor="", name="  Padded Name  ").json()
    detail = client.get(f"{API}/projects/{body['id']}").json()
    assert detail["description"] is None
    assert detail["sponsor"] is None
    assert detail["name"] == "Padded Name"


def test_wizard_validation(client):
    assert _create(client, budget_spent="20000000").status_code == 422
    assert _create(client, end_date="2026-01-01").status_code == 422
    assert _create(client, health="Excellent").status_code == 422
    assert _create(client, template_id=999).status_code == 400


def test_template_generates_evenly_spaced_milestones(client):
    template_id = _seed_template(client, stages=3)
    project = _create(client, template_id=template_id, start_date="2026-10-01", end_date="2026-10-31").json()
    items = client.get(f"{API}/projects/{project['id']}/milestones").json()["items"]
    assert [m["name"] for m in items] == ["Stage 1", "Stage 2", "Stage 3"]
    assert [m["due_date"] for m in items] == ["2026-10-11", "2026-10-21", "2026-10-31"]
    assert {m["status"] for m in items} == {"Not Started"}


def test_update_edits_wizard_fields_and_can_clear_optional_ones(client):
    pid = _create(client).json()["id"]
    updated = client.patch(
        f"{API}/projects/{pid}",
        json={"health": "Poor", "status": "On Hold", "sponsor": None, "budget_spent": "1000"},
    ).json()
    assert updated["health"] == "Poor"
    assert updated["status"] == "On Hold"
    assert updated["sponsor"] is None
    assert client.patch(f"{API}/projects/{pid}", json={"budget_spent": "99999999"}).status_code == 400
    assert client.patch(f"{API}/projects/{pid}", json={"name": None}).json()["name"] == "Alpha - Expansion Plant"


def test_summary_filters_and_next_code(client):
    first = _create(client, plant="Pune").json()
    _create(client, business="Other Co", budget="500", budget_spent="0")
    _milestone(client, first["id"], status="Delayed")
    done = _create(client, name="Done Project", status="Completed", budget="800", budget_spent="0").json()

    summary = client.get(f"{API}/projects/summary").json()
    assert summary == {"total": 3, "on_track": 1, "at_risk": 0, "delayed": 1, "completed": 1}
    assert client.get(f"{API}/projects/summary", params={"business": "Other Co"}).json()["total"] == 1
    assert done["schedule_status"] == "Completed"

    listing = client.get(f"{API}/projects", params={"plant": "Pune"}).json()
    assert listing["total"] == 1
    assert sorted(listing["plants"]) == ["Chennai", "Pune"]
    assert client.get(f"{API}/projects", params={"budget_max": "1000"}).json()["total"] == 2
    assert client.get(f"{API}/projects", params={"search": "ravi"}).json()["total"] == 3
    assert client.get(f"{API}/projects/next-code").json() == {"code": "PRJ004"}


def test_detail_metrics_count_open_risks_and_actions(client):
    pid = _create(client).json()["id"]
    client.post(f"{API}/risks", json={"project_id": pid, "title": "Crane failure", "owner": "A", "impact": "High", "likelihood": "High"})
    client.post(f"{API}/risks", json={"project_id": pid, "title": "Minor delay", "owner": "A", "impact": "Low", "likelihood": "Low"})
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    client.post(f"{API}/actions", json={"project_id": pid, "title": "Late task", "owner": "A", "due_date": yesterday})

    metrics = client.get(f"{API}/projects/{pid}").json()["metrics"]
    assert (metrics["risks_high"], metrics["risks_low"]) == (1, 1)
    assert (metrics["actions_open"], metrics["actions_overdue"]) == (1, 1)


def test_only_managers_can_write_projects(client):
    client.actor.role = "engineering"
    assert _create(client).status_code == 403
    assert client.get(f"{API}/projects").status_code == 200


# ---------- risks ----------
def test_risk_severity_is_derived_and_filterable(client):
    pid = _create(client).json()["id"]
    high = client.post(f"{API}/risks", json={"project_id": pid, "title": "Supplier failure", "owner": "A", "impact": "Critical", "likelihood": "High"})
    assert high.status_code == 201 and high.json()["severity"] == "High"
    client.post(f"{API}/risks", json={"project_id": pid, "title": "Noise complaint", "owner": "A", "risk_type": "Issue", "impact": "Low", "likelihood": "Low"})

    assert client.get(f"{API}/risks", params={"severity": "High"}).json()["total"] == 2
    only_high = client.get(f"{API}/risks", params={"severity": "High"}).json()["items"]
    assert [r["title"] for r in only_high] == ["Supplier failure"]
    assert client.get(f"{API}/risks", params={"type": "Issue"}).json()["items"][0]["title"] == "Noise complaint"


def test_risk_status_update_and_active_only(client):
    pid = _create(client).json()["id"]
    rid = client.post(f"{API}/risks", json={"project_id": pid, "title": "Weather", "owner": "A"}).json()["id"]
    assert client.patch(f"{API}/risks/{rid}", json={"status": "Resolved"}).json()["status"] == "Resolved"
    listing = client.get(f"{API}/risks", params={"active_only": "true"}).json()
    assert (listing["items"], listing["total"], listing["open_count"]) == ([], 1, 0)
    assert client.patch(f"{API}/risks/999", json={"status": "Open"}).status_code == 404
    assert client.post(f"{API}/risks", json={"project_id": 999, "title": "Ghost", "owner": "A"}).status_code == 404


def test_risk_milestone_must_belong_to_project(client):
    first = _create(client).json()["id"]
    other = _create(client, name="Other Project").json()["id"]
    foreign = _milestone(client, other)["id"]
    body = {"project_id": first, "title": "Cross link", "owner": "A", "milestone_id": foreign}
    assert client.post(f"{API}/risks", json=body).status_code == 400


# ---------- actions ----------
def test_action_overdue_is_derived_and_status_filter_matches(client):
    pid = _create(client).json()["id"]
    past = (date.today() - timedelta(days=3)).isoformat()
    soon = (date.today() + timedelta(days=3)).isoformat()
    client.post(f"{API}/actions", json={"project_id": pid, "title": "Overdue one", "owner": "A", "due_date": past})
    client.post(f"{API}/actions", json={"project_id": pid, "title": "Future one", "owner": "A", "due_date": soon})

    overdue = client.get(f"{API}/actions", params={"status": "Overdue"}).json()
    assert [a["title"] for a in overdue["items"]] == ["Overdue one"]
    assert overdue["overdue"] == 1 and overdue["total"] == 2


def test_completing_an_action_sets_and_clears_completed_at(client):
    pid = _create(client).json()["id"]
    aid = client.post(f"{API}/actions", json={"project_id": pid, "title": "Close me", "owner": "A", "due_date": "2026-12-01"}).json()["id"]
    closed = client.patch(f"{API}/actions/{aid}", json={"status": "Closed"}).json()
    assert closed["completed_at"] is not None
    assert client.get(f"{API}/actions").json()["completed"] == 1
    assert client.patch(f"{API}/actions/{aid}", json={"status": "Open"}).json()["completed_at"] is None


def test_ai_agent_action_needs_approval_and_only_approvers_decide(client):
    pid = _create(client).json()["id"]
    created = client.post(f"{API}/actions", json={"project_id": pid, "title": "Release PO", "owner": "A", "due_date": "2026-12-01", "run_by": "AI agent"}).json()
    assert created["approval_status"] == "Pending"
    assert [a["id"] for a in client.get(f"{API}/actions").json()["awaiting_approval"]] == [created["id"]]

    client.actor.role = "viewer"
    assert client.post(f"{API}/actions/{created['id']}/approval", json={"decision": "approve"}).status_code == 403
    client.actor.role = "approver"
    approved = client.post(f"{API}/actions/{created['id']}/approval", json={"decision": "approve"}).json()
    assert (approved["approval_status"], approved["status"]) == ("Approved", "In Progress")
    assert client.post(f"{API}/actions/{created['id']}/approval", json={"decision": "reject"}).status_code == 409


def test_mine_filter_uses_signed_in_username(client):
    pid = _create(client).json()["id"]
    for owner in ("tester", "someone"):
        client.post(f"{API}/actions", json={"project_id": pid, "title": f"For {owner}", "owner": owner, "due_date": "2026-12-01"})
    mine = client.get(f"{API}/actions", params={"mine": "true"}).json()["items"]
    assert [a["owner"] for a in mine] == ["tester"]


# ---------- dependencies ----------
def _chain(client):
    pid = _create(client).json()["id"]
    ids = [
        _milestone(client, pid, name=name, due_date=due, status=status)["id"]
        for name, due, status in [
            ("Design", "2026-10-10", "Delayed"),
            ("PO", "2026-10-15", "Not Started"),
            ("Build", "2026-10-25", "Not Started"),
        ]
    ]
    return pid, ids


def test_dependency_graph_critical_path_and_bottleneck(client):
    pid, (a, b, c) = _chain(client)
    assert client.post(f"{API}/projects/{pid}/dependencies", json={"predecessor_id": a, "successor_id": b}).status_code == 201
    graph = client.post(f"{API}/projects/{pid}/dependencies", json={"predecessor_id": b, "successor_id": c}).json()

    assert graph["critical_path"] == [a, b, c]
    assert graph["bottleneck"]["milestone_id"] == a and graph["bottleneck"]["downstream"] == 2
    assert [n["level"] for n in graph["nodes"]] == [0, 1, 2]
    assert all(e["on_critical_path"] for e in graph["edges"])


def test_dependency_rejects_cycles_duplicates_and_foreign_milestones(client):
    pid, (a, b, c) = _chain(client)
    url = f"{API}/projects/{pid}/dependencies"
    client.post(url, json={"predecessor_id": a, "successor_id": b})
    client.post(url, json={"predecessor_id": b, "successor_id": c})

    assert client.post(url, json={"predecessor_id": c, "successor_id": a}).status_code == 400
    assert client.post(url, json={"predecessor_id": a, "successor_id": b}).status_code == 409
    assert client.post(url, json={"predecessor_id": a, "successor_id": a}).status_code == 400
    other = _create(client, name="Other").json()["id"]
    foreign = _milestone(client, other)["id"]
    assert client.post(url, json={"predecessor_id": a, "successor_id": foreign}).status_code == 400


def test_removing_a_dependency_updates_the_graph(client):
    pid, (a, b, _) = _chain(client)
    url = f"{API}/projects/{pid}/dependencies"
    edge = client.post(url, json={"predecessor_id": a, "successor_id": b}).json()["edges"][0]["id"]
    assert client.delete(f"{url}/{edge}").json()["edges"] == []
    assert client.delete(f"{url}/{edge}").status_code == 404


def test_delay_simulation_is_absorbed_by_gaps_between_milestones(client):
    pid, (a, b, c) = _chain(client)
    url = f"{API}/projects/{pid}/dependencies"
    client.post(url, json={"predecessor_id": a, "successor_id": b})
    client.post(url, json={"predecessor_id": b, "successor_id": c})

    result = client.post(f"{url}/simulate", json={"milestone_id": a, "delay_days": 7}).json()
    shifts = {i["name"]: i["shift_days"] for i in result["impacts"]}
    # Design->PO has a 5 day gap, so PO slips 2 days; PO->Build has a 10 day gap, which absorbs that.
    assert shifts == {"Design": 7, "PO": 2}
    assert result["end_shift_days"] == 0
    assert client.post(f"{url}/simulate", json={"milestone_id": 999, "delay_days": 1}).status_code == 404


# ---------- lookups & overview ----------
def test_lookups_come_from_the_database(client):
    template_id = _seed_template(client, stages=2)
    _create(client, plant="Pune", country="India")
    lookups = client.get(f"{API}/lookups").json()
    assert lookups["plants"] == ["Pune"] and lookups["countries"] == ["India"]
    assert lookups["businesses"] == ["Apex Automotive"]
    assert lookups["templates"] == [{"id": template_id, "name": "Delivery", "stage_count": 2}]
    assert "Execution" in lookups["lifecycle_statuses"]
    assert "Ravi Kumar" in lookups["owners"]


def test_overview_aggregates_scoped_data(client):
    pid = _create(client).json()["id"]
    _milestone(client, pid, name="Done", status="Completed", due_date=date.today().isoformat())
    _milestone(client, pid, name="Late", status="Delayed", due_date=date.today().isoformat())
    client.post(f"{API}/risks", json={"project_id": pid, "title": "Big risk", "owner": "A", "impact": "High", "likelihood": "High"})
    client.post(f"{API}/actions", json={"project_id": pid, "title": "Do it", "owner": "A", "due_date": "2026-12-01"})
    other = _create(client, business="Other Co").json()["id"]
    client.post(f"{API}/risks", json={"project_id": other, "title": "Elsewhere", "owner": "A"})

    everything = client.get(f"{API}/dashboard/overview").json()
    assert everything["summary"]["total"] == 2
    scoped = client.get(f"{API}/dashboard/overview", params={"business": "Apex Automotive"}).json()
    assert scoped["summary"]["total"] == 1
    assert scoped["milestones"] == {"completed": 1, "in_progress": 0, "upcoming": 0, "delayed": 1}
    assert [r["title"] for r in scoped["top_risks"]] == ["Big risk"]
    assert [a["title"] for a in scoped["priority_actions"]] == ["Do it"]
    assert scoped["trend"][-1]["value"] == 50
    assert len(scoped["trend"]) == 6
    assert {item["link"] for item in scoped["activity"]} >= {"risks", "actions", "milestones"}

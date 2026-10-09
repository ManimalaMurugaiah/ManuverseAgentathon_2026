from datetime import datetime
from datetime import timezone

from sqlalchemy.orm import Session

from app.models.workflow import WorkflowLog, WorkflowRun
from app.services.ai.provider import ai_service
from app.services.redis_client import redis_client

WORKFLOW_STAGES = [
    "Design Freeze",
    "Drawing Approval",
    "PO Release",
    "Vendor Manufacturing",
    "FAT",
    "Shipment",
    "Site Readiness",
    "Equipment Delivery",
    "Installation",
    "Mechanical Completion",
    "SAT",
    "Commissioning",
    "Production Handover",
]

AGENT_BY_STAGE = {
    "Design Freeze": "Engineering Design Agent",
    "Drawing Approval": "Design Approval Agent",
    "PO Release": "Procurement Agent",
    "Vendor Manufacturing": "Vendor Manufacturing Agent",
    "FAT": "Shipment Agent",
    "Shipment": "Shipment Agent",
    "Site Readiness": "Site Readiness Agent",
    "Equipment Delivery": "Site Readiness Agent",
    "Installation": "Installation Agent",
    "Mechanical Completion": "Installation Agent",
    "SAT": "SAT and Commissioning Agent",
    "Commissioning": "SAT and Commissioning Agent",
    "Production Handover": "Handover Agent",
}


class WorkflowOrchestrator:
    async def start_run(self, db: Session, project_code: str) -> WorkflowRun:
        run = WorkflowRun(project_code=project_code, current_stage=WORKFLOW_STAGES[0], status="running")
        db.add(run)
        db.commit()
        db.refresh(run)

        self._cache_status(run)
        await self._log_ai_action(db, run, "Run started")
        return run

    async def step(self, db: Session, run: WorkflowRun, approved: bool, note: str = "") -> WorkflowRun:
        if run.status != "running":
            return run

        if not approved:
            run.status = "blocked"
            self._add_log(db, run.id, AGENT_BY_STAGE[run.current_stage], "Approval rejected", "blocked", note)
        else:
            current_index = WORKFLOW_STAGES.index(run.current_stage)
            if current_index == len(WORKFLOW_STAGES) - 1:
                run.status = "completed"
                self._add_log(db, run.id, "Handover Agent", "Workflow completed", "success", note)
            else:
                run.current_stage = WORKFLOW_STAGES[current_index + 1]
                self._add_log(db, run.id, AGENT_BY_STAGE[run.current_stage], "Moved to next stage", "success", note)

        run.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
        db.add(run)
        db.commit()
        db.refresh(run)

        self._cache_status(run)
        await self._log_ai_action(db, run, f"Step processed. approved={approved}")
        return run

    async def auto_advance(self, db: Session, run: WorkflowRun, max_steps: int = 1, note: str = "Auto agent") -> WorkflowRun:
        if max_steps < 1:
            max_steps = 1

        current = run
        for _ in range(max_steps):
            if current.status != "running":
                break
            current = await self.step(db, current, approved=True, note=note)
        return current

    def list_logs(self, db: Session, run_id: int) -> list[WorkflowLog]:
        return db.query(WorkflowLog).filter(WorkflowLog.run_id == run_id).order_by(WorkflowLog.id.asc()).all()

    def _cache_status(self, run: WorkflowRun) -> None:
        try:
            redis_client.hset(
                f"workflow:run:{run.id}",
                mapping={
                    "project_code": run.project_code,
                    "current_stage": run.current_stage,
                    "status": run.status,
                    "updated_at": run.updated_at.isoformat() if run.updated_at else "",
                },
            )
        except Exception:
            # Redis is an optional cache in local mode; workflow must still proceed.
            return

    def _add_log(self, db: Session, run_id: int, agent_name: str, action: str, status: str, details: str) -> None:
        log = WorkflowLog(
            run_id=run_id,
            agent_name=agent_name,
            action=action,
            status=status,
            details=details,
        )
        db.add(log)
        db.commit()

    async def _log_ai_action(self, db: Session, run: WorkflowRun, action: str) -> None:
        prompt = (
            f"Project {run.project_code} is at stage {run.current_stage} with status {run.status}. "
            f"Generate one concise orchestration note for action: {action}."
        )
        try:
            summary = await ai_service.generate(prompt)
        except Exception:
            summary = "Auto note: external AI provider unavailable; action recorded by local orchestrator."
        self._add_log(db, run.id, AGENT_BY_STAGE.get(run.current_stage, "System"), action, run.status, summary)


orchestrator = WorkflowOrchestrator()

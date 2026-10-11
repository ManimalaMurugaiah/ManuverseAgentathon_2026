from collections import defaultdict, deque
from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.models.operations import Dependency
from app.models.project import Milestone, Project
from app.schemas.operations import (
    Bottleneck,
    DependencyGraph,
    GraphEdge,
    GraphNode,
    SimulationImpact,
    SimulationResult,
)

DONE = "Completed"
TROUBLED = ("Delayed", "At Risk")


def _effective_date(milestone: Milestone) -> date | None:
    return milestone.forecast_date or milestone.due_date


def project_edges(db: Session, project_id: int, valid_ids: set[int]) -> list[Dependency]:
    rows = db.query(Dependency).filter(Dependency.project_id == project_id).order_by(Dependency.id).all()
    return [e for e in rows if e.predecessor_id in valid_ids and e.successor_id in valid_ids]


def _topological_order(ids: list[int], succ: dict[int, list[int]]) -> list[int]:
    """Kahn's algorithm; nodes inside a cycle are left out rather than looping forever."""
    indegree = {i: 0 for i in ids}
    for source in ids:
        for target in succ.get(source, []):
            indegree[target] += 1
    queue = deque(i for i in ids if indegree[i] == 0)
    order: list[int] = []
    while queue:
        node = queue.popleft()
        order.append(node)
        for target in succ.get(node, []):
            indegree[target] -= 1
            if indegree[target] == 0:
                queue.append(target)
    return order


def would_create_cycle(edges: list[Dependency], predecessor_id: int, successor_id: int) -> bool:
    succ: dict[int, list[int]] = defaultdict(list)
    for edge in edges:
        succ[edge.predecessor_id].append(edge.successor_id)
    seen, stack = set(), [successor_id]
    while stack:
        node = stack.pop()
        if node == predecessor_id:
            return True
        if node not in seen:
            seen.add(node)
            stack.extend(succ.get(node, []))
    return False


def _descendants(start: int, succ: dict[int, list[int]]) -> set[int]:
    seen: set[int] = set()
    stack = list(succ.get(start, []))
    while stack:
        node = stack.pop()
        if node not in seen:
            seen.add(node)
            stack.extend(succ.get(node, []))
    return seen


def _critical_path(order: list[int], succ: dict[int, list[int]], by_id: dict[int, Milestone]) -> list[int]:
    """Longest chain of unfinished milestones; ties go to the chain that ends earliest."""
    active = [i for i in order if by_id[i].status != DONE]
    active_set = set(active)
    best: dict[int, tuple[int, int | None]] = {i: (1, None) for i in active}
    for node in active:
        for target in succ.get(node, []):
            if target in active_set and best[node][0] + 1 > best[target][0]:
                best[target] = (best[node][0] + 1, node)
    if not active:
        return []

    def end_key(i: int) -> tuple[int, date]:
        return (-best[i][0], _effective_date(by_id[i]) or date.max)

    tail: int | None = min(active, key=end_key)
    path: list[int] = []
    while tail is not None:
        path.append(tail)
        tail = best[tail][1]
    path.reverse()
    return path if len(path) > 1 else []


def build_graph(db: Session, project: Project) -> DependencyGraph:
    milestones = (
        db.query(Milestone).filter(Milestone.project_id == project.id).order_by(Milestone.due_date, Milestone.id).all()
    )
    by_id = {m.id: m for m in milestones}
    edges = project_edges(db, project.id, set(by_id))

    succ: dict[int, list[int]] = defaultdict(list)
    pred: dict[int, list[int]] = defaultdict(list)
    for edge in edges:
        succ[edge.predecessor_id].append(edge.successor_id)
        pred[edge.successor_id].append(edge.predecessor_id)

    order = _topological_order(list(by_id), succ)
    level: dict[int, int] = {}
    for node in order:
        level[node] = max((level[p] + 1 for p in pred.get(node, []) if p in level), default=0)

    path = _critical_path(order, succ, by_id)
    path_set = set(path)
    downstream = {i: len(_descendants(i, succ)) for i in by_id}

    candidates = [
        m for m in milestones
        if m.status in TROUBLED and downstream[m.id] > 0
    ]
    bottleneck = None
    chosen = max(candidates, key=lambda m: (downstream[m.id], -(m.due_date or date.max).toordinal()), default=None)
    if chosen:
        count = downstream[chosen.id]
        bottleneck = Bottleneck(
            milestone_id=chosen.id,
            name=chosen.name or "Untitled milestone",
            status=chosen.status or "",
            downstream=count,
            reason=f"{chosen.name} is {(chosen.status or '').lower()} and gates {count} downstream milestone(s).",
        )

    return DependencyGraph(
        project_id=project.id,
        project_name=project.name or "Untitled project",
        nodes=[
            GraphNode(
                id=m.id,
                name=m.name or "Untitled milestone",
                status=m.status or "Not Started",
                progress=m.progress or 0,
                due_date=m.due_date,
                forecast_date=m.forecast_date,
                level=level.get(m.id, 0),
                downstream=downstream[m.id],
                on_critical_path=m.id in path_set,
                is_bottleneck=bool(bottleneck and bottleneck.milestone_id == m.id),
            )
            for m in milestones
        ],
        edges=[
            GraphEdge(
                id=e.id,
                from_id=e.predecessor_id,
                to_id=e.successor_id,
                on_critical_path=e.predecessor_id in path_set and e.successor_id in path_set,
            )
            for e in edges
        ],
        critical_path=path,
        bottleneck=bottleneck,
    )


def simulate_delay(db: Session, project: Project, milestone_id: int, delay_days: int) -> SimulationResult | None:
    """Propagate a slip downstream; the gap between two milestones absorbs part of it."""
    milestones = db.query(Milestone).filter(Milestone.project_id == project.id).all()
    by_id = {m.id: m for m in milestones}
    if milestone_id not in by_id:
        return None

    succ: dict[int, list[int]] = defaultdict(list)
    for edge in project_edges(db, project.id, set(by_id)):
        succ[edge.predecessor_id].append(edge.successor_id)

    shift = {milestone_id: delay_days}
    for node in _topological_order(list(by_id), succ):
        slip = shift.get(node, 0)
        if slip <= 0:
            continue
        here = _effective_date(by_id[node])
        for target in succ.get(node, []):
            there = _effective_date(by_id[target])
            gap = max(0, (there - here).days) if here and there else 0
            shift[target] = max(shift.get(target, 0), slip - gap)

    impacts = []
    for mid, days in shift.items():
        if days <= 0:
            continue
        original = _effective_date(by_id[mid])
        impacts.append(
            SimulationImpact(
                milestone_id=mid,
                name=by_id[mid].name or "Untitled milestone",
                original_date=original,
                new_date=original + timedelta(days=days) if original else None,
                shift_days=days,
            )
        )
    impacts.sort(key=lambda i: (i.original_date or date.max, i.milestone_id))

    sinks = [i.shift_days for i in impacts if not succ.get(i.milestone_id)]
    end_shift = max(sinks, default=0)
    source = by_id[milestone_id].name or "the milestone"
    summary = (
        f"A {delay_days}-day delay in {source} moves {len(impacts)} milestone(s); "
        + (f"the last affected milestone slips by {end_shift} day(s)." if end_shift else "the delay is absorbed before the final milestone.")
    )
    return SimulationResult(
        delay_days=delay_days, source=source, impacts=impacts, end_shift_days=end_shift, summary=summary
    )

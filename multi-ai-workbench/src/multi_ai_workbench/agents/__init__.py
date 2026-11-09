"""エージェント（役割）。役割名 → クラスの対応を AGENT_ROLES で管理する。"""

from multi_ai_workbench.agents.base import (
    AgentResult,
    AgentTask,
    BaseAgent,
    GenericAgent,
    new_task_id,
)
from multi_ai_workbench.agents.coding_agent import CodingAgent
from multi_ai_workbench.agents.external import ExternalCLIAgent
from multi_ai_workbench.agents.research_agent import ResearchAgent
from multi_ai_workbench.agents.review_agent import ReviewAgent

AGENT_ROLES: dict[str, type[BaseAgent]] = {
    "coding": CodingAgent,
    "review": ReviewAgent,
    "research": ResearchAgent,
    "generic": GenericAgent,
}

__all__ = [
    "AGENT_ROLES",
    "AgentResult",
    "AgentTask",
    "BaseAgent",
    "CodingAgent",
    "ExternalCLIAgent",
    "GenericAgent",
    "ResearchAgent",
    "ReviewAgent",
    "new_task_id",
]

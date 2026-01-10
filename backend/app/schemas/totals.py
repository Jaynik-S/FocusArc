from __future__ import annotations

from pydantic import BaseModel

from app.schemas.stats import TimerTotal


class ResetTotalsResponse(BaseModel):
    totals: list[TimerTotal]

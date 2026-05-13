from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional

class CompareEntitiesRequest(BaseModel):
    entity1Name: str
    entity2Name: str
    entityType: Optional[str] = None

class CompareEntitiesResponse(BaseModel):
    success: bool
    message: str
    details: Optional[dict] = None

app = FastAPI(title="ReqTracker Analytics Service")

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/compare-entities", response_model=CompareEntitiesResponse)
def compare_entities(request: CompareEntitiesRequest):
    return {
        "success": True,
        "message": "Servicio analytics activo. Implementa la comparación semántica aquí.",
        "details": {
            "entity1": request.entity1Name,
            "entity2": request.entity2Name,
            "entityType": request.entityType
        }
    }

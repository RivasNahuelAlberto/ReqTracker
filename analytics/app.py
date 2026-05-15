
# FastAPI Analytics Service for ReqTracker
from fastapi import FastAPI, HTTPException, Body
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import os
import json
import re
import traceback
import hashlib
import logging
import pathlib
import sys
import numpy as np
import redis
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.decomposition import LatentDirichletAllocation

logger = logging.getLogger(__name__)

# Ensure analytics package can be resolved regardless of current working directory
ANALYTICS_DIR = pathlib.Path(__file__).resolve().parent
PROJECT_ROOT = ANALYTICS_DIR.parent  # Parent of /analytics = /reqtracker
CURRENT_DIR = pathlib.Path.cwd()

# Add directories to sys.path in priority order
for directory in [str(ANALYTICS_DIR), str(PROJECT_ROOT), str(CURRENT_DIR)]:
    if directory not in sys.path:
        sys.path.insert(0, directory)
        logger.info(f"Added to sys.path: {directory}")

semantic_import_error = None
graph_import_error = None
monitoring_import_error = None
agent_import_error = None

# ETAPA 2, 3, 6 y 9: Import semantic, graph, monitoring and agent intelligence modules
# Try local imports first, then namespaced imports

# Semantic module
try:
    from semantic import setup_semantic_routes
    logger.info("Successfully imported semantic module (local)")
    semantic_import_error = None
except Exception as exc_local:
    logger.warning("Local semantic import failed, trying namespaced import: %s", exc_local)
    try:
        from analytics.semantic import setup_semantic_routes
        logger.info("Successfully imported semantic module (namespaced)")
        semantic_import_error = None
    except Exception as exc_namespaced:
        setup_semantic_routes = None
        semantic_import_error = traceback.format_exc()
        logger.error("Failed to import semantic module: %s", semantic_import_error)

# Graph module
try:
    from graph import setup_graph_routes
    logger.info("Successfully imported graph module (local)")
    graph_import_error = None
except Exception as exc_local:
    logger.warning("Local graph import failed, trying namespaced import: %s", exc_local)
    try:
        from analytics.graph import setup_graph_routes
        logger.info("Successfully imported graph module (namespaced)")
        graph_import_error = None
    except Exception as exc_namespaced:
        setup_graph_routes = None
        graph_import_error = traceback.format_exc()
        logger.error("Failed to import graph module: %s", graph_import_error)

# Monitoring module
try:
    from monitoring import setup_monitoring_routes
    logger.info("Successfully imported monitoring module (local)")
    monitoring_import_error = None
except Exception as exc_local:
    logger.warning("Local monitoring import failed, trying namespaced import: %s", exc_local)
    try:
        from analytics.monitoring import setup_monitoring_routes
        logger.info("Successfully imported monitoring module (namespaced)")
        monitoring_import_error = None
    except Exception as exc_namespaced:
        setup_monitoring_routes = None
        monitoring_import_error = traceback.format_exc()
        logger.error("Failed to import monitoring module: %s", monitoring_import_error)

# ETAPA 9: Agent analytics module
try:
    from agent import setup_agent_routes
    logger.info("Successfully imported agent module (local)")
    agent_import_error = None
except Exception as exc_local:
    logger.warning("Local agent import failed, trying namespaced import: %s", exc_local)
    try:
        from analytics.agent import setup_agent_routes
        logger.info("Successfully imported agent module (namespaced)")
        agent_import_error = None
    except Exception as exc_namespaced:
        setup_agent_routes = None
        agent_import_error = traceback.format_exc()
        logger.error("Failed to import agent module: %s", agent_import_error)

# Initialize FastAPI app
app = FastAPI(title="ReqTracker Analytics Service", version="1.0.0")

# --- Quality scoring endpoint ---
# Ejemplo de request:
# POST /quality { "text": "El sistema debería responder rápidamente." }

@app.post("/quality")
def quality_score(request: dict = Body(...)):
    """
    Pipeline avanzado de calidad de requisitos:
    - Heurísticas lingüísticas (spaCy)
    - Embeddings para ambigüedad contextual
    - Hook para modelo fine-tuned (BERT, RoBERTa, etc)
    - Fácil de expandir con vector search o reglas adicionales
    """
    text = request.get("text", "")
    nlp = get_nlp()
    embedding_model = get_embedding_model()
    problems = []
    ambiguity_score = 0.0
    atomicity_score = 1.0
    quality_score = 1.0

    # --- Heurísticas lingüísticas ---
    if nlp:
        doc = nlp(text)
        vague_words = ["rápidamente", "fácilmente", "eficiente", "adecuado", "óptimo", "mejor"]
        if any(w in text.lower() for w in vague_words):
            problems.append("vague_adjective")
            ambiguity_score += 0.5
            quality_score -= 0.2
        if not any(char.isdigit() for char in text):
            problems.append("missing_metric")
            quality_score -= 0.2
        if len(list(doc.sents)) > 1:
            problems.append("not_atomic")
            atomicity_score = 0.5
            quality_score -= 0.1
        # Heurística: uso de SHOULD
        if "should" in text.lower():
            problems.append("should_not_used")
            quality_score -= 0.1
    else:
        problems.append("nlp_not_loaded")
        ambiguity_score = 0.5
        atomicity_score = 0.5
        quality_score = 0.5

    # --- Embeddings: ambigüedad contextual ---
    if embedding_model:
        emb = embedding_model.encode([text])[0]
        # Hook: comparar con ejemplos ambiguos (esto puede ser una base de datos o hardcode)
        ambiguous_examples = [
            "El sistema debe ser eficiente.",
            "El usuario podrá acceder fácilmente.",
            "La interfaz será adecuada para todos los usuarios."
        ]
        ambiguous_embs = embedding_model.encode(ambiguous_examples)
        from sklearn.metrics.pairwise import cosine_similarity
        sim_scores = cosine_similarity([emb], ambiguous_embs)[0]
        max_sim = float(max(sim_scores))
        if max_sim > 0.8:
            problems.append("contextual_ambiguity")
            ambiguity_score += 0.4
            quality_score -= 0.15
    else:
        problems.append("embeddings_not_loaded")

    # --- Hook: modelo fine-tuned (BERT, RoBERTa, etc) ---
    # Aquí podrías cargar un modelo propio y ajustar el quality_score
    # Ejemplo:
    # from transformers import pipeline
    # quality_clf = pipeline('text-classification', model='tu-modelo-finetuned')
    # pred = quality_clf(text)
    # quality_score = pred[0]['score']

    # --- Normalización y salida ---
    ambiguity_score = max(0.0, min(1.0, ambiguity_score))
    atomicity_score = max(0.0, min(1.0, atomicity_score))
    quality_score = max(0.0, min(1.0, quality_score))
    return {
        "quality_score": quality_score,
        "ambiguity_score": ambiguity_score,
        "atomicity_score": atomicity_score,
        "problems": problems,
        "input": text,
        "info": "Puedes expandir este pipeline con modelos propios, vector search, reglas, etc."
    }


# --- Similarity endpoint (Advanced) ---
# Ejemplo de request:
# POST /similarity { "text1": "El sistema debe permitir login.", "text2": "El usuario puede autenticarse." }
@app.post("/similarity")
def similarity_score(request: dict = Body(...)):
    """
    Pipeline avanzado de similitud semántica:
    - Embeddings de alta calidad (all-MiniLM-L6-v2, bge-large, etc)
    - Similitud de tokens (Jaccard, overlap)
    - Similitud de entidades nombradas (spaCy)
    - Detección de duplicados (threshold configurable)
    - Hook para vector search (Qdrant, Weaviate)
    - Cache opcional con Redis
    """
    text1 = request.get("text1", "")
    text2 = request.get("text2", "")
    threshold_duplicate = request.get("threshold_duplicate", 0.85)
    
    # --- Similitud semántica (embeddings) ---
    embedding_model = get_embedding_model()
    semantic_sim = 0.0
    if embedding_model:
        try:
            emb = embedding_model.encode([text1, text2])
            semantic_sim = float(cosine_similarity([emb[0]], [emb[1]])[0][0])
        except Exception as e:
            print(f"Error computing embeddings: {e}")
    
    # --- Similitud de tokens (heurística) ---
    tokens1 = set(text1.lower().split())
    tokens2 = set(text2.lower().split())
    intersection = len(tokens1 & tokens2)
    union = len(tokens1 | tokens2)
    token_sim = intersection / union if union > 0 else 0.0
    
    # --- Similitud de entidades nombradas (spaCy) ---
    nlp = get_nlp()
    entity_sim = 0.0
    if nlp:
        try:
            doc1 = nlp(text1)
            doc2 = nlp(text2)
            ents1 = {ent.text.lower() for ent in doc1.ents}
            ents2 = {ent.text.lower() for ent in doc2.ents}
            ent_intersection = len(ents1 & ents2)
            ent_union = len(ents1 | ents2)
            entity_sim = ent_intersection / ent_union if ent_union > 0 else 0.0
        except Exception as e:
            print(f"Error computing entity similarity: {e}")
    
    # --- Score combinado (promedio ponderado) ---
    # Pesos: embeddings (0.6), tokens (0.2), entidades (0.2)
    combined_sim = (0.6 * semantic_sim) + (0.2 * token_sim) + (0.2 * entity_sim)
    
    # --- Detección de duplicados ---
    is_duplicate = combined_sim >= threshold_duplicate
    
    # --- Hook: Vector Search (Qdrant, Weaviate, etc) ---
    # Para producción, podrías usar:
    # from qdrant_client import QdrantClient
    # client = QdrantClient("http://localhost:6333")
    # similar_docs = client.search(collection_name="requirements", query_vector=emb, limit=5)
    
    return {
        "semantic_similarity": semantic_sim,
        "token_similarity": token_sim,
        "entity_similarity": entity_sim,
        "combined_similarity": combined_sim,
        "is_duplicate": is_duplicate,
        "threshold_used": threshold_duplicate,
        "input1": text1,
        "input2": text2,
        "info": "Expande con vector search (Qdrant, Weaviate) o custom embeddings"
    }


# --- Health endpoints ---
@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "ReqTracker Analytics",
        "version": "1.0.0"
    }


@app.get("/health/deep")
def deep_health_check():
    return {
        "status": "healthy",
        "service": "ReqTracker Analytics",
        "version": "1.0.0",
        "modules": {
            "semantic": {
                "status": "ready" if setup_semantic_routes else "unavailable",
                "error": semantic_import_error
            },
            "graph": {
                "status": "ready" if setup_graph_routes else "unavailable",
                "error": graph_import_error
            },
            "monitoring": {
                "status": "ready" if setup_monitoring_routes else "unavailable",
                "error": monitoring_import_error
            }
        }
    }


# Register additional analytics modules
if setup_semantic_routes:
    setup_semantic_routes(app)
    logger.info("✓ ETAPA 2 (Semantic Intelligence) routes registered")
else:
    logger.warning("⚠️  ETAPA 2 (Semantic Intelligence) module not available")

if setup_graph_routes:
    setup_graph_routes(app)
    logger.info("✓ ETAPA 3 (Graph Intelligence) routes registered")
else:
    logger.warning("⚠️  ETAPA 3 (Graph Intelligence) module not available")

if setup_monitoring_routes:
    setup_monitoring_routes(app)
    logger.info("✓ ETAPA 6 (Real-time Monitoring) routes registered")
else:
    logger.warning("⚠️  ETAPA 6 (Real-time Monitoring) module not available")
# Ejemplo de request:
# POST /recommendation { "text": "Reset de contraseña" }
@app.post("/recommendation")
def recommend_requirements(request: dict = Body(...)):
    """
    Pipeline avanzado de recomendaciones:
    - Embeddings + nearest neighbors (similitud semántica)
    - Base de conocimiento de patrones de dominio
    - Heurísticas de dependencia (ej: contraseña → MFA, auditoría)
    - Hook para vector search (Qdrant) con histórico de requisitos
    - Hook para Graph Neural Networks (relaciones entre requisitos)
    """
    text = request.get("text", "")
    k_neighbors = request.get("k_neighbors", 5)
    
    # --- Base de conocimiento: patrones y dependencias ---
    knowledge_base = {
        "contraseña": ["MFA", "expiración de tokens", "auditoría", "rate limiting", "CAPTCHA"],
        "autenticación": ["MFA", "single sign-on", "session management", "token revocation"],
        "autorización": ["role-based access control", "permission auditing", "delegation"],
        "datos sensibles": ["encryption", "access logging", "data masking", "retention policy"],
        "api": ["rate limiting", "authentication", "API versioning", "deprecation policy"],
        "usuario": ["profile management", "preferences", "notification settings", "privacy controls"],
        "búsqueda": ["indexing", "filtering", "sorting", "pagination", "faceting"],
        "exportación": ["format selection", "scheduling", "compression", "access control"],
        "integración": ["webhook", "API", "SSO", "data sync", "error handling"]
    }
    
    # --- Nearest neighbors en base de conocimiento ---
    recommendations = []
    embedding_model = get_embedding_model()
    nlp = get_nlp()
    
    if embedding_model:
        # Calcular similitud con todas las keywords
        text_emb = embedding_model.encode([text])[0]
        keyword_sims = {}
        for keyword in knowledge_base.keys():
            keyword_emb = embedding_model.encode([keyword])[0]
            sim = float(cosine_similarity([text_emb], [keyword_emb])[0][0])
            keyword_sims[keyword] = sim
        
        # Top K keywords más similares
        top_keywords = sorted(keyword_sims.items(), key=lambda x: x[1], reverse=True)[:3]
        for keyword, sim in top_keywords:
            if sim > 0.5:  # threshold de relevancia
                recommendations.extend(knowledge_base[keyword])
    
    # --- Heurísticas adicionales (si embedding falla) ---
    if not recommendations:
        text_lower = text.lower()
        for keyword, related in knowledge_base.items():
            if keyword in text_lower:
                recommendations.extend(related)
                break
    
    # --- Entidades nombradas: contexto ---
    context = []
    if nlp:
        doc = nlp(text)
        for ent in doc.ents:
            context.append({"text": ent.text, "label": ent.label_})
    
    # --- Deduplicar recomendaciones ---
    recommendations = list(set(recommendations))[:k_neighbors]
    
    # --- Hook: Vector Search (Qdrant) ---
    # Para producción:
    # client = QdrantClient("http://localhost:6333")
    # similar_reqs = client.search(collection_name="requirements", 
    #                              query_vector=text_emb, 
    #                              limit=k_neighbors)
    # recommendations = [req.payload['recommendation'] for req in similar_reqs]
    
    # --- Hook: Graph Neural Networks ---
    # Para capturar relaciones: "contraseña" -> "MFA" (dependencia)
    # Usar embeddings relacionales o GNN para inferir mejor.
    
    return {
        "recommendations": recommendations,
        "context": context,
        "input": text,
        "k_neighbors": k_neighbors,
        "info": "Expande con vector search (Qdrant) o GNN para relaciones más sofisticadas"
    }


# --- Impact prediction endpoint (Advanced) ---
# Ejemplo de request:
# POST /impact { "text": "Cambiar la política de contraseñas" }
@app.post("/impact")
def predict_impact(request: dict = Body(...)):
    """
    Pipeline avanzado de predicción de impacto:
    - Embeddings para similitud con cambios históricos
    - Análisis de entidades para identificar componentes afectados
    - Reglas de dependencia y módulos relacionados
    - Scoring de riesgo (complejidad, dependencias, cambio scope)
    - Hook para Graph Neural Networks (análisis de grafo de dependencias)
    """
    text = request.get("text", "")
    
    # --- Mapa de módulos y dependencias ---
    module_dependencies = {
        "auth": ["user_management", "security", "logging"],
        "user_management": ["profile", "permissions", "notifications"],
        "api": ["auth", "rate_limiting", "versioning"],
        "security": ["encryption", "audit", "compliance"],
        "database": ["caching", "replication", "backup"],
        "ui": ["backend", "notifications"],
        "reporting": ["database", "analytics"]
    }
    
    # --- Keywords -> módulos ---
    keyword_to_modules = {
        "contraseña": ["auth", "security", "user_management"],
        "autenticación": ["auth", "security"],
        "autorización": ["auth", "permissions"],
        "base de datos": ["database", "caching"],
        "api": ["api", "auth", "rate_limiting"],
        "usuario": ["user_management", "profile", "permissions"],
        "reporte": ["reporting", "analytics", "database"],
        "seguridad": ["security", "encryption", "audit"],
        "datos": ["database", "security", "backup"],
        "interfaz": ["ui", "backend"]
    }
    
    # --- Análisis de entidades y keywords ---
    nlp = get_nlp()
    embedding_model = get_embedding_model()
    impacted_modules = set()
    risk_factors = []
    complexity_score = 0.0
    
    # 1. Keywords heurísticos
    text_lower = text.lower()
    for keyword, modules in keyword_to_modules.items():
        if keyword in text_lower:
            impacted_modules.update(modules)
            risk_factors.append(f"keyword_match: {keyword}")
    
    # 2. Análisis de entidades nombradas
    if nlp:
        doc = nlp(text)
        for ent in doc.ents:
            ent_text_lower = ent.text.lower()
            for keyword, modules in keyword_to_modules.items():
                if keyword in ent_text_lower:
                    impacted_modules.update(modules)
                    risk_factors.append(f"entity_match: {ent.label_}")
    
    # 3. Embeddings: similitud con cambios de alto impacto históricos
    if embedding_model:
        text_emb = embedding_model.encode([text])[0]
        high_impact_changes = [
            "cambio en la autenticación",
            "modificación de la base de datos",
            "actualización de la API",
            "cambio de política de seguridad"
        ]
        high_impact_embs = embedding_model.encode(high_impact_changes)
        sims = cosine_similarity([text_emb], high_impact_embs)[0]
        max_sim = float(max(sims))
        if max_sim > 0.7:
            impacted_modules.update(["security", "audit", "logging"])
            risk_factors.append("high_impact_detected")
            complexity_score += 0.3
    
    # 4. Calcular complejidad por número de módulos afectados
    complexity_score += min(len(impacted_modules) * 0.1, 0.4)
    
    # 5. Calcular riesgo: 0.0 (bajo) a 1.0 (alto)
    # Consideraciones: número de módulos, dependencias, cambio scope
    num_modules = len(impacted_modules)
    if num_modules == 0:
        risk = 0.1
    elif num_modules <= 2:
        risk = 0.3 + complexity_score
    elif num_modules <= 4:
        risk = 0.6 + complexity_score
    else:
        risk = 0.9
    
    # Ajustar por keywords de alto riesgo
    high_risk_keywords = ["seguridad", "autenticación", "base de datos", "api"]
    for keyword in high_risk_keywords:
        if keyword in text_lower:
            risk = min(risk + 0.2, 1.0)
    
    # 6. Expandir módulos por dependencias transitivas
    all_impacted = set(impacted_modules)
    for module in impacted_modules:
        if module in module_dependencies:
            all_impacted.update(module_dependencies[module])
    
    # --- Hook: Graph Neural Networks ---
    # Para análisis más sofisticado:
    # - Usar embeddings relacionales
    # - Inferir cascada de cambios en el grafo
    # - Predecir impacto indirecto
    
    return {
        "impacted_modules": list(all_impacted),
        "risk_score": min(1.0, max(0.0, risk)),
        "complexity_score": min(1.0, max(0.0, complexity_score)),
        "risk_factors": risk_factors,
        "input": text,
        "info": "Expande con GNN para análisis de grafo y cascadas de cambios"
    }


# --- Consistency check endpoint (Advanced) ---
# Ejemplo de request:
# POST /consistency { "requirements": ["Password mínima 8 chars", "Password mínima 12 chars"] }
@app.post("/consistency")
def check_consistency(request: dict = Body(...)):
    """
    Pipeline avanzado de detección de consistencia:
    - Similitud semántica entre requisitos (embeddings)
    - Heurísticas de conflicto (números contradictorios, keywords opuestas)
    - Análisis de entidades para detectar restricciones conflictivas
    - Hook para Natural Language Inference (NLI): ej, RoBERTa-large-mnli
    - Detecta contradicciones implícitas y explícitas
    """
    requirements = request.get("requirements", [])
    if not requirements:
        return {"conflicts": [], "input": requirements}
    
    conflicts = []
    contradiction_pairs = []
    embedding_model = get_embedding_model()
    nlp = get_nlp()
    
    # --- Pares potencialmente conflictivos (similitud alta) ---
    if embedding_model and len(requirements) > 1:
        embs = embedding_model.encode(requirements)
        for i in range(len(requirements)):
            for j in range(i + 1, len(requirements)):
                sim = float(cosine_similarity([embs[i]], [embs[j]])[0][0])
                if sim > 0.75:  # muy similares
                    contradiction_pairs.append((i, j, sim))
    
    # --- Heurísticas de conflicto explícito ---
    text_lower = [r.lower() for r in requirements]
    
    # 1. Conflicto numérico (ej: 8 chars vs 12 chars)
    numbers = []
    for idx, req in enumerate(requirements):
        import re
        nums = re.findall(r'\d+', req)
        if nums:
            numbers.append((idx, [int(n) for n in nums]))
    
    for i, (idx1, nums1) in enumerate(numbers):
        for idx2, nums2 in numbers[i + 1:]:
            if idx1 != idx2:
                # Si los números son muy diferentes, es potencial conflicto
                if any(abs(n1 - n2) > 2 for n1 in nums1 for n2 in nums2):
                    if "mínimo" in text_lower[idx1] or "mínimo" in text_lower[idx2]:
                        conflicts.append({
                            "type": "conflicting_numeric_constraint",
                            "req1_idx": idx1,
                            "req2_idx": idx2,
                            "req1": requirements[idx1],
                            "req2": requirements[idx2]
                        })
    
    # 2. Keywords opuestos
    opposites = {
        "debe": "puede",
        "requerido": "opcional",
        "obligatorio": "voluntario",
        "permitir": "prohibir",
        "acepta": "rechaza"
    }
    
    for idx, req in enumerate(text_lower):
        for other_idx, other_req in enumerate(text_lower):
            if idx != other_idx:
                for op1, op2 in opposites.items():
                    if op1 in req and op2 in other_req:
                        # Detectar si es sobre lo mismo
                        req_obj_idx = text_lower[idx].find(op1) + len(op1)
                        other_obj_idx = text_lower[other_idx].find(op2) + len(op2)
                        if req_obj_idx < len(text_lower[idx]) and other_obj_idx < len(text_lower[other_idx]):
                            conflicts.append({
                                "type": "opposite_keywords",
                                "keyword1": op1,
                                "keyword2": op2,
                                "req1_idx": idx,
                                "req2_idx": other_idx
                            })
    
    # 3. Análisis de entidades (restricciones sobre mismos componentes)
    if nlp and len(requirements) > 1:
        docs = [nlp(r) for r in requirements]
        entities_by_type = {}
        for doc_idx, doc in enumerate(docs):
            for ent in doc.ents:
                key = (ent.label_, ent.text.lower())
                if key not in entities_by_type:
                    entities_by_type[key] = []
                entities_by_type[key].append(doc_idx)
        
        # Si el mismo entity aparece en múltiples requisitos, chequear si son contradictorios
        for (ent_type, ent_text), doc_indices in entities_by_type.items():
            if len(doc_indices) > 1:
                # Comparar si los requisitos dicen cosas opuestas del mismo entity
                for i in range(len(doc_indices)):
                    for j in range(i + 1, len(doc_indices)):
                        idx1, idx2 = doc_indices[i], doc_indices[j]
                        req1, req2 = requirements[idx1], requirements[idx2]
                        if any(opp in req1.lower() for opp in opposites.keys()) and \
                           any(opp in req2.lower() for opp in opposites.keys()):
                            conflicts.append({
                                "type": "entity_restriction_conflict",
                                "entity": ent_text,
                                "entity_type": ent_type,
                                "req1_idx": idx1,
                                "req2_idx": idx2
                            })
    
    # --- Hook: Natural Language Inference (NLI) ---
    # Para detectar contradicciones implícitas:
    # from transformers import pipeline
    # nli_pipeline = pipeline('zero-shot-classification', 
    #                         model='roberta-large-mnli')
    # premise = requirements[i]
    # hypothesis = requirements[j]
    # result = nli_pipeline(hypothesis, [premise, "contradiction", "neutral"])
    # if result['labels'][0] == 'contradiction':
    #     conflicts.append(...)
    
    # --- Resumen ---
    return {
        "conflicts": conflicts,
        "contradiction_pairs": [
            {
                "idx1": idx1,
                "idx2": idx2,
                "similarity": sim,
                "req1": requirements[idx1],
                "req2": requirements[idx2]
            }
            for idx1, idx2, sim in contradiction_pairs
        ],
        "is_consistent": len(conflicts) == 0,
        "input": requirements,
        "info": "Expande con NLI (RoBERTa-large-mnli) para contradicciones implícitas"
    }

class CompareEntitiesRequest(BaseModel):
    entity1Name: Optional[str] = None
    entity2Name: Optional[str] = None
    entity1: Optional[str] = None
    entity2: Optional[str] = None
    entityType: Optional[str] = None

    @property
    def resolved_entity1(self) -> str:
        return self.entity1Name or self.entity1 or ''

    @property
    def resolved_entity2(self) -> str:
        return self.entity2Name or self.entity2 or ''

class CompareEntitiesResponse(BaseModel):
    success: bool
    message: str
    details: Optional[dict] = None
    similarity_score: Optional[float] = None
    recommendations: Optional[List[str]] = None

class AnalyzeTextRequest(BaseModel):
    text: str
    analysis_type: str = "entities"  # entities, sentiment, keywords, summary

class AnalyzeTextResponse(BaseModel):
    success: bool
    analysis_type: str
    results: Dict[str, Any]

class GenerateEmbeddingsRequest(BaseModel):
    texts: List[str]

class GenerateEmbeddingsResponse(BaseModel):
    success: bool
    embeddings: List[List[float]]
    model_name: str

class CompareRequirementsRequest(BaseModel):
    requirement1: str
    requirement2: str

class CompareRequirementsResponse(BaseModel):
    success: bool
    similarity_score: float
    overlapping_concepts: List[str]
    differences: List[str]
    recommendations: List[str]

# Initialize models with lazy loading
REDIS_URL = os.environ.get('REDIS_URL')
redis_client = None
redis_available = False

# Lazy loaded models
nlp = None
embedding_model = None
sentiment_pipeline = None
models_loaded = False
sentiment_loaded = False

def get_nlp():
    global nlp
    if nlp is None:
        try:
            import spacy
            nlp = spacy.load("en_core_web_sm")
        except Exception as e:
            print(f"Warning: Could not load spaCy model: {e}")
            nlp = None
    return nlp

def get_embedding_model():
    global embedding_model
    if embedding_model is None:
        try:
            from sentence_transformers import SentenceTransformer
            embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
        except Exception as e:
            print(f"Warning: Could not load embedding model: {e}")
            embedding_model = None
    return embedding_model

def get_sentiment_pipeline():
    global sentiment_pipeline
    if sentiment_pipeline is None:
        try:
            from transformers import pipeline
            sentiment_pipeline = pipeline(
                "sentiment-analysis",
                model="distilbert-base-uncased-finetuned-sst-2-english"
            )
        except Exception as e:
            print(f"Warning: Could not load sentiment pipeline: {e}")
            sentiment_pipeline = None
    return sentiment_pipeline

def get_redis_client():
    global redis_client, redis_available
    if redis_client is None and REDIS_URL:
        try:
            import redis as redis_module
            connect_kwargs = {"decode_responses": True}
            if REDIS_URL.startswith("rediss://"):
                connect_kwargs["ssl"] = True
                connect_kwargs["ssl_cert_reqs"] = None
            redis_client = redis_module.Redis.from_url(REDIS_URL, **connect_kwargs)
            redis_client.ping()
            redis_available = True
        except Exception as e:
            print(f"Warning: Redis unavailable at {REDIS_URL}: {e}")
            traceback.print_exc()
            redis_client = None
            redis_available = False
    return redis_client

def check_models_loaded():
    global models_loaded, sentiment_loaded
    if not models_loaded:
        models_loaded = get_nlp() is not None and get_embedding_model() is not None
    if not sentiment_loaded:
        sentiment_loaded = get_sentiment_pipeline() is not None
    return models_loaded, sentiment_loaded


def make_embedding_cache_key(texts: List[str]) -> str:
    normalized_texts = json.dumps(texts, ensure_ascii=False, sort_keys=True)
    return "embeddings:" + hashlib.sha256(normalized_texts.encode('utf-8')).hexdigest()


def get_cached_embeddings(texts: List[str]) -> np.ndarray:
    redis_client = get_redis_client()
    key = make_embedding_cache_key(texts)
    if redis_client:
        try:
            cached = redis_client.get(key)
            if cached:
                return np.array(json.loads(cached), dtype=float)
        except Exception as e:
            print(f"Warning reading embeddings cache: {e}")

    embedding_model = get_embedding_model()
    if embedding_model is None:
        raise Exception("Embedding model not available")

    embeddings = embedding_model.encode(texts)
    if redis_client:
        try:
            redis_client.set(key, json.dumps(embeddings.tolist()), ex=3600)
        except Exception as e:
            print(f"Warning saving embeddings cache: {e}")

    return embeddings


def extract_topics(text: str, n_topics: int = 3, n_words: int = 5) -> List[Dict[str, Any]]:
    sentences = [s.strip() for s in re.split(r'[.!?]+', text) if s.strip()]
    if len(sentences) < 2:
        return [{
            "topic_number": 1,
            "keywords": ["Texto demasiado corto para topic modeling"]
        }]

    n_topics = min(n_topics, len(sentences))
    vectorizer = CountVectorizer(stop_words='english', max_df=0.95, min_df=1)
    doc_term_matrix = vectorizer.fit_transform(sentences)
    lda = LatentDirichletAllocation(n_components=n_topics, random_state=42)
    lda.fit(doc_term_matrix)
    feature_names = vectorizer.get_feature_names_out()

    topics = []
    for idx, topic in enumerate(lda.components_):
        top_keywords = [feature_names[i] for i in topic.argsort()[:-n_words-1:-1]]
        topics.append({
            "topic_number": idx + 1,
            "keywords": top_keywords
        })
    return topics


# --- Advanced Agent Analysis Endpoint (NEW) ---
@app.post("/agent/analyze")
def agent_analyze(request: dict = Body(...)):
    """
    Análisis avanzado para el agente autónomo:
    - Quality scoring
    - Similarity detection (duplicados)
    - Risk assessment
    - Recommendations
    - Todos usando embeddings semánticos reales
    
    Permite al agente:
    1. Retroalimentarse con embeddings
    2. Detectar patrones
    3. Tomar decisiones informadas
    4. Mejorar requisitos iterativamente
    """
    text = request.get("text", "")
    project_context = request.get("context", [])  # requisitos históricos
    
    embedding_model = get_embedding_model()
    nlp = get_nlp()
    
    if not embedding_model or not text:
        return {
            "error": "Embedding model or text missing",
            "status": "failed"
        }
    
    # --- 1. Quality Scoring con Embeddings ---
    problems = []
    quality_score = 1.0
    text_emb = embedding_model.encode([text])[0]
    
    if nlp:
        doc = nlp(text)
        
        # Vagueness detection via embeddings
        vague_terms = ["rápidamente", "fácilmente", "eficiente", "adecuado", "óptimo"]
        vague_scores = []
        for term in vague_terms:
            term_emb = embedding_model.encode([term])[0]
            sim = float(cosine_similarity([text_emb], [term_emb])[0][0])
            if sim > 0.7:
                vague_scores.append((term, sim))
                problems.append(f"vague_term: {term}")
                quality_score -= 0.15
        
        # Atomicity check
        if len(list(doc.sents)) > 2:
            problems.append("not_atomic")
            quality_score -= 0.2
        
        # Metrics detection
        if not any(char.isdigit() for char in text):
            problems.append("missing_metric")
            quality_score -= 0.1
    
    # --- 2. Similarity con Context (Detección de Duplicados) ---
    duplicate_matches = []
    if project_context and embedding_model:
        for ctx_req in project_context:
            ctx_text = ctx_req.get("text", "") if isinstance(ctx_req, dict) else str(ctx_req)
            if ctx_text:
                ctx_emb = embedding_model.encode([ctx_text])[0]
                sim = float(cosine_similarity([text_emb], [ctx_emb])[0][0])
                if sim > 0.75:  # Threshold para duplicados
                    duplicate_matches.append({
                        "text": ctx_text,
                        "similarity": round(sim, 3),
                        "is_duplicate": sim > 0.85
                    })
    
    # --- 3. Risk Assessment ---
    risk_keywords = {
        "crítica": 0.9,
        "seguridad": 0.85,
        "autenticación": 0.8,
        "datos": 0.75,
        "pérdida": 0.9,
        "error": 0.6
    }
    
    risk_score = 0.0
    risk_factors = []
    for keyword, weight in risk_keywords.items():
        keyword_emb = embedding_model.encode([keyword])[0]
        sim = float(cosine_similarity([text_emb], [keyword_emb])[0][0])
        if sim > 0.6:
            risk_score = max(risk_score, sim * weight)
            risk_factors.append(f"{keyword} (similarity: {sim:.2f})")
    
    # --- 4. Recommendations (K-NN based) ---
    knowledge_base = {
        "contraseña": ["MFA", "expiración tokens", "auditoría", "rate limiting"],
        "autenticación": ["SSO", "session management", "token revocation"],
        "autorización": ["RBAC", "permission auditing", "delegation"],
        "datos sensibles": ["encryption", "access logging", "data masking"],
        "API": ["rate limiting", "versioning", "deprecation policy"],
        "búsqueda": ["indexing", "filtering", "pagination"],
        "usuario": ["profile management", "preferences", "privacy controls"],
        "integración": ["webhook", "API", "SSO", "data sync"]
    }
    
    recommendations = []
    keyword_similarities = {}
    for keyword in knowledge_base.keys():
        keyword_emb = embedding_model.encode([keyword])[0]
        sim = float(cosine_similarity([text_emb], [keyword_emb])[0][0])
        if sim > 0.5:
            keyword_similarities[keyword] = sim
            recommendations.extend(knowledge_base[keyword])
    
    # Top keywords
    top_keywords = sorted(keyword_similarities.items(), key=lambda x: x[1], reverse=True)[:3]
    
    # --- 5. Context Extraction (NER) ---
    entities = []
    if nlp:
        doc = nlp(text)
        for ent in doc.ents:
            entities.append({
                "text": ent.text,
                "label": ent.label_,
                "start": ent.start_char,
                "end": ent.end_char
            })
    
    # Final quality normalization
    quality_score = max(0.0, min(1.0, quality_score))
    risk_score = round(risk_score, 3)
    
    return {
        "status": "success",
        "input": text,
        "quality": {
            "score": round(quality_score, 3),
            "problems": problems,
            "verdict": "high_quality" if quality_score > 0.8 else "medium" if quality_score > 0.6 else "low_quality"
        },
        "duplicates": {
            "matches": duplicate_matches,
            "has_duplicates": len([m for m in duplicate_matches if m["is_duplicate"]]) > 0
        },
        "risk": {
            "score": risk_score,
            "factors": risk_factors,
            "level": "critical" if risk_score > 0.8 else "high" if risk_score > 0.6 else "medium" if risk_score > 0.4 else "low"
        },
        "recommendations": list(set(recommendations))[:10],
        "top_keywords": [{"keyword": k, "similarity": round(s, 3)} for k, s in top_keywords],
        "entities": entities,
        "embedding_used": "all-MiniLM-L6-v2"
    }


# --- Endpoint para buscar requisitos similares (Semantic Search) ---
@app.post("/embeddings/similar-requirements")
def find_similar_requirements(request: dict = Body(...)):
    """
    Semantic search para encontrar requisitos similares.
    Usa embeddings reales para búsqueda inteligente.
    
    Request:
    {
        "query": "El usuario debe poder cambiar su contraseña",
        "requirements": [...],
        "limit": 5,
        "threshold": 0.6
    }
    """
    query = request.get("query", "")
    requirements = request.get("requirements", [])
    limit = request.get("limit", 5)
    threshold = request.get("threshold", 0.6)
    
    embedding_model = get_embedding_model()
    
    if not embedding_model or not query or not requirements:
        return {"error": "Missing parameters"}
    
    # Encode query
    query_emb = embedding_model.encode([query])[0]
    
    # Compare with all requirements
    results = []
    for i, req in enumerate(requirements):
        req_text = req.get("text", "") if isinstance(req, dict) else str(req)
        if req_text:
            req_emb = embedding_model.encode([req_text])[0]
            sim = float(cosine_similarity([query_emb], [req_emb])[0][0])
            
            if sim >= threshold:
                results.append({
                    "index": i,
                    "text": req_text,
                    "similarity": round(sim, 3),
                    "original": req
                })
    
    # Sort by similarity descending
    results.sort(key=lambda x: x["similarity"], reverse=True)
    results = results[:limit]
    
    return {
        "query": query,
        "similar_requirements": results,
        "total_matches": len(results),
        "threshold_used": threshold,
        "embedding_model": "all-MiniLM-L6-v2"
    }


# --- Endpoint para agrupar requisitos similares (Clustering) ---
@app.post("/embeddings/cluster-requirements")
def cluster_requirements(request: dict = Body(...)):
    """
    Agrupa requisitos similares usando embeddings + clustering.
    Útil para el agente para entender estructuras de requisitos.
    """
    requirements = request.get("requirements", [])
    distance_threshold = request.get("distance_threshold", 0.3)  # 1 - similarity
    
    embedding_model = get_embedding_model()
    
    if not embedding_model or not requirements:
        return {"error": "Missing parameters"}
    
    # Encode all requirements
    texts = []
    for req in requirements:
        text = req.get("text", "") if isinstance(req, dict) else str(req)
        texts.append(text if text else "")
    
    embeddings = embedding_model.encode(texts)
    
    # Simple clustering based on similarity
    clusters = []
    assigned = set()
    
    for i, emb_i in enumerate(embeddings):
        if i in assigned:
            continue
        
        cluster = [{"index": i, "text": texts[i], "original": requirements[i]}]
        assigned.add(i)
        
        # Find similar items
        for j in range(i + 1, len(embeddings)):
            if j not in assigned:
                sim = float(cosine_similarity([emb_i], [embeddings[j]])[0][0])
                distance = 1 - sim
                if distance <= distance_threshold:
                    cluster.append({
                        "index": j,
                        "text": texts[j],
                        "similarity": round(sim, 3),
                        "original": requirements[j]
                    })
                    assigned.add(j)
        
        if len(cluster) > 0:
            clusters.append({
                "cluster_id": len(clusters),
                "size": len(cluster),
                "requirements": cluster
            })
    
    return {
        "total_requirements": len(requirements),
        "clusters_found": len(clusters),
        "distance_threshold": distance_threshold,
        "clusters": clusters,
        "embedding_model": "all-MiniLM-L6-v2"
    }


    return topics

def health():
    return {"status": "ok", "message": "Analytics service is running"}

@app.get("/health/deep")
def health_deep():
    try:
        models_loaded, sentiment_loaded = check_models_loaded()
        redis_client = get_redis_client()
        redis_available = redis_client is not None

        return {
            "status": "ok",
            "models_loaded": models_loaded,
            "sentiment_model_loaded": sentiment_loaded,
            "redis_available": redis_available,
            "services": ["nlp", "embeddings", "similarity", "sentiment", "topics"]
        }
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Deep health check failed: {str(exc)}")

@app.post("/compare-entities", response_model=CompareEntitiesResponse)
def compare_entities(request: CompareEntitiesRequest):
    models_loaded, _ = check_models_loaded()
    if not models_loaded:
        return CompareEntitiesResponse(
            success=False,
            message="ML models not loaded. Service running in basic mode.",
            details={
                "entity1": request.resolved_entity1,
                "entity2": request.resolved_entity2,
                "entityType": request.entityType
            }
        )

    try:
        entity1_name = request.resolved_entity1
        entity2_name = request.resolved_entity2
        if not entity1_name or not entity2_name:
            raise ValueError("Both entity1 and entity2 are required")

        # Generate or reuse cached embeddings for entity names
        entity_embeddings = get_cached_embeddings([entity1_name, entity2_name])
        entity1_embedding = entity_embeddings[0]
        entity2_embedding = entity_embeddings[1]

        # Calculate similarity
        similarity = cosine_similarity([entity1_embedding], [entity2_embedding])[0][0]

        # Generate recommendations based on similarity
        recommendations = []
        if similarity > 0.8:
            recommendations.append("High similarity - consider merging these entities")
        elif similarity > 0.6:
            recommendations.append("Moderate similarity - review for potential consolidation")
        else:
            recommendations.append("Low similarity - entities appear distinct")

        # Add context-specific recommendations
        if request.entityType:
            if request.entityType.lower() == "requirement" and similarity > 0.7:
                recommendations.append("Requirements may be redundant - consider combining")
            elif request.entityType.lower() == "scenario" and similarity > 0.8:
                recommendations.append("Scenarios are very similar - consider unifying test cases")

        return CompareEntitiesResponse(
            success=True,
            message=f"Entities compared successfully. Similarity: {similarity:.3f}",
            details={
                "entity1": entity1_name,
                "entity2": entity2_name,
                "entityType": request.entityType
            },
            similarity_score=float(similarity),
            recommendations=recommendations
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error comparing entities: {str(e)}")

@app.post("/analyze-text", response_model=AnalyzeTextResponse)
def analyze_text(request: AnalyzeTextRequest):
    models_loaded, sentiment_loaded = check_models_loaded()
    if not models_loaded:
        raise HTTPException(status_code=503, detail="ML models not available")

    try:
        results = {}
        nlp = get_nlp()
        sentiment_pipeline = get_sentiment_pipeline()

        if request.analysis_type == "entities":
            if nlp is None:
                raise HTTPException(status_code=503, detail="NLP model not available")
            doc = nlp(request.text)
            entities = [{
                "text": ent.text,
                "label": ent.label_,
                "start": ent.start_char,
                "end": ent.end_char
            } for ent in doc.ents]
            results["entities"] = entities

        elif request.analysis_type == "keywords":
            if nlp is None:
                raise HTTPException(status_code=503, detail="NLP model not available")
            doc = nlp(request.text)
            keywords = []

            for ent in doc.ents:
                if ent.label_ in ["PERSON", "ORG", "PRODUCT", "GPE", "MONEY", "EVENT"]:
                    keywords.append(ent.text.lower())

            for chunk in doc.noun_chunks:
                if len(chunk.text.split()) <= 3:
                    keywords.append(chunk.text.lower())

            keyword_counts = {}
            for kw in keywords:
                keyword_counts[kw] = keyword_counts.get(kw, 0) + 1

            results["keywords"] = [
                {"keyword": word, "count": count}
                for word, count in sorted(keyword_counts.items(), key=lambda x: x[1], reverse=True)[:10]
            ]

        elif request.analysis_type == "sentiment":
            if sentiment_pipeline is None:
                raise HTTPException(status_code=503, detail="Sentiment model not available")
            sentiment = sentiment_pipeline(request.text[:512])[0]
            results["sentiment"] = sentiment

        elif request.analysis_type == "summary":
            sentences = re.split(r'[.!?]+', request.text)
            sentences = [s.strip() for s in sentences if s.strip()]
            summary_sentences = []
            if sentences:
                summary_sentences.append(sentences[0])
            important_keywords = ["must", "should", "required", "important", "critical", "must be", "shall"]
            for sentence in sentences[1:-1]:
                if any(kw in sentence.lower() for kw in important_keywords):
                    summary_sentences.append(sentence)
            if len(sentences) > 1:
                summary_sentences.append(sentences[-1])
            results["summary"] = " ".join(summary_sentences[:3])

        elif request.analysis_type == "topics":
            results["topics"] = extract_topics(request.text)

        elif request.analysis_type == "all":
            if nlp is None:
                raise HTTPException(status_code=503, detail="NLP model not available")
            doc = nlp(request.text)
            entities = [{
                "text": ent.text,
                "label": ent.label_,
                "start": ent.start_char,
                "end": ent.end_char
            } for ent in doc.ents]

            keywords = []
            for ent in doc.ents:
                if ent.label_ in ["PERSON", "ORG", "PRODUCT", "GPE", "MONEY", "EVENT"]:
                    keywords.append(ent.text.lower())
            for chunk in doc.noun_chunks:
                if len(chunk.text.split()) <= 3:
                    keywords.append(chunk.text.lower())
            keyword_counts = {}
            for kw in keywords:
                keyword_counts[kw] = keyword_counts.get(kw, 0) + 1

            sentiment = sentiment_pipeline(request.text[:512])[0] if sentiment_pipeline else {
                "label": "UNKNOWN",
                "score": 0.0,
                "note": "Sentiment pipeline not loaded"
            }

            summary_sentences = []
            sentences = [s.strip() for s in re.split(r'[.!?]+', request.text) if s.strip()]
            if sentences:
                summary_sentences.append(sentences[0])
            for sentence in sentences[1:-1]:
                if any(kw in sentence.lower() for kw in ["must", "should", "required", "important", "critical", "must be", "shall"]):
                    summary_sentences.append(sentence)
            if len(sentences) > 1:
                summary_sentences.append(sentences[-1])

            results = {
                "entities": entities,
                "keywords": [
                    {"keyword": word, "count": count}
                    for word, count in sorted(keyword_counts.items(), key=lambda x: x[1], reverse=True)[:10]
                ],
                "sentiment": sentiment,
                "summary": " ".join(summary_sentences[:3]),
                "topics": extract_topics(request.text)
            }

        else:
            raise HTTPException(status_code=400, detail=f"Unknown analysis type: {request.analysis_type}")

        return AnalyzeTextResponse(
            success=True,
            analysis_type=request.analysis_type,
            results=results
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error analyzing text: {str(e)}")


@app.post("/generate-embeddings", response_model=GenerateEmbeddingsResponse)
def generate_embeddings(request: GenerateEmbeddingsRequest):
    models_loaded, _ = check_models_loaded()
    if not models_loaded:
        raise HTTPException(status_code=503, detail="ML models not available")

    try:
        embeddings = get_cached_embeddings(request.texts)
        embeddings_list = embeddings.tolist()

        return GenerateEmbeddingsResponse(
            success=True,
            embeddings=embeddings_list,
            model_name="all-MiniLM-L6-v2"
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating embeddings: {str(e)}")


@app.post("/compare-requirements", response_model=CompareRequirementsResponse)
def compare_requirements(request: CompareRequirementsRequest):
    models_loaded, _ = check_models_loaded()
    if not models_loaded:
        raise HTTPException(status_code=503, detail="ML models not available")

    try:
        # Generate or reuse cached embeddings
        requirement_embeddings = get_cached_embeddings([request.requirement1, request.requirement2])
        req1_embedding = requirement_embeddings[0]
        req2_embedding = requirement_embeddings[1]

        # Calculate similarity
        similarity = cosine_similarity([req1_embedding], [req2_embedding])[0][0]

        # Extract key concepts using NLP
        nlp = get_nlp()
        if nlp is None:
            raise HTTPException(status_code=503, detail="NLP model not available")

        req1_doc = nlp(request.requirement1)
        req2_doc = nlp(request.requirement2)

        req1_keywords = set()
        req2_keywords = set()

        for doc, keywords_set in [(req1_doc, req1_keywords), (req2_doc, req2_keywords)]:
            for ent in doc.ents:
                if ent.label_ in ["PRODUCT", "ORG", "GPE", "MONEY", "PERCENT"]:
                    keywords_set.add(ent.text.lower())
            for chunk in doc.noun_chunks:
                if len(chunk.text.split()) <= 2:
                    keywords_set.add(chunk.text.lower())

        overlapping_concepts = list(req1_keywords & req2_keywords)
        unique_req1 = list(req1_keywords - req2_keywords)
        unique_req2 = list(req2_keywords - req1_keywords)

        # Generate recommendations
        recommendations = []
        if similarity > 0.85:
            recommendations.append("Requirements are nearly identical - consider consolidating")
        elif similarity > 0.7:
            recommendations.append("Requirements are very similar - review for potential merge")
        elif similarity > 0.5:
            recommendations.append("Requirements have moderate overlap - ensure they complement each other")
        else:
            recommendations.append("Requirements appear distinct - verify they don't conflict")

        if overlapping_concepts:
            recommendations.append(f"Shared concepts: {', '.join(overlapping_concepts[:3])}")

        return CompareRequirementsResponse(
            success=True,
            similarity_score=float(similarity),
            overlapping_concepts=overlapping_concepts,
            differences=unique_req1 + unique_req2,
            recommendations=recommendations
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error comparing requirements: {str(e)}")


# =============================================================================
# ETAPA 2 & ETAPA 3: Register Intelligence Routes
# =============================================================================

# Register ETAPA 2: Semantic Intelligence routes
if setup_semantic_routes:
    try:
        setup_semantic_routes(app)
        print("✓ ETAPA 2 (Semantic Intelligence) routes registered")
    except Exception as e:
        print(f"⚠️  Failed to register ETAPA 2 routes: {str(e)}")
else:
    print("⚠️  ETAPA 2 (Semantic Intelligence) module not available")

# Register ETAPA 3: Graph Intelligence routes
if setup_graph_routes:
    try:
        setup_graph_routes(app)
        print("✓ ETAPA 3 (Graph Intelligence) routes registered")
    except Exception as e:
        print(f"⚠️  Failed to register ETAPA 3 routes: {str(e)}")
else:
    print("⚠️  ETAPA 3 (Graph Intelligence) module not available")

# Register ETAPA 9: Agent-Specific Analytics routes
if setup_agent_routes:
    try:
        setup_agent_routes(app)
        print("✓ ETAPA 9 (Agent-Specific Analytics) routes registered")
    except Exception as e:
        print(f"⚠️  Failed to register ETAPA 9 routes: {str(e)}")
else:
    print("⚠️  ETAPA 9 (Agent-Specific Analytics) module not available")


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)

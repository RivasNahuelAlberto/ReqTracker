from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import os
import json
import re
import traceback
import hashlib
import numpy as np
import redis
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.decomposition import LatentDirichletAllocation

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

app = FastAPI(title="ReqTracker Analytics Service", version="1.0.0")


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


@app.get("/health")
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


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)

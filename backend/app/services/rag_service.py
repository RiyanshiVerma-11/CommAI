"""
RAG (Retrieval-Augmented Generation) Service — Lightweight document retrieval
using TF-IDF + cosine similarity over platform knowledge, with Groq for response.
"""
import logging
import re
from typing import List, Tuple

logger = logging.getLogger("commai.rag_service")

# We use a simple TF-IDF approach — no external vector DB needed
try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False
    logger.warning("[RAG] scikit-learn not installed. RAG will use fallback keyword matching.")

from app.services.ai_service import _call_groq


class RAGKnowledgeBase:
    """
    In-memory knowledge base that indexes text documents using TF-IDF
    and retrieves the most relevant ones for a given query.
    """

    def __init__(self):
        self.documents: List[str] = []
        self.metadata: List[dict] = []
        self.vectorizer = TfidfVectorizer(stop_words='english', max_features=5000) if SKLEARN_AVAILABLE else None
        self.tfidf_matrix = None
        self._is_fitted = False

    def add_document(self, text: str, meta: dict = None):
        """Add a document to the knowledge base."""
        if text and text.strip():
            self.documents.append(text.strip())
            self.metadata.append(meta or {})
            self._is_fitted = False  # Mark for re-indexing

    def build_index(self):
        """Build/rebuild the TF-IDF index."""
        if not self.documents:
            return
        if SKLEARN_AVAILABLE and self.vectorizer:
            self.tfidf_matrix = self.vectorizer.fit_transform(self.documents)
            self._is_fitted = True
        else:
            self._is_fitted = True

    def retrieve(self, query: str, top_k: int = 3) -> List[Tuple[str, dict, float]]:
        """
        Retrieve the top-k most relevant documents for the query.
        Returns list of (document_text, metadata, similarity_score).
        """
        if not self.documents:
            return []

        if not self._is_fitted:
            self.build_index()

        if SKLEARN_AVAILABLE and self.tfidf_matrix is not None:
            query_vec = self.vectorizer.transform([query])
            similarities = cosine_similarity(query_vec, self.tfidf_matrix).flatten()
            top_indices = similarities.argsort()[-top_k:][::-1]
            results = []
            for idx in top_indices:
                if similarities[idx] > 0.01:  # Minimum threshold
                    results.append((self.documents[idx], self.metadata[idx], float(similarities[idx])))
            return results
        else:
            # Fallback: simple keyword matching
            query_words = set(query.lower().split())
            scored = []
            for i, doc in enumerate(self.documents):
                doc_words = set(doc.lower().split())
                overlap = len(query_words & doc_words)
                if overlap > 0:
                    score = overlap / max(len(query_words), 1)
                    scored.append((doc, self.metadata[i], score))
            scored.sort(key=lambda x: x[2], reverse=True)
            return scored[:top_k]


# Global knowledge base singleton
_knowledge_base = RAGKnowledgeBase()


def get_knowledge_base() -> RAGKnowledgeBase:
    return _knowledge_base


def populate_knowledge_base(db):
    """
    Populate the RAG knowledge base from database content:
    campaigns, templates, and platform FAQs.
    """
    from app.models import Campaign, Template

    kb = get_knowledge_base()
    kb.documents.clear()
    kb.metadata.clear()

    # Index campaign descriptions
    campaigns = db.query(Campaign).filter(Campaign.is_deleted == False).all()
    for c in campaigns:
        text = f"Campaign: {c.title}. {c.description or ''} {c.objective or ''}"
        kb.add_document(text, {"type": "campaign", "id": c.id, "title": c.title})

    # Index template bodies
    templates = db.query(Template).filter(Template.is_deleted == False).all()
    for t in templates:
        text = f"Template: {t.title}. Channel: {t.channel}. Category: {t.category}. Content: {t.body_template}"
        kb.add_document(text, {"type": "template", "id": t.id, "title": t.title})

    # Add platform FAQ entries
    faqs = [
        "CommAI is a mass communication platform for government organizations to send campaigns via Email, SMS, WhatsApp, Push Notifications, Website channels, and Dashboard updates (Live Bulletins).",
        "Audience segmentation allows targeting specific demographics like farmers, healthcare workers, or students based on location, age, occupation, and language preferences.",
        "Campaigns go through a workflow: Draft, Pending Approval, Scheduled, Active, Completed. Admins approve campaigns before they are sent.",
        "Templates support personalization with placeholder variables like first_name, city, district, and state that are replaced with actual audience data during delivery.",
        "Emergency alerts can be submitted by citizens and are reviewed by campaign managers. Critical alerts trigger immediate response protocols.",
        "Citizens can contact a campaign manager or operator directly by submitting an Emergency Contact request or raising a Support Query ticket from their CommAI dashboard. Campaign managers receive these requests in real-time and reply to them directly.",
        "The platform supports 22 official Indian languages for translations including Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam, and more.",
        "Campaign feedback allows audience members to rate campaigns from 1-5 stars and provide comments. Managers can view aggregated feedback analytics.",
        "The platform includes compliance checks for spam phrases, sensitive language, readability, and proper placeholder formatting.",
        "Updates on dashboards, live bulletins, and real-time emergency notifications are automatically provided to both citizens and operators.",
    ]
    for faq in faqs:
        kb.add_document(faq, {"type": "faq"})

    kb.build_index()
    logger.info(f"[RAG] Knowledge base populated with {len(kb.documents)} documents.")


def generate_rag_response(query: str, db=None) -> str:
    """
    Generate a RAG-grounded response: retrieve relevant context, then
    send it to Groq for a contextual answer.
    """
    kb = get_knowledge_base()

    # Repopulate if empty
    if not kb.documents and db:
        populate_knowledge_base(db)

    # Retrieve relevant context
    results = kb.retrieve(query, top_k=5)
    context_parts = []
    
    # Always inject core platform facts to ensure zero hallucination on basic platform capabilities and dashboard updates
    context_parts.append("[CORE FACT] CommAI is a mass communication platform that officially supports sending campaigns and notifications through multiple channels: Email, SMS, WhatsApp, Push Notifications, Website notifications, and Dashboard updates (Live Bulletins).")
    context_parts.append("[CORE FACT] Platform updates, campaign announcements, real-time emergency notifications, and live bulletins are broadcast and displayed directly on user and operator dashboards.")
    
    for doc, meta, score in results:
        context_parts.append(f"[{meta.get('type', 'info').upper()}] {doc}")

    context = "\n\n".join(context_parts)

    system_prompt = (
        "You are a helpful CommAI platform assistant. Answer the user's question "
        "using ONLY the provided context documents. If the context does not contain "
        "enough information, say so honestly and suggest they contact a campaign manager.\n\n"
        "Be concise (2-4 sentences max), clear, and helpful.\n"
        "Do not make up information not present in the context.\n\n"
        f"--- CONTEXT ---\n{context}\n--- END CONTEXT ---"
    )

    response = _call_groq(system_prompt, query, temperature=0.3, max_tokens=400)
    return response or "I'm sorry, I couldn't find relevant information. Please contact a campaign manager for help."

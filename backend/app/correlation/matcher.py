import math
import os
import csv
import logging
from sqlalchemy.orm import Session
from rapidfuzz import fuzz
from anyascii import anyascii

from app.models import Identifier, Finding, LinkFeedback, IdentifierType
from app.normalize import normalize

logger = logging.getLogger(__name__)

# CSV path
SYNTHETIC_CSV_PATH = "backend/app/resources/synthetic_pairs.csv"

# Default m and u probabilities if training data is missing or empty
DEFAULT_M = {
    "exact_match": 0.95,
    "name_match": 0.85,
    "username_match": 0.80,
    "email_username_match": 0.75,
    "shared_domains": 0.70,
    "shared_findings": 0.80
}

DEFAULT_U = {
    "exact_match": 0.001,
    "name_match": 0.015,
    "username_match": 0.008,
    "email_username_match": 0.002,
    "shared_domains": 0.001,
    "shared_findings": 0.02
}

class FellegiSunterModel:
    def __init__(self, csv_path: str = SYNTHETIC_CSV_PATH):
        self.csv_path = csv_path
        self.m = DEFAULT_M.copy()
        self.u = DEFAULT_U.copy()
        self.weights = {}
        self.calibrate()

    def calibrate(self):
        """
        Loads the synthetic dataset and calculates m-probabilities and u-probabilities
        for binary features. Prevents divide-by-zero using Laplace smoothing.
        """
        if not os.path.exists(self.csv_path):
            logger.warning(f"Synthetic pairs CSV not found at {self.csv_path}. Using default weights.")
            self._compute_weights()
            return

        try:
            matches = []
            non_matches = []
            with open(self.csv_path, mode="r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    label = int(row["label"])
                    # Map to binary features
                    feat = {
                        "exact_match": float(row["exact_match"]),
                        "name_match": 1.0 if float(row["name_similarity"]) > 0.7 else 0.0,
                        "username_match": 1.0 if float(row["username_similarity"]) > 0.7 else 0.0,
                        "email_username_match": float(row["email_username_match"]),
                        "shared_domains": float(row["shared_domains"]),
                        "shared_findings": 1.0 if int(row["shared_findings_count"]) >= 1 else 0.0
                    }
                    if label == 1:
                        matches.append(feat)
                    else:
                        non_matches.append(feat)

            num_matches = len(matches)
            num_non_matches = len(non_matches)

            if num_matches == 0 or num_non_matches == 0:
                logger.warning("Empty or skewed training data. Using default weights.")
                self._compute_weights()
                return

            epsilon = 0.001 # Laplace smoothing constant
            
            # Compute probabilities
            for key in DEFAULT_M.keys():
                # m_i = P(x_i = 1 | Match)
                match_matches = sum(row[key] for row in matches)
                self.m[key] = (match_matches + epsilon) / (num_matches + 2 * epsilon)

                # u_i = P(x_i = 1 | Non-Match)
                non_match_matches = sum(row[key] for row in non_matches)
                self.u[key] = (non_match_matches + epsilon) / (num_non_matches + 2 * epsilon)

            logger.info("Fellegi-Sunter model calibrated successfully.")
        except Exception as e:
            logger.error(f"Error calibrating Fellegi-Sunter model: {e}. Using default weights.")
            self.m = DEFAULT_M.copy()
            self.u = DEFAULT_U.copy()

        self._compute_weights()

    def _compute_weights(self):
        """
        Computes the log-likelihood agreement and disagreement weights.
        agreement_weight = log2(m / u)
        disagreement_weight = log2((1 - m) / (1 - u))
        """
        self.weights = {}
        for key in self.m.keys():
            m_val = self.m[key]
            u_val = self.u[key]
            agree = math.log2(m_val / u_val)
            disagree = math.log2((1.0 - m_val) / (1.0 - u_val))
            self.weights[key] = {
                1: agree,
                0: disagree
            }

    def score_pair(self, vector: dict) -> float:
        """
        Calculates the Fellegi-Sunter total weight log-odds and computes the posterior probability.
        Uses a standard prior probability of 0.05.
        """
        prior = 0.05
        prior_log_odds = math.log2(prior / (1.0 - prior))

        weight_sum = 0.0
        for key, val in vector.items():
            if key in self.weights:
                weight_sum += self.weights[key][int(val)]

        # Posterior log odds
        post_log_odds = prior_log_odds + weight_sum
        
        # Convert log odds back to probability: p = odds / (1 + odds)
        # To avoid overflow/underflow, clamp values
        try:
            odds = 2 ** max(min(post_log_odds, 30), -30)
            probability = odds / (1.0 + odds)
        except Exception:
            probability = 1.0 if post_log_odds > 0 else 0.0

        return probability


# Singleton model instance
_model_instance = None
_xgb_model_instance = None

def get_model() -> FellegiSunterModel:
    global _model_instance
    if _model_instance is None:
        _model_instance = FellegiSunterModel()
    return _model_instance


class XGBoostModel:
    def __init__(self, model_path: str = "backend/app/resources/xgboost_model.json"):
        self.model_path = model_path
        self.model = None
        self.load()

    def load(self):
        if not os.path.exists(self.model_path):
            logger.warning(f"XGBoost model file not found at {self.model_path}. Refinement will not be active.")
            return
        try:
            import xgboost as xgb
            self.model = xgb.XGBClassifier()
            self.model.load_model(self.model_path)
            logger.info("XGBoost model loaded successfully for correlation refinement.")
        except Exception as e:
            logger.error(f"Error loading XGBoost model: {e}")
            self.model = None

    def predict_probability(self, vector: dict) -> float | None:
        if self.model is None:
            return None
        try:
            # Must match FEATURE_COLS order in train_xgb.py
            feat_order = [
                "name_similarity",
                "username_similarity",
                "exact_match",
                "email_username_match",
                "shared_findings_count",
                "shared_domains"
            ]
            x = [[float(vector.get(f, 0.0)) for f in feat_order]]
            probs = self.model.predict_proba(x)
            return float(probs[0][1])
        except Exception as e:
            logger.error(f"Error executing XGBoost prediction: {e}")
            return None


def get_xgb_model() -> XGBoostModel:
    global _xgb_model_instance
    if _xgb_model_instance is None:
        _xgb_model_instance = XGBoostModel()
    return _xgb_model_instance


def get_email_local_part(email: str) -> str:
    return email.split("@")[0].lower()


def generate_comparison_vector(id1: Identifier, id2: Identifier, db: Session) -> dict:
    """
    Computes both binary and continuous comparison features for a pair of identifiers.
    """
    val1 = id1.normalized_value
    val2 = id2.normalized_value
    type1 = id1.type.value
    type2 = id2.type.value

    exact_match = 1.0 if val1 == val2 else 0.0

    # 1. Name Match
    name_similarity = 0.0
    name_match = 0.0
    if type1 in ("name", "username") or type2 in ("name", "username"):
        s1 = get_email_local_part(val1) if type1 == "email" else val1
        s2 = get_email_local_part(val2) if type2 == "email" else val2
        name_similarity = fuzz.token_set_ratio(s1, s2) / 100.0
        name_match = 1.0 if name_similarity > 0.7 else 0.0

    # 2. Username Match
    username_similarity = 0.0
    username_match = 0.0
    if type1 == "username" and type2 == "username":
        username_similarity = fuzz.token_set_ratio(val1, val2) / 100.0
        username_match = 1.0 if username_similarity > 0.7 else 0.0

    # 3. Email-Username Match
    email_username_match = 0.0
    if (type1 == "email" and type2 == "username") or (type1 == "username" and type2 == "email"):
        email_str = val1 if type1 == "email" else val2
        user_str = val2 if type1 == "email" else val1
        local_part = get_email_local_part(email_str)
        email_username_match = 1.0 if local_part == user_str else 0.0

    # 4. Shared Domains
    shared_domains = 0.0
    if type1 == "domain" and type2 == "domain":
        shared_domains = 1.0 if val1 == val2 else 0.0
    elif (type1 == "email" and type2 == "domain") or (type1 == "domain" and type2 == "email"):
        email_str = val1 if type1 == "email" else val2
        domain_str = val2 if type1 == "email" else val1
        email_domain = email_str.split("@")[-1] if "@" in email_str else ""
        shared_domains = 1.0 if email_domain == domain_str and domain_str not in ("gmail.com", "yahoo.com", "outlook.com", "proton.me", "protonmail.com") else 0.0

    # 5. Shared Findings
    shared_findings = 0.0
    shared_findings_count = 0.0
    f1_list = db.query(Finding.result_value).filter(Finding.identifier_id == id1.id).all()
    f2_list = db.query(Finding.result_value).filter(Finding.identifier_id == id2.id).all()

    if f1_list and f2_list:
        v1_set = {f[0].strip().lower() for f in f1_list if f[0] and f[0].strip().lower() not in ("", "n/a", "error", "unknown")}
        v2_set = {f[0].strip().lower() for f in f2_list if f[0] and f[0].strip().lower() not in ("", "n/a", "error", "unknown")}
        v1_set.add(val1)
        v2_set.add(val2)
        
        shared = v1_set.intersection(v2_set)
        shared.discard(val1)
        shared.discard(val2)
        
        shared_findings_count = float(len(shared))
        if shared_findings_count > 0.0:
            shared_findings = 1.0

    return {
        "exact_match": exact_match,
        "name_similarity": name_similarity,
        "name_match": name_match,
        "username_similarity": username_similarity,
        "username_match": username_match,
        "email_username_match": email_username_match,
        "shared_domains": shared_domains,
        "shared_findings": shared_findings,
        "shared_findings_count": shared_findings_count
    }


def compute_correlations(case_id: str, db: Session) -> list[dict]:
    """
    Computes pairwise correlations between all identifiers in a case using
    Fellegi-Sunter baseline scores and refines them using an XGBoost model.
    Applies investigator feedbacks to override scores.
    """
    identifiers = db.query(Identifier).filter(Identifier.case_id == case_id).all()
    if len(identifiers) < 2:
        return []

    model = get_model()
    xgb_model = get_xgb_model()
    correlated_links = []

    # Get feedbacks for this case
    feedbacks = db.query(LinkFeedback).filter(LinkFeedback.case_id == case_id).all()
    fb_map = {}
    for fb in feedbacks:
        key = tuple(sorted([fb.source_id, fb.target_id]))
        fb_map[key] = fb.status

    for i in range(len(identifiers)):
        for j in range(i + 1, len(identifiers)):
            id1 = identifiers[i]
            id2 = identifiers[j]

            if id1.normalized_value == id2.normalized_value:
                continue

            fb_key_val = tuple(sorted([id1.normalized_value, id2.normalized_value]))
            fb_key_id = tuple(sorted([id1.id, id2.id]))
            fb_status = fb_map.get(fb_key_val) or fb_map.get(fb_key_id)

            match_type = "baseline"

            if fb_status == "rejected":
                confidence = 0.0
            elif fb_status == "confirmed":
                confidence = 1.0
                match_type = "confirmed"
            else:
                vector = generate_comparison_vector(id1, id2, db)
                # 1. Compute Fellegi-Sunter baseline
                confidence = model.score_pair(vector)
                
                # 2. Refine using XGBoost if baseline exceeds 0.1 threshold and model is ready
                if confidence >= 0.1 and xgb_model.model is not None:
                    refined_prob = xgb_model.predict_probability(vector)
                    if refined_prob is not None:
                        confidence = refined_prob
                        match_type = "xgboost"

            # Output link if confidence is above threshold
            if confidence >= 0.5:
                rel_type = "possible_match"
                if fb_status == "confirmed":
                    rel_type = "confirmed_match"
                elif id1.type == IdentifierType.email and id2.type == IdentifierType.username:
                    rel_type = "email_username_link"
                elif id1.type == IdentifierType.username and id2.type == IdentifierType.username:
                    rel_type = "shared_alias"
                elif id1.type == IdentifierType.email and id2.type == IdentifierType.domain:
                    rel_type = "registrant_domain_link"

                correlated_links.append({
                    "id": f"corr_{id1.id}_{id2.id}",
                    "source": id1.normalized_value,
                    "target": id2.normalized_value,
                    "relationType": rel_type,
                    "confidence": round(confidence, 2),
                    "sourceProvenance": "correlation_engine",
                    "matchType": match_type
                })

    return correlated_links

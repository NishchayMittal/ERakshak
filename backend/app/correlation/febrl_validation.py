import math
import os
import sys
import random
from rapidfuzz import fuzz

# Add backend folder to sys.path
sys.path.append(os.path.abspath("backend"))

import recordlinkage
from recordlinkage.datasets import load_febrl1
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score

class FEBRLFellegiSunter:
    def __init__(self):
        # We will use 6 comparison features
        self.features = [
            "given_name_match",
            "surname_match",
            "postcode_match",
            "suburb_match",
            "dob_match",
            "address_match"
        ]
        self.m = {}
        self.u = {}
        self.weights = {}

    def fit(self, X_train, y_train):
        """
        Estimates m-probabilities and u-probabilities for binary features.
        """
        matches = [row for row, label in zip(X_train, y_train) if label == 1]
        non_matches = [row for row, label in zip(X_train, y_train) if label == 0]
        
        num_matches = len(matches)
        num_non_matches = len(non_matches)
        
        epsilon = 0.001 # Laplace smoothing
        
        for idx, key in enumerate(self.features):
            # m_i = P(x_i = 1 | Match)
            match_pos = sum(row[idx] for row in matches)
            self.m[key] = (match_pos + epsilon) / (num_matches + 2 * epsilon)
            
            # u_i = P(x_i = 1 | Non-Match)
            non_match_pos = sum(row[idx] for row in non_matches)
            self.u[key] = (non_match_pos + epsilon) / (num_non_matches + 2 * epsilon)
            
        # Compute log weights
        self.weights = {}
        for key in self.features:
            m_val = self.m[key]
            u_val = self.u[key]
            agree = math.log2(m_val / u_val)
            disagree = math.log2((1.0 - m_val) / (1.0 - u_val))
            self.weights[key] = {
                1: agree,
                0: disagree
            }

    def predict_probability(self, X):
        prior = 0.05
        prior_log_odds = math.log2(prior / (1.0 - prior))
        
        probs = []
        for row in X:
            weight_sum = 0.0
            for idx, key in enumerate(self.features):
                val = int(row[idx])
                weight_sum += self.weights[key][val]
                
            post_log_odds = prior_log_odds + weight_sum
            
            try:
                odds = 2 ** max(min(post_log_odds, 30), -30)
                prob = odds / (1.0 + odds)
            except Exception:
                prob = 1.0 if post_log_odds > 0 else 0.0
            probs.append(prob)
            
        return probs

def generate_febrl_pairs():
    print("Loading FEBRL1 dataset...")
    df = load_febrl1()
    
    # Separate originals and duplicates
    org_df = df[df.index.str.endswith("-org")]
    dup_df = df[df.index.str.endswith("-dup-0")]
    
    # Map index to base ID (e.g. 'rec-10-org' -> '10')
    org_map = {idx.split("-")[1]: idx for idx in org_df.index}
    dup_map = {idx.split("-")[1]: idx for idx in dup_df.index}
    
    common_ids = list(set(org_map.keys()).intersection(set(dup_map.keys())))
    print(f"Found {len(common_ids)} common record entities.")
    
    X = []
    y = []
    
    def compare_records(r1, r2):
        # 1. Given name similarity
        g1 = str(r1.get("given_name", "")).strip().lower()
        g2 = str(r2.get("given_name", "")).strip().lower()
        g_sim = fuzz.token_set_ratio(g1, g2) / 100.0
        g_match = 1.0 if g_sim > 0.75 else 0.0
        
        # 2. Surname similarity
        s1 = str(r1.get("surname", "")).strip().lower()
        s2 = str(r2.get("surname", "")).strip().lower()
        s_sim = fuzz.token_set_ratio(s1, s2) / 100.0
        s_match = 1.0 if s_sim > 0.75 else 0.0
        
        # 3. Postcode match
        p1 = str(r1.get("postcode", "")).strip()
        p2 = str(r2.get("postcode", "")).strip()
        p_match = 1.0 if p1 == p2 and p1 != "" else 0.0
        
        # 4. Suburb similarity
        sub1 = str(r1.get("suburb", "")).strip().lower()
        sub2 = str(r2.get("suburb", "")).strip().lower()
        sub_sim = fuzz.token_set_ratio(sub1, sub2) / 100.0
        sub_match = 1.0 if sub_sim > 0.75 else 0.0
        
        # 5. Date of Birth match
        dob1 = str(r1.get("date_of_birth", "")).strip()
        dob2 = str(r2.get("date_of_birth", "")).strip()
        dob_match = 1.0 if dob1 == dob2 and dob1 != "" else 0.0
        
        # 6. Address similarity (combining address_1 & address_2)
        a1 = (str(r1.get("address_1", "")) + " " + str(r1.get("address_2", ""))).strip().lower()
        a2 = (str(r2.get("address_1", "")) + " " + str(r2.get("address_2", ""))).strip().lower()
        a_sim = fuzz.token_set_ratio(a1, a2) / 100.0
        a_match = 1.0 if a_sim > 0.75 else 0.0
        
        return [g_match, s_match, p_match, sub_match, dob_match, a_match]

    # Generate positive pairs (matches)
    for bid in common_ids:
        r1 = org_df.loc[org_map[bid]]
        r2 = dup_df.loc[dup_map[bid]]
        features = compare_records(r1, r2)
        X.append(features)
        y.append(1)
        
    # Generate negative pairs (non-matches)
    random.seed(42)
    # Generate 1500 negative pairs to represent realistic class imbalance (1:3 ratio)
    for _ in range(1500):
        # Pick two different random IDs
        id1 = random.choice(common_ids)
        id2 = random.choice(common_ids)
        while id1 == id2:
            id2 = random.choice(common_ids)
            
        r1 = org_df.loc[org_map[id1]]
        r2 = dup_df.loc[dup_map[id2]]
        features = compare_records(r1, r2)
        X.append(features)
        y.append(0)
        
    return X, y

def validate_febrl():
    X, y = generate_febrl_pairs()
    print(f"Generated {len(X)} pairs for verification ({sum(y)} matches, {len(y) - sum(y)} non-matches).")
    
    # Train / Test split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    
    model = FEBRLFellegiSunter()
    model.fit(X_train, y_train)
    
    print("\n=== Estimated FEBRL Fellegi-Sunter Weights ===")
    for key in model.features:
        m_prob = model.m[key]
        u_prob = model.u[key]
        agree = model.weights[key][1]
        disagree = model.weights[key][0]
        print(f"Feature: {key}")
        print(f"  m-probability (P(match|true)): {m_prob:.4f}")
        print(f"  u-probability (P(match|false)): {u_prob:.4f}")
        print(f"  Agreement Weight:  {agree:.4f}")
        print(f"  Disagreement Weight: {disagree:.4f}")
        
    # Predict and evaluate
    probs = model.predict_probability(X_test)
    preds = [1 if p >= 0.5 else 0 for p in probs]
    
    print("\n=== Model Evaluation (FEBRL Validation) ===")
    acc = accuracy_score(y_test, preds)
    print(f"Validation Accuracy: {acc:.4f}")
    print("\nClassification Report:")
    print(classification_report(y_test, preds))

if __name__ == "__main__":
    validate_febrl()

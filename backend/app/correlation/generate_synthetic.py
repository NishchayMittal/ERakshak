import csv
import os
import random
from rapidfuzz import fuzz
from anyascii import anyascii

# Define Demo Personas
PERSONAS = [
    {
        "name": "suspect alpha",
        "aliases": ["alpha_dev", "alpha99", "alphacoder"],
        "emails": ["alpha@example.com", "alpha.dev@gmail.com", "alpha_dev@example.com", "alpha99@gmail.com", "alphacoder@alphasite.com"],
        "phones": ["+919876543210", "+919876543211"],
        "domains": ["alphasite.com", "alphadev.net"]
    },
    {
        "name": "suspect beta",
        "aliases": ["beta_hacker", "secops_beta", "betapower"],
        "emails": ["beta@secops.org", "beta.hacker@proton.me", "beta_hacker@secops.org", "secops_beta@betasecure.net", "betapower@betalabs.io"],
        "phones": ["+918765432109", "+918765432108"],
        "domains": ["betasecure.net", "betalabs.io"]
    }
]

DECOY_NAMES = [
    "john doe", "jane smith", "robert johnson", "emily williams", "michael brown",
    "amit sharma", "priya patel", "rahul verma", "neha gupta", "rajesh kumar"
]

DECOY_USERNAMES = [
    "user123", "hacker_pro", "shadow_ninja", "cyber_warrior", "test_acc",
    "coder_xyz", "data_wizard", "pixel_perfect", "coffee_lover", "travel_bug"
]

DECOY_EMAILS = [
    "user123@gmail.com", "hacker_pro@yahoo.com", "shadow@proton.me", "cyber@outlook.com",
    "amit@sharma.com", "priya@patel.org", "info@example.com", "support@test.net"
]

DECOY_PHONES = [
    "+919999999999", "+918888888888", "+917777777777", "+919123456789",
    "+919812739182", "+918723912039", "+917012938129", "+919900881122"
]

DECOY_DOMAINS = [
    "google.com", "github.com", "twitter.com", "example.com", "testsite.org",
    "myspace.com", "linkedin.com", "stackoverflow.com", "reddit.com"
]

def get_email_local_part(email: str) -> str:
    return email.split("@")[0].lower()

def compute_features(val1: str, type1: str, val2: str, type2: str, is_match: bool) -> dict:
    val1_norm = anyascii(val1).strip().lower()
    val2_norm = anyascii(val2).strip().lower()
    
    # Initialize features
    exact_match = 1.0 if val1_norm == val2_norm else 0.0
    
    # 1. Name Similarity
    # Compare strings using fuzz.token_set_ratio (0.0 to 1.0)
    name_similarity = 0.0
    if type1 in ("name", "username") or type2 in ("name", "username"):
        # For names/usernames or email local parts
        s1 = get_email_local_part(val1_norm) if type1 == "email" else val1_norm
        s2 = get_email_local_part(val2_norm) if type2 == "email" else val2_norm
        name_similarity = fuzz.token_set_ratio(s1, s2) / 100.0
        
    # 2. Username Similarity
    username_similarity = 0.0
    if type1 == "username" and type2 == "username":
        username_similarity = fuzz.token_set_ratio(val1_norm, val2_norm) / 100.0
        
    # 3. Email-Username Matching
    email_username_match = 0.0
    if (type1 == "email" and type2 == "username") or (type1 == "username" and type2 == "email"):
        email_str = val1_norm if type1 == "email" else val2_norm
        user_str = val2_norm if type1 == "email" else val1_norm
        local_part = get_email_local_part(email_str)
        email_username_match = 1.0 if local_part == user_str else 0.0
        
    # 4. Shared Domains
    shared_domains = 0.0
    if type1 == "domain" and type2 == "domain":
        shared_domains = 1.0 if val1_norm == val2_norm else 0.0
    elif (type1 == "email" and type2 == "domain") or (type1 == "domain" and type2 == "email"):
        email_str = val1_norm if type1 == "email" else val2_norm
        domain_str = val2_norm if type1 == "email" else val1_norm
        email_domain = email_str.split("@")[-1] if "@" in email_str else ""
        shared_domains = 1.0 if email_domain == domain_str and domain_str not in ("gmail.com", "yahoo.com", "outlook.com", "proton.me", "protonmail.com") else 0.0

    # 5. Shared Findings Count
    # Simulate based on whether it is a match or non-match
    if is_match:
        # True matching pairs are likely to share registrar contacts, IPs, etc.
        shared_findings_count = random.choices([0, 1, 2, 3], weights=[0.1, 0.4, 0.4, 0.1])[0]
    else:
        # Non-matching pairs rarely share findings
        shared_findings_count = random.choices([0, 1], weights=[0.98, 0.02])[0]
        
    return {
        "name_similarity": round(name_similarity, 3),
        "username_similarity": round(username_similarity, 3),
        "exact_match": exact_match,
        "email_username_match": email_username_match,
        "shared_findings_count": shared_findings_count,
        "shared_domains": shared_domains
    }

def generate_dataset(output_path: str):
    pairs = []
    
    # 1. Generate Positive Pairs (within same persona)
    for persona in PERSONAS:
        all_identifiers = []
        all_identifiers.append((persona["name"], "name"))
        for alias in persona["aliases"]:
            all_identifiers.append((alias, "username"))
        for email in persona["emails"]:
            all_identifiers.append((email, "email"))
        for phone in persona["phones"]:
            all_identifiers.append((phone, "phone"))
        for domain in persona["domains"]:
            all_identifiers.append((domain, "domain"))
            
        # Pair all identifiers of the persona with each other
        for i in range(len(all_identifiers)):
            for j in range(i + 1, len(all_identifiers)):
                val1, type1 = all_identifiers[i]
                val2, type2 = all_identifiers[j]
                
                features = compute_features(val1, type1, val2, type2, is_match=True)
                pairs.append({
                    "val1": val1, "type1": type1,
                    "val2": val2, "type2": type2,
                    **features,
                    "label": 1
                })
                
    # 2. Generate Negative Pairs
    # Cross-persona negative pairs
    alpha_idents = []
    alpha_idents.append((PERSONAS[0]["name"], "name"))
    alpha_idents.extend((a, "username") for a in PERSONAS[0]["aliases"])
    alpha_idents.extend((e, "email") for e in PERSONAS[0]["emails"])
    
    beta_idents = []
    beta_idents.append((PERSONAS[1]["name"], "name"))
    beta_idents.extend((a, "username") for a in PERSONAS[1]["aliases"])
    beta_idents.extend((e, "email") for e in PERSONAS[1]["emails"])
    
    for a_val, a_type in alpha_idents:
        for b_val, b_type in beta_idents:
            features = compute_features(a_val, a_type, b_val, b_type, is_match=False)
            pairs.append({
                "val1": a_val, "type1": a_type,
                "val2": b_val, "type2": b_type,
                **features,
                "label": 0
            })
            
    # Add decoy negative pairs
    for i in range(300):
        # Pick two random decoys or a persona value and a decoy
        t1, t2 = random.choice([("name", "username"), ("email", "username"), ("phone", "email"), ("domain", "email"), ("username", "username")])
        
        # Select val1
        if random.random() < 0.3:
            p = random.choice(PERSONAS)
            val1 = p["name"] if t1 == "name" else (p["aliases"][0] if t1 == "username" else (p["emails"][0] if t1 == "email" else p["phones"][0] if t1 == "phone" else p["domains"][0]))
        else:
            val1 = random.choice(DECOY_NAMES if t1 == "name" else DECOY_USERNAMES if t1 == "username" else DECOY_EMAILS if t1 == "email" else DECOY_PHONES if t1 == "phone" else DECOY_DOMAINS)
            
        # Select val2
        val2 = random.choice(DECOY_NAMES if t2 == "name" else DECOY_USERNAMES if t2 == "username" else DECOY_EMAILS if t2 == "email" else DECOY_PHONES if t2 == "phone" else DECOY_DOMAINS)
        
        # Make sure they aren't the same
        if val1 == val2:
            continue
            
        features = compute_features(val1, t1, val2, t2, is_match=False)
        pairs.append({
            "val1": val1, "type1": t1,
            "val2": val2, "type2": t2,
            **features,
            "label": 0
        })

    # Save to CSV
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["val1", "type1", "val2", "type2", "name_similarity", "username_similarity", "exact_match", "email_username_match", "shared_findings_count", "shared_domains", "label"])
        writer.writeheader()
        writer.writerows(pairs)
        
    print(f"Generated {len(pairs)} synthetic pairs at {output_path}")

if __name__ == "__main__":
    generate_dataset("backend/app/resources/synthetic_pairs.csv")

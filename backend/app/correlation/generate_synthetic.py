import csv
import os
import random
from rapidfuzz import fuzz
from anyascii import anyascii

# -------------------------------------------------------------------------
# Persona Generator (Generates many personas dynamically to build a big DB)
# -------------------------------------------------------------------------
FIRST_NAMES = ["john", "jane", "amit", "priya", "robert", "emily", "michael", "neha", "rajesh", "sara", "david", "lisa", "rahul", "ananya", "carlos", "elena", "yuki", "ken", "ali", "fatima"]
LAST_NAMES = ["doe", "smith", "sharma", "patel", "johnson", "williams", "brown", "gupta", "kumar", "jones", "miller", "davis", "singh", "devi", "garcia", "martinez", "sato", "tanaka", "khan", "ahmed"]
HOSTS = ["gmail.com", "yahoo.com", "outlook.com", "proton.me", "hotmail.com"]

def mutate_string(val: str, mutation_prob: float = 0.25) -> str:
    """
    Introduces realistic typographical mutations (deletions, insertions, swaps)
    to names and usernames.
    """
    if random.random() > mutation_prob or len(val) < 3:
        return val
        
    chars = list(val)
    mutation_type = random.choice(["delete", "insert", "swap"])
    
    if mutation_type == "delete":
        idx = random.randint(0, len(chars) - 1)
        chars.pop(idx)
    elif mutation_type == "insert":
        idx = random.randint(0, len(chars))
        char_to_add = random.choice("abcdefghijklmnopqrstuvwxyz0123456789_")
        chars.insert(idx, char_to_add)
    elif mutation_type == "swap":
        idx = random.randint(0, len(chars) - 2)
        chars[idx], chars[idx + 1] = chars[idx + 1], chars[idx]
        
    return "".join(chars)

def generate_large_personas(num_personas: int = 50) -> list[dict]:
    random.seed(1337)
    personas = []
    
    for i in range(num_personas):
        first = random.choice(FIRST_NAMES)
        last = random.choice(LAST_NAMES)
        name = f"{first} {last}"
        
        # Primary base alias
        base_alias = f"{first}_{last}" if random.random() < 0.5 else f"{first}{random.randint(10, 99)}"
        aliases = [
            base_alias,
            mutate_string(base_alias, mutation_prob=0.8), # Typo alias
            f"{base_alias}coder" if random.random() < 0.3 else f"hacker_{base_alias}"
        ]
        # Remove duplicates
        aliases = list(set(aliases))
        
        # Emails
        emails = [
            f"{base_alias}@{random.choice(HOSTS)}",
            f"{aliases[0]}@{first}site.net" if random.random() < 0.5 else f"{mutate_string(first)}@customlab.org"
        ]
        
        # Phones
        phones = [
            f"+91{random.randint(7000000000, 9999999999)}",
            f"+1{random.randint(2000000000, 9999999999)}"
        ]
        
        # Domains
        domains = [
            f"{first}{last}site.com",
            f"{aliases[0]}dev.org" if random.random() < 0.4 else f"{first}labs.net"
        ]
        
        personas.append({
            "name": name,
            "aliases": aliases,
            "emails": emails,
            "phones": phones,
            "domains": domains
        })
        
    return personas

# Generate 50 unique personas
PERSONAS = generate_large_personas(50)

# Decoy lists for negative pairs
DECOY_NAMES = [f"{fn} {ln}" for fn in FIRST_NAMES for ln in LAST_NAMES]
DECOY_USERNAMES = [f"user_{random.randint(100, 9999)}" for _ in range(500)]
DECOY_EMAILS = [f"contact_{random.randint(100, 9999)}@{random.choice(HOSTS)}" for _ in range(500)]
DECOY_PHONES = [f"+91{random.randint(6000000000, 6999999999)}" for _ in range(500)]
DECOY_DOMAINS = [f"site_{random.randint(100, 9999)}.com" for _ in range(500)]

def get_email_local_part(email: str) -> str:
    return email.split("@")[0].lower()

def compute_features(val1: str, type1: str, val2: str, type2: str, is_match: bool) -> dict:
    val1_norm = anyascii(val1).strip().lower()
    val2_norm = anyascii(val2).strip().lower()
    
    exact_match = 1.0 if val1_norm == val2_norm else 0.0
    
    # 1. Name Similarity
    name_similarity = 0.0
    if type1 in ("name", "username") or type2 in ("name", "username"):
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
        shared_domains = 1.0 if email_domain == domain_str and domain_str not in HOSTS else 0.0

    # 5. Shared Findings Count (WITH DROPOUT AND FP NOISE)
    if is_match:
        # 30% DROPOUT RATE: matching suspects share 0 findings in database
        if random.random() < 0.30:
            shared_findings_count = 0
        else:
            shared_findings_count = random.choices([0, 1, 2, 3], weights=[0.1, 0.4, 0.4, 0.1])[0]
    else:
        # 4% FALSE POSITIVE RATE: non-matching decoy pairs share findings
        if random.random() < 0.04:
            shared_findings_count = random.choices([1, 2], weights=[0.8, 0.2])[0]
        else:
            shared_findings_count = 0
        
    return {
        "name_similarity": round(name_similarity, 3),
        "username_similarity": round(username_similarity, 3),
        "exact_match": exact_match,
        "email_username_match": email_username_match,
        "shared_findings_count": shared_findings_count,
        "shared_domains": shared_domains
    }

def generate_large_dataset(output_path: str):
    pairs = []
    
    # 1. Generate Positive Pairs (from the 50 personas)
    print("Generating positive matches...")
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
            
        # Add spelling typo mutations inside positive pairs to simulate real mutations
        mutated_idents = []
        for val, itype in all_identifiers:
            mutated_idents.append((val, itype))
            if itype in ("name", "username"):
                mutated_idents.append((mutate_string(val, mutation_prob=0.8), itype))
                
        # Deduplicate
        mutated_idents = list(set(mutated_idents))
        
        # Build pairwise positives
        for i in range(len(mutated_idents)):
            for j in range(i + 1, len(mutated_idents)):
                val1, type1 = mutated_idents[i]
                val2, type2 = mutated_idents[j]
                
                features = compute_features(val1, type1, val2, type2, is_match=True)
                pairs.append({
                    "val1": val1, "type1": type1,
                    "val2": val2, "type2": type2,
                    **features,
                    "label": 1
                })
                
    # Cap positives at 2000 to keep classes reasonable
    random.shuffle(pairs)
    positives = pairs[:2000]
    
    # 2. Generate Negative Pairs (Cross-persona and Decoys)
    negatives = []
    print("Generating negative pairs...")
    
    # Cross-persona negatives
    for _ in range(2500):
        p1 = random.choice(PERSONAS)
        p2 = random.choice(PERSONAS)
        while p1 == p2:
            p2 = random.choice(PERSONAS)
            
        t1 = random.choice(["name", "username", "email", "phone", "domain"])
        t2 = random.choice(["name", "username", "email", "phone", "domain"])
        
        val1 = p1["name"] if t1 == "name" else (p1["aliases"][0] if t1 == "username" else (p1["emails"][0] if t1 == "email" else p1["phones"][0] if t1 == "phone" else p1["domains"][0]))
        val2 = p2["name"] if t2 == "name" else (p2["aliases"][0] if t2 == "username" else (p2["emails"][0] if t2 == "email" else p2["phones"][0] if t2 == "phone" else p2["domains"][0]))
        
        features = compute_features(val1, t1, val2, t2, is_match=False)
        negatives.append({
            "val1": val1, "type1": t1,
            "val2": val2, "type2": t2,
            **features,
            "label": 0
        })
        
    # Decoy negatives (completely random contacts/sites)
    for _ in range(2500):
        t1 = random.choice(["name", "username", "email", "phone", "domain"])
        t2 = random.choice(["name", "username", "email", "phone", "domain"])
        
        val1 = random.choice(DECOY_NAMES if t1 == "name" else DECOY_USERNAMES if t1 == "username" else DECOY_EMAILS if t1 == "email" else DECOY_PHONES if t1 == "phone" else DECOY_DOMAINS)
        val2 = random.choice(DECOY_NAMES if t2 == "name" else DECOY_USERNAMES if t2 == "username" else DECOY_EMAILS if t2 == "email" else DECOY_PHONES if t2 == "phone" else DECOY_DOMAINS)
        
        if val1 == val2:
            continue
            
        features = compute_features(val1, t1, val2, t2, is_match=False)
        negatives.append({
            "val1": val1, "type1": t1,
            "val2": val2, "type2": t2,
            **features,
            "label": 0
        })

    # Combine positives and negatives
    all_pairs = positives + negatives
    random.shuffle(all_pairs)
    
    # Save to CSV
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["val1", "type1", "val2", "type2", "name_similarity", "username_similarity", "exact_match", "email_username_match", "shared_findings_count", "shared_domains", "label"])
        writer.writeheader()
        writer.writerows(all_pairs)
        
    print(f"Generated {len(all_pairs)} synthetic pairs at {output_path} ({len(positives)} matches, {len(negatives)} non-matches).")

if __name__ == "__main__":
    generate_large_dataset("backend/app/resources/synthetic_pairs.csv")

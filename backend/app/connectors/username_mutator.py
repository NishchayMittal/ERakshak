"""
username_mutator.py - Fuzzy Identity Mutation Engine
=====================================================

Generates a ranked list of probable username/name variations from a seed value.
Used by FuzzyUsernameConnector and FuzzyNameConnector to actively search for
alternate identities across platforms.

Mutation strategies applied (in order of confidence):
  1. Separator variants        - john.doe, john_doe, john-doe
  2. Common suffix patterns    - johndoe1, johndoe92, johndoe1992
  3. Common prefix patterns    - realjohndoe, iamjohndoe, _johndoe
  4. Leet substitutions        - j0hnd0e, j0hn_d03
  5. Typo mutations            - levenshtein-1 (single char drop/swap)
  6. Truncation variants       - johnd, jdoe, jd
  7. Phonetic variants (names) - transliteration normalization
  8. Case normalization        - always lowercased in output

Each variant carries a confidence score (0.0-1.0) representing how likely
it is to actually belong to the same person as the seed.
"""

import re
from dataclasses import dataclass, field


# ---------------------------------------------------------------------------
# Core data structure
# ---------------------------------------------------------------------------

@dataclass(order=True)
class UsernameVariant:
    """A generated username variant with its confidence score."""
    confidence: float        # Sort key (highest first)
    variant: str = field(compare=False)
    strategy: str = field(compare=False)


# ---------------------------------------------------------------------------
# Leet speak substitution table
# ---------------------------------------------------------------------------

LEET_MAP: dict[str, list[str]] = {
    "a": ["4", "@"],
    "e": ["3"],
    "i": ["1", "!"],
    "l": ["1"],
    "o": ["0"],
    "s": ["5", "$"],
    "t": ["7"],
    "g": ["9"],
    "b": ["8"],
    "z": ["2"],
}

# Common prefix words people prepend to claim real identity
PREFIX_WORDS = ["real", "iam", "im", "official", "the", "i_am", "i.am", "actual"]

# Common alt/backup suffixes
SUFFIX_WORDS = ["_real", "_official", "_backup", "_2", "_alt", ".real", "-real"]

# Very common first names / short generic words that produce massive numeric-suffix noise.
# If a seed matches one of these, numeric-suffix confidence is heavily penalised.
COMMON_NAMES: frozenset[str] = frozenset({
    "alex", "john", "jane", "mike", "nick", "kate", "chris", "matt",
    "david", "james", "robert", "michael", "william", "richard", "joseph",
    "thomas", "charles", "daniel", "mark", "paul", "steven", "kevin",
    "brian", "george", "edward", "andrew", "jacob", "ryan", "sarah",
    "jessica", "jennifer", "ashley", "emily", "rachel", "amanda", "lisa",
    "karen", "donna", "carol", "sharon", "michelle", "raj", "dev", "sam",
    "ben", "tom", "tim", "jim", "bob", "rob", "joe", "anna", "emma",
    "mia", "amy", "sue", "kim", "lee", "dan", "max", "adam", "eric",
    "ryan", "josh", "luis", "peter", "carl", "alan", "ivan", "ravi",
    "admin", "user", "test", "guest", "info", "help", "root", "mail",
})


def score_seed_uniqueness(seed: str) -> float:
    """
    Score how unique/specific a seed username is (0.0=very generic, 1.0=very specific).

    Used to penalise numeric_suffix confidence for common/short seeds so that
    results like alex1992, john1995 are not treated as high-confidence matches.

    Scoring factors (additive, clamped to [0.0, 1.0]):
      - Baseline                           : +0.50
      - Very short clean name (<= 4 chars) : -0.30
      - Short clean name (5-6 chars)       : -0.10
      - Long name (8-9 chars)              : +0.10
      - Very long name (>= 10 chars)       : +0.20
      - Seed already contains digits       : +0.15  (e.g. dragonx99 -> more specific)
      - Has separator (compound name)      : +0.05
      - Is a common first name / word      : -0.25
    """
    clean = re.sub(r"[._\-\s]", "", seed.lower())
    score = 0.50

    if len(clean) <= 4:
        score -= 0.30
    elif len(clean) <= 6:
        score -= 0.10
    elif len(clean) >= 10:
        score += 0.20
    elif len(clean) >= 8:
        score += 0.10

    if any(c.isdigit() for c in clean):
        score += 0.15

    if any(c in seed for c in "._-"):
        score += 0.05

    if clean in COMMON_NAMES:
        score -= 0.25

    return max(0.0, min(1.0, score))


# ---------------------------------------------------------------------------
# Mutation strategies
# ---------------------------------------------------------------------------

def _separator_variants(base: str) -> list[tuple[str, float]]:
    """
    Split on separator and regenerate with all separator combinations.
    e.g., johndoe -> john.doe, john_doe, john-doe
          john_doe -> johndoe, john.doe, john-doe
    """
    results = []
    separators = ["", ".", "_", "-"]
    parts = re.split(r"[._\-\s]+", base)
    if len(parts) < 2:
        parts = re.sub(r"([a-z])([A-Z])", r"\1 \2", base).split()
    if len(parts) >= 2:
        parts_lower = [p.lower() for p in parts]
        for sep in separators:
            variant = sep.join(parts_lower)
            if variant != base.lower():
                results.append((variant, 0.90))
    return results


def _numeric_suffix_variants(base: str) -> list[tuple[str, float]]:
    """Append common years and short numbers to the base username."""
    results = []
    base_clean = re.sub(r"[._\-\s]", "", base.lower())

    # Birth year patterns - highest probability
    for year in ["1990", "1991", "1992", "1993", "1994", "1995",
                 "1996", "1997", "1998", "1999", "2000", "2001",
                 "2002", "2003", "90", "91", "92", "93", "94", "95",
                 "96", "97", "98", "99", "00", "01", "02", "03"]:
        results.append((f"{base_clean}{year}", 0.75))

    # Generic short numbers
    for num in ["1", "2", "3", "7", "9", "0", "01", "12", "21", "99", "00", "123"]:
        results.append((f"{base_clean}{num}", 0.65))
        results.append((f"{base_clean}_{num}", 0.63))

    return results


def _prefix_variants(base: str) -> list[tuple[str, float]]:
    """Prepend common words indicating real/official identity."""
    results = []
    base_clean = re.sub(r"[._\-\s]", "", base.lower())
    results.append((f"_{base_clean}", 0.72))
    for prefix in PREFIX_WORDS:
        results.append((f"{prefix}{base_clean}", 0.70))
        results.append((f"{prefix}_{base_clean}", 0.68))
    return results


def _suffix_word_variants(base: str) -> list[tuple[str, float]]:
    """Append common alt/real/backup suffixes."""
    results = []
    base_clean = re.sub(r"[._\-\s]", "", base.lower())
    for suffix in SUFFIX_WORDS:
        results.append((f"{base_clean}{suffix}", 0.65))
    return results


def _leet_variants(base: str) -> list[tuple[str, float]]:
    """
    Generate single-substitution leet-speak variants.
    e.g., johndoe -> j0hndoe, johnd0e
    Deliberately avoids multi-substitution to limit explosion.
    """
    results = []
    base_lower = base.lower()
    for i, char in enumerate(base_lower):
        if char in LEET_MAP:
            for sub in LEET_MAP[char]:
                variant = base_lower[:i] + sub + base_lower[i + 1:]
                results.append((variant, 0.60))
    return results


def _typo_variants(base: str) -> list[tuple[str, float]]:
    """
    Generate Levenshtein distance-1 and phoneme typo variants:
    - Single character deletion
    - Adjacent character swap
    - Character doubling & consonant reduction (tt -> t, t -> tt)
    - Common phonetic sound exchanges (sh/sch/s, v/w, ph/f, k/c, etc.)
    """
    results = []
    base_lower = base.lower()
    
    # Allow typos on words length >= 3
    if len(base_lower) < 3:
        return []
        
    n = len(base_lower)

    # Deletion (nishchay -> nishcay, nishchy)
    for i in range(n):
        variant = base_lower[:i] + base_lower[i + 1:]
        if len(variant) >= 3:
            results.append((variant, 0.70))

    # Swap adjacent (kholi -> kohli)
    for i in range(n - 1):
        swapped = list(base_lower)
        swapped[i], swapped[i + 1] = swapped[i + 1], swapped[i]
        results.append(("".join(swapped), 0.75))

    # Character doubling (mital -> mittal, patel -> patell)
    for c in "bcdfghjklmnpqrstvwxyz":
        if c in base_lower:
            for i in range(n):
                if base_lower[i] == c:
                    doubled = base_lower[:i] + c + base_lower[i:]
                    results.append((doubled, 0.72))

    # Consonant reduction (mittal -> mital, sharmaa -> sharma)
    for c in "bcdfghjklmnpqrstvwxyz":
        double_c = c * 2
        if double_c in base_lower:
            reduced = base_lower.replace(double_c, c)
            results.append((reduced, 0.75))

    # Common phonetic sound exchanges
    SOUND_EXCHANGES = [
        ("sh", "sch"), ("sch", "sh"),
        ("sh", "s"), ("s", "sh"),
        ("sch", "ch"), ("ch", "sch"),
        ("ee", "i"), ("i", "ee"),
        ("oo", "u"), ("u", "oo"),
        ("v", "w"), ("w", "v"),
        ("ph", "f"), ("f", "ph"),
        ("k", "c"), ("c", "k"),
        ("dh", "d"), ("d", "dh"),
        ("th", "t"), ("t", "th"),
        ("kh", "k"), ("k", "kh"),
        ("gh", "g"), ("g", "gh"),
        ("bh", "b"), ("b", "bh"),
        ("aa", "a"), ("a", "aa"),
    ]
    for p1, p2 in SOUND_EXCHANGES:
        if p1 in base_lower:
            variant = base_lower.replace(p1, p2)
            results.append((variant, 0.72))

    return results


def _truncation_variants(base: str) -> list[tuple[str, float]]:
    """
    Generate initialism and truncation variants.
    e.g., john.doe -> jdoe, johnd, jd
    """
    results = []
    parts = re.split(r"[._\-\s]+", base.lower())
    if len(parts) >= 2:
        results.append((parts[0][0] + parts[-1], 0.70))   # jdoe
        results.append((parts[0] + parts[-1][0], 0.65))   # johnd
        initials = "".join(p[0] for p in parts)
        if len(initials) >= 2:
            results.append((initials, 0.45))               # jd

    base_clean = re.sub(r"[._\-\s]", "", base.lower())
    if len(base_clean) > 6:
        results.append((base_clean[:6], 0.45))
    if len(base_clean) > 8:
        results.append((base_clean[:8], 0.45))

    return results


# Comprehensive phonetic and common name variations dictionary
PHONETIC_GROUPS: list[list[str]] = [
    # Indian First & Last Names with common spelling variations
    ["mittal", "mital", "mitall"],
    ["nishchay", "nischay", "nishchal", "nishant"],
    ["dhruv", "dhruva", "dhruvv"],
    ["kohli", "kholi", "koli", "kole"],
    ["sharma", "sharmaa", "shrma", "sarma", "sharmar"],
    ["verma", "varma", "barmar"],
    ["gupta", "guptaa", "guptha"],
    ["agarwal", "agrawal", "aggarwal", "aggrawal"],
    ["jain", "jaine", "jayan"],
    ["chaudhary", "choudhary", "chowdhury", "choudhry", "chaudhari"],
    ["mehta", "mheta", "mahta"],
    ["joshi", "josi"],
    ["patel", "patil", "patell"],
    ["shah", "sah", "sha"],
    ["reddy", "reddi", "redi"],
    ["nair", "nayar", "nayyar"],
    ["iyer", "aiyar", "ayyar"],
    ["mishra", "misra"],
    ["pandey", "pande", "panday"],
    ["yadav", "yadaav", "jadhav"],
    ["khan", "khaan"],
    ["ahmed", "ahmad", "ahmet"],
    ["singh", "sing", "sinha", "singht"],
    ["kumar", "kumaar", "kmr"],
    ["priya", "priyaa", "priyah"],
    ["raj", "raaj", "rj"],
    ["dev", "dv", "dave"],
    ["arjun", "arjuna", "arjoon"],
    ["amit", "amitt", "ameet"],
    ["rahul", "raahul", "rahool"],
    ["vikram", "vikrm", "vikrum"],
    ["sundar", "sunder"],
    ["pichai", "pitchai"],
    ["satya", "sathya"],
    ["nadella", "nadela"],
    # Arabic / Islamic Names
    ["mohammed", "muhammad", "mohd", "mohammad", "mohamad", "muhammed", "mhd"],
    ["ali", "aali", "aly"],
    ["hussain", "husain", "hussein", "husayn"],
    # Common Western Names
    ["john", "jon", "jhon", "jhn"],
    ["alex", "alx", "aleksandr", "alexey"],
    ["chris", "kris", "kristopher", "christopher"],
    ["mike", "mick", "michael", "mikhail"],
    ["nick", "nik", "nikolas", "nikolai"],
    ["kate", "katy", "katie", "katherine", "kathryn"],
    ["matt", "mat", "matthew"],
    # Russian / Slavic
    ["ivan", "ewan", "iwan"],
    ["dmitri", "dmitry", "dmitriy", "mitya"],
]


def _phonetic_variants(name: str) -> list[tuple[str, float]]:
    """
    Phonetically equivalent name variants for common transliterations.
    Handles single tokens as well as multi-word full names.
    """
    results = []
    clean_parts = [w.strip().lower() for w in re.split(r"[._\-\s]+", name) if w.strip()]
    if not clean_parts:
        return []

    # 1. Whole name check
    name_joined = "".join(clean_parts)
    for group in PHONETIC_GROUPS:
        if name_joined in group or any(name_joined.startswith(g) for g in group):
            for alt in group:
                if alt != name_joined:
                    results.append((alt, 0.85))

    # 2. Multi-word name token substitution (e.g. "Nishchay Mital" -> "Nishchay Mittal")
    if len(clean_parts) >= 2:
        part_variations: list[list[str]] = []
        for p in clean_parts:
            variations = {p}
            # Look up in phonetic groups
            for group in PHONETIC_GROUPS:
                if p in group:
                    variations.update(group)
            # Double/single consonant reduction on individual token
            for c in "bcdfghjklmnpqrstvwxyz":
                if c * 2 in p:
                    variations.add(p.replace(c * 2, c))
                elif c in p:
                    for i, char in enumerate(p):
                        if char == c:
                            variations.add(p[:i] + c + p[i:])
            part_variations.append(list(variations)[:4])

        # Generate cross-combinations of name tokens
        if len(part_variations) == 2:
            first_vars, last_vars = part_variations[0], part_variations[1]
            for f in first_vars:
                for l in last_vars:
                    if f == clean_parts[0] and l == clean_parts[1]:
                        continue
                    results.append((f"{f}{l}", 0.85))
                    results.append((f"{f}.{l}", 0.82))
                    results.append((f"{f}_{l}", 0.82))
                    results.append((f"{f[0]}{l}", 0.78))
                    results.append((f"{f}{l[0]}", 0.75))

    return results


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def generate_variants(
    seed: str,
    is_name: bool = False,
    max_variants: int = 80,
) -> list[UsernameVariant]:
    """
    Generate a deduplicated, ranked list of username variants from a seed.

    Args:
        seed:         The original username or name to mutate.
        is_name:      If True, apply name-specific phonetic strategies.
        max_variants: Maximum number of variants to return.

    Returns:
        List of UsernameVariant sorted by confidence descending.
    """
    if not seed or len(seed) < 2:
        return []

    seed_lower = seed.lower().strip()
    all_variants: list[tuple[str, float, str]] = []

    # Compute how unique/specific this seed is.
    # Generic seeds ("alex", "john") get a heavy penalty on numeric-suffix
    # confidence so year-suffix variants don't flood results with different people.
    uniqueness = score_seed_uniqueness(seed_lower)
    # Multiplier: 0.40 for very generic ("alex") up to 1.0 for very specific
    numeric_multiplier = max(0.40, uniqueness)

    for variant, conf in _separator_variants(seed_lower):
        all_variants.append((variant, conf, "separator"))

    for variant, conf in _numeric_suffix_variants(seed_lower):
        # Apply uniqueness penalty: generic seeds get lower numeric-suffix confidence
        adjusted = round(conf * numeric_multiplier, 3)
        all_variants.append((variant, adjusted, "numeric_suffix"))

    for variant, conf in _prefix_variants(seed_lower):
        adjusted = round(conf * numeric_multiplier, 3)
        all_variants.append((variant, adjusted, "prefix"))

    for variant, conf in _suffix_word_variants(seed_lower):
        adjusted = round(conf * numeric_multiplier, 3)
        all_variants.append((variant, adjusted, "suffix_word"))

    for variant, conf in _leet_variants(seed_lower):
        all_variants.append((variant, conf, "leet"))

    for variant, conf in _typo_variants(seed_lower):
        adjusted = round(conf * numeric_multiplier, 3)
        all_variants.append((variant, adjusted, "typo"))

    for variant, conf in _truncation_variants(seed_lower):
        adjusted = round(conf * numeric_multiplier, 3)
        all_variants.append((variant, adjusted, "truncation"))

    if is_name:
        for variant, conf in _phonetic_variants(seed_lower):
            all_variants.append((variant, conf, "phonetic"))

    # Deduplicate: keep highest confidence per variant string
    seen: dict[str, tuple[float, str]] = {}
    for variant, conf, strategy in all_variants:
        if not variant or len(variant) < 2 or len(variant) > 30:
            continue
        if variant == seed_lower:
            continue
        if variant.isdigit():
            continue
        if variant not in seen or seen[variant][0] < conf:
            seen[variant] = (conf, strategy)

    result = [
        UsernameVariant(confidence=conf, variant=v, strategy=strat)
        for v, (conf, strat) in seen.items()
    ]
    result.sort(reverse=True)
    return result[:max_variants]

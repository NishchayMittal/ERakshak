import asyncio, sys, time, collections
sys.path.insert(0, ".")

import importlib.util

# Load mutator in isolation to avoid DB deps
spec = importlib.util.spec_from_file_location("mutator", "app/connectors/username_mutator.py")
mutator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mutator)

from app.connectors.fuzzy_username import FuzzyUsernameConnector, MIN_PROBE_CONFIDENCE

SEP  = "=" * 70
SEP2 = "-" * 70

# -----------------------------------------------------------------------
# Test matrix
# -----------------------------------------------------------------------
# Each entry: (seed, group, notes)
#   group A = unique/specific  -> expect high-quality hits
#   group B = compound name    -> expect separator variants to match
#   group C = generic/common   -> expect FEWER hits after fix (noise pruned)
#   group D = pure garbage     -> expect ZERO hits (false positive test)
# -----------------------------------------------------------------------
TESTS = [
    # Group A: Specific / unique seeds
    ("torvalds",      "A_specific",  "Linus Torvalds - rare unique name"),
    ("defnull",       "A_specific",  "Security researcher - compound unique"),
    # Group B: Compound names with separator
    ("john_doe",      "B_compound",  "Placeholder compound - many people have variants"),
    ("bruce_wayne",   "B_compound",  "Known fictional compound name"),
    # Group C: Generic single-word - should be PRUNED by uniqueness fix
    ("alex",          "C_generic",   "Very common 4-char name - should produce 0 numeric probes"),
    ("admin",         "C_generic",   "Reserved word - should produce 0 numeric probes"),
    # Group D: Pure garbage - false positive control
    ("xqztywvb923",   "D_garbage",   "Random garbage 1"),
    ("zyzyx_test77",  "D_garbage",   "Random garbage 2"),
]

async def run_one(seed, notes):
    # Mutator stats
    all_variants = mutator.generate_variants(seed, is_name=False, max_variants=80)
    uniqueness    = mutator.score_seed_uniqueness(seed)
    numeric_mult  = max(0.40, uniqueness)

    will_probe    = [v for v in all_variants if v.confidence >= MIN_PROBE_CONFIDENCE]
    skipped       = [v for v in all_variants if v.confidence <  MIN_PROBE_CONFIDENCE]

    strat_counts  = collections.Counter(v.strategy for v in will_probe)

    # Connector live probe
    connector = FuzzyUsernameConnector()
    print(f"  Probing '{seed}'... ", end="", flush=True)
    t0 = time.perf_counter()
    findings = await connector.run(seed)
    elapsed  = time.perf_counter() - t0
    print(f"done ({elapsed:.1f}s)  ->  {len(findings)} hits")

    return dict(
        seed=seed, notes=notes,
        uniqueness=uniqueness, numeric_mult=numeric_mult,
        generated=len(all_variants),
        will_probe=len(will_probe),
        skipped=len(skipped),
        strat_counts=strat_counts,
        findings=findings,
        elapsed=elapsed,
    )

async def main():
    print(SEP)
    print("  FUZZY SEARCH STRATEGY - FULL STATISTICAL TEST (post-fix)")
    print(SEP)

    results_by_group = collections.defaultdict(list)

    for seed, group, notes in TESTS:
        print(f"\n[{group}] {seed!r}  ({notes})")
        r = await run_one(seed, notes)
        results_by_group[group].append(r)

        # Per-seed detail
        print(f"    Uniqueness score   : {r['uniqueness']:.2f}  (numeric_mult={r['numeric_mult']:.2f})")
        print(f"    Variants generated : {r['generated']}")
        print(f"    Variants probed    : {r['will_probe']}  (skipped={r['skipped']} below threshold)")
        strat_str = "  ".join(f"{k}:{v}" for k,v in sorted(r['strat_counts'].items()))
        print(f"    Strategy breakdown : {strat_str or 'none'}")
        print(f"    Findings           : {len(r['findings'])}")
        for f in r['findings']:
            p = f.raw_payload or {}
            print(f"      [{f.confidence:.2f}] {p.get('site','?'):12s}  variant='{p.get('matched_variant','')}' ({p.get('variant_strategy','')})")

    # -----------------------------------------------------------------------
    # Summary statistics
    # -----------------------------------------------------------------------
    print(f"\n{SEP}")
    print("  SUMMARY STATISTICS")
    print(SEP)

    all_results = [r for grp in results_by_group.values() for r in grp]

    groups_display = [
        ("A_specific", "Group A: Unique/Specific seeds"),
        ("B_compound", "Group B: Compound name seeds"),
        ("C_generic",  "Group C: Generic/common seeds (expect pruned)"),
        ("D_garbage",  "Group D: Garbage seeds (false positive control)"),
    ]

    for gkey, glabel in groups_display:
        rows = results_by_group.get(gkey, [])
        if not rows:
            continue
        print(f"\n  {glabel}")
        print(f"  {SEP2}")
        for r in rows:
            print(f"    {r['seed']:20s}  probed={r['will_probe']:3d}  hits={len(r['findings']):2d}  time={r['elapsed']:6.1f}s  uniqueness={r['uniqueness']:.2f}")

    # False positive rate
    d_rows     = results_by_group.get("D_garbage", [])
    total_fp   = sum(len(r["findings"]) for r in d_rows)
    total_d_probed = sum(r["will_probe"] * 6 for r in d_rows)  # 6 platforms
    fp_rate    = (total_fp / total_d_probed * 100) if total_d_probed else 0.0

    # True positive hits
    ab_rows    = results_by_group.get("A_specific", []) + results_by_group.get("B_compound", [])
    total_tp   = sum(len(r["findings"]) for r in ab_rows)

    # Generic noise reduction
    c_rows     = results_by_group.get("C_generic", [])
    c_probed   = sum(r["will_probe"] for r in c_rows)
    c_generated= sum(r["generated"] for r in c_rows)

    print(f"\n{SEP}")
    print(f"  OVERALL METRICS")
    print(f"  {SEP2}")
    print(f"  True positive hits (A+B seeds)     : {total_tp}")
    print(f"  False positives (D garbage seeds)  : {total_fp}  (rate: {fp_rate:.2f}%)")
    print(f"  Noise pruned on generic seeds (C)  : {c_generated - c_probed} / {c_generated} variants skipped")
    print(f"  Total time across all seeds        : {sum(r['elapsed'] for r in all_results):.1f}s")

    # Confidence distribution
    all_findings = [f for r in all_results for f in r["findings"]]
    if all_findings:
        high   = sum(1 for f in all_findings if f.confidence >= 0.75)
        medium = sum(1 for f in all_findings if 0.50 <= f.confidence < 0.75)
        low    = sum(1 for f in all_findings if f.confidence < 0.50)
        strats = collections.Counter(f.raw_payload.get("variant_strategy","?") for f in all_findings)
        print(f"\n  Confidence distribution of findings:")
        print(f"    High   (>=0.75) : {high}")
        print(f"    Medium (0.50-0.74): {medium}")
        print(f"    Low    (<0.50)  : {low}")
        print(f"\n  Winning strategies that produced hits:")
        for strat, count in strats.most_common():
            print(f"    {strat:20s} : {count} hits")
    print(f"\n{SEP}")

asyncio.run(main())

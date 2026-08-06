import asyncio, sys, time
sys.path.insert(0, '.')
from app.connectors.fuzzy_username import FuzzyUsernameConnector
from app.connectors.username_mutator import generate_variants

GROUP_A = ['torvalds', 'john_doe', 'alex']
GROUP_B = ['xqztywvb923', 'aaabbbccc999', 'zyzyx_test']
SEP = '=' * 65

async def run_test(seed):
    connector = FuzzyUsernameConnector()
    variants = generate_variants(seed, is_name=False, max_variants=30)
    top_v = [v.variant for v in variants[:8]]
    print(f'  Seed: {seed}')
    print(f'  Variants: {top_v}')
    print('  Probing platforms...', end='', flush=True)
    t0 = time.perf_counter()
    findings = await connector.run(seed)
    elapsed = time.perf_counter() - t0
    print(f' done ({elapsed:.1f}s)')
    return dict(seed=seed, findings=findings, elapsed=elapsed)

async def main():
    print(SEP)
    print('FUZZY USERNAME CONNECTOR - STATISTICAL TEST')
    print(SEP)
    print()
    print('GROUP A: Known seeds - expect True Positives')
    a_res = []
    for s in GROUP_A:
        r = await run_test(s)
        a_res.append(r)
        for f in r['findings']:
            p = f.raw_payload or {}
            site = p.get('site', '?')
            var = p.get('matched_variant', '?')
            strat = p.get('variant_strategy', '?')
            print(f'    [TP?][{f.confidence:.2f}] {site} | variant={var} strategy={strat}')
            print(f'           {f.result_value}')

    print()
    print('GROUP B: Random garbage - any match = False Positive')
    b_res = []
    for s in GROUP_B:
        r = await run_test(s)
        b_res.append(r)
        if r['findings']:
            for f in r['findings']:
                p = f.raw_payload or {}
                site = p.get('site', '?')
                var = p.get('matched_variant', '?')
                print(f'    [FP!][{f.confidence:.2f}] {site} | variant={var}')
                print(f'           {f.result_value}')
        else:
            print(f'    CLEAN - 0 false positives')

    print()
    print(SEP)
    print('SUMMARY STATISTICS')
    print(SEP)
    ta = sum(len(r['findings']) for r in a_res)
    tb = sum(len(r['findings']) for r in b_res)
    print()
    print(f'Group A (Known seeds):')
    for r in a_res:
        print(f'  {r["seed"]:20s}: {len(r["findings"])} hits in {r["elapsed"]:.1f}s')
    print(f'  TOTAL TRUE POSITIVE HITS : {ta}')
    print()
    print(f'Group B (Random seeds):')
    for r in b_res:
        print(f'  {r["seed"]:20s}: {len(r["findings"])} hits in {r["elapsed"]:.1f}s')
    if tb == 0:
        print(f'  TOTAL FALSE POSITIVES    : 0 - FALSE POSITIVE RATE: 0.0%')
    else:
        print(f'  TOTAL FALSE POSITIVES    : {tb} spurious hits')
    print()
    print(SEP)

asyncio.run(main())

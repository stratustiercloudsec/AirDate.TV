"""
Seed airdate-renewal-predictions with TMDB popular/trending shows.
Uses the same probability buckets as the classifier until full ML scoring runs.
"""
import json, urllib.request, boto3
from datetime import datetime

TMDB_KEY = "9e7202516e78494f2b18ec86d29a4309"
TABLE    = "airdate-renewal-predictions"
dynamo   = boto3.client('dynamodb', region_name='us-east-1')

def tmdb_get(path):
    url = f"https://api.themoviedb.org/3{path}&api_key={TMDB_KEY}"
    with urllib.request.urlopen(url, timeout=10) as r:
        return json.loads(r.read())

def renewal_score(show):
    """Heuristic scoring until full ML batch runs."""
    status    = show.get('status', '')
    vote      = float(show.get('vote_average') or 0)
    pop       = float(show.get('popularity') or 0)
    vote_cnt  = int(show.get('vote_count') or 0)

    if status in ('Ended', 'Canceled'):
        return 12.0, 'cancelled'
    if status == 'Returning Series':
        if vote >= 7.5 and pop >= 50:  return 94.0, 'renewed'
        if vote >= 6.5:                return 78.0, 'renewed'
        return 55.0, 'likely_renewed'
    if status in ('In Production', 'Planned'):
        return 88.0, 'renewed'
    # Unknown/Pilot
    if vote >= 7.0: return 65.0, 'likely_renewed'
    return 40.0, 'uncertain'

def score_and_write(show_ids):
    written = 0
    for sid in show_ids:
        try:
            d = tmdb_get(f"/tv/{sid}?language=en-US")
            prob, label = renewal_score(d)
            dynamo.put_item(
                TableName=TABLE,
                Item={
                    'show_id':            {'S': str(sid)},
                    'renewal_probability':{'N': str(prob)},
                    'label':              {'S': label},
                    'model_version':      {'S': 'heuristic-v1'},
                    'updated_at':         {'S': datetime.utcnow().isoformat()},
                },
                ConditionExpression='attribute_not_exists(show_id)'  # don't overwrite ML scores
            )
            print(f"  ✅ {d.get('name','?')} ({sid}) → {prob}% {label}")
            written += 1
        except dynamo.exceptions.ConditionalCheckFailedException:
            print(f"  ⏭  {sid} already has ML score — skipped")
        except Exception as e:
            print(f"  ❌ {sid}: {e}")
    return written

# Collect show IDs from TMDB popular + top-rated + trending
show_ids = set()
for page in range(1, 6):  # 5 pages = ~100 shows each endpoint
    for endpoint in ['/tv/popular?', '/tv/top_rated?', '/trending/tv/week?']:
        try:
            results = tmdb_get(f"{endpoint}page={page}").get('results', [])
            for r in results:
                show_ids.add(r['id'])
        except: pass

print(f"📺 Scoring {len(show_ids)} unique shows...")
total = score_and_write(show_ids)
print(f"\n✅ Done — {total} shows written to {TABLE}")

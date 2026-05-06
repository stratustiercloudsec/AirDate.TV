import json
import boto3
import logging
from datetime import datetime, timezone

logger = logging.getLogger()
logger.setLevel(logging.INFO)
bedrock = boto3.client("bedrock-runtime", region_name="us-east-1")

DOMAIN_SCORES = {
    "deadline.com":95,"variety.com":95,"hollywoodreporter.com":95,
    "tvline.com":92,"vulture.com":88,"ew.com":85,"thewrap.com":85,
    "indiewire.com":82,"avclub.com":80,"collider.com":75,
    "slashfilm.com":75,"screenrant.com":70,"cinemablend.com":68,
    "ign.com":65,"rollingstone.com":72,"people.com":62,
    "nytimes.com":78,"latimes.com":75,"washingtonpost.com":75,
    "theguardian.com":73,"bbc.com":70,"cnn.com":62,"nbcnews.com":60,
}
HIGH_VALUE = [
    "cancelled","canceled","renewed","cancellation","renewal","premiere",
    "series premiere","season premiere","finale","series finale","exclusive",
    "first look","trailer","official trailer","greenlit","ordered","pilot order",
    "series order","pickup","axed","ending","spinoff","spin-off","reboot",
    "revival","casting","showrunner","limited series","miniseries","netflix",
    "hbo","hulu","apple tv+","disney+","peacock","paramount+","amazon",
    "prime video","max","emmy","golden globe","sag","wga","sag-aftra",
    "writers strike","actors strike",
]
MEDIUM_VALUE = [
    "release date","returns","season","episode","debut","interview",
    "behind the scenes","set photo","production","filming","recap","review",
    "ratings","viewership","streaming","creator","director",
    "executive producer","guest star","crossover","development",
]
BORDERLINE_LOW=50; BORDERLINE_HIGH=60; TOP_N=15

def domain_score(domain):
    domain=domain.lower().strip()
    if domain in DOMAIN_SCORES: return DOMAIN_SCORES[domain]
    for k,v in DOMAIN_SCORES.items():
        if k in domain: return v
    return 38

def keyword_score(headline,summary):
    text=(headline+" "+summary).lower()
    return min(100.0,sum(1 for kw in HIGH_VALUE if kw in text)*18.0+sum(1 for kw in MEDIUM_VALUE if kw in text)*5.0)

def recency_score(published_at):
    try:
        h=(datetime.now(timezone.utc)-datetime.fromisoformat(published_at.replace("Z","+00:00"))).total_seconds()/3600
        if h<=6: return 100.0
        if h<=24: return 85.0
        if h<=48: return 68.0
        if h<=72: return 50.0
        if h<=168: return 30.0
        return 10.0
    except: return 50.0

def heuristic_score(a):
    return round(domain_score(a.get("domain",""))*0.35+keyword_score(a.get("headline",""),a.get("summary",""))*0.40+recency_score(a.get("published_at",""))*0.25,2)

def bedrock_score(article):
    try:
        resp=bedrock.invoke_model(
            modelId="us.anthropic.claude-3-5-haiku-20241022-v1:0",
            contentType="application/json",accept="application/json",
            body=json.dumps({"anthropic_version":"bedrock-2023-05-31","max_tokens":30,
                "messages":[{"role":"user","content":f"Score TV newsworthiness 0-100.\nHeadline: {article.get('headline','')}\nSource: {article.get('domain','')}\nJSON only: {{\"score\":<0-100>}}"}]}))
        text=json.loads(resp["body"].read())["content"][0]["text"].strip().replace("```json","").replace("```","")
        return float(json.loads(text).get("score",50))
    except Exception as e:
        logger.warning(f"Bedrock fallback: {e}"); return 50.0

def lambda_handler(event, context):
    raw=event.get("raw_articles",[])
    logger.info(f"Ranking {len(raw)} articles")
    if not raw: return {"ranked_articles":[],"total":0,"bedrock_calls":0}
    scored=[]; bedrock_calls=0
    for a in raw:
        h=heuristic_score(a); final,method=h,"heuristic"
        if BORDERLINE_LOW<=h<=BORDERLINE_HIGH:
            final=round(h*0.4+bedrock_score(a)*0.6,2); method="hybrid"; bedrock_calls+=1
        scored.append({**a,"newsworthiness":final,"scoring_method":method})
    ranked=sorted(scored,key=lambda x:x["newsworthiness"],reverse=True)[:TOP_N]
    logger.info(f"Top {len(ranked)} returned. Bedrock calls: {bedrock_calls}")
    return {"ranked_articles":ranked,"total":len(ranked),"bedrock_calls":bedrock_calls}

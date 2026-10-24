#!/usr/bin/env python3
"""Liveticker: Python-Webserver, JSON-API und Abruf offizieller Quellen.

Keine externe Python-Abhängigkeit: für Ugreen NAS genügt Python 3.9+.
"""
from __future__ import annotations

import json, logging, os, re, threading, time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from html import unescape
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent
PORT = int(os.getenv('PORT', '5056'))
TTL, TIMEOUT = 8, 8
BERLIN = ZoneInfo('Europe/Berlin')
LOG_DIR = ROOT / 'logs'; LOG_DIR.mkdir(exist_ok=True)
logging.basicConfig(level=logging.INFO, format='%(message)s', handlers=[logging.FileHandler(LOG_DIR / 'liveticker-api.log', encoding='utf-8'), logging.StreamHandler()])
log = logging.getLogger('liveticker')

FLAG = 'data:image/svg+xml,' + __import__('urllib.parse').parse.quote('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3 2"><path d="M0 0h3v.667H0z"/><path fill="#d00" d="M0 .667h3v.666H0z"/><path fill="#ffce00" d="M0 1.333h3v.667H0z"/></svg>')
TEAMS = [
 {'id':'dfb_men','name':'Deutschland Männer','short':'Deutschland','sport':'football','league':'DFB-Nationalmannschaft','color':'#111111','color2':'#dd0000','color3':'#ffce00','logo':FLAG,'src':'dfb','path':'men','role':'Nationalteam','sourceUrl':'https://www.dfb.de/maenner/nationalmannschaften/nationalmannschaft/spiele-und-termine'},
 {'id':'dfb_women','name':'Deutschland Frauen','short':'Deutschland','sport':'football','league':'DFB-Nationalmannschaft','color':'#111111','color2':'#dd0000','color3':'#ffce00','logo':FLAG,'src':'dfb','path':'women','role':'Nationalteam','sourceUrl':'https://www.dfb.de/frauen/nationalmannschaften/nationalmannschaft/spiele-und-termine'},
 {'id':'deb_men','name':'Deutschland Männer','short':'Deutschland','sport':'hockey','league':'DEB-Nationalmannschaft','color':'#111111','color2':'#dd0000','color3':'#ffce00','logo':FLAG,'src':'deb','path':'men','role':'Nationalteam','sourceUrl':'https://www.deb-online.de/maenner-nationalmannschaft/'},
 {'id':'deb_women','name':'Deutschland Frauen','short':'Deutschland','sport':'hockey','league':'DEB-Nationalmannschaft','color':'#111111','color2':'#dd0000','color3':'#ffce00','logo':FLAG,'src':'deb','path':'women','role':'Nationalteam','sourceUrl':'https://www.deb-online.de/frauen-nationalmannschaft/'},
 {'id':'straubing','name':'Straubing Tigers','short':'Straubing','sport':'hockey','league':'PENNY DEL','color':'#002e62','color2':'#ffffff','logo':'https://www.straubing-tigers.de/wp-content/themes/straubing-tigers-theme/assets/img/logo.svg','src':'straubing','club':'Straubing Tigers','role':'Team','sourceUrl':'https://www.straubing-tigers.de/spielplan/'},
 {'id':'tappara','name':'Tappara','short':'Tappara','sport':'hockey','league':'Liiga','color':'#00539b','color2':'#f58220','src':'liiga','club':'Tappara','role':'Team','sourceUrl':'https://liiga.fi/en/schedule?joukkue=tappara'},
 {'id':'eisloewen','name':'Dresdner Eislöwen','short':'Dresdner','sport':'hockey','league':'DEL2','color':'#0054a6','color2':'#ffffff','src':'del2','club':'Dresdner Eislöwen','teamId':332,'leagues':[('DEL2','DEL2','hockey')]},
 {'id':'marquez','name':'Marc Márquez','short':'Márquez','sport':'motorsport','league':'MotoGP','color':'#e10600','color2':'#111111','src':'motogp','role':'MotoGP-Fahrer'},
 {'id':'oilers','name':'Edmonton Oilers','short':'Edmonton','sport':'hockey','league':'NHL','color':'#ff4c00','color2':'#003e7e','src':'nhl','abbr':'EDM'},
 {'id':'vegas','name':'Vegas Golden Knights','short':'Vegas','sport':'hockey','league':'NHL','color':'#b4975a','color2':'#333f48','src':'nhl','abbr':'VGK'},
 {'id':'bayern','name':'FC Bayern München','short':'Bayern','sport':'football','league':'Bundesliga','color':'#dc052d','color2':'#ffffff','src':'oldb','teamId':40,'espn':('ger.1',132),'leagues':[('bl1','Bundesliga','football'),('dfb','DFB-Pokal','football'),('ucl','Champions League','football')]},
 {'id':'dynamo','name':'Dynamo Dresden','short':'Dresden','sport':'football','league':'2. Bundesliga','color':'#f2c200','color2':'#111111','src':'oldb','teamId':177,'espn':('ger.2',7017),'leagues':[('bl2','2. Bundesliga','football'),('dfb','DFB-Pokal','football')]},
]
CACHE, CACHE_LOCK, SNAP = {}, threading.Lock(), {'at':0., 'value':None, 'lock':threading.Lock()}
MONTHS = {'januar':1,'februar':2,'märz':3,'april':4,'mai':5,'juni':6,'juli':7,'august':8,'september':9,'oktober':10,'november':11,'dezember':12}
NHL_PEN = {'tripping':'Beinstellen','hooking':'Haken','slashing':'Stockschlag','high-sticking':'Hoher Stock','interference':'Behinderung','holding':'Halten','cross-checking':'Check mit Stock','roughing':'Rempeln','boarding':'Bandencheck','delay-of-game':'Spielverzögerung','too-many-men-on-the-ice':'Zu viele Spieler','fighting':'Faustkampf'}

def event(level, message, **meta): log.log(getattr(logging, level.upper(), logging.INFO), json.dumps({'time':now(), 'level':level, 'message':message, **({'meta':meta} if meta else {})}, ensure_ascii=False))
def now(): return datetime.now(timezone.utc).isoformat().replace('+00:00','Z')
def iso_berlin(y,m,d,h=12,mi=0): return datetime(y,m,d,h,mi,tzinfo=BERLIN).astimezone(timezone.utc).isoformat().replace('+00:00','Z')
def fetch(url, binary=False):
  req=Request(url, headers={'User-Agent':'Liveticker/1.3 (+https://tyskman11.duckdns.org)','#':'x'})
  try:
    with urlopen(req, timeout=TIMEOUT) as r: return r.read() if binary else r.read().decode(r.headers.get_content_charset() or 'utf-8', 'replace')
  except (HTTPError, URLError, TimeoutError) as e: raise RuntimeError(f'{url} -> {getattr(e,"code",str(e))}') from e
def cached(key, seconds, fun):
  with CACHE_LOCK:
    hit=CACHE.get(key)
    if hit and time.time()-hit[0]<seconds: return hit[1]
  value=fun()
  with CACHE_LOCK: CACHE[key]=(time.time(), value)
  return value
def getjson(url, key=None, ttl=30): return json.loads(cached(key or url, ttl, lambda: fetch(url)))
def text(s): return re.sub(r'\s+',' ',unescape(re.sub(r'<[^>]+>','',s)).replace('\xa0',' ')).strip()
def game(*, ident, status, start, competition, home, away, venue='', **extra):
  return {'id':ident,'status':status,'start':start,'venue':venue,'competition':competition,'home':home,'away':away,'note':'','period':'','clock':'','goals':[],'penalties':[],**extra}
def side(name, short=None, logo='', score=None, **kw): return {'name':name,'short':short or name,'logo':logo,'score':score,**kw}
def parts(all_games, key, field='name', sourceUrl=None):
  all_games.sort(key=lambda x:x['start']); finals=[x for x in all_games if x['status']=='final']; live=next((x for x in all_games if x['status']=='live'),None)
  def form(g):
    mine=g['home'] if g['home'].get(field)==key else g['away']; other=g['away'] if mine is g['home'] else g['home']
    return 'W' if mine['score']>other['score'] else 'L' if mine['score']<other['score'] else 'D'
  return {'live':live,'upcoming':[x for x in all_games if x['status']=='next'][:4],'last':finals[-1] if finals else None,'history':list(reversed(finals[-10:])),'form':[form(x) for x in finals[-5:] if x['home']['score'] is not None and x['away']['score'] is not None], **({'sourceUrl':sourceUrl} if sourceUrl else {})}

def build_nhl(t):
  d=datetime.now(timezone.utc); season=f'{d.year}{d.year+1}' if d.month>=9 else f'{d.year-1}{d.year}'
  raw=getjson(f'https://api-web.nhle.com/v1/club-schedule-season/{t["abbr"]}/{season}', 'nhl-'+t['abbr'])
  def conv(x):
    state=x.get('gameState',''); status='live' if state in ('LIVE','CRIT') else 'final' if state in ('FINAL','OFF') else 'next'
    def s(v): return side((v.get('placeName',{}).get('default','')+' '+v.get('commonName',{}).get('default','')).strip(),v.get('abbrev',''),v.get('darkLogo') or v.get('logo',''),v.get('score'))
    return game(ident='nhl'+str(x['id']),status=status,start=x['startTimeUTC'],competition='NHL',home=s(x['homeTeam']),away=s(x['awayTeam']),venue=x.get('venue',{}).get('default',''))
  return parts([conv(x) for x in raw.get('games',[])],t['abbr'],'short')

def oldb_season(code):
  d=datetime.now(); return d.year if d.month >= (9 if code=='DEL2' else 8) else d.year-1
def oldb_game(m, comp, sport):
  start=m.get('matchDateTimeUTC') or m.get('matchDateTime','')+'Z'; elapsed=(datetime.now(timezone.utc)-datetime.fromisoformat(start.replace('Z','+00:00'))).total_seconds()/60
  goals=sorted(m.get('goals',[]),key=lambda x:x.get('goalID',0)); result=next((x for x in m.get('matchResults',[]) if x.get('resultTypeID')==2),None)
  finished=bool(m.get('matchIsFinished')) or (elapsed>= (160 if sport=='hockey' else 150) and bool(goals or m.get('matchResults')))
  status='final' if finished else 'live' if 0<=elapsed<(160 if sport=='hockey' else 150) else 'next'
  def s(v, score): return side(v.get('teamName',''),v.get('shortName') or v.get('teamName',''),v.get('teamIconUrl',''),score,id=v.get('teamId'))
  score1=score2=None
  if result: score1,score2=result.get('pointsTeam1'),result.get('pointsTeam2')
  elif status!='next' and goals: score1,score2=goals[-1].get('scoreTeam1'),goals[-1].get('scoreTeam2')
  goals_out=[]; prev=0
  for x in goals:
    home=x.get('scoreTeam1',0)>prev; prev=x.get('scoreTeam1',0)
    goals_out.append({'s':x.get('matchMinute',0)*60,'time':str(x.get('matchMinute',''))+"'",'side':'home' if home else 'away','player':x.get('goalGetterName','')+(' (ET)' if x.get('isOwnGoal') else ' (Elfm.)' if x.get('isPenalty') else ''),'assists':[],'score':f"{x.get('scoreTeam1')}:{x.get('scoreTeam2')}",'tag':''})
  location=m.get('location') or {}
  return game(ident='ol'+str(m.get('matchID')),status=status,start=start,competition=comp,home=s(m['team1'],score1),away=s(m['team2'],score2),venue=location.get('locationStadium','') or location.get('locationCity',''),goals=goals_out)
def build_espn(t):
  league, team=t['espn']; raw=getjson(f'https://site.api.espn.com/apis/site/v2/sports/soccer/{league}/teams/{team}/schedule',f'espn-{league}-{team}',60)
  out=[]
  for e in raw.get('events',[]):
    c=(e.get('competitions') or [e])[0]; comp=c.get('competitors',[]); h=next((x for x in comp if x.get('homeAway')=='home'),{}); a=next((x for x in comp if x.get('homeAway')=='away'),{})
    def s(x): q=x.get('team',{}); return side(q.get('displayName',''),q.get('abbreviation',''),q.get('logo',''),int(x['score']) if str(x.get('score','')).isdigit() else None,id=int(x.get('id',0) or 0))
    st=c.get('status',{}).get('type',{}).get('state'); out.append(game(ident='espn'+str(e.get('id')),status='live' if st=='in' else 'final' if st=='post' else 'next',start=e.get('date') or c.get('date'),competition=t['league'],home=s(h),away=s(a),venue=c.get('venue',{}).get('fullName',''),period=c.get('status',{}).get('type',{}).get('shortDetail',''),clock=c.get('status',{}).get('displayClock','')))
  return parts(out,team,'id')
def build_oldb(t):
  out=[]; ok=False
  for code,label,sport in t['leagues']:
    try:
      for m in getjson(f'https://api.openligadb.de/getmatchdata/{code}/{oldb_season(code)}',f'oldb-{code}-{oldb_season(code)}',60):
        if m['team1'].get('teamId')==t['teamId'] or m['team2'].get('teamId')==t['teamId']: out.append(oldb_game(m,label,sport))
      ok=True
    except RuntimeError: pass
  return parts(out,t['teamId'],'id') if ok else build_espn(t)

def build_dfb(t):
  url=t['sourceUrl']; html=cached('dfb-'+t['path'],300,lambda:fetch(url)); out=[]
  for row in re.findall(r'<tr[^>]*>(.*?)</tr>',html,re.S|re.I):
    c=[text(x) for x in re.findall(r'<td[^>]*>(.*?)</td>',row,re.S|re.I)]; dm=re.search(r'(\d{2})\.(\d{2})\.(\d{4})',c[0] if c else '')
    if not dm or len(c)<3: continue
    pair=re.sub(r'\s*\([^)]*\)\s*$','',c[2]).split(' - '); tm=re.search(r'(\d{1,2})[.:](\d{2})',c[1])
    if len(pair)!=2: continue
    out.append(game(ident='dfb-'+''.join(dm.groups()),status='next',start=iso_berlin(int(dm[3]),int(dm[2]),int(dm[1]),int(tm[1]) if tm else 12,int(tm[2]) if tm else 0),competition=(re.search(r'\(([^)]+)\)',c[2]) or ['','Länderspiel'])[1],home=side(pair[0]),away=side(pair[1]),venue=c[3] if len(c)>3 else ''))
  if not out: return {'live':None,'upcoming':[],'last':None,'history':[],'form':[],'sourceUrl':url,'notice':'Der DFB hat derzeit noch keine konkrete Paarung veröffentlicht.'}
  return parts(out,'Deutschland',sourceUrl=url)
def build_deb(t):
  html=cached('deb-'+t['path'],300,lambda:fetch(t['sourceUrl'])); out=[]
  for block in re.findall(r'<article class="mec-event-article.*?</article>',html,re.S|re.I):
    dm=re.search(r'mec-start-date-label">(\d{1,2})\.\s*([A-Za-zäöü]+)\s+(\d{4})',block,re.I); tm=re.search(r'mec-start-time">(\d{1,2}):(\d{2})',block); teams=[text(x) for x in re.findall(r'team-score"><p>([^<]+)</p>',block,re.I)]
    if not dm or len(teams)<2 or dm[2].lower() not in MONTHS: continue
    mo=MONTHS[dm[2].lower()]; h=int(tm[1]) if tm else 12; mi=int(tm[2]) if tm else 0
    norm=lambda x:'Deutschland' if x=='GER' else x
    out.append(game(ident=f'deb-{t["path"]}-{dm[3]}{mo}{dm[1]}',status='next',start=iso_berlin(int(dm[3]),mo,int(dm[1]),h,mi),competition='DEB · '+(text((re.search(r'mec-label-normal[^>]*>([^<]+)',block) or ['','Länderspiel'])[1])),home=side(norm(teams[0]),teams[0]),away=side(norm(teams[1]),teams[1])))
  if not out: raise RuntimeError('DEB-Spielplan enthält derzeit keine konkreten Paarungen')
  return parts(out,'Deutschland',sourceUrl=t['sourceUrl'])

def build_liiga(t):
  year=datetime.now().year+(datetime.now().month>=8); raw=getjson(f'https://liiga.fi/api/v2/games?tournament=runkosarja&season={year}',f'liiga-{year}',60); out=[]
  for x in raw:
    if t['club'] not in (x.get('homeTeam',{}).get('teamName'),x.get('awayTeam',{}).get('teamName')): continue
    def s(k): v=x[k]; return side(v.get('teamName',''),v.get('teamName',''),(v.get('logos',{}).get('lightBg') or v.get('logos',{}).get('darkBg','')),v.get('goals') if x.get('started') else None,id=v.get('teamId'))
    status='final' if x.get('ended') else 'live' if x.get('started') else 'next'; out.append(game(ident='liiga'+str(x['id']),status=status,start=x['start'],competition='Liiga',home=s('homeTeam'),away=s('awayTeam'),venue=x.get('iceRink',{}).get('name',''),period=f"{x.get('currentPeriod','')}. Drittel" if status=='live' else ''))
  if not out: raise RuntimeError('Offizieller Liiga-Spielplan enthält keine Tappara-Spiele')
  return parts(out,t['club'],sourceUrl=t['sourceUrl'])
def build_straubing(t):
  html=cached('straubing',60,lambda:fetch(t['sourceUrl'])); out=[]
  for row in re.findall(r'<tr[^>]*>(.*?)</tr>',html,re.S|re.I):
    c=[re.sub(r'^(Heimmannschaft|Gastmannschaft)\s*','',text(x),flags=re.I) for x in re.findall(r'<td[^>]*>(.*?)</td>',row,re.S|re.I)]
    if len(c)<7 or 'Straubing Tigers' not in (c[1]+c[5]): continue
    dm=re.search(r'(\d{2})\.(\d{2})\.(\d{4})\s*(\d{2}):(\d{2})',c[6]); score=re.search(r'(\d+)\s*:\s*(\d+)',c[3])
    if not dm: continue
    start=iso_berlin(int(dm[3]),int(dm[2]),int(dm[1]),int(dm[4]),int(dm[5])); status='final' if score else 'live' if datetime.fromisoformat(start.replace('Z','+00:00')).timestamp()<=time.time()<datetime.fromisoformat(start.replace('Z','+00:00')).timestamp()+10800 else 'next'
    out.append(game(ident='str-'+''.join(dm.groups()),status=status,start=start,competition='PENNY DEL',home=side(c[1],c[1],score=int(score[1]) if score else None),away=side(c[5],c[5],score=int(score[2]) if score else None),period='Läuft' if status=='live' else ''))
  if not out: raise RuntimeError('Offizieller Straubing-Spielplan enthält keine Spiele')
  return parts(out,t['club'],sourceUrl=t['sourceUrl'])
def build_del2(t):
  # Offizieller DEL2-Plan ist HTML; bei Änderungen weiterhin sauber auf OpenLigaDB zurückfallen.
  try:
    html=cached('del2',30,lambda:fetch('https://www.del-2.org/spielplan/')); out=[]
    for chunk in html.split('<div class="games-row ')[1:]:
      sc=re.search(r'games-score-(\w+).*?am (\d\d)\.(\d\d)\.(\d{4})(?:, (?:Ergebnis|live): (\d+) zu (\d+))?',chunk,re.S); tm=re.search(r'games-meta-time">(\d\d):(\d\d)',chunk); teams=re.findall(r'games-team-(home|away)[^>]*" title="([^"]*)"',chunk)
      if not sc or not tm or len(teams)<2: continue
      sides={k:side(text(v)) for k,v in teams};
      if t['club'] not in (sides.get('home',{}).get('name'),sides.get('away',{}).get('name')): continue
      status='live' if sc[1]=='live' else 'final' if sc[1]=='played' else 'next';
      if sc[5]: sides['home']['score']=int(sc[5]); sides['away']['score']=int(sc[6])
      out.append(game(ident='d2-'+sc[4]+sc[3]+sc[2],status=status,start=iso_berlin(int(sc[4]),int(sc[3]),int(sc[2]),int(tm[1]),int(tm[2])),competition='DEL2',home=sides['home'],away=sides['away']))
    if out:return parts(out,t['club'])
  except RuntimeError: pass
  return build_oldb(t)

def build_motogp(t):
  base='https://api.motogp.pulselive.com/motogp/v1/'; headers={'User-Agent':'Liveticker/1.3'}
  def mg(path,key,ttl=300): return getjson(base+path,key,ttl)
  seasons=mg('results/seasons','mg-seasons',3600); season=next((x for x in seasons if x.get('current')),seasons[0]); cats=mg('results/categories?seasonUuid='+str(season['id']),'mg-cats',3600); cat=next(x for x in cats if x.get('name','').startswith('MotoGP'))
  events=mg(f'results/events?seasonUuid={season["id"]}&isFinished=false','mg-open'); done=mg(f'results/events?seasonUuid={season["id"]}&isFinished=true','mg-done'); types={'FP':'Freies Training','PR':'Practice','Q':'Qualifying','SPR':'Sprint','WUP':'Warm-up','RAC':'Rennen'}
  def sessions(ev):
    raw=mg(f'results/sessions?eventUuid={ev["id"]}&categoryUuid={cat["id"]}','mg-ses-'+str(ev['id']),60); out=[]
    for x in raw:
      ty=x.get('type',''); label=types.get(ty,ty)+((' '+str(x.get('number'))) if ty in ('FP','Q') and x.get('number') else '')
      out.append({'id':'mg'+str(x['id']),'kind':'moto','status':'final' if x.get('status')=='FINISHED' else 'next' if x.get('status')=='NOT-STARTED' else 'live','start':datetime.fromisoformat(x['date'].replace('Z','+00:00')).isoformat().replace('+00:00','Z'),'venue':x.get('circuit') or ev.get('circuit',{}).get('name',''),'competition':'GP '+re.sub(r'^GRAND PRIX OF ','',ev.get('name',''),flags=re.I).title(),'session':label,'type':ty,'period':'','clock':'','rider':None,'grid':[],'goals':[],'penalties':[]})
    return out
  open_ev=sorted([x for x in events if not x.get('test')],key=lambda x:x.get('date_start','')); all_s=[s for e in open_ev[:2] for s in sessions(e)]; live=next((x for x in all_s if x['status']=='live'),None); upcoming=[x for x in all_s if x['status']=='next'][:4]
  last=None
  for e in sorted([x for x in done if not x.get('test')],key=lambda x:x.get('date_start',''))[-1:]:
    raw=sessions(e); last=next((x for x in reversed(raw) if x['type']=='RAC'),None)
  return {'live':live,'upcoming':upcoming,'last':last,'history':[last] if last else [],'form':[],'standing':None}

BUILDERS={'nhl':build_nhl,'oldb':build_oldb,'dfb':build_dfb,'deb':build_deb,'liiga':build_liiga,'straubing':build_straubing,'del2':build_del2,'motogp':build_motogp}
def decorate(t, result):
  base={k:t.get(k) for k in ('id','name','short','sport','league','color','color2','color3','role')}; base['color3']=base.get('color3') or base.get('color2') or base['color']; base['role']=base.get('role') or 'Team'
  def strip(g):
    if not g:return None
    if g.get('kind')=='moto':return g
    for s in (g['home'],g['away']):
      me=(t.get('teamId') is not None and s.get('id')==t['teamId']) or s.get('name')==t.get('club') or (t['src'] in ('dfb','deb') and s.get('name')=='Deutschland') or (t['src']=='nhl' and s.get('short')==t.get('abbr'))
      s['me']=me
      if me:s['short']=t['short']
      s.pop('id',None)
    return g
  result['upcoming']=[strip(x) for x in result.get('upcoming',[])]
  # Die Karten nutzen `next`, die Agenda dagegen `upcoming`. Beide stammen
  # aus derselben Quelle, damit niemals "Kein Termin" neben einem echten
  # Agenda-Eintrag erscheint.
  result['next']=strip(result.get('next') or (result['upcoming'][0] if result['upcoming'] else None))
  for key in ('live','last'): result[key]=strip(result.get(key))
  result['history']=[strip(x) for x in result.get('history',[])]
  sample=result.get('live') or result.get('next') or result.get('last'); base.update(result)
  candidates=((sample or {}).get('home',{}),(sample or {}).get('away',{}))
  base['logo']=t.get('logo') or (next((x.get('logo','') for x in candidates if x.get('me')), '') if sample else '')
  base['error']=None
  return base
def build_team(t):
  try: return decorate(t, BUILDERS[t['src']](t))
  except Exception as e:
    event('error','Datenquelle nicht erreichbar',team=t['id'],error=str(e)); return {**{k:t.get(k) for k in ('id','name','short','sport','league','color','color2','color3','role')},'logo':t.get('logo',''),'live':None,'next':None,'upcoming':[],'last':None,'history':[],'form':[],'standing':None,'error':str(e)}
def ticker():
  with SNAP['lock']:
    if SNAP['value'] and time.time()-SNAP['at']<TTL:return SNAP['value']
    with ThreadPoolExecutor(max_workers=len(TEAMS)) as pool: teams=[f.result() for f in as_completed([pool.submit(build_team,t) for t in TEAMS])]
    # Feste Reihenfolge bewahren, Parallelausführung nur für Abrufgeschwindigkeit.
    teams.sort(key=lambda x: next(i for i,t in enumerate(TEAMS) if t['id']==x['id']))
    SNAP.update(at=time.time(),value={'updated':now(),'teams':teams}); return SNAP['value']

DOCS={'name':'Liveticker API','version':'2.0.0','runtime':'Python 3 Standard Library','endpoints':{'GET /api/v1/ticker':'all teams and game data','GET /api/v1/teams':'team overview','GET /api/v1/teams/{id}':'one team','GET /api/v1/live':'currently live games','GET /api/v1/next':'upcoming fixtures','GET /api/v1/health':'service status'}}
MIME={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'}
class Handler(BaseHTTPRequestHandler):
  server_version='LivetickerPython/2.0'; protocol_version='HTTP/1.1'
  def log_message(self,*args): pass
  def send_json(self, status, data):
    body=json.dumps(data,ensure_ascii=False,separators=(',',':')).encode(); self.send_response(status); self.send_header('Content-Type','application/json; charset=utf-8'); self.send_header('Cache-Control','no-store'); self.send_header('Access-Control-Allow-Origin','*'); self.send_header('Content-Length',str(len(body))); self.end_headers(); self.wfile.write(body)
  def do_OPTIONS(self): self.send_response(204); self.send_header('Access-Control-Allow-Origin','*'); self.send_header('Access-Control-Allow-Methods','GET, OPTIONS'); self.end_headers()
  def do_GET(self):
    started=time.time(); path=self.path.split('?',1)[0].rstrip('/') or '/'
    try:
      p=re.sub(r'^/liveticker','',path) or '/'
      if p in ('/api','/api/v1'): self.send_json(200,DOCS)
      elif p=='/api/v1/health': self.send_json(200,{'ok':True,'runtime':'python','updated':SNAP['value']['updated'] if SNAP['value'] else None})
      elif p.startswith('/api'):
        d=ticker()
        if p in ('/api/ticker','/api/v1/ticker'): self.send_json(200,d)
        elif p=='/api/v1/teams': self.send_json(200,[{k:x.get(k) for k in ('id','name','short','sport','league','color','logo')} for x in d['teams']])
        elif p=='/api/v1/live': self.send_json(200,{'updated':d['updated'],'teams':[x for x in d['teams'] if x.get('live')]})
        elif p=='/api/v1/next': self.send_json(200,{'updated':d['updated'],'games':sorted([{'team':x['id'],**x['next']} for x in d['teams'] if x.get('next')],key=lambda x:x['start'])})
        elif m:=re.fullmatch(r'/api/v1/teams/([a-z0-9_-]+)',p): self.send_json(200,next(({'updated':d['updated'],**x} for x in d['teams'] if x['id']==m[1]),{'error':'unknown team'}))
        else:self.send_json(404,{'error':'not found','docs':'/api/v1'})
      else:
        rel='index.html' if p=='/' else p.lstrip('/'); file=(ROOT/rel).resolve()
        if ROOT not in file.parents or file.suffix not in MIME or not file.is_file(): self.send_json(404,{'error':'not found'}); return
        body=file.read_bytes(); self.send_response(200); self.send_header('Content-Type',MIME[file.suffix]); self.send_header('Cache-Control','no-cache'); self.send_header('Content-Length',str(len(body))); self.end_headers(); self.wfile.write(body)
    except Exception as e: event('error','HTTP-Anfrage fehlgeschlagen',url=self.path,error=str(e)); self.send_json(502,{'error':str(e)})
    finally:event('info','HTTP-Anfrage',method='GET',url=self.path,durationMs=round((time.time()-started)*1000))
if __name__=='__main__':
  event('info',f'Liveticker Python bereit auf http://localhost:{PORT}/',port=PORT); ThreadingHTTPServer(('0.0.0.0',PORT),Handler).serve_forever()

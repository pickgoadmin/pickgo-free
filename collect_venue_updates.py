#!/usr/bin/env python3
"""PICKGO v1.0.1: suggest (never publish) court changes from official webpages.

Reads public, published rows from existing Supabase RLS-protected API, only visits
an administrator-entered official_url, parses matched LocalBusiness JSON-LD,
then writes a static candidate JSON for admin review. No secret/service-role key.
No guessed prices/photos and no general search engines or undocumented APIs.
"""
import argparse
import datetime as dt
import html
from html.parser import HTMLParser
import ipaddress
import json
import os
from pathlib import Path
import re
import socket
import ssl
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse, urljoin
from urllib.request import Request, urlopen, build_opener, HTTPRedirectHandler, HTTPSHandler
from difflib import SequenceMatcher

FIELDS = {'contact_phone': '전화번호', 'operating_hours': '운영시간'}
KNOWN_TYPES = {'localbusiness','sportsactivitylocation','sportsclub','healthclub','exercisegym','sportscomplex','civicstructure','stadiumorarena'}
MAX_BYTES=950_000
UA='PICKGO-VenueReview/1.0 (public page metadata; contact: site operator)'

class DataParser(HTMLParser):
 def __init__(self):
  super().__init__(convert_charrefs=True)
  self.in_jsonld=False;self.buf=[];self.jsonld=[];self.title='';self.in_title=False
 def handle_starttag(self,tag,attrs):
  attrs=dict(attrs)
  if tag=='script' and 'ld+json' in attrs.get('type','').lower(): self.in_jsonld=True;self.buf=[]
  if tag=='title': self.in_title=True
 def handle_data(self,data):
  if self.in_jsonld:self.buf.append(data)
  if self.in_title:self.title+=data
 def handle_endtag(self,tag):
  if tag=='script' and self.in_jsonld:self.jsonld.append(''.join(self.buf));self.in_jsonld=False
  if tag=='title':self.in_title=False

def secure_url(value):
 try:
  p=urlparse(value)
  if p.scheme!='https' or not p.hostname or p.username or p.password or len(value)>2000: return False
  if p.hostname.lower() in ('localhost',) or p.hostname.endswith(('.local','.internal','.localhost')):return False
  try: return ipaddress.ip_address(p.hostname).is_global
  except ValueError:return True
 except (ValueError,TypeError): return False

def public_hostname(host):
 try:
  info=socket.getaddrinfo(host,443,type=socket.SOCK_STREAM)
  return bool(info) and all(ipaddress.ip_address(i[4][0]).is_global for i in info)
 except (socket.gaierror,ValueError,OverflowError):return False

class RestrictRedirect(HTTPRedirectHandler):
 def redirect_request(self,req,fp,code,msg,headers,newurl):
  old=urlparse(req.full_url);new=urlparse(newurl)
  if not secure_url(newurl) or not public_hostname(new.hostname):raise ValueError('Unsafe redirect')
  def base(host):return host.lower().removeprefix('www.')
  if base(old.hostname)!=base(new.hostname):raise ValueError('Cross-domain redirect not followed')
  return super().redirect_request(req,fp,code,msg,headers,newurl)

def fetch(url):
 if not secure_url(url):raise ValueError('Invalid HTTPS official URL')
 host=urlparse(url).hostname
 if not public_hostname(host):raise ValueError('Official URL resolves to non-public IP')
 handler=build_opener(RestrictRedirect,HTTPSHandler(context=ssl.create_default_context()))
 req=Request(url,headers={'User-Agent':UA,'Accept':'text/html,application/ld+json;q=0.9'})
 with handler.open(req,timeout=10) as resp:
  if not ('html' in resp.headers.get('Content-Type','').lower()):raise ValueError('Not an HTML page')
  b=resp.read(MAX_BYTES+1)
  if len(b)>MAX_BYTES:raise ValueError('Page too large')
  charset=resp.headers.get_content_charset() or 'utf-8'
  try:return b.decode(charset,errors='replace')
  except LookupError:return b.decode('utf-8',errors='replace')

def nodes(obj):
 if isinstance(obj,list):
  for item in obj:yield from nodes(item)
 elif isinstance(obj,dict):
  if '@graph' in obj:yield from nodes(obj['@graph'])
  yield obj

def match_name(a,b):
 def clean(s):return re.sub(r'[^a-z0-9가-힣]','',str(s or '').casefold())
 a=clean(a);b=clean(b)
 return bool(a and b) and (a==b or (min(len(a),len(b))>=6 and (a in b or b in a)) or (len(a)>6 and len(b)>6 and SequenceMatcher(None,a,b).ratio()>=0.86))

def to_text(v):
 if isinstance(v,list):return ', '.join(str(x).strip() for x in v if str(x).strip())
 if isinstance(v,str):return v.strip()
 return ''

def extract(page,venue):
 parser=DataParser();parser.feed(page)
 picks=[]
 for script in parser.jsonld:
  try:obj=json.loads(html.unescape(script))
  except (json.JSONDecodeError,ValueError):continue
  for node in nodes(obj):
   typ=node.get('@type',[]);typ=[typ] if isinstance(typ,str) else typ
   if not isinstance(typ,list) or not any(t.split('/')[-1].lower() in KNOWN_TYPES for t in typ if isinstance(t,str)):continue
   if not match_name(venue['name'],node.get('name','')):continue
   # If a schema address is given, require recognizable address fragment to avoid wrong branches.
   addr=node.get('address') or {};addr=' '.join(str(v) for v in addr.values()) if isinstance(addr,dict) else str(addr)
   if addr:
    clean=lambda s:re.sub(r'\s+','',s)
    va=clean(venue.get('address',''));ad=clean(addr)
    if len(ad)>8 and not (ad[-7:] in va or va[-7:] in ad or SequenceMatcher(None,va,ad).ratio()>=0.51):continue
   values={}
   if node.get('telephone'):
    tel=to_text(node['telephone'])
    if re.fullmatch(r'[+0-9()\s-]{7,30}',tel):values['contact_phone']=tel[:60]
   hours=to_text(node.get('openingHours'))
   if not hours:
    spec=node.get('openingHoursSpecification')
    if isinstance(spec,dict):spec=[spec]
    if isinstance(spec,list):
     chunks=[]
     for part in spec:
      if not isinstance(part,dict):continue
      day=to_text(part.get('dayOfWeek'));opens=to_text(part.get('opens'));closes=to_text(part.get('closes'))
      if opens and closes:chunks.append((day+' ' if day else '')+opens+'-'+closes)
     hours=', '.join(chunks)
   if 0<len(hours)<=300:values['operating_hours']=hours
   if values:picks.append(values)
 return picks[0] if len(picks)==1 else {} # ambiguous matches => no proposal

def source_rows(venues):
 for v in venues:
  url=v.get('official_url')
  if secure_url(url):yield v,url

def collect(venues,loader=fetch):
 result=[];status=[]
 now=dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()
 for v in sorted(venues,key=lambda x:x.get('id','')):
  vid=v.get('id','');url=v.get('official_url','')
  if not secure_url(url):
   status.append({'id':vid,'name':v.get('name',''),'state':'missing_official_url'});continue
  try:
   page=loader(url)
   vals=extract(page,v)
   if not vals:
    status.append({'id':vid,'name':v['name'],'state':'no_matching_structured_data','url':url});continue
   n=0
   for field,newvalue in vals.items():
    before=str(v.get(field) or '').strip()
    if before==newvalue:continue
    # Don't auto propose replacing a manually set value; a human must research conflicts.
    if before:
     status.append({'id':vid,'name':v['name'],'state':'conflict_needs_manual_check','field':field,'url':url});continue
    result.append({'id':vid,'name':v['name'],'field':field,'value':newvalue,'source_url':url,'collected_at':now,'basis':'official_page_matching_jsonld','status':'needs_human_review'})
    n+=1
   status.append({'id':vid,'name':v['name'],'state':'suggestions_found' if n else 'no_new_empty_fields','url':url})
  except (ValueError,HTTPError,URLError,TimeoutError,ssl.SSLError,UnicodeError,OSError) as exc:
   status.append({'id':vid,'name':v.get('name',''),'state':'fetch_failed','message':str(exc)[:150],'url':url})
 return result,status

def from_supabase(url,key):
 from urllib.parse import urlencode
 path=url.rstrip('/')+'/rest/v1/pickgo_venues?'+urlencode({'select':'id,name,address,official_url,contact_phone,operating_hours,is_published','is_published':'eq.true','limit':'500'})
 if not secure_url(path):raise ValueError('Invalid API URL')
 headers={'apikey':key,'Accept':'application/json','User-Agent':UA}
 req=Request(path,headers=headers)
 with urlopen(req,timeout=20) as response:
  data=json.load(response)
 if not isinstance(data,list):raise ValueError('Unexpected API response')
 return data

def main():
 ap=argparse.ArgumentParser()
 ap.add_argument('--input',help='Offline JSON array of venues (local test only)')
 ap.add_argument('--output',default='venue_candidates.json')
 ap.add_argument('--status-output',default='venue_source_status.json')
 args=ap.parse_args()
 if args.input:
  venues=json.loads(Path(args.input).read_text(encoding='utf-8'))
 else:
  url=os.environ.get('SUPABASE_URL','')
  key=os.environ.get('SUPABASE_PUBLISHABLE_KEY','')
  if not secure_url(url) or not key:raise SystemExit('Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY')
  venues=from_supabase(url,key)
 cand,stats=collect(venues)
 # Preserve previously human-researched official-source proposals until an admin approves them.
 # A routine refresh must never erase a pending manually verified proposal.
 old_path=Path(args.output)
 current={str(v.get('id')):v for v in venues}
 if old_path.exists():
  try:
   previous=json.loads(old_path.read_text(encoding='utf-8'))
   seen={(v['id'],v['field']) for v in cand}
   for x in previous.get('candidates',[]):
    if x.get('basis')!='manual_verified_official_webpage':continue
    key=(x.get('id'),x.get('field'));row=current.get(x.get('id'))
    if key in seen or not row or str(row.get(x.get('field')) or '').strip():continue
    if x.get('source_url')!=row.get('official_url'):continue
    cand.append(x);seen.add(key)
  except (ValueError,TypeError,KeyError):pass
 cand.sort(key=lambda x:(x['id'],x['field']))
 for output,obj in [(args.output,{'schema_version':1,'candidates':cand}), (args.status_output,{'schema_version':1,'courts_checked':len(stats),'venues':stats})]:
  path=Path(output);path.parent.mkdir(parents=True,exist_ok=True)
  payload=json.dumps(obj,ensure_ascii=False,indent=2)+'\n'
  # Avoid commits for timestamp-only changes if suggestions themselves are unchanged.
  if path.exists():
   try:
    old=json.loads(path.read_text(encoding='utf-8'))
    if output==args.output:
     # Stable compare by meaningful candidate key/value: timestamp doesn't force deploy.
     simple=lambda a:[(v['id'],v['field'],v['value'],v['source_url']) for v in a.get('candidates',[])]
     if simple(old)==simple(obj):continue
    elif old==obj:continue
   except (ValueError,KeyError,TypeError):pass
  path.write_text(payload,encoding='utf-8')
 print(f'Checked {len(stats)} venues; {len(cand)} proposals; nothing automatically published')

if __name__=='__main__':main()

#!/usr/bin/env python3
"""Read official catalogs/public page metadata and authorized availability feeds.
Never call protected calendar endpoints or infer empty courts from business hours.
Standard library only. Credentials come exclusively from runner environment.
"""
import datetime as dt
import hashlib
from html.parser import HTMLParser
import ipaddress
import json
import os
import re
import socket
import sys
from urllib.parse import urlsplit, urljoin, urlencode, quote
from urllib.request import Request, build_opener, HTTPRedirectHandler

UTC=dt.timezone.utc
KST=dt.timezone(dt.timedelta(hours=9))
MAX_BYTES=2_000_000
UA='PICKGO-BookingInfo/2.3.1'

class SyncError(Exception):pass

def https_url(url):
 try:
  p=urlsplit(url)
  return bool(p.scheme=='https' and p.hostname and not p.username and not p.password and p.port in (None,443) and len(url)<=2000)
 except (ValueError,TypeError):return False

def public_host(host):
 try:
  results=socket.getaddrinfo(host,443,type=socket.SOCK_STREAM)
  return bool(results) and all(ipaddress.ip_address(r[4][0]).is_global for r in results)
 except (OSError,ValueError):return False

class NoRedirect(HTTPRedirectHandler):
 def redirect_request(self,*args,**kwargs):return None

def request(url,headers=None,body=None,redirect_hosts=(),seoul_http=False):
 """Bounded reads, public DNS only, redirects checked before credentials are sent."""
 for hop in range(5):
  p=urlsplit(url)
  if not (https_url(url) or (seoul_http and p.scheme=='http' and p.hostname=='openapi.seoul.go.kr' and p.port==8088)) or not public_host(p.hostname):raise SyncError('unsafe_endpoint')
  req=Request(url,headers={'User-Agent':UA,**(headers or {})},data=body)
  try:
   with build_opener(NoRedirect()).open(req,timeout=12) as response:
    raw=response.read(MAX_BYTES+1)
    if len(raw)>MAX_BYTES:raise SyncError('response_too_large')
    return raw,url
  except Exception as exc:
   if getattr(exc,'code',None) in (301,302,303,307,308):
    target=urljoin(url,exc.headers.get('Location',''));q=urlsplit(target)
    if headers or body or q.hostname not in redirect_hosts or not https_url(target):raise SyncError('redirect_blocked') from None
    url=target;continue
   if isinstance(exc,SyncError):raise
   raise SyncError('fetch_failed') from None
 raise SyncError('too_many_redirects')

def decode(raw):
 try:return json.loads(raw)
 except (ValueError,UnicodeError):raise SyncError('invalid_json') from None

def stamp(value):
 if not isinstance(value,str):raise SyncError('invalid_timestamp')
 try:
  parsed=dt.datetime.fromisoformat(value.replace('Z','+00:00'))
  if parsed.tzinfo is None:raise ValueError()
  return parsed.astimezone(UTC)
 except ValueError:raise SyncError('invalid_timestamp') from None

def slot_feed(payload,now):
 """Requires explicit complete window and fresh evidence, not a guessed provider schema."""
 if not isinstance(payload,dict) or type(payload.get('schema_version')) is not int or payload.get('schema_version')!=1 or payload.get('complete') is not True:raise SyncError('incomplete_snapshot')
 generated=stamp(payload.get('generated_at'));begin=stamp(payload.get('window_start'));end=stamp(payload.get('window_end'))
 if generated>now+dt.timedelta(seconds=30) or generated<now-dt.timedelta(minutes=5) or not begin<end or end-begin>dt.timedelta(days=31):raise SyncError('stale_snapshot')
 entries=payload.get('slots')
 if not isinstance(entries,list) or len(entries)>2000:raise SyncError('invalid_slots')
 result=[];ids=set();windows={}
 for entry in entries:
  if not isinstance(entry,dict):raise SyncError('invalid_slot')
  sid=entry.get('id');court=entry.get('court_label');state=entry.get('status');remaining=entry.get('remaining')
  if not isinstance(sid,str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,80}',sid) or sid in ids or not isinstance(court,str) or court!=court.strip() or not 1<=len(court)<=40 or state not in ('available','booked','blocked') or type(remaining) is not int or remaining<0 or remaining>10000 or (state=='available' and remaining<=0):raise SyncError('invalid_slot')
  a=stamp(entry.get('starts_at'));b=stamp(entry.get('ends_at'))
  if not begin<=a<b<=end or b-a>dt.timedelta(hours=8) or a.astimezone(KST).date()!=b.astimezone(KST).date():raise SyncError('invalid_slot_window')
  ids.add(sid)
  for x,y in windows.setdefault(court.casefold(),[]):
   if a<y and b>x:raise SyncError('overlapping_slots')
  windows[court.casefold()].append((a,b))
  if b>now:result.append({'external_id':sid,'court_label':court,'starts_at':a.isoformat(),'ends_at':b.isoformat(),'available':state=='available' and remaining>0})
 return {'schema_version':1,'complete':True,'generated_at':generated.isoformat(),'window_start':begin.isoformat(),'window_end':end.isoformat(),'slots':result}

SERVICE_STATES={'ì ìì¤','ì ìë§ê°','ìë´ì¤','ìì½ë§ê°','ìì½ë¶ê°','ìë¹ì¤ì¢ë£'}

def seoul_catalog(payload):
 data=payload.get('ListPublicReservationSport') if isinstance(payload,dict) else None
 if not isinstance(data,dict) or not isinstance(data.get('RESULT'),dict) or data['RESULT'].get('CODE')!='INFO-000' or not isinstance(data.get('row'),list):raise SyncError('catalog_unavailable')
 # V_MIN/V_MAX are operating hours. They are never converted to free slots.
 found={}
 for row in data['row']:
  if not isinstance(row,dict):raise SyncError('invalid_catalog')
  sid=row.get('SVCID');url=row.get('SVCURL','')
  if not isinstance(sid,str) or not re.fullmatch(r'S\d{18}',sid):continue
  state=row.get('SVCSTATNM','');found[sid]={'state':state if state in SERVICE_STATES else 'ìíë¯¸íì¸','url':url}
 return found

class PageInfo(HTMLParser):
 def __init__(self):super().__init__();self.heading=False;self.depth=0;self.heading_text=[];self.current='';self.blocked=False
 def handle_starttag(self,tag,attrs):
  values=dict(attrs)
  if tag=='h3':self.heading=True;self.current=''
  if tag=='script' and ('dynapath' in values.get('src','').lower() or values.get('src')=='/dynaPath.jsp'):self.blocked=True
 def handle_data(self,text):
  if self.heading:self.current+=text
 def handle_endtag(self,tag):
  if tag=='h3' and self.heading:self.heading_text.append(' '.join(self.current.split()));self.heading=False

def seoul_page(raw):
 parser=PageInfo()
 try:parser.feed(raw.decode('utf-8'))
 except UnicodeError:raise SyncError('invalid_page') from None
 if not any('í¼í´ë³¼' in text for text in parser.heading_text):raise SyncError('page_identity_unverified')
 states=[state for state in SERVICE_STATES if any(text.endswith(state) for text in parser.heading_text)]
 return {'state':'protected' if parser.blocked else 'catalog_only','service_status':states[0] if len(states)==1 else 'ìíë¯¸íì¸'}

def source_key(provider,identity):return hashlib.sha256((provider+':'+identity).encode()).hexdigest()

def discover(venues):
 sources=[];seen=set()
 for venue in venues:
  for field in ('booking_url','booking_url_weekend'):
   url=venue.get(field) or ''
   if not https_url(url):continue
   host=urlsplit(url).hostname
   if host=='yeyak.seoul.go.kr':
    match=re.search(r'(?:[?&])rsv_svc_id=(S\d{18})(?:&|$)',url)
    if not match:continue
    identity=match.group(1);provider='seoul_page'
   elif host in ('naver.me','booking.naver.com','m.booking.naver.com'):
    provider='naver_page';identity=url
   else:continue
   key=source_key(provider,identity)
   if (venue['id'],key) in seen:continue
   seen.add((venue['id'],key));sources.append({'venue_id':venue['id'],'key':key,'provider':provider,'url':url,'identity':identity})
 return sources

def rpc(base,key,name,args):
 raw,_=request(base+'/rest/v1/rpc/'+name,headers={'apikey':key,'Authorization':'Bearer '+key,'Content-Type':'application/json'},body=json.dumps(args).encode())
 return decode(raw)

def run():
 base=os.environ.get('SUPABASE_URL','').rstrip('/');secret=os.environ.get('SUPABASE_SERVICE_ROLE_KEY','')
 if not https_url(base) or not urlsplit(base).hostname.endswith('.supabase.co') or not secret:raise SyncError('server_secrets_missing')
 raw,_=request(base+'/rest/v1/pickgo_venues?select=id,name,booking_url,booking_url_weekend&is_published=eq.true&limit=500',headers={'apikey':secret,'Authorization':'Bearer '+secret})
 venues=decode(raw)
 if not isinstance(venues,list):raise SyncError('venues_unavailable')
 sources=discover(venues);now=dt.datetime.now(UTC);published=0;failed=0
 api_key=os.environ.get('SEOUL_OPEN_DATA_KEY','');catalog=None
 if api_key:
  if not re.fullmatch(r'[A-Za-z0-9]{10,100}',api_key):raise SyncError('invalid_seoul_key')
  try:
   # Official documented API transport. No login or user reservation data is sent.
   raw,_=request('http://openapi.seoul.go.kr:8088/'+quote(api_key,safe='')+'/json/ListPublicReservationSport/1/1000/',seoul_http=True);catalog=seoul_catalog(decode(raw))
  except SyncError:catalog=None
 for source in sources:
  state='failed';service='ìíë¯¸íì¸'
  try:
   if source['provider']=='seoul_page':
    if catalog is not None and source['identity'] in catalog:
     state='catalog_only';service=catalog[source['identity']]['state']
    else:
     raw,_=request(source['url']);info=seoul_page(raw);state=info['state'];service=info['service_status']
   else:
    # Read ordinary public page only. No session, login, CAPTCHA or internal API.
    raw,final=request(source['url'],redirect_hosts=('naver.me','map.naver.com','m.booking.naver.com','booking.naver.com'))
    state='link_only' if urlsplit(final).hostname=='map.naver.com' else 'requires_partner_api'
  except SyncError:failed+=1
  try:
   rpc(base,secret,'pickgo_publish_booking_sync',{'p_venue':source['venue_id'],'p_key':source['key'],'p_provider':source['provider'],'p_url':source['url'],'p_state':state,'p_service_status':service,'p_observed_at':now.isoformat(),'p_snapshot':None});published+=1
  except SyncError:failed+=1
 # Optional authorized feeds. URLs are configured once, not per time slot.
 try:feeds=json.loads(os.environ.get('PICKGO_AUTHORIZED_FEEDS_JSON','[]'))
 except ValueError:raise SyncError('invalid_feed_configuration') from None
 if not isinstance(feeds,list) or len(feeds)>20:raise SyncError('invalid_feed_configuration')
 known={v['id'] for v in venues}
 for feed in feeds:
  if not isinstance(feed,dict) or feed.get('venue_id') not in known or feed.get('authorized') is not True or not https_url(feed.get('url','')) or not https_url(feed.get('booking_url','')):raise SyncError('invalid_feed_configuration')
  identity=feed.get('id')
  if not isinstance(identity,str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,60}',identity):raise SyncError('invalid_feed_configuration')
  key=source_key('partner_feed',identity);observed=dt.datetime.now(UTC);snapshot=None;state='failed'
  try:
   token_name=feed.get('token_env','');headers=None
   if token_name:
    if not re.fullmatch(r'PICKGO_FEED_TOKEN_[A-Z0-9_]+',token_name) or not os.environ.get(token_name):raise SyncError('feed_token_missing')
    headers={'Authorization':'Bearer '+os.environ[token_name]}
   raw,_=request(feed['url'],headers=headers);snapshot=slot_feed(decode(raw),observed);state='slots_ok'
  except SyncError:failed+=1
  args={'p_venue':feed['venue_id'],'p_key':key,'p_provider':'partner_feed','p_url':feed['booking_url'],'p_state':state,'p_service_status':'ìíë¯¸íì¸','p_observed_at':observed.isoformat(),'p_snapshot':snapshot}
  try:
   rpc(base,secret,'pickgo_publish_booking_sync',args);published+=1
  except SyncError:
   failed+=1;args.update(p_state='failed',p_snapshot=None)
   try:rpc(base,secret,'pickgo_publish_booking_sync',args)
   except SyncError:pass
 print(json.dumps({'sources_checked':published,'fetch_failures':failed,'seoul_api_configured':bool(api_key),'authorized_feeds':len(feeds)}))
 return 1 if failed else 0

if __name__=='__main__':
 try:sys.exit(run())
 except Exception as exc:
  # Never print remote exception text: it may contain an API key or endpoint token.
  print(json.dumps({'error':str(exc) if isinstance(exc,SyncError) else 'sync_failed'}));sys.exit(1)

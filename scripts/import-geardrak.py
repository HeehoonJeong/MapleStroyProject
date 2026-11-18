"""Import Geardrak map images and metadata from the referenced article."""
import hashlib, json, os, ssl, urllib.request
from html.parser import HTMLParser
from urllib.parse import urlparse

article='https://matsu1207.tistory.com/1119'
ctx=ssl.create_default_context(cafile='/etc/ssl/cert.pem')
class Images(HTMLParser):
    def __init__(self): super().__init__(); self.urls=[]
    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs)
        src=attrs.get('src','')
        if tag=='img' and urlparse(src).hostname=='blog.kakaocdn.net' and attrs.get('data-filename')=='blob': self.urls.append(src)
parser=Images()
with urllib.request.urlopen(urllib.request.Request(article,headers={'User-Agent':'Mozilla/5.0'}),context=ctx,timeout=25) as response: parser.feed(response.read().decode('utf-8'))
rows=[]
for name,level in [('지하 1층',295),('지하 2층 1구역',295),('지하 2층 2구역',295),('지하 3층 1구역',296),('지하 3층 2구역',296),('지하 4층',296)]: rows.append((name,740,level,'순찰형 경비 로봇' if level==295 else '공격형 경비 로봇'))
for i in range(1,9): rows.append((f'로봇 창고 {i}',770,297 if i<=4 else 298,'일반형 병기 로봇' if i<=4 else '강화형 병기 로봇'))
for i in range(1,9): rows.append((f'고브의 작업실 {i}',810,299,'크로노스의 잔재' if i<=4 else '크로노스의 원념'))
if len(parser.urls)!=len(rows): raise SystemExit(f'Expected {len(rows)} map images, found {len(parser.urls)}; no changes made')
base=os.environ['SUPABASE_URL'].rstrip('/');key=os.environ['SUPABASE_SERVICE_ROLE_KEY'];headers={'apikey':key,'Authorization':'Bearer '+key};records=[]
for (name,symbol,level,mob),url in zip(rows,parser.urls):
    with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),context=ctx,timeout=30) as response: image=response.read()
    if not image.startswith(b'\x89PNG\r\n\x1a\n'): raise SystemExit(f'Invalid image: {name}')
    map_id=hashlib.sha256(('기어드락\0'+name).encode()).hexdigest()[:20]
    request=urllib.request.Request(f'{base}/storage/v1/object/hunting-images/map-{map_id}.png',data=image,headers={**headers,'Content-Type':'image/png','x-upsert':'true'},method='POST')
    with urllib.request.urlopen(request,context=ctx,timeout=30) as response:
        if response.status not in (200,201): raise SystemExit(f'Image upload failed: {name}')
    records.append({'id':map_id,'region':'기어드락','name':name,'symbol':symbol,'mobs':[{'name':mob,'level':level,'exp':None,'meso':None,'count':40,'image_id':'','image_available':False}],'image_available':True})
    print(f'Uploaded {len(records)}/{len(rows)}',flush=True)
request=urllib.request.Request(base+'/rest/v1/maple_hunting_maps?on_conflict=id',data=json.dumps(records,ensure_ascii=False).encode(),headers={**headers,'Content-Type':'application/json','Prefer':'resolution=merge-duplicates,return=minimal'},method='POST')
with urllib.request.urlopen(request,context=ctx,timeout=30) as response: print('Map records:',len(records),'HTTP',response.status)

"""Upload the local hunting prototype to Supabase. Requires server credentials in the environment."""
import concurrent.futures, hashlib, json, os, sqlite3, urllib.error, urllib.request
from pathlib import Path

base = os.environ['SUPABASE_URL'].rstrip('/')
key = os.environ['SUPABASE_SERVICE_ROLE_KEY']
db = sqlite3.connect(Path(__file__).resolve().parents[1] / 'frontend/.local/hunting.sqlite3')
headers = {'apikey': key, 'Authorization': 'Bearer ' + key}
images = db.execute("select id, data from hunting_images where id like 'map-%' or id like 'mob-%'").fetchall()
def upload(row):
    id, data = row
    req = urllib.request.Request(base + '/storage/v1/object/hunting-images/' + id + '.png', data=data, headers={**headers, 'Content-Type': 'image/png', 'x-upsert': 'true'}, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=40) as response:
            return id, response.status in (200, 201)
    except (urllib.error.URLError, TimeoutError): return id, False
success=set(); failed=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    for i, (id, ok) in enumerate(pool.map(upload, images), 1):
        if ok: success.add(id)
        else: failed.append(id)
        if i % 100 == 0: print(f'Uploaded {i}/{len(images)} images', flush=True)
if failed:
    print(f'Image uploads failed: {len(failed)}; stopping before map data update.', flush=True)
    raise SystemExit(1)
records=[]
for id, region, name, symbol, raw_mobs in db.execute('select id, region, name, symbol, mobs from hunting_maps'):
    mobs=json.loads(raw_mobs)
    for mob in mobs:
        mob['image_id']='mob-'+hashlib.sha256((region+'\0'+mob['name']).encode()).hexdigest()[:20]
        mob['image_available']=mob['image_id'] in success
    records.append({'id':id,'region':region,'name':name,'symbol':symbol,'mobs':mobs,'image_available':'map-'+id in success})
for i in range(0,len(records),100):
    req=urllib.request.Request(base+'/rest/v1/maple_hunting_maps?on_conflict=id',data=json.dumps(records[i:i+100],ensure_ascii=False).encode(),headers={**headers,'Content-Type':'application/json','Prefer':'resolution=merge-duplicates,return=minimal'},method='POST')
    with urllib.request.urlopen(req,timeout=40) as response:
        if response.status not in (200,201,204): raise RuntimeError('Map upload failed')
print(f'Completed: {len(records)} maps, {len(success)} images',flush=True)

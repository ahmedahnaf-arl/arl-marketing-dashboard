"""Cloud rebuild script — runs on GitHub Actions, queries DWH, generates dashboard, deploys to Netlify."""
import json, os, pymssql, requests, zipfile, io, datetime, subprocess, sys, shutil
from collections import defaultdict

TMP = '/tmp/opencode'
os.makedirs(TMP, exist_ok=True)

def log(msg):
    print(f'[{datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")}] {msg}')

log('=== Cloud Daily Rebuild Started ===')

# Step 1: Query DWH
log('Step 1: Querying DWH...')
conn = pymssql.connect(
    server=os.environ['DWH_SERVER'], port=1433,
    user=os.environ['DWH_USER'], password=os.environ['DWH_PASSWORD'],
    database='DWH', timeout=30, login_timeout=15
)
cur = conn.cursor()

# Marketing spend
cur.execute("""
    SELECT intSBUId, MONTH(dteTransactionDate) as Mo, strSubGLName,
           CASE WHEN strSubGLName LIKE '%Advertisement%' OR strSubGLName LIKE '%Publicity%' THEN 'ATL'
                WHEN strSubGLName LIKE '%Commission%' OR strSubGLName LIKE '%Discount%' THEN 'Trade_Commission'
                WHEN strSubGLName LIKE '%Entertainment%' OR strSubGLName LIKE '%Donation%' OR strSubGLName LIKE '%Training%' OR strSubGLName LIKE '%Printing%' OR strSubGLName LIKE '%Postage%' OR strSubGLName LIKE '%Others%' THEN 'BTL'
                ELSE 'Operational' END as Category,
           SUM(ABS(numAmount))/10000000.0 AS Amount_Cr
    FROM fin.tblAccountingJournalArc
    WHERE strGeneralLedgerCode='4210001' AND numAmount>0 AND isActive=1
    AND dteTransactionDate >= '2026-07-01'
    GROUP BY intSBUId, MONTH(dteTransactionDate), strSubGLName
""")
rows = [{'sbu':r[0],'month':r[1],'subgl':r[2],'cat':r[3],'amt':float(r[4])} for r in cur.fetchall()]
with open(f'{TMP}/marketing_corrected.json','w') as f: json.dump(rows,f)
log(f'  Marketing: {len(rows)} entries')

# Revenue
cur.execute("""
    SELECT intSBUId, SUM(ABS(numAmount))/10000000.0 as Rev
    FROM fin.tblAccountingJournalArc
    WHERE strGeneralLedgerCode='3010001' AND numAmount<0 AND isActive=1
    AND dteTransactionDate >= '2026-07-01'
    GROUP BY intSBUId
""")
rev_rows = [{'sbu':r[0],'rev':float(r[1])} for r in cur.fetchall()]
with open(f'{TMP}/rev_fixed.json','w') as f: json.dump(rev_rows,f)
log(f'  Revenue: {len(rev_rows)} entries')

# POs
cur.execute("""
    SELECT h.strPurchaseOrderNo, h.dtePurchaseOrderDate, h.strBusinessPartnerName,
           h.numTotalAmount/1e7, h.numReceiveQty/1e7, h.isClosed, h.intSBUId, h.intBusinessUnitId,
           r.strItemName, r.numOrderQty, r.numFinalPrice, r.numTotalValue/1e7, r.numReceiveQty
    FROM pro.tblPurchaseOrderHeaderArc h
    JOIN pro.tblPurchaseOrderRowArc r ON h.intPurchaseOrderId=r.intPurchaseOrderId
    WHERE h.intGeneralLedgerId=95 AND r.isActive=1
    AND h.dtePurchaseOrderDate >= '2026-07-01'
    ORDER BY h.numTotalAmount DESC
""")
po_rows = cur.fetchall()
pos = {}
for r in po_rows:
    pono = r[0]
    if pono not in pos:
        pos[pono] = {'po':pono,'date':str(r[1])[:10] if r[1] else '','vendor':r[2] or '','total':float(r[3] or 0),'received':float(r[4] or 0),'closed':bool(r[5]),'sbu':int(r[6] or 0),'bu':int(r[7] or 0),'items':[]}
    pos[pono]['items'].append({'item':r[8] or '','qty':float(r[9] or 0),'price':float(r[10] or 0),'value':float(r[11] or 0),'recv':float(r[12] or 0)})
po_list = sorted(pos.values(), key=lambda x: x['total'], reverse=True)
with open(f'{TMP}/marketing_po.json','w') as f: json.dump(po_list,f)
log(f'  POs: {len(po_list)}')
conn.close()

# Step 2: Run budget + metrics processor
log('Step 2: Processing metrics...')
if os.path.exists('rebuild_v2.py'):
    shutil.copy('rebuild_v2.py', f'{TMP}/rebuild_v2.py')
    result = subprocess.run([sys.executable, f'{TMP}/rebuild_v2.py'], capture_output=True, text=True, cwd=TMP)
    log(f'  {result.stdout.strip().split(chr(10))[0] if result.stdout else "Done"}')
else:
    log('  WARNING: rebuild_v2.py not found')

# Step 3: Generate HTML
log('Step 3: Generating HTML...')
if os.path.exists('build_dashboard.py'):
    shutil.copy('build_dashboard.py', f'{TMP}/build_dashboard.py')
    result = subprocess.run([sys.executable, f'{TMP}/build_dashboard.py'], capture_output=True, text=True, cwd=TMP)
    log(f'  {result.stdout.strip().split(chr(10))[0] if result.stdout else "Done"}')
else:
    log('  WARNING: build_dashboard.py not found')

# Step 4: Find the generated HTML
html_file = None
for path in [f'{TMP}/../Marketing_Campaign_Portal_FY26-27.html',
             '/tmp/Marketing_Campaign_Portal_FY26-27.html',
             '/home/runner/Marketing_Campaign_Portal_FY26-27.html']:
    if os.path.exists(path):
        html_file = path
        break
# Also check where build_dashboard.py writes it
if not html_file:
    import glob
    matches = glob.glob('/tmp/**/Marketing_Campaign_Portal*.html', recursive=True)
    if matches: html_file = matches[0]

# Step 5: Deploy to Netlify
if html_file and os.path.exists(html_file):
    log(f'Step 5: Deploying {html_file} ({os.path.getsize(html_file)} bytes)...')
    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        zf.write(html_file, 'index.html')
    zip_buf.seek(0)
    
    token = os.environ['NETLIFY_TOKEN']
    site_id = os.environ['NETLIFY_SITE_ID']
    headers = {'Authorization': f'Bearer {token}'}
    
    resp = requests.post(f'https://api.netlify.com/api/v1/sites/{site_id}/deploys', headers=headers, data=zip_buf.read(), timeout=60)
    if resp.status_code in [200,201]:
        deploy_id = resp.json().get('id')
        requests.post(f'https://api.netlify.com/api/v1/sites/{site_id}/deploys/{deploy_id}/restore', headers=headers, timeout=30)
        log(f'  Published: https://arl-marketing-command-center.netlify.app')
    else:
        log(f'  Deploy failed: {resp.status_code} {resp.text[:200]}')
else:
    log(f'  ERROR: HTML file not found. Checked paths.')

log('=== Cloud Rebuild Complete ===')

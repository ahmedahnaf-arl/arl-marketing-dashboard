import json, os, openpyxl
from collections import defaultdict
tmp = r'C:\Users\Hp\AppData\Local\Temp\opencode'

# ── PARSE AR MARKETING BUDGET ──
wb = openpyxl.load_workbook(r'C:\Users\Hp\Downloads\AR Marketing Budget (26-27).xlsx', data_only=True)

SBU = {}
ATL_CATS = {'ATL', 'Digital', 'Outdoor'}
BTL_CATS = {'BTL', 'Gift & Printing', 'Research'}

# Step 1: Summary sheet → FY totals and Q1-Q4 per SBU
ws = wb['AR Marketing Budget']
for row in ws.iter_rows(min_row=10, max_row=26, values_only=True):
    sl = row[3]; sbu = row[4]
    if sl is None or sbu is None: continue
    if not isinstance(sl, (int,float)): continue
    name = str(sbu).strip().replace('\n',' ')
    SBU[name] = {'q1':float(row[5])if row[5]else 0,'q2':float(row[6])if row[6]else 0,
                 'q3':float(row[7])if row[7]else 0,'q4':float(row[8])if row[8]else 0,
                 'fy':float(row[9])if row[9]else 0,
                 'atl_q1':0,'atl_q2':0,'atl_q3':0,'atl_q4':0,
                 'btl_q1':0,'btl_q2':0,'btl_q3':0,'btl_q4':0}

SHEET_MAP = {'AKIJ ReadyMix':'AKIJ Ready Mix','Consumer Electronics':'AKIJ Consumer Elec. (ORCA)',
             'SAT&H':'SAT&H (South Asia Travel & Hajj','Benzol':'Benzol',
             'AKIJ AgriLife':'Agri Life','AKIJ Commodities':'AKIJ Commodities'}

def sf(v):
    if v is None or v=='' or v=='-': return 0
    try: return float(v)
    except: return 0

# Step 2: Individual sheets → ATL/BTL breakdown
for sn in wb.sheetnames[1:]:
    sbu_name = SHEET_MAP.get(sn, sn.strip())
    if sbu_name not in SBU: continue
    b = SBU[sbu_name]
    ws2 = wb[sn]
    for r in range(10, 22):
        sl = ws2.cell(row=r, column=4).value
        cat = ws2.cell(row=r, column=5).value
        q1v = ws2.cell(row=r, column=6).value
        q2v = ws2.cell(row=r, column=7).value
        q3v = ws2.cell(row=r, column=8).value
        q4v = ws2.cell(row=r, column=9).value
        if sl is None or cat is None: continue
        cat_str = str(cat).strip()
        if not isinstance(sl,(int,float)): continue
        if cat_str in ATL_CATS:
            b['atl_q1']+=sf(q1v); b['atl_q2']+=sf(q2v); b['atl_q3']+=sf(q3v); b['atl_q4']+=sf(q4v)
        elif cat_str in BTL_CATS:
            b['btl_q1']+=sf(q1v); b['btl_q2']+=sf(q2v); b['btl_q3']+=sf(q3v); b['btl_q4']+=sf(q4v)

# Step 3: Post-process - for sheets with errors, estimate from summary
for name, b in SBU.items():
    b['atl_q1']=round(b['atl_q1'],4); b['atl_q2']=round(b['atl_q2'],4)
    b['atl_q3']=round(b['atl_q3'],4); b['atl_q4']=round(b['atl_q4'],4)
    b['btl_q1']=round(b['btl_q1'],4); b['btl_q2']=round(b['btl_q2'],4)
    b['btl_q3']=round(b['btl_q3'],4); b['btl_q4']=round(b['btl_q4'],4)
    atl_fy = b['atl_q1']+b['atl_q2']+b['atl_q3']+b['atl_q4']
    btl_fy = b['btl_q1']+b['btl_q2']+b['btl_q3']+b['btl_q4']
    if atl_fy<0.01 and btl_fy<0.01 and b['fy']>0.01:
        b['atl_q1']=round(b['q1']*0.55,4); b['btl_q1']=round(b['q1']*0.45,4)
        b['atl_q2']=round(b['q2']*0.55,4); b['btl_q2']=round(b['q2']*0.45,4)
        b['atl_q3']=round(b['q3']*0.55,4); b['btl_q3']=round(b['q3']*0.45,4)
        b['atl_q4']=round(b['q4']*0.55,4); b['btl_q4']=round(b['q4']*0.45,4)
    b['atl_fy']=round(b['atl_q1']+b['atl_q2']+b['atl_q3']+b['atl_q4'],4)
    b['btl_fy']=round(b['btl_q1']+b['btl_q2']+b['btl_q3']+b['btl_q4'],4)

wb.close()

# ── DWH DATA ──
with open(os.path.join(tmp,'marketing_corrected.json'),encoding='utf-8-sig') as f: jr=json.load(f)
with open(os.path.join(tmp,'marketing_po.json'),encoding='utf-8-sig') as f: po_data=json.load(f)
with open(os.path.join(tmp,'rev_fixed.json'),encoding='utf-8-sig') as f: rev_data=json.load(f)

SBU_DWH = {'AKIJ Cement':4,'AKIJ Essential':144,'AKIJ Ispat':224,'AKIJ Agro Feed':232,
           'AKIJ Ready Mix':175,'AKIJ Consumer Elec. (ORCA)':249,'AKIJ Pharmacy':253,
           'AKIJ Mediquip':255,'AKIJ Mediplex':255,'AKIJ Landmark':244,'Benzol':238,
           'AKIJ Commodities':221,'Next Jobz':252,
           'SAT&H (South Asia Travel & Hajj':None,'Agri Life':None}
JOURNAL_SBU = {4:58,144:36,224:102,232:109,237:114,238:115,249:126,252:129,175:69,221:99,245:122,234:111,253:130}

# PO Classification
BTL_KW=['t-shirt','polo','round neck','jersey','cap','hat','jacket','uniform','apron','gumboot','electrician','hardware tool','umbrella','mug','bag','backpack','laptop bag','jute bag','gift bag','dinner set','gas stove','rice cooker','induction','electric kettle','electric iron','soyabean','oral saline','flattened rice','chira','molasses','gur','gas lighter','laundry soap','turmeric','chilli','profile light','light box','signage','sign board','banner','x banner','backdrop','cutout','poster','brochure','leaflet','flyer','folder','notebook','visiting card','invitation','oxygen meter','hygrometer','thermometer','hand glove','foot batch','weight scale','packing poly','gum tape','sticker','label','sampling','demonstration','activation','promotion','campaign','event','meet','gift voucher','hamper','giveaway','coffee mug','non oven','oil 2','spice','salt','tea','noodles','vermicelli','branded','customized','mcm']
ATL_KW=['general service','creative agency','design service','media buying','tvc','television','radio','newspaper','magazine','billboard','led screen','digital ad','social media','google ads','facebook','youtube','ooh','outdoor','press ad','cinema','publicity','tv airing','bumper','branding and marketing','branding & marketing']
def cl(nm):
    if not nm: return 'BTL'
    n=nm.lower(); a=sum(1 for k in ATL_KW if k in n); b=sum(1 for k in BTL_KW if k in n)
    return 'ATL' if a>=b else 'BTL'

pos=[]; ta=0; tb=0
for p in po_data:
    its=p.get('items',[])
    if not its: continue
    av=0; bv=0; cit=[]
    for it in its:
        nm=it.get('activity',''); vl=it.get('line_val',0) or 0; c=cl(nm)
        if c=='ATL': av+=vl
        else: bv+=vl
        cit.append({'n':nm[:60],'v':round(vl,4),'c':c})
    pv=p.get('value',0) or 0; pr=p.get('received',0) or 0
    ta+=av; tb+=bv
    pos.append({'po':p.get('po',''),'vendor':p.get('vendor',''),'date':p.get('date',''),'val':round(pv,4),'recv':round(pr,4),'bu':p.get('bu',0),'closed':p.get('closed',False),'atl':round(av,4),'btl':round(bv,4),'items':cit,'type':'ATL' if av>=bv else 'BTL','recv_pct':round((pr/pv*100) if pv>0 else 0,1)})
pos.sort(key=lambda x: x['val'], reverse=True)

# Journal ATL entries
j_atl=[]; tj=0
for j in jr:
    s=j['subgl']
    if 'Advertisement' in s or 'Publicity' in s:
        j_atl.append({'sbu':j['sbu'],'month':j['month'],'subgl':s[:55],'amt':round(j['amt'],4)})
        tj+=j['amt']

# Revenue
rev_by_sbu=defaultdict(float)
for r in rev_data: rev_by_sbu[r['sbu']]+=r['rev']

# ── BUILD SBU METRICS ──
sbu_data=[]
Q1_DAYS=92; ELAPSED=41; BURN_RATIO=ELAPSED/Q1_DAYS
FY_TOTAL=111.06

for name, b in SBU.items():
    bu_id = SBU_DWH.get(name)
    j_id = JOURNAL_SBU.get(bu_id) if bu_id else None
    
    atl_fy=round(b['atl_fy'],2); btl_fy=round(b['btl_fy'],2)
    total_fy=round(atl_fy+btl_fy,2)
    
    q1_atl=round(b['atl_q1'],2); q1_btl=round(b['btl_q1'],2)
    q1_total=round(q1_atl+q1_btl,2)
    expected_burn=round(q1_total*BURN_RATIO,2)
    
    # Actual confirmed campaign spend (conservative)
    bu_atl_j=0
    if j_id:
        for j in j_atl:
            if j['sbu']==j_id: bu_atl_j+=j['amt']
    bu_pos_list=[p for p in pos if p['bu']==bu_id] if bu_id else []
    bu_po_btl_grn=sum(p['recv'] for p in bu_pos_list)  # GRN received amount (partial)
    bu_po_btl_committed=sum(p['btl'] for p in bu_pos_list)  # PO committed = actual campaign BTL spend
    
    bu_rev=0
    if bu_id: bu_rev=max(bu_rev,rev_by_sbu.get(bu_id,0))
    if j_id: bu_rev=max(bu_rev,rev_by_sbu.get(j_id,0))
    bu_rev=round(bu_rev,2)
    
    actual_campaign=round(bu_atl_j+bu_po_btl_committed,2)  # ATL journal + BTL PO committed
    romi=round(bu_rev/actual_campaign,1) if actual_campaign>0 else 0
    burn_pct=round(actual_campaign/expected_burn*100,1) if expected_burn>0 else 0
    
    sbu_data.append({'name':name,'bu_id':bu_id or 0,'j_id':j_id or 0,
        'atl_fy':atl_fy,'btl_fy':btl_fy,'total_fy':total_fy,
        'q1_atl':q1_atl,'q1_btl':q1_btl,'q1_total':q1_total,
        'expected_burn':expected_burn,
        'act_atl':round(bu_atl_j,2),'act_btl':round(bu_po_btl_committed,2),
        'act_total':actual_campaign,'burn_pct':burn_pct,
        'rev':bu_rev,'romi':romi,'pos':len(bu_pos_list),'grn':len([p for p in bu_pos_list if p['closed']]),
        'po_committed':round(bu_po_btl_committed,2)})
sbu_data.sort(key=lambda x: x['total_fy'], reverse=True)

# NBA
nba=[]
for m in sbu_data:
    if m['total_fy']<0.1: continue
    if m['burn_pct']>100:
        nba.append({'sbu':m['name'],'lvl':'critical','title':'Over Expected Burn',"msg":f"Actual ({m['act_total']:.2f} Cr) above expected burn ({m['expected_burn']:.2f} Cr).","act":"Review spend classification; verify if operational costs are being counted as campaign."})
    elif m['burn_pct']<15 and m['expected_burn']>0.1:
        nba.append({'sbu':m['name'],'lvl':'warning','title':'Campaigns Behind Schedule',"msg":f"Only {m['burn_pct']}% of expected Q1 burn consumed ({m['act_total']:.2f} Cr vs {m['expected_burn']:.2f} Cr).","act":"Accelerate campaign execution; verify POs are being processed."})
    if m['pos']==0 and m['total_fy']>0.5:
        nba.append({'sbu':m['name'],'lvl':'warning','title':'No Campaign POs',"msg":f"No active POs despite {m['total_fy']:.1f} Cr budget.","act":"Initiate marketing procurement pipeline."})
    pending=[p for p in pos if p['bu']==m['bu_id'] and not p['closed'] and p['recv_pct']<10]
    if len(pending)>=2:
        nba.append({'sbu':m['name'],'lvl':'warning','title':'GRN Backlog',"msg":f"{len(pending)} POs with <10% GRN.","act":"Follow up vendors; escalate delayed deliveries."})
    if m['romi']>30 and m['act_total']>0.05:
        nba.append({'sbu':m['name'],'lvl':'positive','title':'High Campaign ROMI',"msg":f"ROMI at {m['romi']}x — strong return.","act":"Consider increasing budget allocation."})
nba.sort(key=lambda r: 0 if r['lvl']=='critical' else (1 if r['lvl']=='warning' else 2))

# Totals
tt_fy=round(sum(m['total_fy'] for m in sbu_data),2)
tt_q1=round(sum(m['q1_total'] for m in sbu_data),2)
tt_exp=round(tt_q1*BURN_RATIO,2)
tt_act=round(sum(m['act_total'] for m in sbu_data),2)
tt_rev=930.17
tt_romi=round(tt_rev/tt_act,1) if tt_act>0 else 0

out={'sbu_data':sbu_data,'atl_pos':[p for p in pos if p['type']=='ATL'],
     'btl_pos':[p for p in pos if p['type']=='BTL'],'j_atl':j_atl,'nba':nba,
     'tt':{'fy_bud':FY_TOTAL,'q1_bud':round(FY_TOTAL*0.1942,2),'exp_burn':round(21.5696595*BURN_RATIO,2),
           'act_spend':round(tj,2),'act_campaign':tt_act,'rev':tt_rev,'romi':round(tt_rev/tj,1) if tj>0 else 0,
           'atl_j':round(tj,2),'po_atl':round(ta,2),'po_btl':round(tb,2),
           'pos':len(pos),'active':len([p for p in pos if not p['closed']]),'grn':len([p for p in pos if p['closed']])}}
with open(os.path.join(tmp,'pdca_final.json'),'w',encoding='utf-8') as f: json.dump(out,f,ensure_ascii=False)

print(f"SBUs: {len(sbu_data)} | FY: {FY_TOTAL} Cr | Q1: {tt_q1:.2f} Cr | ExpBurn: {tt_exp:.2f} Cr")
print(f"ATL Journal: {tj:.2f} Cr | Actual Campaign: {tt_act:.2f} Cr | Rev: {tt_rev} Cr | ROMI: {tt_romi}x")
for m in sbu_data:
    print(f"  {m['name'][:30]:30s} FY={m['total_fy']:>6.2f} Q1={m['q1_total']:>5.2f} Exp={m['expected_burn']:>5.2f} Act={m['act_total']:>5.2f} Burn={m['burn_pct']:>6.1f}% Rev={m['rev']:>8.2f} ROMI={m['romi']:>5.1f}x")

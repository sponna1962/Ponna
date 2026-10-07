#!/usr/bin/env python3
"""Builds backend/src/modules/ask-ponna/g4-knowledge.json — the searchable
knowledge base behind Ask PONNA's search_group4_notification tool.

Sources: the guide JSON (frontend/src/content/g4-notification.json, already
row-structured), the official notification PDF text (pdftotext), and a
hand-checked transcription of the age tables (age.txt), which are images in
the guide. Usage:
  build-g4-knowledge.py <guide.json> <notification.txt(pdftotext -layout)> <age.txt> <out.json>
"""
import json, re, sys
from html.parser import HTMLParser

guide_json, pdf_txt, age_txt, out = sys.argv[1:5]
PAGE = '/tnpsc-group-4/notification-2026'

class P(HTMLParser):
    def __init__(s):
        super().__init__(); s.out=[]; s.row=None; s.cell=None; s.rows=[]; s.intable=False
    def _w(s,x):
        (s.cell if s.cell is not None else s.out).append(x)
    def handle_starttag(s,t,a):
        if t in('img','figure'): return
        if t=='table': s.intable=True; s.rows=[]
        elif t=='tr': s.row=[]
        elif t in('td','th'): s.cell=[]
        elif t=='br': s._w('\n')
        elif t in('p','div','li','h1','h2','h3','h4','ul','ol') and not s.intable: s._w('\n')
        if t=='li' and not s.intable: s._w('• ')
    def handle_endtag(s,t):
        if t in('td','th') and s.cell is not None:
            s.row.append(re.sub(r'\s+',' ',''.join(s.cell)).strip()); s.cell=None
        elif t=='tr' and s.row is not None: s.rows.append(s.row); s.row=None
        elif t=='table':
            s.intable=False
            if s.rows:
                h=s.rows[0]
                for r in s.rows[1:]:
                    s._w('\n• '+('; '.join(f'{a}: {b}' for a,b in zip(h,r) if b) if len(h)==len(r) and len(h)>1 else ' | '.join(r)))
                if len(s.rows)==1: s._w('\n'+' | '.join(s.rows[0]))
            s.rows=[]; s._w('\n')
        elif t in('p','div','li','h1','h2','h3','h4') and not s.intable: s._w('\n')
    def handle_data(s,x): s._w(x)

def conv(h):
    p=P(); p.feed(h); t=''.join(p.out)
    t=re.sub(r'[ \t]+',' ',t); t=re.sub(r'\n\s*\n+','\n',t).strip()
    # drop the "image page" captions left by the guide's page images
    t=re.sub(r'(?:[^\n]*— அறிவிப்பு பக்கம் \d+)+','',t)
    return t.strip()

# English search keywords per guide section (the guide titles are Tamil; the
# notification and most search terms are English). Used for title matching.
KW={'dates':'important dates schedule last date notification application exam date correction window','warning':'warning cautions agents false claims','posts':'posts vacancies vacancy 46 posts 6574 post code pay level salary','qual':'educational qualification technical qualification degree sslc eligibility post wise','age':'age limit age concession maximum minimum age community bc mbc sc st ex-servicemen widow pwbd','medical':'medical physical standards','tamil':'knowledge in tamil tamil eligibility','pbd':'persons with benchmark disability pwbd disability','dw':'destitute widow','community':'community reservation sc st bc mbc scheduled castes backward classes certificate','women':'women transgender reservation','sports':'sportsperson sports quota','ex':'ex-servicemen ex servicemen defence','exam':'scheme of examination plan of examination pattern marks questions duration','syllabus':'syllabus general studies aptitude tamil eligibility test','ranking':'ranking procedure rank list','priority':'priority typist steno typist shorthand typewriting','otr':'one time registration otr aadhaar','apply':'how to apply online application steps','photo':'photograph signature upload size dpi','fee':'examination fee payment exemption free chances','centres':'examination centres district centre list','examday':'exam day hall ticket memorandum of admission reporting time','banned':'banned items mobile phone calculator smart watch','omr':'omr answer sheet objective type instructions','scribe':'scribe compensatory time','penalty':'penalty debarment malpractice','cases':'criminal cases disciplinary cases','cert':'certificates documents verification','pstm':'person studied in tamil medium pstm','postexam':'answer key challenge certificate verification counselling','annexures':'annexure forms','lists':'annexure lists certificates','contact':'contact helpdesk phone email','eligibility':'eligibility summary','checklist':'checklist','process':'selection process steps','source':'source pages','conclusion':'summary'}
chunks=[]
for s in json.load(open(guide_json))['sections']:
    text=conv(s['html'])
    if s['id']=='age': text=open(age_txt).read().strip()
    chunks.append({'id':'guide:'+s['id'],'kind':'guide','title':re.sub(r'^\d+\.\s*','',s['title']),'kw':KW.get(s['id'],''),'text':text,'url':f'{PAGE}#{s["id"]}'})

# page -> guide section anchor (for links on raw-PDF-page chunks)
ANCHOR=[(1,'dates'),(2,'warning'),(15,'medical'),(16,'pbd'),(17,'exam'),(21,'priority'),(23,'otr'),(24,'apply'),(25,'centres'),(28,'fee'),(31,'cases'),
        (33,'ex'),(36,'pbd'),(46,'dw'),(47,'pstm'),(51,'community'),(53,'women'),(54,'sports'),(62,'syllabus'),(66,'examday'),(75,'postexam'),(76,'annexures')]
def anchor(p):
    a=None
    for start,sec in ANCHOR:
        if p>=start: a=sec
    return a
pages=open(pdf_txt).read().split('\f')
skip=set(range(3,15))|set(range(56,66))|{86}   # tables already structured in guide chunks / scanned image pages
for i,txt in enumerate(pages, start=1):
    if i in skip or len(txt.strip())<100: continue
    t=re.sub(r'[ \t]{3,}','  ',txt); t=re.sub(r'\n\s*\n+','\n',t).strip()
    a=anchor(i)
    chunks.append({'id':f'pdf:{i}','kind':'pdf','title':f'Official notification text — page {i} of 85','text':t,'url':PAGE+(f'#{a}' if a else '')})
json.dump(chunks,open(out,'w'),ensure_ascii=False,separators=(',',':'))
print(len(chunks),'chunks',sum(len(c['text']) for c in chunks),'chars')

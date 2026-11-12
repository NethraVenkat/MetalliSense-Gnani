from pathlib import Path
import re,json
r=Path.cwd();f=r/'MetalliSense_Frontend_R/MetalliSense_Frontend/src';a=r/'MetalliSense_Agent_R/MetalliSense_Agent/app/copilot'
sources=['services/voicePages.js','services/voiceActionRegistry.js','services/voiceFormActions.js','services/voiceDecisionActions.js','mock/handlers/premeltGate/config.js','mock/handlers/premeltGate/store.js','mock/handlers/premeltGate/supplierHistory.js']
terms=['Kural','H-1051','H-1053','PR','heat','carbon','silicon','manganese','phosphorus','sulphur','copper','chromium','nickel','molybdenum','tin','FeSi','FeMn']
s=(f/sources[0]).read_text(encoding='utf-8');terms+=re.findall(r"page\('[^']+','([^']+)'",s)
for source in sources[1:4]:
 s=(f/source).read_text(encoding='utf-8')
 for line in s.splitlines():
  if re.match(r"\s*\['[a-z_]+','/",line):
   terms += [x for x in re.findall(r"'([^']+)'",line) if ' ' in x and '/' not in x and len(x)<65 and not x.startswith('This ')]
s=(f/sources[4]).read_text(encoding='utf-8');terms+=re.findall(r"'(SG-IRON|GREY-IRON|LOW-CARBON-STEEL|MEDIUM-CARBON-STEEL|HIGH-CARBON-STEEL)'",s);terms+=re.findall(r"label: '([^']+)'",s)
for source in sources[5:]:terms+=re.findall(r"supplier: '([^']+)'",(f/source).read_text(encoding='utf-8'))
terms=list(dict.fromkeys(terms));assert len(terms)<=200
(a/'command_keyterms.json').write_text(json.dumps({'sources':sources,'keyterms':terms},ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(len(terms),'application terms')

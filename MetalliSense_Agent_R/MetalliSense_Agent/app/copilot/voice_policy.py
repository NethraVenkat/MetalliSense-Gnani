"""Server-side foundation policy. No plant handler is registered."""
import re
ROLES={'Operator','Supervisor','Manager','Unit Controller'}
ACTIONS={'test-action':{'level':'RUN','roles':[]}}
NEVER=re.compile(r'\b(delete|remove|reset|override|clear\s+chat|edit\s+(grade|price|training)|receive\s+(lot|additive)|dri\s+lab|release|reject|issue\s+invoice|approve\s+tap|accept\s+strategy)\b|HOLD.*(?:override|bypass)|(?:override|bypass).*HOLD|நீக்கு|அழி|ஓவர்ரைடு|हटाओ|मिटाओ|ओवरराइड',re.I)
def forbidden(*parts):return bool(NEVER.search(' '.join(str(p) for p in parts)))

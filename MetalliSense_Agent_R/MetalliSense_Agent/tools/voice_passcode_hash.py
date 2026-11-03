"""Print a synthetic user entry; the hidden code is never written."""
import argparse,getpass,json,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from app.copilot.voice_auth import entry

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--id',required=True);parser.add_argument('--name',required=True);parser.add_argument('--role',required=True);args=parser.parse_args()
    code=getpass.getpass('Six-digit code (hidden): ');again=getpass.getpass('Repeat code (hidden): ')
    if code!=again:raise SystemExit('Codes did not match')
    try:print(json.dumps(entry(args.id,args.name,args.role,code),ensure_ascii=True))
    except ValueError:raise SystemExit('Use a six-digit code and a supported role') from None
if __name__=='__main__':main()

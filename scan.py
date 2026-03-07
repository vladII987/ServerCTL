#!/usr/bin/env python3
"""
ServerCTL — Network Scanner (CLI version)
Usage: python3 scan.py
"""
import asyncio, ipaddress, json, os, re, socket, subprocess, sys
from datetime import datetime
from pathlib import Path

try:
    import httpx
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "httpx", "--break-system-packages", "-q"])
    import httpx

G="\033[0;32m"; R="\033[0;31m"; Y="\033[1;33m"; B="\033[0;34m"
C="\033[0;36m"; W="\033[1;37m"; D="\033[0;37m"; NC="\033[0m"
def c(col,t): return f"{col}{t}{NC}"

SUBNETS    = ["192.168.0.0/24","192.168.1.0/24","172.16.0.0/16"]
AGENT_PORT = 8080
CONCURRENCY= {24:64, 16:512}
OUTPUT     = Path(__file__).parent / "backend" / "servers.json"

async def ping(ip):
    try:
        p = await asyncio.create_subprocess_exec("ping","-c","1","-W","1",ip,
            stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL)
        await asyncio.wait_for(p.wait(), timeout=2)
        return p.returncode == 0
    except: return False

async def check_agent(ip):
    try:
        async with httpx.AsyncClient(timeout=2.0) as cl:
            r = await cl.get(f"http://{ip}:{AGENT_PORT}/health")
            return r.json() if r.status_code == 200 else None
    except: return None

def rdns(ip):
    try: return socket.gethostbyaddr(ip)[0].split(".")[0]
    except: return ""

async def scan_subnet(subnet):
    net   = ipaddress.ip_network(subnet, strict=False)
    hosts = list(net.hosts())
    total = len(hosts)
    workers = CONCURRENCY.get(net.prefixlen, 128)
    found = []; scanned = 0; sem = asyncio.Semaphore(workers)
    print(f"\n  {c(B,'►')} {c(W,subnet)} — {total:,} adresa ({c(D,f'{workers} par.')})\n")

    async def scan_one(ip):
        nonlocal scanned
        async with sem:
            ip_s = str(ip); alive = await ping(ip_s); scanned += 1
            if scanned % 256 == 0 or alive:
                pct = int(scanned/total*100)
                bar = "█"*(pct//5)+"░"*(20-pct//5)
                print(f"\r    {c(D,bar)} {pct:3d}%  {c(D,f'{scanned:,}/{total:,}')}  ",end="",flush=True)
            if not alive: return
            agent   = await check_agent(ip_s)
            name    = (agent.get("hostname","") if agent else "") or rdns(ip_s)
            status  = c(G,"● agent") if agent else c(Y,"○ online")
            label   = c(C,name) if name else c(D,"—")
            print(f"\r    {c(W,ip_s):<18} {label:<28} {status}          ")
            found.append({"ip":ip_s,"hostname":name,"has_agent":agent is not None})

    await asyncio.gather(*[scan_one(ip) for ip in hosts])
    print(f"\r    {'█'*20} 100%  {c(D,f'{total:,}/{total:,}')}  ")
    return sorted(found, key=lambda x: ipaddress.ip_address(x["ip"]))

def select(all_found):
    if not all_found: print(c(R,"\n  Nema online hosta.\n")); return []
    agents = sum(1 for h in all_found if h["has_agent"])
    print(f"\n{'─'*65}")
    print(f"  Online: {c(W,str(len(all_found)))}  │  Agent: {c(G,str(agents))}  │  Bez: {c(Y,str(len(all_found)-agents))}")
    print(f"{'─'*65}\n")
    for i,h in enumerate(all_found,1):
        st = c(G,"● agent") if h["has_agent"] else c(Y,"○")
        nm = c(C,h["hostname"]) if h["hostname"] else c(D,"—")
        print(f"  {c(D,f'{i:>3}.')}  {c(W,h['ip']):<18}  {nm:<28}  {st}")
    print(f"\n  all / agent / 1,3,5 / 1-5\n")
    while True:
        try: raw = input(f"  {c(W,'Dodaj')} › ").strip().lower()
        except (KeyboardInterrupt,EOFError): print(); sys.exit(0)
        if not raw: continue
        if raw == "all":   return all_found
        if raw == "agent": return [h for h in all_found if h["has_agent"]]
        indices = set(); parts = [p.strip() for p in raw.replace(" ",",").split(",") if p.strip()]; ok=True
        for pt in parts:
            if re.match(r"^\d+$",pt): indices.add(int(pt))
            elif re.match(r"^\d+-\d+$",pt): a,b=map(int,pt.split("-")); indices.update(range(a,b+1))
            else: print(c(R,f"  Nepoznato: '{pt}'")); ok=False; break
        if not ok: continue
        sel=[all_found[i-1] for i in sorted(indices) if 1<=i<=len(all_found)]
        if sel: return sel
        print(c(Y,"  Nema validnih."))

async def main():
    print(f"\n{c(W,'╔══════════════════════════════════════════╗')}")
    print(f"{c(W,'║')}     {c(C,'ServerCTL — Network Scanner')}          {c(W,'║')}")
    print(f"{c(W,'╚══════════════════════════════════════════╝')}")
    print(f"  Mreže: {c(Y,', '.join(SUBNETS))}\n")
    start = datetime.now(); all_found = []
    for subnet in SUBNETS:
        r = await scan_subnet(subnet)
        all_found.extend(r)
        print(f"\n  {c(D,'─'*50)}\n  {c(W,subnet)}: {c(G,str(len(r)))} online\n")
    print(c(D,f"  Skeniranje završeno za {(datetime.now()-start).seconds}s"))
    sel = select(all_found)
    if not sel: print(c(Y,"\n  Ništa.\n")); return

    try: token = input(f"\n  {c(W,'Agent token')} (Enter za prazno) › ").strip()
    except (KeyboardInterrupt,EOFError): print(); return

    servers = []
    for h in sel:
        p = h["ip"].split(".")
        group = {"192.168":f"{p[0]}.{p[1]}","172.16":"internal","10.0":"private"}.get(f"{p[0]}.{p[1]}","other")
        servers.append({
            "id":h["ip"].replace(".","- ").replace(" ",""),
            "name":h["hostname"] or h["ip"],
            "host":h["ip"],"group":group,
            "agent_url":f"http://{h['ip']}:{AGENT_PORT}",
            "agent_token":token or "REPLACE_WITH_TOKEN",
            "prometheus_instance":f"{h['ip']}:9100",
            "tags":["linux"]+( ["agent"] if h["has_agent"] else []),
        })
    out = json.dumps({"servers":servers},indent=2,ensure_ascii=False)
    print(f"\n{c(B,'Preview:')}\n{c(D,out)}")
    try: confirm = input(f"\n  {c(W,f'Snimi u {OUTPUT}? [y/n]')} › ").strip().lower()
    except (KeyboardInterrupt,EOFError): print(); return
    if confirm == "y":
        OUTPUT.parent.mkdir(parents=True,exist_ok=True)
        if OUTPUT.exists():
            bk = OUTPUT.with_suffix(f".bak-{datetime.now().strftime('%H%M%S')}.json")
            OUTPUT.rename(bk); print(c(D,f"  Backup: {bk}"))
        OUTPUT.write_text(out)
        print(c(G,f"\n  ✓ Snimljeno: {OUTPUT}"))
        print(c(D,"  Restart: docker compose restart backend\n"))
    else:
        print(c(Y,"\n  Nije snimljeno.\n"))

if __name__ == "__main__":
    try: asyncio.run(main())
    except KeyboardInterrupt: print(f"\n{c(Y,'  Prekinuto.')}\n")

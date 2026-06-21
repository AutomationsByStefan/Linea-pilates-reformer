"""Read-only provjera pariteta minusa: stari flag-broj vs novi živi račun.

Pokreni PRIJE merge-a reforme da uporediš:
  - stari način: count(trainings.minus == True)              [+ varijanta bez otkazanih]
  - novi način : compute_minus() replika (negativan balans paketa + nepokriveni)

Skripta NIŠTA ne mijenja u bazi (ne zove expire koji bi mutirao — istek se
primjenjuje samo u memoriji, identično compute_minus() krajnjem ponašanju).

NE treba .env. Konekciju proslijediš na jedan od tri načina (po prioritetu):
  1) argument:   python scripts/check_minus_parity.py --mongo-url "<URL>" --db-name "<DB>"
  2) env var:    MONGO_URL=... DB_NAME=... python scripts/check_minus_parity.py
  3) interaktivno: python scripts/check_minus_parity.py   (pita te da zalijepiš URL/DB)

Opcije:
  --all   ispiši i korisnike koji se slažu (ne samo neslaganja)

Napomena: na TRENUTNOM stanju (prije primjene reforme) očekuj neka neslaganja —
dugovi koji sad žive samo u minus:true flagu još nisu zapisani u balanse paketa,
pa će novi račun za te slučajeve biti niži. To je očekivano i upravo ono što
provjeravamo.
"""

import argparse
import asyncio
import os
from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorClient

CONSUMING = ["predstojeći", "završen", "iskoristen"]


def resolve_connection(args) -> tuple[str, str]:
    """MONGO_URL/DB_NAME iz argumenta -> env var -> interaktivni unos."""
    mongo_url = args.mongo_url or os.environ.get("MONGO_URL")
    db_name = args.db_name or os.environ.get("DB_NAME")

    if not mongo_url:
        mongo_url = input("MONGO_URL (zalijepi iz Railway-a): ").strip()
    if not db_name:
        db_name = input("DB_NAME: ").strip()

    if not mongo_url or not db_name:
        raise SystemExit("Greška: MONGO_URL i DB_NAME su obavezni.")
    return mongo_url, db_name


def _is_expired(m: dict, now_iso: str) -> bool:
    """Da li bi expire_overdue_memberships ovaj paket označio kao istekao."""
    if m.get("tip") != "aktivna":
        return False
    isteka = m.get("datum_isteka")
    return isteka is not None and isteka < now_iso


def _effective_balance(m: dict, now_iso: str) -> int:
    """Balans nakon (in-memory) primjene pravila isteka: min(preostali, 0) ako istekao."""
    p = m.get("preostali_termini", 0) or 0
    if _is_expired(m, now_iso):
        return min(p, 0)
    return p


async def new_minus(db, user_id: str, now_iso: str) -> int:
    """Read-only replika compute_minus() iz reforme."""
    memberships = await db.memberships.find(
        {"user_id": user_id}, {"_id": 0, "tip": 1, "preostali_termini": 1, "datum_isteka": 1}
    ).to_list(1000)

    balance_debt = sum(
        -_effective_balance(m, now_iso)
        for m in memberships
        if _effective_balance(m, now_iso) < 0
    )

    uncovered = 0
    if not memberships:
        uncovered = await db.trainings.count_documents(
            {"user_id": user_id, "tip": {"$in": CONSUMING}}
        )

    return balance_debt + uncovered


async def old_minus(db, user_id: str) -> tuple[int, int]:
    """Stari način. Vraća (flag_sve, flag_bez_otkazanih)."""
    flag_all = await db.trainings.count_documents({"user_id": user_id, "minus": True})
    flag_active = await db.trainings.count_documents(
        {"user_id": user_id, "minus": True, "tip": {"$ne": "otkazan"}}
    )
    return flag_all, flag_active


async def main(args) -> None:
    mongo_url, db_name = resolve_connection(args)
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    now_iso = datetime.now(timezone.utc).isoformat()
    try:
        users = await db.users.find({}, {"_id": 0, "user_id": 1, "name": 1}).to_list(100000)

        mismatches = []
        checked = 0
        for u in users:
            uid = u["user_id"]
            flag_all, flag_active = await old_minus(db, uid)
            new = await new_minus(db, uid, now_iso)
            checked += 1
            # Poredimo sa "flag bez otkazanih" jer je to najbliže ispravnom starom računu.
            if new != flag_active or args.all:
                mismatches.append((u.get("name", "?"), uid, flag_all, flag_active, new))

        print(f"\nBaza: {db_name}")
        print(f"Provjereno korisnika: {checked}")
        diff_count = sum(1 for r in mismatches if r[4] != r[3])
        print(f"Neslaganja (novi != stari-bez-otkazanih): {diff_count}\n")

        if mismatches:
            print(f"{'IME':<22} {'flag_sve':>8} {'flag_bezOtk':>11} {'NOVI':>6}  delta")
            print("-" * 60)
            for name, uid, fa, fact, new in sorted(mismatches, key=lambda r: r[4] - r[3], reverse=True):
                mark = "" if new == fact else "  <-- RAZLIKA"
                print(f"{(name or '?')[:22]:<22} {fa:>8} {fact:>11} {new:>6}  {new - fact:+d}{mark}")
    finally:
        client.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Read-only parity provjera minusa (bez .env).")
    parser.add_argument("--mongo-url", help="MongoDB konekcioni string (ili env MONGO_URL, ili upit).")
    parser.add_argument("--db-name", help="Ime baze (ili env DB_NAME, ili upit).")
    parser.add_argument("--all", action="store_true", help="Ispiši i korisnike koji se slažu.")
    asyncio.run(main(parser.parse_args()))

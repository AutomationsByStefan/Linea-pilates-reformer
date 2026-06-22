"""Jednokratna dijagnostička skripta za "minus" treninge.

SAMO ČITA i ispisuje — ne mijenja ništa u bazi.

Koristi istu konekciju kao backend/server.py (MONGO_URL, DB_NAME iz backend/.env).

Pokretanje (iz korijena repozitorija):
    python scripts/diag_minus.py
"""
import asyncio
import os
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

# .env je u backend/ — isti fajl koji server.py učitava
BACKEND_DIR = Path(__file__).resolve().parent.parent / "backend"
load_dotenv(BACKEND_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
db_name = os.environ["DB_NAME"]


async def main():
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    print(f"MongoDB: {db_name}")
    print("=" * 70)

    # 1. Ukupno trainings sa minus:true
    total_minus = await db.trainings.count_documents({"minus": True})
    print(f"\n1. Ukupno trainings sa minus:true = {total_minus}")

    # 2. Razbijeno po tip
    print("\n2. Razbijeno po 'tip':")
    pipeline = [
        {"$match": {"minus": True}},
        {"$group": {"_id": "$tip", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    by_tip = await db.trainings.aggregate(pipeline).to_list(1000)
    if not by_tip:
        print("   (nema minus treninga)")
    for row in by_tip:
        tip = row["_id"] if row["_id"] is not None else "(bez tip)"
        print(f"   {tip:<15} {row['count']}")

    # 3. Za SVAKI minus:true trening: ime, datum, tip, i ima li aktivnu članarinu
    #    sa preostali_termini > 0 (to bi bio bug — minus a ipak ima termina).
    print("\n3. Detalji po minus treningu:")
    print(f"   {'IME':<25} {'DATUM':<12} {'TIP':<13} {'AKTIVNA>0?'}")
    print("   " + "-" * 64)

    minus_trainings = await db.trainings.find(
        {"minus": True}, {"_id": 0, "user_id": 1, "datum": 1, "tip": 1}
    ).sort("datum", 1).to_list(10000)

    # keš imena i statusa po user_id da ne pogađamo bazu više puta
    name_cache = {}
    active_cache = {}
    bug_count = 0

    for t in minus_trainings:
        uid = t.get("user_id")

        if uid not in name_cache:
            user = await db.users.find_one({"user_id": uid}, {"_id": 0, "name": 1})
            name_cache[uid] = (user.get("name") if user else None) or "(nepoznata)"

        if uid not in active_cache:
            active = await db.memberships.find_one(
                {"user_id": uid, "tip": "aktivna", "preostali_termini": {"$gt": 0}},
                {"_id": 0, "preostali_termini": 1},
            )
            active_cache[uid] = active.get("preostali_termini") if active else None

        ime = name_cache[uid]
        datum = (t.get("datum") or "")[:10]
        tip = t.get("tip") or "(bez tip)"
        preostali = active_cache[uid]

        if preostali is not None:
            bug_count += 1
            marker = f"DA ({preostali})  <-- BUG"
        else:
            marker = "ne"

        print(f"   {ime[:24]:<25} {datum:<12} {tip:<13} {marker}")

    print("\n" + "=" * 70)
    print(f"Suma: {total_minus} minus treninga, "
          f"{bug_count} kod članica sa aktivnom članarinom (preostali>0).")
    if bug_count:
        print("UPOZORENJE: redovi označeni '<-- BUG' imaju minus iako članica "
              "ima termina na aktivnom paketu.")

    client.close()


if __name__ == "__main__":
    asyncio.run(main())

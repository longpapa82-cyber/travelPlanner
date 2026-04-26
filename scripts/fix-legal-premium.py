"""
V187 P1-B (CRITICAL #5/#6): fix unlimited AI claims and BRL pricing.

- id: 'tanpa batas' (without limit) — premium has 30/month, not unlimited
- ru: 'безлимитную' (unlimited) — same
- pt: 'R$19,99/mês ou R$149,99/ano' — Play Console has only USD pricing
"""

import json
from pathlib import Path

REPLACEMENTS = {
    "id": "Premium ($3,99/bulan atau $29,99/tahun) memberi Anda 30 pembuatan perjalanan AI per bulan, pengalaman bebas iklan, dan fitur yang ditingkatkan. Pengguna gratis dapat membuat hingga 3 perjalanan AI per bulan. Anda dapat membatalkan kapan saja melalui pengaturan langganan Google Play.",
    "ru": "Премиум ($3,99/мес. или $29,99/год) даёт 30 AI-генераций поездок в месяц, отсутствие рекламы и расширенные функции. Бесплатные пользователи могут создавать до 3 AI-поездок в месяц. Вы можете отменить подписку в любой момент в настройках подписок Google Play.",
    "pt": "O Premium ($3,99/mês ou $29,99/ano) oferece 30 gerações mensais de viagens com IA, experiência sem anúncios e recursos aprimorados. Usuários gratuitos podem criar até 3 viagens com IA por mês. Você pode cancelar a qualquer momento nas configurações de assinatura da Google Play.",
}

base = Path("frontend/src/i18n/locales")
for locale, new_a in REPLACEMENTS.items():
    path = base / locale / "legal.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    p = data.get("help", {}).get("adsPartners", {}).get("premium")
    if p and "a" in p:
        p["a"] = new_a
        path.write_text(
            json.dumps(data, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print(f"{locale}: updated premium.a")
    else:
        print(f"{locale}: SKIP")

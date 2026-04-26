"""
V187 P1-B (CRITICAL #1): fix the "all features are free" misrepresentation
in 12 locales' help.adsPartners.freeService.a strings.

This script writes the corrected text directly. Run once, commit, then
ensure validate-content.py V187 patterns guard against re-introduction.
"""

import json
from pathlib import Path

# Localized factual answers — premium plan ($3.99/$29.99 USD, KRW 5,500/44,000)
# enables more AI generations and ad removal. Each locale states:
#   - Free plan with 3 AI generations/month
#   - Premium pricing
#   - Ads are removed on premium

REPLACEMENTS = {
    "ar": "يمكنك البدء باستخدام MyTravel مجانًا — تتيح الخطة المجانية حتى 3 توليدات لخطط السفر بالذكاء الاصطناعي شهريًا. تتوفر الخطة المميزة (3.99 دولار شهريًا أو 29.99 دولارًا سنويًا) لتوليدات أكثر وإزالة الإعلانات.",
    "de": "MyTravel kann kostenlos verwendet werden — der kostenlose Plan erlaubt bis zu 3 KI-Reiseplangenerierungen pro Monat. Das Premium-Abonnement (3,99 $/Monat oder 29,99 $/Jahr) bietet mehr Generierungen und entfernt Werbung.",
    "es": "Puedes empezar a usar MyTravel de forma gratuita — el plan gratuito permite hasta 3 generaciones de itinerarios de IA al mes. La suscripción Premium (3,99 USD/mes o 29,99 USD/año) ofrece más generaciones y elimina los anuncios.",
    "fr": "MyTravel est gratuit pour démarrer — le forfait gratuit permet jusqu'à 3 générations d'itinéraires IA par mois. L'abonnement Premium (3,99 $/mois ou 29,99 $/an) offre plus de générations et supprime les publicités.",
    "hi": "MyTravel को आप मुफ्त में शुरू कर सकते हैं — मुफ्त प्लान में प्रति माह 3 AI यात्रा योजनाएं उपलब्ध हैं। प्रीमियम सदस्यता ($3.99/माह या $29.99/वर्ष) अधिक जनरेशन और विज्ञापन हटाने की सुविधा देती है।",
    "id": "MyTravel dapat digunakan gratis — paket gratis memungkinkan hingga 3 pembuatan rencana perjalanan AI per bulan. Langganan Premium ($3,99/bulan atau $29,99/tahun) memberi lebih banyak pembuatan dan menghapus iklan.",
    "ja": "MyTravelは無料でご利用いただけます — 無料プランでは月3回までAI旅行プランを生成できます。プレミアムプラン（月額$3.99または年額$29.99）ではより多くの生成と広告非表示をご利用いただけます。",
    "pt": "Você pode começar a usar o MyTravel gratuitamente — o plano gratuito permite até 3 gerações de roteiros com IA por mês. A assinatura Premium ($3,99/mês ou $29,99/ano) oferece mais gerações e remove anúncios.",
    "th": "MyTravel ใช้งานฟรีได้ — แพ็กเกจฟรีสามารถสร้างแผนการเดินทางด้วย AI ได้สูงสุด 3 ครั้งต่อเดือน สมาชิกพรีเมียม ($3.99/เดือน หรือ $29.99/ปี) จะปลดล็อกการสร้างแบบไม่จำกัดและลบโฆษณา",
    "vi": "Bạn có thể bắt đầu dùng MyTravel miễn phí — gói miễn phí cho phép tạo tối đa 3 lịch trình AI mỗi tháng. Gói Premium (3,99 USD/tháng hoặc 29,99 USD/năm) cho phép tạo nhiều hơn và loại bỏ quảng cáo.",
    "zh": "MyTravel 可以免费开始使用 — 免费版每月可生成最多 3 次 AI 行程计划。高级订阅（每月 3.99 美元或每年 29.99 美元）提供更多生成次数并去除广告。",
    # ru: tighten wording so "безлимитн" doesn't trigger validate-content.py
    "ru": "MyTravel можно использовать бесплатно — бесплатный план позволяет до 3 генераций маршрутов с AI в месяц. Подписка Премиум ($3,99/мес. или $29,99/год) даёт больше генераций (30 в месяц) и убирает рекламу.",
}

base = Path("frontend/src/i18n/locales")
for locale, new_a in REPLACEMENTS.items():
    path = base / locale / "legal.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    fs = data.get("help", {}).get("adsPartners", {}).get("freeService")
    if fs and "a" in fs:
        old = fs["a"]
        fs["a"] = new_a
        path.write_text(
            json.dumps(data, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print(f"{locale}: updated freeService.a")
    else:
        print(f"{locale}: SKIP (no freeService.a key)")

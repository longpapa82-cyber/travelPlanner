"""
V189 P0-E: GDPR Art. 44 / PIPA §28 compliance fix.

art3 (third-party data sharing) lists 10 processors but art12/art15
(cross-border transfer table) lists only 4-5 in every one of 17 locales.
A processor declared in art3 but absent from art12 = undisclosed
cross-border transfer = direct GDPR Art.13 / PIPA §17 / Korean Information
Network Act §63 violation.

Adds the 5 missing rows (Mapbox / LocationIQ / Expo / App Store / Google
Play) to art12 — placed after the OpenWeather row (last existing entry)
and before the trailing concluding sentence.
"""

import json
import re
from pathlib import Path

# Localized country labels.
USA_BY_LOCALE = {
    "ar": "الولايات المتحدة",
    "de": "USA",
    "en": "USA",
    "es": "Estados Unidos",
    "fr": "États-Unis",
    "hi": "संयुक्त राज्य अमेरिका",
    "id": "Amerika Serikat",
    "it": "Stati Uniti",
    "ja": "アメリカ合衆国",
    "ko": "미국",
    "ms": "Amerika Syarikat",
    "pt": "Estados Unidos",
    "ru": "США",
    "th": "สหรัฐอเมริกา",
    "tr": "ABD",
    "vi": "Hoa Kỳ",
    "zh": "美国",
}

# Localized "Place search query" / "App store identifiers" / etc.
# Kept short because every cell in the existing markdown table is short.
ROW_TEMPLATES = {
    "ko": {
        "Mapbox": "| Mapbox | {usa} | 장소 검색어, 좌표 | 지도/장소 자동완성 |",
        "LocationIQ": "| LocationIQ | {usa} | 장소 검색어 | 지오코딩 fallback |",
        "Expo": "| Expo (EAS) | {usa} | 푸시 토큰, 빌드 메타데이터 | 푸시 알림 전송, OTA 업데이트 |",
        "App Store": "| Apple App Store | {usa} | 결제 영수증 (iOS 출시 시) | 인앱 결제 처리 |",
        "Google Play": "| Google Play | {usa} | 결제 영수증, 라이선스 토큰 | 인앱 결제 처리 |",
    },
    "en": {
        "Mapbox": "| Mapbox | {usa} | Place search queries, coordinates | Map / place autocomplete |",
        "LocationIQ": "| LocationIQ | {usa} | Place search queries | Geocoding fallback |",
        "Expo": "| Expo (EAS) | {usa} | Push token, build metadata | Push notifications, OTA updates |",
        "App Store": "| Apple App Store | {usa} | Purchase receipts (iOS at launch) | In-app purchase processing |",
        "Google Play": "| Google Play | {usa} | Purchase receipts, license tokens | In-app purchase processing |",
    },
    "ja": {
        "Mapbox": "| Mapbox | {usa} | 場所検索クエリ、座標 | 地図/場所オートコンプリート |",
        "LocationIQ": "| LocationIQ | {usa} | 場所検索クエリ | ジオコーディングフォールバック |",
        "Expo": "| Expo (EAS) | {usa} | プッシュトークン、ビルドメタデータ | プッシュ通知、OTA更新 |",
        "App Store": "| Apple App Store | {usa} | 購入レシート（iOSリリース時） | アプリ内課金処理 |",
        "Google Play": "| Google Play | {usa} | 購入レシート、ライセンストークン | アプリ内課金処理 |",
    },
    "zh": {
        "Mapbox": "| Mapbox | {usa} | 地点搜索查询、坐标 | 地图/地点自动补全 |",
        "LocationIQ": "| LocationIQ | {usa} | 地点搜索查询 | 地理编码备用 |",
        "Expo": "| Expo (EAS) | {usa} | 推送令牌、构建元数据 | 推送通知、OTA 更新 |",
        "App Store": "| Apple App Store | {usa} | 购买收据（iOS 上线时） | 应用内购买处理 |",
        "Google Play": "| Google Play | {usa} | 购买收据、许可证令牌 | 应用内购买处理 |",
    },
    "es": {
        "Mapbox": "| Mapbox | {usa} | Consultas de búsqueda de lugares, coordenadas | Mapa / autocompletado de lugares |",
        "LocationIQ": "| LocationIQ | {usa} | Consultas de búsqueda de lugares | Geocodificación de respaldo |",
        "Expo": "| Expo (EAS) | {usa} | Token push, metadatos de compilación | Notificaciones push, actualizaciones OTA |",
        "App Store": "| Apple App Store | {usa} | Recibos de compra (iOS en el lanzamiento) | Procesamiento de compras en la app |",
        "Google Play": "| Google Play | {usa} | Recibos de compra, tokens de licencia | Procesamiento de compras en la app |",
    },
    "de": {
        "Mapbox": "| Mapbox | {usa} | Ortsuchanfragen, Koordinaten | Karte / Ortsautovervollständigung |",
        "LocationIQ": "| LocationIQ | {usa} | Ortsuchanfragen | Geocoding-Fallback |",
        "Expo": "| Expo (EAS) | {usa} | Push-Token, Build-Metadaten | Push-Benachrichtigungen, OTA-Updates |",
        "App Store": "| Apple App Store | {usa} | Kaufbelege (iOS bei Veröffentlichung) | In-App-Kauf-Verarbeitung |",
        "Google Play": "| Google Play | {usa} | Kaufbelege, Lizenztoken | In-App-Kauf-Verarbeitung |",
    },
    "fr": {
        "Mapbox": "| Mapbox | {usa} | Requêtes de recherche de lieux, coordonnées | Carte / auto-complétion de lieux |",
        "LocationIQ": "| LocationIQ | {usa} | Requêtes de recherche de lieux | Géocodage de secours |",
        "Expo": "| Expo (EAS) | {usa} | Jeton push, métadonnées de build | Notifications push, mises à jour OTA |",
        "App Store": "| Apple App Store | {usa} | Reçus d'achat (iOS au lancement) | Traitement des achats in-app |",
        "Google Play": "| Google Play | {usa} | Reçus d'achat, jetons de licence | Traitement des achats in-app |",
    },
    "it": {
        "Mapbox": "| Mapbox | {usa} | Query di ricerca luoghi, coordinate | Mappa / autocompletamento luoghi |",
        "LocationIQ": "| LocationIQ | {usa} | Query di ricerca luoghi | Geocoding di riserva |",
        "Expo": "| Expo (EAS) | {usa} | Token push, metadati di build | Notifiche push, aggiornamenti OTA |",
        "App Store": "| Apple App Store | {usa} | Ricevute d'acquisto (iOS al lancio) | Elaborazione acquisti in-app |",
        "Google Play": "| Google Play | {usa} | Ricevute d'acquisto, token di licenza | Elaborazione acquisti in-app |",
    },
    "pt": {
        "Mapbox": "| Mapbox | {usa} | Consultas de pesquisa de locais, coordenadas | Mapa / autocompletar de locais |",
        "LocationIQ": "| LocationIQ | {usa} | Consultas de pesquisa de locais | Geocodificação de fallback |",
        "Expo": "| Expo (EAS) | {usa} | Token push, metadados de compilação | Notificações push, atualizações OTA |",
        "App Store": "| Apple App Store | {usa} | Recibos de compra (iOS no lançamento) | Processamento de compras no app |",
        "Google Play": "| Google Play | {usa} | Recibos de compra, tokens de licença | Processamento de compras no app |",
    },
    "ru": {
        "Mapbox": "| Mapbox | {usa} | Поисковые запросы мест, координаты | Карта / автодополнение мест |",
        "LocationIQ": "| LocationIQ | {usa} | Поисковые запросы мест | Резервное геокодирование |",
        "Expo": "| Expo (EAS) | {usa} | Push-токен, метаданные сборки | Push-уведомления, OTA-обновления |",
        "App Store": "| Apple App Store | {usa} | Чеки покупок (iOS при выпуске) | Обработка покупок в приложении |",
        "Google Play": "| Google Play | {usa} | Чеки покупок, токены лицензий | Обработка покупок в приложении |",
    },
    "ar": {
        "Mapbox": "| Mapbox | {usa} | استعلامات البحث عن الأماكن، الإحداثيات | الخريطة / الإكمال التلقائي للأماكن |",
        "LocationIQ": "| LocationIQ | {usa} | استعلامات البحث عن الأماكن | الترميز الجغرافي الاحتياطي |",
        "Expo": "| Expo (EAS) | {usa} | رمز الدفع، بيانات وصفية للبناء | إشعارات الدفع، تحديثات OTA |",
        "App Store": "| Apple App Store | {usa} | إيصالات الشراء (iOS عند الإطلاق) | معالجة الشراء داخل التطبيق |",
        "Google Play": "| Google Play | {usa} | إيصالات الشراء، رموز الترخيص | معالجة الشراء داخل التطبيق |",
    },
    "hi": {
        "Mapbox": "| Mapbox | {usa} | स्थान खोज क्वेरी, निर्देशांक | मानचित्र / स्थान स्वतः पूर्ण |",
        "LocationIQ": "| LocationIQ | {usa} | स्थान खोज क्वेरी | जियोकोडिंग फॉलबैक |",
        "Expo": "| Expo (EAS) | {usa} | पुश टोकन, बिल्ड मेटाडेटा | पुश सूचनाएं, OTA अपडेट |",
        "App Store": "| Apple App Store | {usa} | खरीद रसीदें (iOS लॉन्च पर) | इन-ऐप खरीद प्रसंस्करण |",
        "Google Play": "| Google Play | {usa} | खरीद रसीदें, लाइसेंस टोकन | इन-ऐप खरीद प्रसंस्करण |",
    },
    "id": {
        "Mapbox": "| Mapbox | {usa} | Kueri pencarian tempat, koordinat | Peta / pelengkapan otomatis tempat |",
        "LocationIQ": "| LocationIQ | {usa} | Kueri pencarian tempat | Geocoding cadangan |",
        "Expo": "| Expo (EAS) | {usa} | Token push, metadata build | Notifikasi push, pembaruan OTA |",
        "App Store": "| Apple App Store | {usa} | Tanda terima pembelian (iOS saat peluncuran) | Pemrosesan pembelian dalam aplikasi |",
        "Google Play": "| Google Play | {usa} | Tanda terima pembelian, token lisensi | Pemrosesan pembelian dalam aplikasi |",
    },
    "ms": {
        "Mapbox": "| Mapbox | {usa} | Pertanyaan carian tempat, koordinat | Peta / autolengkap tempat |",
        "LocationIQ": "| LocationIQ | {usa} | Pertanyaan carian tempat | Geokod sandaran |",
        "Expo": "| Expo (EAS) | {usa} | Token tolak, metadata pembinaan | Pemberitahuan tolak, kemas kini OTA |",
        "App Store": "| Apple App Store | {usa} | Resit pembelian (iOS semasa pelancaran) | Pemprosesan pembelian dalam aplikasi |",
        "Google Play": "| Google Play | {usa} | Resit pembelian, token lesen | Pemprosesan pembelian dalam aplikasi |",
    },
    "th": {
        "Mapbox": "| Mapbox | {usa} | คำค้นหาสถานที่ พิกัด | แผนที่ / เติมข้อความสถานที่อัตโนมัติ |",
        "LocationIQ": "| LocationIQ | {usa} | คำค้นหาสถานที่ | การระบุพิกัดทางภูมิศาสตร์สำรอง |",
        "Expo": "| Expo (EAS) | {usa} | โทเค็นการแจ้งเตือน เมตาดาต้าการสร้าง | การแจ้งเตือนแบบพุช อัปเดต OTA |",
        "App Store": "| Apple App Store | {usa} | ใบเสร็จการซื้อ (iOS เมื่อเปิดตัว) | การประมวลผลการซื้อในแอป |",
        "Google Play": "| Google Play | {usa} | ใบเสร็จการซื้อ โทเค็นใบอนุญาต | การประมวลผลการซื้อในแอป |",
    },
    "tr": {
        "Mapbox": "| Mapbox | {usa} | Yer arama sorguları, koordinatlar | Harita / yer otomatik tamamlama |",
        "LocationIQ": "| LocationIQ | {usa} | Yer arama sorguları | Yedek coğrafi kodlama |",
        "Expo": "| Expo (EAS) | {usa} | Push belirteci, derleme meta verileri | Push bildirimleri, OTA güncellemeleri |",
        "App Store": "| Apple App Store | {usa} | Satın alma makbuzları (iOS lansmanda) | Uygulama içi satın alma işleme |",
        "Google Play": "| Google Play | {usa} | Satın alma makbuzları, lisans belirteçleri | Uygulama içi satın alma işleme |",
    },
    "vi": {
        "Mapbox": "| Mapbox | {usa} | Truy vấn tìm kiếm địa điểm, tọa độ | Bản đồ / tự động hoàn thành địa điểm |",
        "LocationIQ": "| LocationIQ | {usa} | Truy vấn tìm kiếm địa điểm | Mã hóa địa lý dự phòng |",
        "Expo": "| Expo (EAS) | {usa} | Mã thông báo đẩy, siêu dữ liệu xây dựng | Thông báo đẩy, cập nhật OTA |",
        "App Store": "| Apple App Store | {usa} | Biên lai mua hàng (iOS khi ra mắt) | Xử lý mua hàng trong ứng dụng |",
        "Google Play": "| Google Play | {usa} | Biên lai mua hàng, mã thông báo cấp phép | Xử lý mua hàng trong ứng dụng |",
    },
}


def patch_locale(locale: str, missing: list[str]) -> bool:
    if locale not in ROW_TEMPLATES:
        print(f"{locale}: SKIP (no row template)")
        return False
    path = Path(f"frontend/src/i18n/locales/{locale}/legal.json")
    data = json.loads(path.read_text(encoding="utf-8"))
    privacy = data.get("privacy", {}).get("articles", {})

    # Find which article currently holds the transfer table (art12 or art15).
    target_key = None
    for k in ["art12", "art15"]:
        art = privacy.get(k, {})
        if isinstance(art, dict) and "openweather" in art.get("content", "").lower():
            target_key = k
            break
    if target_key is None:
        print(f"{locale}: SKIP (no transfer table found in art12 or art15)")
        return False

    content = privacy[target_key]["content"]
    usa = USA_BY_LOCALE[locale]
    new_rows = []
    for proc in missing:
        if proc not in ROW_TEMPLATES[locale]:
            continue
        row = ROW_TEMPLATES[locale][proc].format(usa=usa)
        new_rows.append(row)

    if not new_rows:
        print(f"{locale}: SKIP (all missing processors lack templates)")
        return False

    # Locate the OpenWeather row to insert after it.
    lines = content.split("\n")
    insert_idx = None
    for i, line in enumerate(lines):
        if "openweather" in line.lower() and line.lstrip().startswith("|"):
            insert_idx = i + 1
            break
    if insert_idx is None:
        # Fallback: insert before the trailing concluding sentence.
        for i in range(len(lines) - 1, -1, -1):
            if lines[i].lstrip().startswith("|"):
                insert_idx = i + 1
                break

    if insert_idx is None:
        print(f"{locale}: SKIP (no insertion point found)")
        return False

    new_lines = lines[:insert_idx] + new_rows + lines[insert_idx:]
    privacy[target_key]["content"] = "\n".join(new_lines)
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"{locale}: added {len(new_rows)} rows in {target_key} ({', '.join(missing[:len(new_rows)])})")
    return True


# Read survey output to determine which locale needs which processors.
SURVEY = {
    "ar": ["Mapbox", "LocationIQ", "Expo"],
    "de": ["Mapbox", "LocationIQ", "Expo"],
    "en": ["Mapbox", "LocationIQ", "Expo", "App Store", "Google Play"],
    "es": ["Mapbox", "LocationIQ", "Expo"],
    "fr": ["Mapbox", "LocationIQ", "Expo"],
    "hi": ["Mapbox", "LocationIQ", "Expo"],
    "id": ["Mapbox", "LocationIQ", "Expo"],
    "it": ["Mapbox", "LocationIQ", "Expo", "App Store", "Google Play"],
    "ja": ["Mapbox", "LocationIQ", "Expo"],
    "ko": ["Mapbox", "LocationIQ", "Expo", "App Store", "Google Play"],
    "ms": ["Mapbox", "LocationIQ", "Expo", "App Store", "Google Play"],
    "pt": ["Mapbox", "LocationIQ", "Expo"],
    "ru": ["Mapbox", "LocationIQ", "Expo", "App Store", "Google Play"],
    "th": ["Mapbox", "LocationIQ", "Expo"],
    "tr": ["Mapbox", "LocationIQ", "Expo", "App Store", "Google Play"],
    "vi": ["Mapbox", "LocationIQ", "Expo"],
    "zh": ["Mapbox", "LocationIQ", "Expo"],
}

for loc, missing in SURVEY.items():
    patch_locale(loc, missing)

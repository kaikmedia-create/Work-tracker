# Vergleichsoberfläche entfernt

Stand: 6. November 2026. Ausgangscommit: 427946b12d7f339ddc46f32107d3c71f280deab9.

Entfernt wurden die Vergleichsoberfläche, ihr Laufzeitmodul, die Vorher-/Nachher-Schalter, die automatische Gebäude-Zentrierung und die zugehörigen Vergleichstests. PIN-Loader und Quellcode-Vorbereitung verwenden wieder den unmittelbar vorherigen, verifizierten UI-Stand bb602c6. Es wurde kein alter Branch-Stand erzwungen: Die Entfernung wird als neuer Commit auf dem aktuellen main vorgenommen. Der alte Vergleichsbericht bleibt als historische Dokumentation erhalten.

Klassisches Kartenrelief bleibt Standard. Klassische Kanten + Messhöhen, die rohe Messoberfläche, STL-Export und vorhandene Fehlerdiagnose bleiben erhalten. Es werden keine neuen Messquellen eingebunden. Der Plan in docs/official-data-quality-plan.md ist eine Planung, keine Behauptung bereits eingebauter Datenadapter.

## Tatsächlich geprüft

`cd relief-studio/source && npm test`: 386 bestanden, 0 fehlgeschlagen, 0 übersprungen. Die elf ausschließlich auf die entfernte Vergleichsoberfläche bezogenen Tests sind entfallen; vier neue Tests prüfen die vollständige Entfernung der Laufzeitverweise, beide Startpfade, den klassischen Standard, die weiterhin verfügbare Hybridoption und das erhaltene Messhöhenprotokoll. Die vorhandenen Gate-Tests prüfen die vollständige Rekonstruktion der App und ihre Übereinstimmung mit dem Quellcode.

Die folgenden zehn Laufzeitdateien sind gegenüber dem veröffentlichten Ausgangsstand byteidentisch: core.js, architecture.js, surface-build.mjs, hybrid-buildings.mjs, survey29.js, viewer.js, worker.js, atlas-mesh-worker.mjs, phone-workspace.js und phone-workspace.css. Die Änderung verändert somit weder die Höhenkorrektur noch die geometrischen Rechenmodule, den Renderer oder die mobile Navigation.

Keine neue vollständige Browserabnahme: Die lokale Browsernavigation wurde von der administrativen Browserrichtlinie gesperrt; der vorgeschlagene zusätzliche CI-Browsertest wurde nicht angelegt. Diese Einschränkung wurde nicht umgangen. Es werden keine erfolgreichen neuen Live-Datenabrufe, Browserdownloads, physischen Gerätetests oder Probedrucke behauptet.

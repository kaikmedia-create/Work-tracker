# Relief Studio 12 · Gebäude statt Rasterhöcker

- Gebäudegrundrisse bilden unabhängige polygonale Wände und Dachflächen. Sie werden nicht mehr in das grobe Geländeraster gedrückt.
- Erfasste Gebäudeteile ersetzen nur ihre tatsächliche Grundfläche; ein Kirchturm löscht nicht mehr den Hauptbau.
- Sieben Dachformen aus OSM-Tags, ausgerichtet nach vorhandenen Angaben. Keine frei erfundenen Türme oder Fassaden.
- Innenhöfe, schmale runde Türme und erfasste Mauerzüge bleiben erhalten.
- Gebäudeflächen und Gelände werden zu einem geschlossenen Druckkörper verbunden. Jede berechnete Ausgabe erhält eine Kantenprüfung; fehlerhafte Geometrie wird nicht exportiert.
- Maßstäbliche Gebäudehöhen statt automatischer mehrfacher Wahrzeichenüberhöhung. Ein optionaler Gelände-Regler bleibt; keine zusätzlichen Gebäuderegler.
- Gemeinsame Geometrie für WebGL, Software-Vorschau, STL und 3MF. Alte Projekte bleiben lesbar; für zusätzliche Mauer-/Turmdaten Karte neu laden.

Nicht enthalten: fotogrammetrische Fassaden, vermessene Burgrekonstruktion, neue hochaufgelöste Geländedaten, freistehende Brücken/Unterführungen. Höhen und Dächer ohne vollständige Quellangaben bleiben als Annäherung ausgewiesen.

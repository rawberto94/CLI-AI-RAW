# ConTigo — Service Level Agreement (SLA)

**ConTigo GmbH — Zürich, Schweiz / Zurich, Switzerland**
**Gültig ab / Effective: 1. März 2026**

---

## 1. Geltungsbereich / Scope

Dieses Service Level Agreement (SLA) regelt die Verfügbarkeits- und Leistungszusagen der ConTigo-Plattform und ist Bestandteil der Allgemeinen Geschäftsbedingungen (AGB).

*This SLA governs availability and performance commitments for the ConTigo Platform and forms part of the General Terms and Conditions (GTC).*

---

## 2. Verfügbarkeit / Availability

### 2.1 Verfügbarkeitsziel / Availability Target

| Plan | Monatliche Verfügbarkeit | Max. Ausfallzeit/Monat |
|---|---|---|
| **Starter** | 99,5% | ~3,6 Stunden |
| **Professional** | 99,9% | ~43 Minuten |
| **Enterprise** | 99,95% (oder individuell) | ~22 Minuten |

### 2.2 Berechnung / Calculation

```
Verfügbarkeit (%) = (Gesamtminuten − Ausfallminuten − Ausschlüsse) / (Gesamtminuten − Ausschlüsse) × 100
```

**Gesamtminuten** = Anzahl Minuten im Kalendermonat (z.B. 43'200 für 30 Tage).

### 2.3 Messung / Measurement

Die Verfügbarkeit wird gemessen durch:

- Synthetische Health-Check-Abfragen alle 1 Minute an `/api/health`
- Ein Dienst gilt als nicht verfügbar, wenn 3 aufeinanderfolgende Prüfungen fehlschlagen
- Das Monitoring-System ist die verbindliche Datenquelle

---

## 3. Ausschlüsse / Exclusions

Folgende Zeiten werden **nicht** als Ausfallzeit berechnet:

| Ausschluss / Exclusion | Details |
|---|---|
| **Geplante Wartung** | Mit 72 Stunden Vorankündigung, max. 4 Stunden/Monat, ausserhalb Geschäftszeiten (20:00–06:00 CET) |
| **Notfallwartung** | Kritische Sicherheitsupdates mit schnellstmöglicher Vorankündigung |
| **Höhere Gewalt** | Gemäss Art. 13 AGB |
| **Kundenseitige Probleme** | Internet-Ausfall, Browser-Probleme, Endgeräte |
| **Drittanbieter-Ausfälle** | Azure-Plattform-Ausfälle, sofern nicht ConTigo zurechenbar |
| **Abuse/Überlastung** | Durch den Kunden verursachte Überlastung |
| **API-Missbrauch** | Überschreitung der Rate Limits durch den Kunden |

---

## 4. Leistungskennzahlen / Performance Metrics

### 4.1 Antwortzeiten / Response Times

| Endpunkt / Endpoint | Ziel (p95) | Messung |
|---|---|---|
| **Seitenaufbau (Dashboard)** | <2 Sekunden | Lighthouse / web-vitals |
| **API-Antwortzeit** | <500 ms | Prometheus Histogram |
| **Vertragsextraktion (KI)** | <120 Sekunden | Queue-Metriken |
| **Chatbot (erste Antwort)** | <3 Sekunden | OTel Spans |
| **Datei-Upload (100 MB)** | <30 Sekunden | API-Metriken |
| **Suche** | <1 Sekunde | API-Metriken |

### 4.2 Datenintegrität / Data Integrity

| Massnahme / Measure | Zusage / Commitment |
|---|---|
| **Datenaufbewahrung** | Keine Datenverluste (RPO: max. 15 Min.) |
| **Backup-Häufigkeit** | Täglich (Snapshot) + kontinuierlich (WAL) |
| **Backup-Aufbewahrung** | 35 Tage |
| **Wiederherstellungszeit (RTO)** | <4 Stunden (Starter), <1 Stunde (Professional), <30 Min. (Enterprise) |

---

## 5. Gutschriftenregelung / Credit Policy

### 5.1 Gutschriftenberechnung / Credit Calculation

Bei Unterschreitung der Verfügbarkeitsziele im **Professional-** oder **Enterprise-Plan**:

| Monatliche Verfügbarkeit | Gutschrift (% der Monatsgebühr) |
|---|---|
| 99,0% – <99,9% (Professional) bzw. <99,95% (Enterprise) | 10% |
| 98,0% – <99,0% | 25% |
| 95,0% – <98,0% | 50% |
| <95,0% | 100% |

### 5.2 Maximale Gutschrift / Maximum Credit

Die Gesamtgutschrift pro Monat ist auf **100% der monatlichen Abonnementgebühr** begrenzt. Gutschriften werden ausschliesslich als Kontoguthaben gewährt (keine Barauszahlung).

### 5.3 Geltendmachung / Claiming Credits

1. Der Kunde muss die Gutschrift innerhalb von **30 Tagen** nach dem betroffenen Monat schriftlich geltend machen an: <sla@contigo-app.ch>
2. Die Anfrage muss enthalten: Datum/Uhrzeit des Ausfalls, betroffene Dienste, Auswirkung
3. ConTigo bestätigt oder bestreitet den Anspruch innerhalb von **10 Werktagen**
4. Genehmigte Gutschriften werden auf die nächste Rechnung angerechnet

---

## 6. Support-Stufen / Support Tiers

### 6.1 Incident-Prioritäten / Incident Priorities

| Priorität / Priority | Definition | Beispiel / Example |
|---|---|---|
| **P1 — Kritisch** | Plattform nicht verfügbar, Datenverlust | Kompletter Ausfall, Datenbank-Fehler |
| **P2 — Hoch** | Kernfunktion beeinträchtigt, kein Workaround | KI-Extraktion fehlgeschlagen, Upload nicht möglich |
| **P3 — Mittel** | Funktion beeinträchtigt, Workaround vorhanden | Langsame Suche, Dashboard-Anzeigefehler |
| **P4 — Niedrig** | Kosmetisch oder Feature-Wunsch | UI-Darstellungsfehler, Verbesserungsvorschlag |

### 6.2 Reaktionszeiten / Response Times

| Priorität | Starter | Professional | Enterprise |
|---|---|---|---|
| **P1 — Kritisch** | <24 Stunden | <4 Stunden | <1 Stunde |
| **P2 — Hoch** | <48 Stunden | <8 Stunden | <4 Stunden |
| **P3 — Mittel** | <5 Werktage | <2 Werktage | <1 Werktag |
| **P4 — Niedrig** | Best Effort | <5 Werktage | <3 Werktage |

### 6.3 Lösungszeiten / Resolution Times

| Priorität | Professional | Enterprise |
|---|---|---|
| **P1 — Kritisch** | <8 Stunden | <4 Stunden |
| **P2 — Hoch** | <24 Stunden | <8 Stunden |
| **P3 — Mittel** | <5 Werktage | <3 Werktage |
| **P4 — Niedrig** | <20 Werktage | <10 Werktage |

### 6.4 Support-Kanäle / Support Channels

| Kanal / Channel | Starter | Professional | Enterprise |
|---|---|---|---|
| **Knowledge Base** | ✅ | ✅ | ✅ |
| **E-Mail** | ✅ | ✅ | ✅ |
| **In-App Chat** | — | ✅ | ✅ |
| **Telefon** | — | — | ✅ |
| **Dedizierter CSM** | — | — | ✅ |
| **Slack-Kanal** | — | — | ✅ |

---

## 7. Wartung / Maintenance

### 7.1 Geplante Wartung / Scheduled Maintenance

| Parameter | Detail |
|---|---|
| **Vorankündigungsfrist** | Mindestens 72 Stunden |
| **Wartungsfenster** | Samstag/Sonntag 20:00–06:00 CET |
| **Maximale Dauer/Monat** | 4 Stunden |
| **Benachrichtigung** | E-Mail + In-App-Banner + Statusseite |

### 7.2 Notfallwartung / Emergency Maintenance

Für kritische Sicherheitsupdates kann ConTigo die Vorankündigungsfrist auf ein Minimum reduzieren. Betroffene Kunden werden schnellstmöglich informiert.

### 7.3 Statusseite / Status Page

Aktuelle Verfügbarkeitsinformationen unter: [status.contigo-app.ch](https://status.contigo-app.ch)

Kunden können Status-Updates per E-Mail abonnieren.

---

## 8. Eskalation / Escalation

### 8.1 Eskalationsmatrix / Escalation Matrix

| Stufe / Level | Zeitrahmen / Timeframe | Kontakt / Contact |
|---|---|---|
| **Stufe 1: Support** | Sofort | <support@contigo-app.ch> |
| **Stufe 2: Engineering Lead** | Nach 4 Stunden (P1) / 24 Stunden (P2) | <engineering@contigo-app.ch> |
| **Stufe 3: CTO** | Nach 8 Stunden (P1) / 48 Stunden (P2) | <cto@contigo-app.ch> |
| **Stufe 4: Geschäftsleitung** | Nach 24 Stunden (P1) | <management@contigo-app.ch> |

---

## 9. Berichterstattung / Reporting

### 9.1 Verfügbarkeitsberichte / Availability Reports

| Plan | Bericht / Report | Häufigkeit / Frequency |
|---|---|---|
| **Starter** | Statusseite | Echtzeit |
| **Professional** | Monatlicher Verfügbarkeitsbericht | Monatlich |
| **Enterprise** | Detaillierter SLA-Bericht + Quarterly Review | Monatlich + Q-Meeting |

### 9.2 Inhalt der Berichte / Report Contents

- Monatliche Verfügbarkeit (%)
- Anzahl und Dauer der Ausfälle
- Root-Cause-Analyse für P1/P2-Vorfälle
- Leistungskennzahlen (p95 Latenz)
- Geplante Verbesserungen

---

## 10. Schlussbestimmungen / Final Provisions

### 10.1 Ausschliesslicher Rechtsbehelf / Exclusive Remedy

Die in diesem SLA beschriebenen Gutschriften sind der ausschliessliche und alleinige Rechtsbehelf des Kunden für Verfügbarkeitsverstösse.

*Credits described in this SLA are the Customer's sole and exclusive remedy for availability breaches.*

### 10.2 Änderungen / Amendments

ConTigo kann dieses SLA mit 90 Tagen Vorankündigung ändern. Verschlechterungen der Verfügbarkeitsziele geben dem Kunden ein ausserordentliches Kündigungsrecht.

*ConTigo may amend this SLA with 90 days' notice. Reductions in availability targets entitle the Customer to extraordinary termination.*

### 10.3 Verweis / Reference

Für alle nicht in diesem SLA geregelten Punkte gelten die AGB. Bei Widersprüchen zwischen SLA und AGB geht das SLA vor.

*For matters not covered by this SLA, the GTC apply. In case of conflict, the SLA prevails.*

---

**Kontakt / Contact:** <sla@contigo-app.ch>

---

*ConTigo GmbH — Zürich, Schweiz*
*Letzte Aktualisierung / Last updated: Februar / February 2026*

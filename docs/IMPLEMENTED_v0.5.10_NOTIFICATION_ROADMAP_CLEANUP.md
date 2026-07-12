# v0.5.10 — Notification Roadmap Cleanup

## Ziel

Discord ist kein Zielkanal mehr fuer DayZ AIO. Der vorhandene minimale Discord-Webhook-Pfad wurde entfernt, damit die Notification-Roadmap auf ntfy und spaeter TS6 ausgerichtet bleibt.

## Geaendert

- Backend-Validation erlaubt nur noch `ntfy` und `webhook` als Notification-Targets.
- Der spezielle Discord-Payload-Zweig wurde entfernt.
- Die Notifications-UI zeigt nur noch `ntfy` und `webhook`.
- README/Implementierungsdocs wurden von Discord auf ntfy/Webhook bereinigt.
- Die zukuenftige Planung lautet: ntfy zuerst, danach TS6-Server/TS6-Manager-nahe Benachrichtigungen statt Discord.

## Nicht enthalten

- Kein TS6-Protokoll-Adapter.
- Kein TS6-Server-Control-Feature.
- Keine neue Notification-Queue.

## Manuelle Pruefung

- `grep -RIn "Discord\|discord"` soll keine Produkt-/UI-Integration mehr finden.
- Bestehende `ntfy`- und `webhook`-Targets bleiben kompatibel.

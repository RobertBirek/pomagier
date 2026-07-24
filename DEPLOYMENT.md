# Deployment — PomagierGT

## Stan: [Do weryfikacji]

Środowisko docelowe: VPS (Linux). [Wymaga decyzji: szczegóły VPS — dystrybucja, dostępne usługi, Docker?]

## Założenia

- Backend API i PWA serwowane z VPS Linux
- [Wymaga decyzji: connector ERP na Windows w sieci Subiekta?]
- [Wymaga decyzji: Docker czy bare metal na VPS?]
- TLS dla wszystkich połączeń zewnętrznych
- Health check endpointy dla każdej usługi
- Backup przed każdą migracją

## Elementy do skonfigurowania

- [ ] Dockerfile (multi-stage)
- [ ] docker-compose.yml (development)
- [ ] .env.example (bez sekretów)
- [ ] Walidacja konfiguracji przy starcie
- [ ] Health endpoint
- [ ] Procedura rollback
- [ ] Backup strategy

## Instrukcja uruchomienia

[Do utworzenia po pierwszej implementacji]

---
description: Deleguje zadania deploymentowe do subagenta pomagier-devops — Docker, VPS, zdrowie, deployment, zmienne środowiskowe.
agent: pomagier-devops
---

Wykonaj zadanie deploymentowe.

1. Sprawdź aktualny stan Dockerfile, docker-compose i konfiguracji środowiska.
2. Zweryfikuj zmienne środowiskowe (`.env.example` bez sekretów).
3. Uruchom health check jeśli aplikacja działa.
4. Wykonaj zadane polecenia deploymentowe.
5. Nie commituj sekretów ani artefaktów builda.
6. Podaj instrukcję uruchomienia i health check URL.

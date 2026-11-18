#!/usr/bin/env bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT/motores/regime-regular"
mkdir -p calculadora/db
chmod +x mvnw
./mvnw -B -ntp flyway:migrate -Dflyway.configFiles=./flyway/flyway-pro.conf
test -s calculadora/db/calculadora-pro.db
mkdir -p "$ROOT/infra/data"
cp calculadora/db/calculadora-pro.db "$ROOT/infra/data/calculadora-pro.db"
chmod 644 "$ROOT/infra/data/calculadora-pro.db"
echo "Banco SQLite gerado em infra/data/calculadora-pro.db"

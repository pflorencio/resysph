#!/usr/bin/env bash
set -e
python -m prisma generate
python -m prisma migrate deploy

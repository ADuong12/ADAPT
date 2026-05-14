#!/bin/sh
set -e

mkdir -p /app/data/uploads

if [ ! -f /app/data/adapt.db ]; then
    touch /app/data/adapt.db
fi

ln -sf /app/data/adapt.db /app/adapt.db
ln -sf /app/data/uploads /app/uploads

if [ ! -f /app/data/.secret_key ]; then
    touch /app/data/.secret_key
fi
ln -sf /app/data/.secret_key /app/.secret_key

exec "$@"
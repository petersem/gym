#!/bin/sh
set -eu

node backend/src/scripts/initializeDatabase.mjs
unset DB_INIT_USER DB_INIT_PASSWORD DB_ROOT_PASSWORD ADMIN_PASSWORD
exec "$@"

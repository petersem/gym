#!/bin/sh
set -e

if [ "${DATA_SEED:-false}" = "true" ]; then
  MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --protocol=socket -uroot --database="$MYSQL_DATABASE" < /opt/gym/seed.sql
  echo "Sample data seeded."
fi
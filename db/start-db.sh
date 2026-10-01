#!/bin/bash
set -e

/usr/local/bin/docker-entrypoint.sh "$@" &
mysql_pid=$!
trap 'kill -TERM "$mysql_pid" 2>/dev/null || true' TERM INT

(
  for attempt in {1..60}; do
    if MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --protocol=tcp -h127.0.0.1 -uroot --database="$MYSQL_DATABASE" -e 'SELECT 1' >/dev/null 2>&1; then
      for table in users activities blog locations sessions bookings; do
        exists=$(MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --protocol=socket -uroot --database="$MYSQL_DATABASE" -N -s -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = '$table'")
        if [ "$exists" = 1 ]; then
          echo "Table available: $table"
        else
          echo "Table missing: $table"
        fi
      done
      seeded=$(MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --protocol=socket -uroot --database="$MYSQL_DATABASE" -N -s -e "SELECT COUNT(*) FROM users WHERE email = 'de@gym.com'")
      if [ "$seeded" -gt 0 ]; then
        echo "Sample data added."
      else
        echo "Sample data ommitted."
      fi
      exit 0
    fi
    kill -0 "$mysql_pid" 2>/dev/null || exit 1
    sleep 1
  done
  echo "Database startup status check timed out." >&2
) &
status_pid=$!

exit_code=0
wait "$mysql_pid" || exit_code=$?
kill "$status_pid" 2>/dev/null || true
wait "$status_pid" 2>/dev/null || true
exit "$exit_code"
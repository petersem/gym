# syntax=docker/dockerfile:1

# MySQL with the gym schema, optional seed data and startup status script built in,
# so compose only needs this image and environment variables.
FROM mysql:8.0

COPY schema.sql /docker-entrypoint-initdb.d/01-schema.sql
COPY seed-if-enabled.sh /docker-entrypoint-initdb.d/02-seed.sh
COPY seed.sql /opt/gym/seed.sql
COPY start-db.sh /opt/gym/start-db.sh

RUN chmod 644 /docker-entrypoint-initdb.d/01-schema.sql /opt/gym/seed.sql \
    && chmod 755 /docker-entrypoint-initdb.d/02-seed.sh /opt/gym/start-db.sh

ENTRYPOINT ["bash", "/opt/gym/start-db.sh"]
CMD ["mysqld"]

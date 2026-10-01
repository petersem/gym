# Gym app

Noot Noot

```
services:
  gymdb:
    image: mysql:8.0
    container_name: gym-db
    restart: unless-stopped
    entrypoint: ["bash", "/opt/gym/start-db.sh"]
    command: ["mysqld"]
    environment:
      MYSQL_DATABASE: gym
      MYSQL_USER: gymuser
      MYSQL_PASSWORD: Testing123!
      MYSQL_ROOT_PASSWORD: rootpassword
      # Enable or disable data seeding - can only run on initial database creation
      DATA_SEED: true
    ports:
      - "${DB_PORT}:3306"
    volumes:
      - db-data:/var/lib/mysql
      - ./db/schema.sql:/docker-entrypoint-initdb.d/01-schema.sql:ro
      - ./db/seed-if-enabled.sh:/docker-entrypoint-initdb.d/02-seed.sh:ro
      - ./db/seed.sql:/opt/gym/seed.sql:ro
      - ./db/start-db.sh:/opt/gym/start-db.sh:ro
    healthcheck:
      test:
        [
          "CMD",
          "mysqladmin",
          "ping",
          "-h",
          "127.0.0.1",
          "-uroot",
          "-prootpassword",
        ]
      interval: 10s
      timeout: 5s
      retries: 10

  app:
    image: petersem/gym:latest
    container_name: gym-app
    restart: unless-stopped
    ports:
      - "3001:3000"
    environment:
      NODE_ENV: production
      PORT: 3000
      DB_HOST: gymdb
      DB_PORT: 3306
      DB_USER: ${DB_USER}
      DB_PASSWORD: ${DB_PASSWORD}
      DB_NAME: ${DB_NAME}
      ADMIN_EMAIL: ${ADMIN_EMAIL}
      ADMIN_SEED_PASSWORD: ${ADMIN_SEED_PASSWORD}
    command: ["sh", "-c", "node backend/src/scripts/seedAdmin.mjs && exec node backend/src/server.mjs"]
    depends_on:
      gymdb:
        condition: service_healthy

volumes:
  db-data:
```

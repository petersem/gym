# Gym app

Gym app for Tafe stage 2 assessment

- Backend MVC app
- Backend API (coming soon)
- Frontend React app (coming soon)

![gym app](https://raw.githubusercontent.com/petersem/gym/main/gh-assets/gymapp.png)

[![Architecture diagram of petersem/gym](https://gitdiagram.com/petersem/gym/diagram.png)](https://gitdiagram.com/petersem/gym?utm_source=readme&utm_medium=picture)

## Form validation

Backend login, registration, and all management POST forms define their
`express-validator` rules in their respective [controllers](backend/src/controllers). Authentication uses `loginValidation` and `registerValidation`. Management controllers use `formValidation`.

- The shared [form validation utility](backend/src/utilities/formValidation.mjs) only provides
  action/ID validation for management forms and saving feedback before redirecting.
- The [feedback middleware](backend/src/middleware/formFeedback.mjs) only exposes
  saved errors and values to EJS; it does not define field-specific rules.
- Invalid submissions redirect (HTTP 303) to the originating form GET page before password hashing or model writes.
- Validation feedback displays messages beneath each field and preserves non-sensitive entered values and URL
  filters.
- Passwords and authentication keys are never saved in feedback. Password inputs are cleared after rejection and must be re-entered.
- Invalid-form redirects include `#form-validation`, scrolling the reloaded page to the error summary at the start of the create/edit form.
- When errors are displayed, a page-show handler also focuses and scrolls to the summary after page loading, including repeated invalid submissions to the same URL.
- The booking calendar shows a correction form for rejected booking submissions.
- Rules enforce required text, database column lengths, email and phone formats,
- Supported roles/actions, integer IDs, real calendar dates, and valid session
  times (24-hour or AM/PM).
- New passwords require at least 8 characters and no more than 36.
- EJS forms contain no required/length/pattern validation rules and use
  `novalidate` so submissions reach the server. (Project **MUST** be all server-side)
- This validation covers HTML form routes, not the API handlers.

## Example `.env` file

```
DB_HOST=127.0.0.1
DB_PORT=3307
DB_ROOT_PASSWORD=rootpassword
DB_USER=gymuser
DB_PASSWORD=Testing123!
DB_NAME=gym
ADMIN_EMAIL=admin@example.com
ADMIN_SEED_PASSWORD=testing123
DATA_SEED=true
```

## Example `compose.yaml` file

Only this file and a `.env` file are needed. The `petersem/gym-db` image includes the schema, optional seed data
and startup script.

```
services:
  gymdb:
    image: petersem/gym-db:latest
    container_name: gym-db
    restart: unless-stopped
    environment:
      MYSQL_DATABASE: ${DB_NAME}
      MYSQL_USER: ${DB_USER}
      MYSQL_PASSWORD: ${DB_PASSWORD}
      MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASSWORD}
      # Enable or disable data seeding - can only run on initial database creation
      DATA_SEED: ${DATA_SEED}
    ports:
      - ${DB_PORT}:3306
    volumes:
      - db-data:/var/lib/mysql
    healthcheck:
      test:
        [
          "CMD-SHELL",
          'MYSQL_PWD="$$MYSQL_ROOT_PASSWORD" mysqladmin ping -h 127.0.0.1 -uroot',
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
    command:
      [
        "sh",
        "-c",
        "node backend/src/scripts/seedAdmin.mjs && exec node backend/src/server.mjs",
      ]
    depends_on:
      gymdb:
        condition: service_healthy

volumes:
  db-data:
```

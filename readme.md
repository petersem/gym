# Gym app

Gym app for Tafe stage 2 assessment

- Backend MVC app
- Backend API (coming soon)
- Frontend React app (coming soon)

![gym app](https://raw.githubusercontent.com/petersem/gym/main/gh-assets/gymapp.png)

[![Architecture diagram of petersem/gym](https://gitdiagram.com/petersem/gym/diagram.png)](https://gitdiagram.com/petersem/gym?utm_source=readme&utm_medium=picture)

## Navigation

On screens up to 760px wide, primary navigation collapses into a hamburger
menu. The native HTML `details`/`summary` control supports mouse, touch, and
keyboard toggling without JavaScript. Desktop navigation remains expanded,
and both layouts use the same role-based links.

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
- Invalid-form redirects include `#form-validation`, scrolling the reloaded page to the error summary at the start of the create/edit form.
- When errors are displayed, a page-show handler also focuses and scrolls to the summary after page loading, including repeated invalid submissions to the same URL.
- The booking calendar shows a correction form for rejected booking submissions.
- Rules enforce required text, database column lengths, email and phone formats,
- Supported roles/actions, integer IDs, real calendar dates, and valid session
  times (24-hour or AM/PM).
- New passwords require at least 8 characters and no more than 36.
- EJS forms contain no required/length/pattern validation rules and use
  `novalidate` so submissions reach the server. (Project **MUST** be all server-side)
- Required field labels show `*`, with a `* Required fields` note in each data-entry
  form. These visual markers match server validation; date of birth and search/filter
  controls remain optional.
- This validation covers HTML form routes, not the API handlers.

## Shared backend environment

Keep local settings in `backend/.env`. Copy [backend/.env.example](backend/.env.example)
and replace its placeholder passwords when setting up a new checkout. The real
environment file is excluded from Git and Docker builds. Do not put secrets in
the example file.

The `dev`, `dev-full`, `prod`, and `dbcreate` backend scripts all load this file.
The server launcher sets `NODE_ENV` to `development` for `dev` and `production`
for `prod`; it does not need separate environment files. Nodemon also watches
the shared environment file so saved changes restart the development server.

Example `backend/.env`:

```
# app settings
PORT=3000

# database connection settings
DB_HOST=127.0.0.1
DB_PORT=3307
DB_ROOT_PASSWORD=rootymctooty
DB_NAME=gym

# database app user credentials
DB_USER=gymuser
DB_PASSWORD=Testing123!

# app admin credentials
ADMIN_EMAIL=admin@gym.com
ADMIN_PASSWORD=testing123
DATA_SEED=true

```

## Example `compose.yaml` file

Only this file and `backend/.env` are needed. Use the standard `mysql:8.0` image;
gymapp contains the schema, optional sample data, and initialization script.
Rebuild/publish gymapp before using this configuration with an older image.

Compose does not automatically load an environment file in a subfolder. From
the repository root, start the published images with
`docker compose --env-file backend/.env -f compose.yml up -d`.
For a local image build, use
`docker compose --env-file backend/.env -f docker-compose.yml up -d --build`.
Compose uses the same credentials, but overrides the app's database host and
port to the internal MySQL service address and port 3306.

```
services:
  gymdb:
    image: mysql:8.0
    container_name: gymdb
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASSWORD}
      MYSQL_ROOT_HOST: "%"
    ports:
      - ${DB_PORT}:3306
    volumes:
      - gymdb-data:/var/lib/mysql
    healthcheck:
      # $$ defers expansion to the container so the healthcheck uses its own root password.
      test:
        [
          "CMD-SHELL",
          'MYSQL_PWD="$$MYSQL_ROOT_PASSWORD" mysqladmin ping -h 127.0.0.1 -uroot',
        ]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 180s

  gymapp:
    image: petersem/gym:latest
    container_name: gymapp
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
      DB_INIT_USER: root
      DB_INIT_PASSWORD: ${DB_ROOT_PASSWORD}
      DATA_SEED: ${DATA_SEED:-false}
      ADMIN_EMAIL: ${ADMIN_EMAIL}
      ADMIN_PASSWORD: ${ADMIN_PASSWORD}
    depends_on:
      gymdb:
        condition: service_healthy

volumes:
  gymdb-data:
```

## Database initialization

The gymapp entrypoint waits for MySQL, creates `DB_NAME` and `DB_USER` if absent,
grants the app account SELECT/INSERT/UPDATE/DELETE access, creates the tables,
and ensures an admin account exists before starting the server. Failures stop
startup rather than serving an uninitialized database.

- `DB_INIT_USER` defaults to `root`; `DB_INIT_PASSWORD` falls back to
  `DB_ROOT_PASSWORD` when absent or empty. Set `DB_INIT_PASSWORD` explicitly when
  using a separate initialization account with a different password. This account
  must have database/user creation, grant, and schema modification privileges.
  It must be different from `DB_USER`. The entrypoint removes its credentials
  from the server process environment after initialization.
- MySQL needs `MYSQL_ROOT_HOST: "%"` for gymapp to connect as root from another
  container on a **new** volume. On an existing volume, environment variables do
  not change accounts: configure an accessible privileged account yourself and
  set `DB_INIT_USER`/`DB_INIT_PASSWORD` accordingly.
- Keep MySQL on a private network, use strong passwords, and do not expose its
  published port to untrusted networks. The published DB port is optional.
- Existing app users are not reset or given a new password. `DB_PASSWORD` must
  match the account already present; startup verifies that connection.
- Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` for the first admin account.
  The password is not printed in initialization logs. Changing this value does
  not reset the password of an existing admin account.
- `DATA_SEED=true` seeds sample data only when initializing a new, empty schema.
  The initial choice is recorded in `gym_initialization`; changing it later
  does not seed an existing database. Existing complete schemas are adopted
  without replacing tables or inserting sample data.
- An advisory lock serializes initialization by concurrent gymapp instances.
  Table creation is non-destructive and resumable; sample data, admin creation,
  and the completion marker commit in one transaction. An untracked, partially
  populated schema is rejected for manual repair rather than silently accepted.
- Table creation is initial setup, not a migration system for future schema
  changes. Back up existing databases before changing deployment configuration;
  preserve their volumes and use MySQL 8.0 when replacing the old custom image.

For local Node development, run `npm run dbcreate --workspace backend` from the
repository root once before starting `npm run dev-full --workspace backend`.
Initialization and the server use the same `backend/.env` settings.

## Tests

The full suite includes a live MySQL integration test. Use an isolated test
database, not your application database. Set `DB_HOST`, `DB_PORT`, `DB_NAME`,
`DB_USER`, and `DB_PASSWORD` to that database before running `npm test -- --runInBand`.
The test runner does not automatically load `.env` files. Initialize a new test
database with the initialization script first (including its privileged and
initial admin credentials), then run tests with the same runtime database settings.
An unavailable MySQL server will cause the integration test to fail.

Coverage thresholds remain 100% for statements, branches, functions, and lines
of the modules exercised by the suite.

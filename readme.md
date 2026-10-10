# Gym app

Gym app for Tafe stage 2 assessment

- Backend MVC app
- Backend API (coming soon)
- Frontend React app (coming soon)

## Backend Gym App

![gym app](https://raw.githubusercontent.com/petersem/gym/main/gh-assets/gymapp.png)

### Architecture

![Architecture diagram](https://raw.githubusercontent.com/petersem/gym/main/gh-assets/diagram.png)

### Bookings

The desktop and mobile menus highlight the current page section, including its
record-edit pages. This works with or without JavaScript.

On the Bookings page, selecting **All locations** shows the session location beneath each booking. Selecting a specific location hides this extra line.

### Sitemap by Role

**Role colors:**

![Guest on blue, Member on green, Trainer on orange and Admin on purple backgrounds](gh-assets/role-legend.svg)

![Role sitemap with blue Guest, green Member, orange Trainer and purple Admin tick backgrounds](gh-assets/role-sitemap.svg)

¹ Trainers can manage only their own

² Guests can only view, not book sessions

### Hierarchical Sitemap

The Dashboard is the landing page for all roles. Its content changes for guests,
members, trainers and admins; the dashboard views below are not separate pages.

![Hierarchical gym sitemap with connected page boxes and colored access circles: blue Guest, green Member, orange Trainer and purple Admin](gh-assets/hierarchical-sitemap.svg)

### Running the code

> There is NO NEED to run any speific database or schema creation SQL. The application takes care of this for you.

### Sample data

If you choose to seed sample data on your first install, the passowrd for all sample users is `testing123`.

Besides your app admin account, here are a few users to get you started:

#### Trainers

- dv@gym.com
- de@gym.com

#### Members

- ep@gym.com
- ww@gym.com

#### Development Environment

- You will need to have mySQL v8 or above installed and running
- Configure the .env file.

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

# Seed sample data into database
DATA_SEED=true
```

- If you have just cloned this repo, run `npm i` and `npm i -w backend` to install prerequisit packages.
- From the top-level folder, run the following command `npm run devall -w backend`

> This is how you will start the app in development every time.

- A database initialisation script process is started. If this is a new installation the following will execute, otherwise these steps will skip:
  - Create the database
  - Create tables and foriegn keys
  - Create a database user account for the application
  - Set priviledges for database user account
  - Create an application admin user if there is no admin
  - Seed sample data if a new database and the seed option is true
- The application is then started and available locally on the specified port.

** Other dev options **

- Run unit and integration tests with individual test results and coverage `npm run test`
- Run eslint linter `npm run lint`
- Run prettier linter `npm run prettier:check`
- Generate JSDoc documentation _backend/src/public/docs_ `npm run jsdoc`
- Run tests with output to _test_results.txt_ file `npm run testfilee`

#### Docker (Recomended for production)

- Docker is installed and configured
- On your docker host machine, create and populate `.env` and `compose.yaml` files. Suggested options below:

Example `.env`:

```
# app settings
PORT=3000

# database connection settings
DB_HOST=127.0.0.1
# This is the port if you want to connect with mysql workbench. Change as needed
DB_PORT=3307
# Your mySQL root password
DB_ROOT_PASSWORD=rootymctooty
DB_NAME=gym

# database app user credentials
DB_USER=gymuser
DB_PASSWORD=Testing123!

# app admin credentials
ADMIN_EMAIL=admin@gym.com
ADMIN_PASSWORD=testing123

# Option to populate with same data (only on first install)
DATA_SEED=true

```

Example `compose.yaml` file

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

Once you have configured these files, from the same directory, run `docker compose up -d gymapp` This will first create and install mySQL, and then it will create a container for the gym app.

> If this is the first time the database is being created, this process can take a couple of minutes before things are running. Be patient!

Once it says gymdb is `healthy` and gymapp says `running`, the app is ready to be opened in a browser on the docker host ip:[specified port]

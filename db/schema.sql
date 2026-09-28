-- Schema used for local/dev deployment (mirrors .github/workflows/unit-tests.yml).
CREATE TABLE IF NOT EXISTS users (
  id INT NOT NULL AUTO_INCREMENT,
  first_name VARCHAR(45) NOT NULL,
  last_name VARCHAR(45) NOT NULL,
  role ENUM('admin', 'trainer', 'member') NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(70) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  dob DATE NULL,
  deleted TINYINT NOT NULL DEFAULT 0,
  authentication_key VARCHAR(36) NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS activities (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(45) NOT NULL,
  description VARCHAR(150) NULL,
  deleted TINYINT NOT NULL DEFAULT 0,
  updated_by INT NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  CONSTRAINT fk_activity_updated_by FOREIGN KEY (updated_by) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS locations (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(45) NOT NULL,
  street VARCHAR(100) NOT NULL,
  suburb VARCHAR(100) NOT NULL,
  postcode INT NOT NULL,
  manager INT NOT NULL,
  deleted TINYINT NOT NULL DEFAULT 0,
  updated_by INT NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  CONSTRAINT fk_location_manager FOREIGN KEY (manager) REFERENCES users (id),
  CONSTRAINT fk_location_updated_by FOREIGN KEY (updated_by) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id INT NOT NULL AUTO_INCREMENT,
  title VARCHAR(200) NOT NULL,
  activity_id INT NOT NULL,
  location_id INT NOT NULL,
  trainer_id INT NOT NULL,
  date DATE NOT NULL,
  time TIME NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_session_activity FOREIGN KEY (activity_id) REFERENCES activities (id),
  CONSTRAINT fk_session_location FOREIGN KEY (location_id) REFERENCES locations (id),
  CONSTRAINT fk_session_trainer FOREIGN KEY (trainer_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS bookings (
  id INT NOT NULL AUTO_INCREMENT,
  session_id INT NOT NULL,
  user_id INT NOT NULL,
  created DATETIME NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_booking_session FOREIGN KEY (session_id) REFERENCES sessions (id),
  CONSTRAINT fk_booking_user FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS blog (
  id INT NOT NULL AUTO_INCREMENT,
  create_date DATETIME NOT NULL,
  user_id INT NOT NULL,
  subject VARCHAR(100) NOT NULL,
  body VARCHAR(250) NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_blog_user FOREIGN KEY (user_id) REFERENCES users (id)
);

INSERT INTO users
  (id, first_name, last_name, role, email, password, phone, dob, deleted)
VALUES
  (1, 'Admin', 'User', 'admin', 'admin@example.com', 'seeded', '0000000000', '2000-01-01', 0)
ON DUPLICATE KEY UPDATE id = id;

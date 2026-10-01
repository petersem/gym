
--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `first_name` varchar(45) NOT NULL,
  `last_name` varchar(45) NOT NULL,
  `role` enum('admin','trainer','member') NOT NULL,
  `email` varchar(100) NOT NULL,
  `password` varchar(70) NOT NULL,
  `phone` varchar(20) NOT NULL,
  `dob` date DEFAULT NULL,
  `deleted` tinyint NOT NULL DEFAULT '0',
  `authentication_key` varchar(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_UNIQUE` (`id`),
  UNIQUE KEY `username_UNIQUE` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
SELECT 'Created table: users' AS message;
/*!40101 SET character_set_client = @saved_cs_client */;


-- Dump completed on 2026-09-28 22:30:34

--
-- Table structure for table `activities`
--

DROP TABLE IF EXISTS `activities`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `activities` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(45) NOT NULL,
  `description` varchar(150) DEFAULT NULL,
  `deleted` tinyint NOT NULL DEFAULT '0',
  `updated_by` int NOT NULL DEFAULT '2',
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_UNIQUE` (`id`),
  KEY `fk_updy_user_idx` (`updated_by`),
  CONSTRAINT `fk_updby_user` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2518 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
SELECT 'Created table: activities' AS message;
/*!40101 SET character_set_client = @saved_cs_client */;


--
-- Table structure for table `blog`
--

DROP TABLE IF EXISTS `blog`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `blog` (
  `id` int NOT NULL AUTO_INCREMENT,
  `create_date` datetime NOT NULL,
  `user_id` int NOT NULL,
  `subject` varchar(100) NOT NULL,
  `body` varchar(250) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_UNIQUE` (`id`),
  KEY `fk_blog_user` (`user_id`),
  CONSTRAINT `fk_blog_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=12706 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
SELECT 'Created table: blog' AS message;
/*!40101 SET character_set_client = @saved_cs_client */;


--
-- Table structure for table `locations`
--

DROP TABLE IF EXISTS `locations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `locations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `phone` varchar(20) NOT NULL,
  `email` varchar(45) NOT NULL,
  `street` varchar(100) NOT NULL,
  `suburb` varchar(100) NOT NULL,
  `postcode` int NOT NULL,
  `manager` int NOT NULL,
  `deleted` tinyint NOT NULL DEFAULT '0',
  `updated_by` int NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_UNIQUE` (`id`),
  KEY `fk_location_manager_idx` (`manager`),
  KEY `fk_loc_user_idx` (`updated_by`),
  CONSTRAINT `fk_loc_user` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_location_manager` FOREIGN KEY (`manager`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2957 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
SELECT 'Created table: locations' AS message;
/*!40101 SET character_set_client = @saved_cs_client */;


--
-- Table structure for table `sessions`
--

DROP TABLE IF EXISTS `sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sessions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(200) NOT NULL,
  `activity_id` int NOT NULL,
  `location_id` int NOT NULL,
  `trainer_id` int NOT NULL,
  `date` date NOT NULL,
  `time` time NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_UNIQUE` (`id`),
  KEY `fk_loc_sess_idx` (`location_id`),
  KEY `fk_act_sess_idx` (`activity_id`),
  KEY `fk_user_sess_idx` (`trainer_id`),
  CONSTRAINT `fk_act_sess` FOREIGN KEY (`activity_id`) REFERENCES `activities` (`id`),
  CONSTRAINT `fk_loc_sess` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`),
  CONSTRAINT `fk_user_sess` FOREIGN KEY (`trainer_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2377 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
SELECT 'Created table: sessions' AS message;
/*!40101 SET character_set_client = @saved_cs_client */;


--
-- Table structure for table `bookings`
--

DROP TABLE IF EXISTS `bookings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bookings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `session_id` int NOT NULL,
  `user_id` int NOT NULL,
  `created` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_UNIQUE` (`id`),
  KEY `fk_user_sess_idx` (`user_id`),
  KEY `fk_book_sess_idx` (`session_id`),
  CONSTRAINT `fk_book_sess` FOREIGN KEY (`session_id`) REFERENCES `sessions` (`id`),
  CONSTRAINT `fk_book_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2245 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
SELECT 'Created table: bookings' AS message;
/*!40101 SET character_set_client = @saved_cs_client */;

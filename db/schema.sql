
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
) ENGINE=InnoDB AUTO_INCREMENT=12707 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'Matt','Petersen','admin','admin@gym.com','$2b$10$HWYjiJDArwT/OxIH1rCXK..aK/8R.lYokhCeIkM2bdiwDjEhEjEs2','',NULL,0,NULL),(2,'Doctor','Evil','trainer','de@gym.com','$2b$10$HWYjiJDArwT/OxIH1rCXK..aK/8R.lYokhCeIkM2bdiwDjEhEjEs2','08675309','2026-09-10',0,''),(5,'Lex','Luthor','trainer','ll@gym.com','$2b$10$HWYjiJDArwT/OxIH1rCXK..aK/8R.lYokhCeIkM2bdiwDjEhEjEs2','',NULL,0,NULL),(6,'Doctor','Octavius','member','oo@gym.com','$2b$10$HWYjiJDArwT/OxIH1rCXK..aK/8R.lYokhCeIkM2bdiwDjEhEjEs2','',NULL,0,NULL),(8,'Emperor','Palpatine','member','ep@gym.com','$2b$10$HWYjiJDArwT/OxIH1rCXK..aK/8R.lYokhCeIkM2bdiwDjEhEjEs2','',NULL,0,NULL),(9772,'Count','Dracula','member','cd@gym.com','$2b$10$HWYjiJDArwT/OxIH1rCXK..aK/8R.lYokhCeIkM2bdiwDjEhEjEs2','12344321','1624-01-06',0,NULL),(9773,'Doctor','Doom','trainer','dd@gym.com','$2b$10$m.3qArCXeuZ4ICZT5Xt/9.Kd2tpg.LYu.T9OJT3sI4XLeZ58fy5fW','09876543','1974-05-04',0,''),(9985,'Ronan','Accuser','member','ra@gym.com','$2b$10$vBMPRiWc7NLEGCXXSXIg4eGI9F3Fe/GNtLtbQMKNeGu8typN5kAY6','555-1009','1990-01-01',0,NULL),(9987,'Thanos','Titan','member','tt@gym.com','$2b$10$vBMPRiWc7NLEGCXXSXIg4eGI9F3Fe/GNtLtbQMKNeGu8typN5kAY6','555-1011','1990-01-01',0,NULL),(9988,'Ultron','Prime','member','up@gym.com','$2b$10$vBMPRiWc7NLEGCXXSXIg4eGI9F3Fe/GNtLtbQMKNeGu8typN5kAY6','555-1012','1990-01-01',0,NULL),(9996,'Kang','Conqueror','member','kc@gym.com','$2b$10$vBMPRiWc7NLEGCXXSXIg4eGI9F3Fe/GNtLtbQMKNeGu8typN5kAY6','555-1020','1990-01-01',0,NULL),(9997,'Agatha','Harkness','member','ah@gym.com','$2b$10$vBMPRiWc7NLEGCXXSXIg4eGI9F3Fe/GNtLtbQMKNeGu8typN5kAY6','555-1021','1990-01-01',0,NULL),(10004,'Norman','Osborn','member','no@gym.com','$2b$10$vBMPRiWc7NLEGCXXSXIg4eGI9F3Fe/GNtLtbQMKNeGu8typN5kAY6','555-1028','1990-01-01',0,NULL),(10006,'Harry','Osborn','member','ho@gym.com','$2b$10$vBMPRiWc7NLEGCXXSXIg4eGI9F3Fe/GNtLtbQMKNeGu8typN5kAY6','555-1030','1990-01-01',0,NULL),(10009,'Eddie','Brock','member','eb@gym.com','$2b$10$vBMPRiWc7NLEGCXXSXIg4eGI9F3Fe/GNtLtbQMKNeGu8typN5kAY6','555-1033','1990-01-01',0,''),(10014,'Bane','Santiago','member','bs@gym.com','$2b$10$vBMPRiWc7NLEGCXXSXIg4eGI9F3Fe/GNtLtbQMKNeGu8typN5kAY6','555-1038','1990-01-01',0,NULL),(10015,'Harvey','Dent','member','hd@gym.com','$2b$10$vBMPRiWc7NLEGCXXSXIg4eGI9F3Fe/GNtLtbQMKNeGu8typN5kAY6','555-1039','1990-01-01',0,NULL),(10017,'Oswald','Cobblepot','member','oc@gym.com','$2b$10$vBMPRiWc7NLEGCXXSXIg4eGI9F3Fe/GNtLtbQMKNeGu8typN5kAY6','555-1041','1990-01-01',0,NULL),(10018,'Selina','Kyle','member','sk@gym.com','$2b$10$vBMPRiWc7NLEGCXXSXIg4eGI9F3Fe/GNtLtbQMKNeGu8typN5kAY6','555-1042','1990-01-01',0,NULL),(10020,'Dru','Zod','member','dz@gym.com','$2b$10$vBMPRiWc7NLEGCXXSXIg4eGI9F3Fe/GNtLtbQMKNeGu8typN5kAY6','555-1044','1990-01-01',0,NULL),(10029,'Amora','Enchantress','member','ae@gym.com','$2b$10$vBMPRiWc7NLEGCXXSXIg4eGI9F3Fe/GNtLtbQMKNeGu8typN5kAY6','555-1053','1990-01-01',0,NULL),(10033,'Arthur','Fleck','member','af@gym.com','$2b$10$vBMPRiWc7NLEGCXXSXIg4eGI9F3Fe/GNtLtbQMKNeGu8typN5kAY6','555-1057','1990-01-01',0,NULL),(10036,'Walter','White','member','ww@gym.com','$2b$10$vBMPRiWc7NLEGCXXSXIg4eGI9F3Fe/GNtLtbQMKNeGu8typN5kAY6','555-1060','1990-01-01',0,NULL),(10037,'Gustavo','Fring','member','gf@gym.com','$2b$10$vBMPRiWc7NLEGCXXSXIg4eGI9F3Fe/GNtLtbQMKNeGu8typN5kAY6','555-1061','1990-01-01',0,NULL),(10039,'Cersei','Lannister','member','cl@gym.com','$2b$10$vBMPRiWc7NLEGCXXSXIg4eGI9F3Fe/GNtLtbQMKNeGu8typN5kAY6','555-1063','1990-01-01',0,NULL),(10040,'Ramsay','Bolton','member','rb@gym.com','$2b$10$vBMPRiWc7NLEGCXXSXIg4eGI9F3Fe/GNtLtbQMKNeGu8typN5kAY6','555-1064','1990-01-01',0,NULL),(10041,'Joffrey','Baratheon','member','jb@gym.com','$2b$10$vBMPRiWc7NLEGCXXSXIg4eGI9F3Fe/GNtLtbQMKNeGu8typN5kAY6','555-1065','1990-01-01',0,NULL),(10049,'Wilson','Fisk','member','wf@gym.com','$2b$10$vBMPRiWc7NLEGCXXSXIg4eGI9F3Fe/GNtLtbQMKNeGu8typN5kAY6','555-1073','1990-01-01',0,NULL),(10051,'Sauron','Mairon','member','sm@gym.com','$2b$10$vBMPRiWc7NLEGCXXSXIg4eGI9F3Fe/GNtLtbQMKNeGu8typN5kAY6','555-1075','1990-01-01',0,NULL),(10062,'Hannibal','Lecter','member','hl@gym.com','$2b$10$vBMPRiWc7NLEGCXXSXIg4eGI9F3Fe/GNtLtbQMKNeGu8typN5kAY6','555-1086','1990-01-01',0,NULL),(10066,'Hans','Gruber','member','hg@gym.com','$2b$10$vBMPRiWc7NLEGCXXSXIg4eGI9F3Fe/GNtLtbQMKNeGu8typN5kAY6','555-1090','1990-01-01',0,NULL),(10067,'Anakin','Skywalker','member','as3@gym.com','$2b$10$vBMPRiWc7NLEGCXXSXIg4eGI9F3Fe/GNtLtbQMKNeGu8typN5kAY6','555-1091','1990-01-01',0,NULL),(10070,'Agent','Smith','member','as4@gym.com','$2b$10$vBMPRiWc7NLEGCXXSXIg4eGI9F3Fe/GNtLtbQMKNeGu8typN5kAY6','555-1094','1990-01-01',0,NULL),(10071,'Norman','Bates','member','nb@gym.com','$2b$10$vBMPRiWc7NLEGCXXSXIg4eGI9F3Fe/GNtLtbQMKNeGu8typN5kAY6','555-1095','1990-01-01',0,NULL),(10072,'Freddy','Krueger','member','fk@gym.com','$2b$10$vBMPRiWc7NLEGCXXSXIg4eGI9F3Fe/GNtLtbQMKNeGu8typN5kAY6','555-1096','1990-01-01',0,NULL),(10073,'Jason','Voorhees','member','jv@gym.com','$2b$10$vBMPRiWc7NLEGCXXSXIg4eGI9F3Fe/GNtLtbQMKNeGu8typN5kAY6','555-1097','1990-01-01',0,NULL),(10074,'Michael','Myers','member','mm@gym.com','$2b$10$vBMPRiWc7NLEGCXXSXIg4eGI9F3Fe/GNtLtbQMKNeGu8typN5kAY6','555-1098','1990-01-01',0,NULL),(10075,'Pinhead','Cenobite','member','pc@gym.com','$2b$10$vBMPRiWc7NLEGCXXSXIg4eGI9F3Fe/GNtLtbQMKNeGu8typN5kAY6','555-1099','1990-01-01',0,NULL),(10085,'Deathstroke','Slade','member','ds@gym.com','$2b$10$vBMPRiWc7NLEGCXXSXIg4eGI9F3Fe/GNtLtbQMKNeGu8typN5kAY6','555-1109','1990-01-01',0,NULL),(10086,'Darth','Vader','trainer','dv@gym.com','$2b$10$EdWhUG.MkETbclY8AD9giOTLtod6v9YtlMjfxBXEh0PYt66QJTdC2','80081351','2026-09-16',0,'');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

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
  `updated_by` int NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_UNIQUE` (`id`),
  KEY `fk_updy_user_idx` (`updated_by`),
  CONSTRAINT `fk_updby_user` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2518 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `activities`
--

LOCK TABLES `activities` WRITE;
/*!40000 ALTER TABLE `activities` DISABLE KEYS */;
INSERT INTO `activities` VALUES (1,'Cardio','work yur guts out until you puke',0,1),(1909,'Bike Riding','Bring your spandex and take up all the road',0,1),(1910,'Posing','With your camera, you are the star',0,1),(1911,'Health Foods','Learn about what you can eat and drink to improve your health',0,1),(1912,'Boxing','Really sweat to make it happen',0,1),(1913,'Twerking','Move dat ass',0,1),(1914,'Flexibility','Free your body in coordinated stretching routines.',0,1),(2246,'Meditation','Focus on your middle eye to achieve enlightment.',0,1);
/*!40000 ALTER TABLE `activities` ENABLE KEYS */;
UNLOCK TABLES;

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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `blog`
--

LOCK TABLES `blog` WRITE;
/*!40000 ALTER TABLE `blog` DISABLE KEYS */;
INSERT INTO `blog` VALUES (9687,'2026-09-07 06:23:00',10015,'I Survived Leg Day','Woke up today and my legs filed for divorce. 10/10 would still skip the stairs at work.'),(9689,'2026-09-08 09:26:00',6,'Protein Shake or Punishment?','Tried a new protein powder that tastes like chalk and regret. My gains thank me, my taste buds have filed a formal complaint.'),(9691,'2026-09-09 01:40:00',10074,'Squat Rack Etiquette 101','PSA: \'working in\' does not mean staring at me while I catch my breath for four minutes. We are not the same.'),(9692,'2026-09-09 23:55:00',10073,'I Wore My Shirt Inside Out for the Whole Session','Nobody told me. Everybody saw. The tag said \'front\' and I still got it wrong.'),(9693,'2026-09-10 00:44:00',9772,'Cardio Bunny Confessions','Did 45 minutes on the elliptical while mentally redecorating my apartment. Zero calories burned in my imagination, sadly.'),(9695,'2026-09-10 22:07:00',10049,'Gym Selfie, Take 47','Turns out \'good lighting by the squat rack\' is code for \'blocking three people mid-set.\' Sorry, not sorry, the angle was perfect.'),(9697,'2026-09-12 06:56:00',10015,'My Pre-Workout Gave Me Main Character Energy','Felt like I could deadlift a car. Could not, in fact, deadlift a car. Could barely deadlift my gym bag afterwards.'),(9699,'2026-09-13 00:06:00',9772,'Group Class Survivor: Day 1','The instructor said \'just one more\' four times. I have never trusted anyone less in my entire life.'),(9700,'2026-09-14 06:52:00',10075,'Accidentally Made Eye Contact in the Mirror Mid-Grunt','There is no recovering from that. I have already changed gyms in my mind.'),(9702,'2026-09-15 07:07:00',10066,'I Tried the 5am Class','Discovered a secret society of people who are somehow both awake and cheerful before sunrise. I do not trust them, but I respect them.'),(9703,'2026-09-15 22:08:00',10029,'Forgot My Gym Card Again','The front desk knows my name, my face, and apparently my entire membership history by heart at this point. We\'re basically family.'),(9704,'2026-09-16 03:34:00',10073,'The Bench Press Wobble','Racked the bar like a newborn deer learning to walk. The spotter\'s face said everything my ego needed to hear.'),(9705,'2026-09-17 07:36:00',9772,'My Gym Bag Has Become a Biohazard','Found a banana peel from what I can only assume was a previous geological era. Send help, or at least a scented candle.'),(9706,'2026-09-16 23:47:00',10037,'Leg Press Machine vs. My Dignity','Loaded way too many plates to impress absolutely nobody, and now I understand true fear.'),(9708,'2026-09-18 00:43:00',10085,'I Made a Gym Friend and I Don\'t Even Know Their Name','We nod at each other by the water fountain. It\'s a whole relationship at this point, no names needed.'),(9710,'2026-09-19 00:39:00',10071,'The Mysterious Case of the Missing Dumbbell','The 12.5kg dumbbells vanish the second I need them. I\'m convinced they\'re plotting something in the storage room.'),(9711,'2026-09-20 05:00:00',10040,'Post-Workout Hunger Is a Personality Trait Now','Burned 300 calories, ate 1200 in celebration. The math checks out somewhere, probably.'),(9712,'2026-09-19 23:50:00',10020,'My Trainer Said \'Just Breathe\' and I Forgot How','Apparently inhaling and exhaling gets complicated under a barbell. Who knew.'),(9714,'2026-09-22 04:58:00',9985,'Gym Mirror Selfie Fail','Took twelve photos to get one where I don\'t look like I\'m mid-sneeze. Success rate: unacceptable.'),(9715,'2026-09-22 09:24:00',10039,'I Wore Jeans to the Gym Once','Once. That is the whole story. I still hear the squeaking sounds in my nightmares.'),(9716,'2026-09-23 07:12:00',10040,'The Suspicious Silence of the Sauna','Everyone just sits there in silence sweating like it\'s a competitive sport. I respect the commitment.'),(9717,'2026-09-23 03:19:00',10014,'My Gym Playlist Betrayed Me Mid-Squat','Song switched to a slow ballad right as I hit the bottom of my squat. Nearly gave up on life and gravity simultaneously.'),(9720,'2026-09-25 00:35:00',10006,'Gym Etiquette: Re-Rack Your Weights, Please','Found someone\'s entire workout still sitting on the bar like an abandoned art installation. Sir. Ma\'am. Please.'),(9725,'2026-09-27 05:47:00',10006,'The Day I Confused Cable Machines','Tried to do a bicep curl and accidentally activated what I can only describe as a medieval torture device.'),(9726,'2026-09-27 22:04:00',9988,'Post-Gym Nap Is a Human Right','Worked out for one hour, slept for three. The math is irrelevant when you\'ve earned it.'),(9728,'2026-09-07 23:03:00',10062,'The Locker Combination Incident','Spent 20 minutes trying to open someone else\'s locker before realizing mine was one row over. Cardio achieved before I even touched a treadmill.'),(9730,'2026-09-08 23:18:00',10018,'The Mirror Doesn\'t Lie, But My Playlist Does','Nothing hits different than doing bicep curls to a Disney soundtrack because you forgot your headphones were still connected to the kids\' tablet.'),(9734,'2026-09-11 08:03:00',10062,'The Great Water Bottle Mix-Up','Drank from a stranger\'s bottle by accident. We made eye contact. Neither of us said anything. We are bonded for life now.'),(9736,'2026-09-11 22:53:00',10074,'Why Is the Treadmill Always Broken When I Need It','Every single one. Every single time. I\'m starting to think they can sense my presence and shut down out of fear.'),(9738,'2026-09-13 06:29:00',10017,'The Sock Situation','Wore two different socks to leg day. One had a hole. Genuinely unsure which one, but my dignity definitely does now.'),(9741,'2026-09-15 05:22:00',9997,'The Sacred Ritual of the Pre-Workout Playlist','Spent 25 minutes curating the perfect playlist. Worked out for 12. Priorities are clearly in order.'),(9747,'2026-09-18 04:34:00',10075,'The Great Deadlift Grunt Debate','Is it a war cry or a cry for help? Honestly at this point in my set, both.'),(9749,'2026-09-18 22:24:00',10051,'Tried Yoga After Only Ever Lifting Weights','Turns out flexibility and strength are not the same skill. My hamstrings filed a restraining order against \'downward dog.\''),(9753,'2026-09-21 08:10:00',10037,'The Treadmill Incline Betrayal','Set it to \'hill workout\' expecting a gentle slope. Ended up training for a mountain rescue mission instead.'),(9758,'2026-09-24 04:37:00',8,'The Great Chalk Explosion of Tuesday','Clapped my hands before a lift and created a small dust storm. The people two racks over are still coughing.'),(9759,'2026-09-24 02:13:00',10066,'I Tried Intermittent Fasting Before Leg Day','Big mistake. Huge. Nearly fainted into the squat rack and made new friends on the way down.'),(9761,'2026-09-25 02:24:00',10085,'The Cardio Machine That Judges Me','The screen said \'fat burn zone\' in a tone I did not appreciate. We are no longer on speaking terms.'),(9762,'2026-09-26 07:27:00',10040,'I Accidentally Joined a Spin Class','Thought it was a normal cycling machine. Forty-five minutes later I emerged a changed, sweatier person.'),(9763,'2026-09-26 07:38:00',10036,'The Water Fountain Line Is Longer Than the Squat Rack Line','Says a lot about our priorities as a species, honestly.'),(9764,'2026-09-27 07:44:00',10071,'My Gym Shoes Have Their Own Smell Now','It has evolved past \'odor\' into something closer to a sentient being. We\'ve named it Gary.'),(12482,'2026-09-28 19:41:07',8,'Great equipment','The equipment in the city gym is brilliant!');
/*!40000 ALTER TABLE `blog` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=2536 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `locations`
--

LOCK TABLES `locations` WRITE;
/*!40000 ALTER TABLE `locations` DISABLE KEYS */;
INSERT INTO `locations` VALUES (1,'Fig Tree Pocket','8675309','ftp@gym.com','1 poop street','fig tree pocket',4069,1,0,1),(2,'City','8675309','city@gym.com','1 dump place','brisbane',4000,1,0,1),(315,'Evil Gym','66666666','evilgym@gymsrus.com','1 Lair Cresent','Evilsville',5000,1,0,1),(1935,'Haunted House','22222222','aa@gym.com','1 song st','Amityville ',666,9772,0,1);
/*!40000 ALTER TABLE `locations` ENABLE KEYS */;
UNLOCK TABLES;

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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sessions`
--
LOCK TABLES `sessions` WRITE;
/*!40000 ALTER TABLE `sessions` DISABLE KEYS */;
INSERT INTO `sessions` VALUES (624,'Get lean and mean',1,315,2,'2026-10-04','17:00:00'),(1578,'Plugh',1,1,5,'2026-09-25','11:15:00'),(1803,'Papperazzi',1910,2,5,'2026-09-28','19:00:00'),(1804,'Spandex people',1909,2,2,'2026-10-02','11:00:00'),(1805,'Glug glug',1911,1,5,'2026-10-02','17:30:00'),(1806,'Work it out',1912,2,2,'2026-10-03','10:00:00'),(1807,'Shake it',1,1,9773,'2026-10-01','15:00:00'),(1808,'Look at Meeeee',1910,2,2,'2026-09-28','09:00:00'),(1810,'Getting Evil',1909,315,2,'2026-10-04','09:00:00'),(1811,'Work it out',1,1,9773,'2026-09-28','16:00:00'),(1812,'Go for it',1914,1935,9773,'2026-09-30','11:00:00'),(1813,'Dance session',1913,1,5,'2026-10-01','15:00:00'),(1814,'Take all the road',1909,1,2,'2026-09-30','09:00:00'),(1815,'1M Dollars',1,1,2,'2026-10-01','09:00:00'),(1816,'Use the force',1910,315,10086,'2026-10-04','11:00:00');
/*!40000 ALTER TABLE `sessions` ENABLE KEYS */;
UNLOCK TABLES;

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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bookings`
--

LOCK TABLES `bookings` WRITE;
/*!40000 ALTER TABLE `bookings` DISABLE KEYS */;
INSERT INTO `bookings` VALUES (1619,1578,1,'2026-09-26 16:54:26'),(1646,624,1,'2026-09-26 16:57:15'),(1650,1804,1,'2026-09-27 14:46:39'),(1659,1805,8,'2026-09-27 16:00:58'),(1661,1806,1,'2026-09-27 16:12:37'),(1664,1807,1,'2026-09-27 17:53:27'),(1666,1807,8,'2026-09-27 17:55:03'),(1667,1805,1,'2026-09-28 08:41:22'),(1669,1808,1,'2026-09-28 09:50:14'),(1684,1803,8,'2026-09-28 11:17:17'),(1688,624,8,'2026-09-28 11:21:24'),(1689,1806,8,'2026-09-28 11:23:30'),(1691,1811,8,'2026-09-28 11:47:54'),(1693,1813,1,'2026-09-28 12:43:33'),(1694,1812,1,'2026-09-28 12:43:42'),(1695,1811,1,'2026-09-28 12:43:51'),(1696,1808,10071,'2026-09-28 13:21:05'),(1697,1812,10071,'2026-09-28 13:21:13'),(1698,1813,10071,'2026-09-28 13:21:17'),(1701,1815,1,'2026-09-28 14:24:23'),(1702,1813,8,'2026-09-28 14:26:07'),(1703,1815,8,'2026-09-28 14:26:09'),(1704,1812,8,'2026-09-28 14:26:12'),(1705,1816,8,'2026-09-28 14:26:18'),(1706,1808,8,'2026-09-28 14:26:23'),(1708,1810,8,'2026-09-28 14:45:00'),(1918,1810,10036,'2026-09-28 15:16:35'),(1919,624,10036,'2026-09-28 15:16:36'),(1920,1804,10036,'2026-09-28 15:16:39'),(1921,1807,10036,'2026-09-28 15:16:40'),(1922,1812,10036,'2026-09-28 15:16:42'),(1923,1808,10036,'2026-09-28 15:16:46'),(1924,1811,10036,'2026-09-28 15:16:51'),(1925,1814,10036,'2026-09-28 15:21:36'),(1952,1816,1,'2026-09-28 15:40:00'),(2213,1803,1,'2026-09-28 19:02:50'),(2240,1804,10066,'2026-09-28 20:52:44'),(2241,1813,10066,'2026-09-28 20:52:46'),(2242,1803,10066,'2026-09-28 20:52:47'),(2243,624,10066,'2026-09-28 20:52:49'),(2244,1806,10066,'2026-09-28 20:53:13');
/*!40000 ALTER TABLE `bookings` ENABLE KEYS */;
UNLOCK TABLES;

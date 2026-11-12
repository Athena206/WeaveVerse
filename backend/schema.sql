CREATE DATABASE IF NOT EXISTS first_saree_centre
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE first_saree_centre;

CREATE TABLE IF NOT EXISTS customers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  first_name VARCHAR(80) NOT NULL,
  last_name VARCHAR(80) NOT NULL,
  email VARCHAR(254) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  date_joined TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (id),
  UNIQUE KEY uq_customers_email (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sarees (
  product_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  saree_name VARCHAR(180) NOT NULL,
  category VARCHAR(80) NOT NULL,
  fabric VARCHAR(80) NOT NULL,
  weave VARCHAR(100) NOT NULL,
  region VARCHAR(100) NOT NULL,
  occasion VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  price DECIMAL(10, 2) UNSIGNED NOT NULL,
  stock INT UNSIGNED NOT NULL DEFAULT 0,
  image_url VARCHAR(1000) NOT NULL,
  image_credit VARCHAR(180) NOT NULL DEFAULT 'First Saree Centre',
  image_license VARCHAR(80) NOT NULL DEFAULT 'Project photography',
  image_source VARCHAR(1000) NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (product_id),
  UNIQUE KEY uq_sarees_name (saree_name),
  KEY ix_sarees_category (category),
  KEY ix_sarees_fabric (fabric),
  KEY ix_sarees_region (region),
  KEY ix_sarees_occasion (occasion),
  CONSTRAINT chk_sarees_price CHECK (price >= 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS orders (
  order_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_id BIGINT UNSIGNED NOT NULL,
  total_amount DECIMAL(12, 2) UNSIGNED NOT NULL,
  status ENUM('placed', 'processing', 'shipped', 'delivered', 'cancelled')
    NOT NULL DEFAULT 'placed',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (order_id),
  KEY ix_orders_customer_created (customer_id, created_at),
  CONSTRAINT fk_orders_customer
    FOREIGN KEY (customer_id) REFERENCES customers (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS order_details (
  order_detail_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  saree_name VARCHAR(180) NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  unit_price DECIMAL(10, 2) UNSIGNED NOT NULL,
  PRIMARY KEY (order_detail_id),
  UNIQUE KEY uq_order_product (order_id, product_id),
  KEY ix_order_details_product (product_id),
  CONSTRAINT fk_order_details_order
    FOREIGN KEY (order_id) REFERENCES orders (order_id),
  CONSTRAINT fk_order_details_saree
    FOREIGN KEY (product_id) REFERENCES sarees (product_id),
  CONSTRAINT chk_order_details_quantity CHECK (quantity > 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS reviews (
  review_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id BIGINT UNSIGNED NOT NULL,
  customer_id BIGINT UNSIGNED NOT NULL,
  rating TINYINT UNSIGNED NOT NULL,
  review_text VARCHAR(1200) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (review_id),
  UNIQUE KEY uq_customer_product_review (customer_id, product_id),
  KEY ix_reviews_product_created (product_id, created_at),
  CONSTRAINT fk_reviews_saree
    FOREIGN KEY (product_id) REFERENCES sarees (product_id),
  CONSTRAINT fk_reviews_customer
    FOREIGN KEY (customer_id) REFERENCES customers (id),
  CONSTRAINT chk_review_rating CHECK (rating BETWEEN 1 AND 5)
) ENGINE=InnoDB;

INSERT INTO sarees
  (saree_name, category, fabric, weave, region, occasion, description, price, stock,
   image_url, image_credit, image_license, image_source)
VALUES
  ('Handloom Heritage', 'Everyday', 'Cotton', 'Jamdani', 'West Bengal', 'Everyday',
   'An airy Bengal handloom with delicate Jamdani motifs, woven slowly by skilled artisans.',
   999.00, 12, '/uploads/commons-01.jpg', 'Worldizen', 'CC BY-SA 2.0',
   'https://commons.wikimedia.org/wiki/File:A_girl_in_sari_sitting.jpg'),
  ('Banarasi Gulab', 'Wedding', 'Silk', 'Banarasi brocade', 'Uttar Pradesh', 'Wedding',
   'A luminous silk weave with a rose-gold border inspired by the ghats of Banaras.',
   4999.00, 7, '/uploads/commons-02.jpg', 'Worldizen', 'CC BY-SA 2.0',
   'https://commons.wikimedia.org/wiki/File:A_girl_in_sari_standing.jpg'),
  ('Kanjivaram Temple Gold', 'Wedding', 'Silk', 'Kanjivaram zari', 'Tamil Nadu', 'Wedding',
   'Traditional South Indian silk with a rich contrast border and temple-inspired zari.',
   8499.00, 5, '/uploads/commons-03.jpg', 'Jonathansammy', 'CC BY-SA 4.0',
   'https://commons.wikimedia.org/wiki/File:A_woman_in_traditional_Maharashtrian_saree_IMG_20221211_131250_(1).jpg'),
  ('Bengal Cotton Morning', 'Everyday', 'Cotton', 'Handloom', 'West Bengal', 'Everyday',
   'Soft, breathable handwoven cotton made for long, easy days.',
   1450.00, 15, '/uploads/commons-04.jpg', 'Topich topich', 'CC0',
   'https://commons.wikimedia.org/wiki/File:Barefoot_In_A_Saree_(Unsplash).jpg'),
  ('Jamdani Garden', 'Handloom', 'Cotton', 'Jamdani', 'West Bengal', 'Celebration',
   'Fine floral motifs float across a sheer, light cotton weave from Bengal.',
   2350.00, 5, '/uploads/commons-05.jpg', 'Sonisha2112', 'CC0',
   'https://commons.wikimedia.org/wiki/File:Indian_Woman_in_Saree.jpg'),
  ('Chanderi Moonlight', 'Handloom', 'Chanderi silk-cotton', 'Chanderi', 'Madhya Pradesh', 'Celebration',
   'A featherlight Chanderi drape with a soft sheen and understated woven motifs.',
   3299.00, 9, '/uploads/commons-06.jpg', 'Nitesh Gosalia', 'CC BY-SA 4.0',
   'https://commons.wikimedia.org/wiki/File:Saree_draping.jpg'),
  ('Paithani Peacock', 'Wedding', 'Silk', 'Paithani', 'Maharashtra', 'Wedding',
   'A jewel-toned Maharashtrian silk with a classic peacock-inspired pallu.',
   7299.00, 4, '/uploads/commons-07.jpg', 'miramurphy', 'CC BY 2.0',
   'https://commons.wikimedia.org/wiki/File:Saree_wrapping.jpg'),
  ('Patola Heritage', 'Handloom', 'Silk', 'Double ikat Patola', 'Gujarat', 'Celebration',
   'A vivid geometric Patola-inspired silk celebrating Gujarat''s intricate ikat craft.',
   6499.00, 6, '/uploads/commons-08.jpg', 'Yann (talk)', 'CC BY-SA 4.0',
   'https://commons.wikimedia.org/wiki/File:Sari.jpg'),
  ('Bandhani Celebration', 'Festive', 'Georgette', 'Bandhani tie-dye', 'Gujarat', 'Festive',
   'Playful hand-tied dots bring colour and movement to this festive georgette drape.',
   2199.00, 11, '/uploads/commons-09.jpg', 'Yann (talk)', 'CC BY-SA 4.0',
   'https://commons.wikimedia.org/wiki/File:Sari_2.jpg'),
  ('Chiffon Rose', 'Contemporary', 'Chiffon', 'Printed', 'Rajasthan', 'Celebration',
   'An easy, graceful chiffon saree with a garden-inspired print and fluid drape.',
   1899.00, 10, '/uploads/commons-10.jpg', 'Michael Pravin', 'CC BY 2.0',
   'https://commons.wikimedia.org/wiki/File:Sari_in_dance_(11147236036).jpg'),
  ('Mysore Silk Dawn', 'Wedding', 'Silk', 'Mysore silk', 'Karnataka', 'Celebration',
   'Smooth, pure silk and a clean traditional border, woven in the spirit of Mysore.',
   5599.00, 5, '/uploads/commons-11.jpg', 'Sreekumar K. S.', 'CC BY 2.0',
   'https://commons.wikimedia.org/wiki/File:Shraddha_Arya_wearing_a_Sari,_traditional_Indian_attire.jpg'),
  ('Tussar Wildflower', 'Handloom', 'Tussar silk', 'Handloom', 'Jharkhand', 'Celebration',
   'Naturally textured wild tussar silk with a warm sheen and botanical motifs.',
   3899.00, 8, '/uploads/commons-12.jpg', 'nevil zaveri', 'CC BY 2.0',
   'https://commons.wikimedia.org/wiki/File:Wearing_saree,_maheshwar_(1425690749).jpg'),
  ('Linen Sandstone', 'Contemporary', 'Linen', 'Handwoven', 'West Bengal', 'Everyday',
   'A breathable linen drape in earthy tones for quiet, polished everyday dressing.',
   2799.00, 9, '/uploads/commons-13.jpg', 'Art Projects MKCL KF', 'CC BY-SA 4.0',
   'https://commons.wikimedia.org/wiki/File:Woman_in_Green_Saree,_Yamai_Temple,_Aundh,_Maharashtra.jpg'),
  ('Organza Blossom', 'Contemporary', 'Organza', 'Embroidered', 'Uttar Pradesh', 'Celebration',
   'A sheer organza saree with delicate embroidered florals and an occasion-ready glow.',
   3499.00, 6, '/uploads/commons-14.jpg', 'CY, Meng', 'CC BY-SA 4.0',
   'https://commons.wikimedia.org/wiki/File:Woman_wearing_Saree.jpg'),
  ('Kota Doria Sky', 'Handloom', 'Cotton-silk', 'Kota Doria', 'Rajasthan', 'Everyday',
   'Airy square-check Kota Doria with a light cotton-silk touch, ideal for warm days.',
   1999.00, 12, '/uploads/saree-01.jpg', 'First Saree Centre', 'Provided project reference',
   ''),
  ('Sambalpuri Ikat Earth', 'Handloom', 'Cotton', 'Sambalpuri ikat', 'Odisha', 'Everyday',
   'A distinctive Odisha ikat with traditional motifs and a comfortable handloom feel.',
   2599.00, 7, '/uploads/saree-02.jpg', 'First Saree Centre', 'Provided project reference',
   ''),
  ('Chikankari Ivory', 'Festive', 'Georgette', 'Chikankari embroidery', 'Uttar Pradesh', 'Celebration',
   'Soft georgette meets delicate Lucknow-inspired white threadwork.',
   2999.00, 6, '/uploads/saree-03.jpg', 'First Saree Centre', 'Provided project reference',
   ''),
  ('Kalamkari Story', 'Handloom', 'Cotton', 'Kalamkari print', 'Andhra Pradesh', 'Everyday',
   'A narrative hand-painted-inspired cotton print celebrating the Kalamkari tradition.',
   1799.00, 10, '/uploads/saree-04.jpg', 'First Saree Centre', 'Provided project reference',
   ''),
  ('Crepe Evening Bloom', 'Contemporary', 'Crepe', 'Digital print', 'Rajasthan', 'Celebration',
   'A graceful crepe saree with a fluid fall and painterly evening florals.',
   2099.00, 9, '/uploads/saree-05.jpg', 'First Saree Centre', 'Provided project reference',
   ''),
  ('Bhagalpuri Silk Fern', 'Handloom', 'Silk', 'Bhagalpuri handloom', 'Bihar', 'Celebration',
   'Textured Bhagalpuri silk with a natural finish and subtle fern-inspired detailing.',
   3199.00, 8, '/uploads/saree-06.jpg', 'First Saree Centre', 'Provided project reference',
   ''),
  ('Gadwal Border Classic', 'Wedding', 'Silk-cotton', 'Gadwal weave', 'Telangana', 'Wedding',
   'A light-bodied saree with the bold, contrasting border of a classic Gadwal weave.',
   4599.00, 5, '/uploads/saree-07.jpg', 'First Saree Centre', 'Provided project reference',
   ''),
  ('Maheshwari River', 'Handloom', 'Silk-cotton', 'Maheshwari', 'Madhya Pradesh', 'Celebration',
   'Elegant stripes and a distinctive reversible border from Maheshwar.',
   2899.00, 7, '/uploads/saree-08.jpg', 'First Saree Centre', 'Provided project reference',
   ''),
  ('Paithani Lotus', 'Wedding', 'Silk', 'Paithani', 'Maharashtra', 'Wedding',
   'A celebratory silk drape with lotus motifs and a richly coloured traditional pallu.',
   7999.00, 3, '/uploads/saree-09.jpg', 'First Saree Centre', 'Provided project reference',
   ''),
  ('Printed Mulmul Daydream', 'Everyday', 'Mulmul cotton', 'Printed', 'West Bengal', 'Everyday',
   'Cloud-soft mulmul cotton with an easy botanical print for everyday comfort.',
   1299.00, 14, '/uploads/saree-10.jpg', 'First Saree Centre', 'Provided project reference',
   ''),
  ('Cotton Crepe Blossom', 'Contemporary', 'Crepe cotton', 'Printed crepe', 'Rajasthan', 'Celebration',
   'A light cotton-crepe saree with a soft fall and a floral print for celebrations.',
   2299.00, 8, '/uploads/weaveverse-model-19.jpg', 'Unsplash', 'Unsplash License',
   'https://unsplash.com/photos/woman-in-purple-and-white-floral-sari-X-rtukesXzY'),
  ('Cotton Georgette Garden', 'Contemporary', 'Georgette cotton', 'Printed georgette', 'Uttar Pradesh', 'Celebration',
   'An airy cotton-georgette saree with a fluid drape and a bright printed border.',
   2699.00, 7, '/uploads/weaveverse-model-20.jpg', 'Unsplash', 'Unsplash License',
   'https://unsplash.com/photos/a-beautiful-woman-in-a-colorful-sari-dCuCMZ9XnHg')
ON DUPLICATE KEY UPDATE
  category = VALUES(category),
  fabric = VALUES(fabric),
  weave = VALUES(weave),
  region = VALUES(region),
  occasion = VALUES(occasion),
  description = VALUES(description),
  price = VALUES(price),
  image_url = VALUES(image_url),
  image_credit = VALUES(image_credit),
  image_license = VALUES(image_license),
  image_source = VALUES(image_source),
  is_active = TRUE;

UPDATE sarees
SET image_url = CASE saree_name
    WHEN 'Handloom Heritage' THEN '/uploads/weaveverse-model-01.jpg'
    WHEN 'Banarasi Gulab' THEN '/uploads/commons-02.jpg'
    WHEN 'Kanjivaram Temple Gold' THEN '/uploads/commons-01.jpg'
    WHEN 'Bengal Cotton Morning' THEN '/uploads/weaveverse-model-04.jpg'
    WHEN 'Jamdani Garden' THEN '/uploads/weaveverse-model-05.jpg'
    WHEN 'Chanderi Moonlight' THEN '/uploads/weaveverse-model-06.jpg'
    WHEN 'Paithani Peacock' THEN '/uploads/weaveverse-model-07.jpg'
    WHEN 'Patola Heritage' THEN '/uploads/weaveverse-model-08.jpg'
    WHEN 'Bandhani Celebration' THEN '/uploads/weaveverse-model-09.jpg'
    WHEN 'Chiffon Rose' THEN '/uploads/weaveverse-model-10.jpg'
    WHEN 'Mysore Silk Dawn' THEN '/uploads/weaveverse-model-11.jpg'
    WHEN 'Tussar Wildflower' THEN '/uploads/weaveverse-model-12.jpg'
    WHEN 'Linen Sandstone' THEN '/uploads/weaveverse-model-13.jpg'
    WHEN 'Organza Blossom' THEN '/uploads/weaveverse-model-14.jpg'
    WHEN 'Kota Doria Sky' THEN '/uploads/weaveverse-model-15.jpg'
    WHEN 'Sambalpuri Ikat Earth' THEN '/uploads/weaveverse-model-16.jpg'
    WHEN 'Chikankari Ivory' THEN '/uploads/weaveverse-model-17.jpg'
    WHEN 'Kalamkari Story' THEN '/uploads/weaveverse-model-18.jpg'
    WHEN 'Crepe Evening Bloom' THEN '/uploads/weaveverse-model-19.jpg'
    WHEN 'Bhagalpuri Silk Fern' THEN '/uploads/weaveverse-model-20.jpg'
    WHEN 'Gadwal Border Classic' THEN '/uploads/weaveverse-model-21.jpg'
    WHEN 'Maheshwari River' THEN '/uploads/weaveverse-model-22.jpg'
    WHEN 'Paithani Lotus' THEN '/uploads/weaveverse-model-23.jpg'
    WHEN 'Printed Mulmul Daydream' THEN '/uploads/weaveverse-model-24.jpg'
  END,
    image_credit = CASE saree_name
    WHEN 'Banarasi Gulab' THEN 'Worldizen'
    WHEN 'Kanjivaram Temple Gold' THEN 'Worldizen'
    ELSE 'Unsplash'
  END,
    image_license = CASE saree_name
    WHEN 'Banarasi Gulab' THEN 'CC BY-SA 2.0'
    WHEN 'Kanjivaram Temple Gold' THEN 'CC BY-SA 2.0'
    ELSE 'Unsplash License'
  END,
    image_source = CASE saree_name
    WHEN 'Handloom Heritage' THEN 'https://unsplash.com/s/photos/saree-model'
    WHEN 'Banarasi Gulab' THEN 'https://commons.wikimedia.org/wiki/File:A_girl_in_sari_standing.jpg'
    WHEN 'Kanjivaram Temple Gold' THEN 'https://commons.wikimedia.org/wiki/File:A_girl_in_sari_sitting.jpg'
    WHEN 'Bengal Cotton Morning' THEN 'https://unsplash.com/photos/woman-in-red-and-brown-sari-XbEWASqbaVo'
    WHEN 'Jamdani Garden' THEN 'https://unsplash.com/photos/woman-in-sari-with-gold-jewelry-Xqa_NWl4xEY'
    WHEN 'Chanderi Moonlight' THEN 'https://unsplash.com/photos/a-woman-in-a-red-sari-posing-for-a-picture-KFE22Lb6xHE'
    WHEN 'Paithani Peacock' THEN 'https://unsplash.com/photos/a-woman-in-a-sari-walking-through-a-park-UnWadQg_Whc'
    WHEN 'Patola Heritage' THEN 'https://unsplash.com/photos/a-woman-in-a-sari-and-jewelry-posing-for-a-picture-wrRVsNyuCW4'
    WHEN 'Bandhani Celebration' THEN 'https://unsplash.com/photos/woman-wearing-black-and-white-saree-dress-standing-on-tree-hj50WxMqPVg'
    WHEN 'Chiffon Rose' THEN 'https://unsplash.com/photos/a-young-woman-in-a-green-sari-smiles-warmly-outdoors-ws388aWhWwM'
    WHEN 'Mysore Silk Dawn' THEN 'https://unsplash.com/photos/a-woman-in-a-purple-and-gold-sari-wcgCFUi_Zws'
    WHEN 'Tussar Wildflower' THEN 'https://unsplash.com/photos/a-woman-in-a-sari-posing-for-a-picture-xvchqCn0fHc'
    WHEN 'Linen Sandstone' THEN 'https://unsplash.com/photos/a-woman-wearing-a-red-and-gold-sari-hNwKkiapoNI'
    WHEN 'Organza Blossom' THEN 'https://unsplash.com/photos/woman-in-yellow-and-red-sari-HBHwy_vp_e8'
    WHEN 'Kota Doria Sky' THEN 'https://unsplash.com/photos/a-woman-in-an-orange-sari-standing-on-a-balcony-9vBvBSmQTaM'
    WHEN 'Sambalpuri Ikat Earth' THEN 'https://unsplash.com/photos/a-woman-in-a-red-sari-posing-for-a-picture-CWtDdYAIKTI'
    WHEN 'Chikankari Ivory' THEN 'https://unsplash.com/photos/woman-in-blue-and-yellow-sari-dress-tjRs987fPfg'
    WHEN 'Kalamkari Story' THEN 'https://unsplash.com/photos/3-women-in-purple-and-pink-sari-oXm1bSl87WY'
    WHEN 'Crepe Evening Bloom' THEN 'https://unsplash.com/photos/woman-in-purple-and-white-floral-sari-X-rtukesXzY'
    WHEN 'Bhagalpuri Silk Fern' THEN 'https://unsplash.com/photos/a-beautiful-woman-in-a-colorful-sari-dCuCMZ9XnHg'
    WHEN 'Gadwal Border Classic' THEN 'https://unsplash.com/photos/woman-in-yellow-and-red-sari-dress-MZtI8RnGGpM'
    WHEN 'Maheshwari River' THEN 'https://unsplash.com/photos/woman-in-green-and-blue-sari-standing-beside-red-wall-LzuokPBloGc'
    WHEN 'Paithani Lotus' THEN 'https://unsplash.com/photos/woman-in-brown-and-white-floral-sari-pyAi6k9EPHw'
    WHEN 'Printed Mulmul Daydream' THEN 'https://unsplash.com/photos/woman-in-blue-and-red-sari-dress-8yawVKD8xf4'
  END
WHERE saree_name IN (
  'Handloom Heritage', 'Banarasi Gulab', 'Kanjivaram Temple Gold',
  'Bengal Cotton Morning', 'Jamdani Garden', 'Chanderi Moonlight',
  'Paithani Peacock', 'Patola Heritage', 'Bandhani Celebration',
  'Chiffon Rose', 'Mysore Silk Dawn', 'Tussar Wildflower',
  'Linen Sandstone', 'Organza Blossom', 'Kota Doria Sky',
  'Sambalpuri Ikat Earth', 'Chikankari Ivory', 'Kalamkari Story',
  'Crepe Evening Bloom', 'Bhagalpuri Silk Fern', 'Gadwal Border Classic',
  'Maheshwari River', 'Paithani Lotus', 'Printed Mulmul Daydream'
);

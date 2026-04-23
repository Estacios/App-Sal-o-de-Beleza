CREATE DATABASE IF NOT EXISTS salao_agenda CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE salao_agenda;

CREATE TABLE IF NOT EXISTS settings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  salon_name VARCHAR(120) NOT NULL DEFAULT 'Agenda do Salão',
  salon_subtitle VARCHAR(180) NOT NULL DEFAULT 'Agendamento online para clientes',
  hours TEXT NOT NULL,
  working_days VARCHAR(30) NOT NULL DEFAULT '1,2,3,4,5,6',
  booking_limit_days INT NOT NULL DEFAULT 15,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS services (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  duration INT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bookings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  client_name VARCHAR(120) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  service_id INT NOT NULL,
  service_name VARCHAR(120) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  duration INT NOT NULL,
  booking_date DATE NOT NULL,
  booking_time TIME NOT NULL,
  notes TEXT NULL,
  status ENUM('Pendente','Confirmado','Cancelado') NOT NULL DEFAULT 'Pendente',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_booking_service FOREIGN KEY (service_id) REFERENCES services(id)
);

INSERT INTO settings (id, salon_name, salon_subtitle, hours, working_days, booking_limit_days)
VALUES (1, 'Agenda do Salão', 'Agendamento online para clientes', '08:00,09:00,10:00,11:00,13:00,14:00,15:00,16:00', '1,2,3,4,5,6', 15)
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

INSERT INTO services (name, duration, price)
SELECT 'Manicure', 60, 35.00
WHERE NOT EXISTS (SELECT 1 FROM services WHERE name = 'Manicure');

INSERT INTO services (name, duration, price)
SELECT 'Pedicure', 70, 40.00
WHERE NOT EXISTS (SELECT 1 FROM services WHERE name = 'Pedicure');

INSERT INTO services (name, duration, price)
SELECT 'Escova', 50, 45.00
WHERE NOT EXISTS (SELECT 1 FROM services WHERE name = 'Escova');

INSERT INTO services (name, duration, price)
SELECT 'Corte Feminino', 60, 50.00
WHERE NOT EXISTS (SELECT 1 FROM services WHERE name = 'Corte Feminino');

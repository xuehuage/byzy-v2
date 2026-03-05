-- Byzy Project - Schema Patch & Field Synchronization
-- This script safely adds missing columns to existing tables using stored procedures.
-- It will NOT delete or overwrite your existing data.

DELIMITER //

-- Procedure to safely add a column if it doesn't exist
DROP PROCEDURE IF EXISTS AddColumnUnlessExists //
CREATE PROCEDURE AddColumnUnlessExists(
    IN tableName VARCHAR(64),
    IN columnName VARCHAR(64),
    IN columnDef VARCHAR(255)
)
BEGIN
    IF NOT EXISTS (
        SELECT * FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = tableName 
        AND COLUMN_NAME = columnName
    ) THEN
        SET @sql = CONCAT('ALTER TABLE `', tableName, '` ADD COLUMN `', columnName, '` ', columnDef);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END //

-- Procedure to safely update an ENUM column
DROP PROCEDURE IF EXISTS UpdateOrderEnum //
CREATE PROCEDURE UpdateOrderEnum()
BEGIN
    -- This adds PARTIAL_REFUNDED and other V2 statuses to the orders table enum
    SET @sql = "ALTER TABLE `orders` MODIFY COLUMN `status` ENUM('PENDING','PAID','EXCHANGING','SHIPPED','CANCELLED','REFUNDING','PARTIAL_REFUNDED','REFUNDED') NOT NULL DEFAULT 'PENDING'";
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
END //

DELIMITER ;

-- 1. Apply Order Status Enum Update
CALL UpdateOrderEnum();

-- 2. Update 'orders' table
CALL AddColumnUnlessExists('orders', 'shipped_at', 'timestamp NULL DEFAULT NULL AFTER paid_at');

-- 3. Update 'schools' table (V2 Config Fields)
CALL AddColumnUnlessExists('schools', 'summer_image', 'varchar(255) DEFAULT NULL');
CALL AddColumnUnlessExists('schools', 'autumn_image', 'varchar(255) DEFAULT NULL');
CALL AddColumnUnlessExists('schools', 'winter_image', 'varchar(255) DEFAULT NULL');
CALL AddColumnUnlessExists('schools', 'size_guide_image', 'varchar(255) DEFAULT NULL');
CALL AddColumnUnlessExists('schools', 'is_summer_active', 'tinyint(4) NOT NULL DEFAULT 0');
CALL AddColumnUnlessExists('schools', 'is_autumn_active', 'tinyint(4) NOT NULL DEFAULT 0');
CALL AddColumnUnlessExists('schools', 'is_winter_active', 'tinyint(4) NOT NULL DEFAULT 0');
CALL AddColumnUnlessExists('schools', 'summer_price', 'int(11) NOT NULL DEFAULT 0');
CALL AddColumnUnlessExists('schools', 'autumn_price', 'int(11) NOT NULL DEFAULT 0');
CALL AddColumnUnlessExists('schools', 'winter_price', 'int(11) NOT NULL DEFAULT 0');
CALL AddColumnUnlessExists('schools', 'after_sales_exchange_active', 'tinyint(4) NOT NULL DEFAULT 1');
CALL AddColumnUnlessExists('schools', 'after_sales_refund_active', 'tinyint(4) NOT NULL DEFAULT 1');

-- 4. Update 'order_items' table (Measurement Fields)
CALL AddColumnUnlessExists('order_items', 'is_special_size', 'tinyint(4) NOT NULL DEFAULT 0');
CALL AddColumnUnlessExists('order_items', 'height', 'decimal(5,2) DEFAULT NULL');
CALL AddColumnUnlessExists('order_items', 'weight', 'decimal(5,2) DEFAULT NULL');

-- 5. Update 'after_sales_records' table
CALL AddColumnUnlessExists('after_sales_records', 'product_id', 'int(11) DEFAULT NULL');
CALL AddColumnUnlessExists('after_sales_records', 'is_special_size', 'tinyint(4) NOT NULL DEFAULT 0');
CALL AddColumnUnlessExists('after_sales_records', 'height', 'decimal(5,2) DEFAULT NULL');
CALL AddColumnUnlessExists('after_sales_records', 'weight', 'decimal(5,2) DEFAULT NULL');

-- Clean up
DROP PROCEDURE IF EXISTS AddColumnUnlessExists;
DROP PROCEDURE IF EXISTS UpdateOrderEnum;

-- Sprint 11: CHECK constraint on product_locations.quantity (E7)
-- Pre-flight: fix any zero/negative quantities (shouldn't exist, but defensive)
UPDATE product_locations SET quantity = 1 WHERE quantity <= 0;

-- Add constraint: quantity must be > 0
ALTER TABLE product_locations ADD CONSTRAINT chk_quantity_positive CHECK (quantity > 0);

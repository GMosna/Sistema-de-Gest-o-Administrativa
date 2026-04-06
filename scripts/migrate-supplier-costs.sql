-- Adicionar campos de custo do fornecedor e lucro nos pedidos
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS supplier_cost NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_cost NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS profit NUMERIC(10,2) DEFAULT 0;

-- Garantir que installments tenha os campos installment_number e total_installments
ALTER TABLE installments
  ADD COLUMN IF NOT EXISTS installment_number INT,
  ADD COLUMN IF NOT EXISTS total_installments INT;

-- Atualizar installments existentes que não tenham os campos preenchidos
UPDATE installments i
SET
  installment_number = sub.rn,
  total_installments = sub.cnt
FROM (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY due_date ASC) AS rn,
    COUNT(*) OVER (PARTITION BY order_id) AS cnt
  FROM installments
) sub
WHERE i.id = sub.id AND i.installment_number IS NULL;

-- AlterTable: add shipping column to order_items
ALTER TABLE "order_items" ADD COLUMN "shipping" DECIMAL(10,2) NOT NULL DEFAULT 0;

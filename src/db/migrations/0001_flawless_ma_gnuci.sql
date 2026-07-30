CREATE TABLE "products_cache" (
	"id" integer PRIMARY KEY NOT NULL,
	"symbol" varchar(50) NOT NULL,
	"name" varchar(200) NOT NULL,
	"barcode" varchar(50),
	"unit" varchar(10) DEFAULT 'szt',
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_pc_barcode" ON "products_cache" USING btree ("barcode");--> statement-breakpoint
CREATE INDEX "idx_pc_symbol" ON "products_cache" USING btree ("symbol");
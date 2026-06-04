-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidates" (
    "id" UUID NOT NULL,
    "name_original" TEXT NOT NULL,
    "name_normalized" TEXT NOT NULL,
    "length" INTEGER NOT NULL,
    "category_id" UUID,
    "source_id" UUID,
    "score" INTEGER,
    "score_reason" TEXT,
    "score_updated_at" TIMESTAMP(3),
    "candidate_status" TEXT NOT NULL DEFAULT 'active',
    "availability_status" TEXT NOT NULL DEFAULT 'unknown',
    "sniping_status" TEXT NOT NULL DEFAULT 'none',
    "notes" TEXT,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_checked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_tags" (
    "candidate_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidate_tags_pkey" PRIMARY KEY ("candidate_id","tag_id")
);

-- CreateTable
CREATE TABLE "labels" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "labels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_labels" (
    "candidate_id" UUID NOT NULL,
    "label_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidate_labels_pkey" PRIMARY KEY ("candidate_id","label_id")
);

-- CreateTable
CREATE TABLE "sources" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "url" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imports" (
    "id" UUID NOT NULL,
    "filename" TEXT,
    "file_type" TEXT,
    "source_id" UUID,
    "default_category_id" UUID,
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "imported_count" INTEGER NOT NULL DEFAULT 0,
    "duplicate_count" INTEGER NOT NULL DEFAULT 0,
    "invalid_count" INTEGER NOT NULL DEFAULT 0,
    "updated_count" INTEGER NOT NULL DEFAULT 0,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_rows" (
    "id" UUID NOT NULL,
    "import_id" UUID NOT NULL,
    "raw_value" TEXT,
    "normalized_value" TEXT,
    "status" TEXT,
    "reason" TEXT,
    "candidate_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_events" (
    "id" UUID NOT NULL,
    "candidate_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "metadata" JSONB,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidate_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "candidates_name_normalized_key" ON "candidates"("name_normalized");

-- CreateIndex
CREATE INDEX "candidates_category_id_idx" ON "candidates"("category_id");

-- CreateIndex
CREATE INDEX "candidates_source_id_idx" ON "candidates"("source_id");

-- CreateIndex
CREATE INDEX "candidates_candidate_status_idx" ON "candidates"("candidate_status");

-- CreateIndex
CREATE INDEX "candidates_availability_status_idx" ON "candidates"("availability_status");

-- CreateIndex
CREATE INDEX "candidates_score_idx" ON "candidates"("score");

-- CreateIndex
CREATE INDEX "candidates_created_at_idx" ON "candidates"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "tags_slug_key" ON "tags"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "labels_slug_key" ON "labels"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "labels_name_key" ON "labels"("name");

-- CreateIndex
CREATE UNIQUE INDEX "sources_name_key" ON "sources"("name");

-- CreateIndex
CREATE INDEX "imports_created_at_idx" ON "imports"("created_at");

-- CreateIndex
CREATE INDEX "import_rows_import_id_idx" ON "import_rows"("import_id");

-- CreateIndex
CREATE INDEX "import_rows_candidate_id_idx" ON "import_rows"("candidate_id");

-- CreateIndex
CREATE INDEX "candidate_events_candidate_id_idx" ON "candidate_events"("candidate_id");

-- CreateIndex
CREATE INDEX "candidate_events_event_type_idx" ON "candidate_events"("event_type");

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_tags" ADD CONSTRAINT "candidate_tags_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_tags" ADD CONSTRAINT "candidate_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_labels" ADD CONSTRAINT "candidate_labels_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_labels" ADD CONSTRAINT "candidate_labels_label_id_fkey" FOREIGN KEY ("label_id") REFERENCES "labels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imports" ADD CONSTRAINT "imports_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imports" ADD CONSTRAINT "imports_default_category_id_fkey" FOREIGN KEY ("default_category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imports" ADD CONSTRAINT "imports_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_events" ADD CONSTRAINT "candidate_events_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_events" ADD CONSTRAINT "candidate_events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

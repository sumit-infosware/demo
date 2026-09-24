-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "jti" TEXT NOT NULL,
    "user_agent" TEXT,
    "ip" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "replaced_by_token_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "action" TEXT NOT NULL,
    "screen" TEXT,
    "resource" TEXT NOT NULL,
    "description" TEXT,
    "resource_id" TEXT,
    "result" TEXT DEFAULT 'success',
    "ip" TEXT,
    "user_agent" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rr" (
    "id" BIGSERIAL NOT NULL,
    "rr_no" TEXT NOT NULL,
    "gate_entry_no" TEXT,
    "ownership" VARCHAR(10),
    "receipt_no" TEXT,
    "source_type" TEXT NOT NULL DEFAULT 'DOMESTIC',
    "vendor_name" TEXT,
    "vendor_no" TEXT,
    "contract" TEXT,
    "challan_no" TEXT,
    "challan_date" DATE,
    "rr_status" TEXT NOT NULL,
    "rr_date" DATE NOT NULL,
    "fetched_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rr_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rr_lines" (
    "id" BIGSERIAL NOT NULL,
    "rr_id" BIGINT NOT NULL,
    "rr_line_no" TEXT NOT NULL,
    "gate_entry_no" TEXT,
    "gate_entry_line_no" TEXT,
    "receipt_no" TEXT,
    "item_code" TEXT NOT NULL,
    "item_desc" TEXT,
    "category" TEXT,
    "ordered_qty" DECIMAL(18,4) NOT NULL,
    "received_qty" DECIMAL(18,4),
    "accepted_qty" DECIMAL(18,4),
    "vendor_uom" TEXT,
    "stocking_uom" TEXT,
    "qc_status" TEXT,
    "is_charge_approved" BOOLEAN NOT NULL DEFAULT false,
    "is_hold" BOOLEAN NOT NULL DEFAULT false,
    "charge_status" TEXT,
    "charges_approved_at" TIMESTAMPTZ,
    "inventory_qty" DECIMAL(18,4),
    "conversion_factor" DECIMAL(18,6),
    "note_text" TEXT,
    "batch_no" TEXT,
    "num_packages" INTEGER,
    "qty_per_package" DECIMAL(18,4),
    "computed_total_qty" DECIMAL(18,4),
    "alternate_item_code" TEXT,
    "original_item_code" TEXT,
    "fetched_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "item_type" TEXT NOT NULL DEFAULT 'BULK',
    "serial_numbers" TEXT,
    "serials_missing_alerted" BOOLEAN NOT NULL DEFAULT false,
    "serials_missing_alerted_at" TIMESTAMPTZ,
    "is_serialized" BOOLEAN NOT NULL DEFAULT false,
    "material_type" TEXT,
    "coc_document_url" TEXT,
    "requires_engraving" BOOLEAN NOT NULL DEFAULT false,
    "is_fractional_qty" BOOLEAN NOT NULL DEFAULT false,
    "ownership" VARCHAR(10),
    "po_ownership" VARCHAR(10),
    "top_marking_photo_url" TEXT,
    "sits_status" TEXT NOT NULL DEFAULT 'OPEN',
    "ifs_rejected" BOOLEAN NOT NULL DEFAULT false,
    "ifs_rejected_at" TIMESTAMPTZ,

    CONSTRAINT "rr_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_master" (
    "item_code" TEXT NOT NULL,
    "description" TEXT,
    "stocking_uom" TEXT,
    "vendor_uom" TEXT,
    "counting_method" TEXT,
    "uom_conv_factor" DECIMAL(18,6),
    "weight_net" DECIMAL(65,30),
    "unit_weight_g" DECIMAL(18,6),
    "asset_class" TEXT,
    "is_serialized" BOOLEAN NOT NULL DEFAULT false,
    "reel_attrs" JSONB,
    "location_no" TEXT,
    "cached_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_master_pkey" PRIMARY KEY ("item_code")
);

-- CreateTable
CREATE TABLE "serial" (
    "id" SERIAL NOT NULL,
    "item_code" TEXT NOT NULL,
    "serial_no" TEXT NOT NULL,

    CONSTRAINT "serial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_location" (
    "id" BIGSERIAL NOT NULL,
    "location_no" TEXT NOT NULL,
    "location_name" TEXT,
    "warehouse" TEXT,
    "bay_no" TEXT,
    "row_no" TEXT,
    "tier_no" TEXT,
    "bin_no" TEXT,
    "cached_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approved_alternates" (
    "id" BIGSERIAL NOT NULL,
    "ordered_item" TEXT NOT NULL,
    "alternate_item" TEXT NOT NULL,
    "is_approved" BOOLEAN NOT NULL DEFAULT true,
    "cached_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approved_alternates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "line_count" (
    "id" BIGSERIAL NOT NULL,
    "rr_line_id" BIGINT NOT NULL,
    "method" TEXT NOT NULL,
    "num_packages" INTEGER NOT NULL,
    "qty_per_package" DECIMAL(18,4) NOT NULL,
    "unit_weight_g" DECIMAL(18,6),
    "total_weight_g" DECIMAL(18,4),
    "reel_reading_mtr" DECIMAL(18,4),
    "pitch_mm" DECIMAL(18,4),
    "calculated_qty" DECIMAL(18,4) NOT NULL,
    "operator_edited_qty" DECIMAL(18,4),
    "final_counted_qty" DECIMAL(18,4) NOT NULL,
    "ifs_challan_qty" DECIMAL(18,4) NOT NULL,
    "variance_qty" DECIMAL(18,4) NOT NULL,
    "variance_flag" BOOLEAN NOT NULL DEFAULT false,
    "device_id" TEXT,
    "counted_by" UUID,
    "counted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "line_count_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packet_tags" (
    "id" BIGSERIAL NOT NULL,
    "epc" TEXT NOT NULL,
    "rr_line_id" BIGINT NOT NULL,
    "line_count_id" BIGINT,
    "packet_no" INTEGER NOT NULL,
    "batch_no" TEXT,
    "colour" TEXT,
    "colour_category" TEXT,
    "item_code" TEXT NOT NULL,
    "original_item_code" TEXT,
    "qty" DECIMAL(18,4) NOT NULL,
    "uom" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "tagged_by" UUID,
    "tagged_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tag_type" TEXT NOT NULL DEFAULT 'RFID',
    "serial_number" TEXT,
    "barcode" TEXT,
    "material_type" TEXT,
    "is_voided" BOOLEAN NOT NULL DEFAULT false,
    "void_reason" TEXT,
    "voided_at" TIMESTAMPTZ,
    "coc_doc_link" TEXT,
    "print_status" TEXT NOT NULL DEFAULT 'PENDING',
    "printed_at" TIMESTAMPTZ,
    "read_back_epc" TEXT,
    "commissioned_at" TIMESTAMPTZ,

    CONSTRAINT "packet_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_log" (
    "id" BIGSERIAL NOT NULL,
    "ref" TEXT,
    "event_type" TEXT NOT NULL,
    "phase" TEXT,
    "device" TEXT,
    "app_user" UUID,
    "payload" JSONB,
    "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_registry" (
    "id" BIGSERIAL NOT NULL,
    "device_id" TEXT NOT NULL,
    "device_type" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "controller_host" TEXT NOT NULL,
    "controller_port" INTEGER NOT NULL,
    "controller_protocol" TEXT NOT NULL DEFAULT 'HTTP',
    "machine_id_on_controller" TEXT,
    "endpoint_path" TEXT,
    "config" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_seen_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "device_registry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "baseline" (
    "id" BIGSERIAL NOT NULL,
    "packet_tag_id" BIGINT NOT NULL,
    "method" TEXT NOT NULL,
    "unit_weight" DECIMAL(18,6),
    "total_weight" DECIMAL(18,4),
    "baseline_count" DECIMAL(18,4) NOT NULL,
    "ifs_qty_at_count" DECIMAL(18,4) NOT NULL,
    "variance_flag" BOOLEAN NOT NULL DEFAULT false,
    "variance_amount" DECIMAL(18,4),
    "device_id" TEXT,
    "counted_by" UUID,
    "counted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "baseline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variance" (
    "id" BIGSERIAL NOT NULL,
    "context" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "expected_qty" DECIMAL(18,4),
    "actual_qty" DECIMAL(18,4),
    "variance_amount" DECIMAL(18,4),
    "disposition" TEXT NOT NULL DEFAULT 'PENDING',
    "raised_by" UUID,
    "raised_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_by" UUID,
    "resolved_at" TIMESTAMPTZ,
    "notes" TEXT,

    CONSTRAINT "variance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfer" (
    "id" BIGSERIAL NOT NULL,
    "transfer_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "from_location" TEXT NOT NULL DEFAULT 'TRANSIT',
    "to_location" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dispatched_at" TIMESTAMPTZ,
    "received_at" TIMESTAMPTZ,

    CONSTRAINT "transfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfer_line" (
    "id" BIGSERIAL NOT NULL,
    "transfer_id" BIGINT NOT NULL,
    "packet_tag_id" BIGINT NOT NULL,
    "rr_line_id" BIGINT NOT NULL,
    "epc" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_received" BOOLEAN NOT NULL DEFAULT false,
    "received_at" TIMESTAMPTZ,
    "is_missing" BOOLEAN NOT NULL DEFAULT false,
    "is_extra" BOOLEAN NOT NULL DEFAULT false,
    "received_qty" DECIMAL(18,4),
    "missing_qty" DECIMAL(18,4),
    "notes" TEXT,

    CONSTRAINT "transfer_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "count_check" (
    "id" BIGSERIAL NOT NULL,
    "packet_tag_id" BIGINT NOT NULL,
    "baseline_id" BIGINT NOT NULL,
    "actual_count" DECIMAL(18,4) NOT NULL,
    "baseline_count" DECIMAL(18,4) NOT NULL,
    "matches_baseline" BOOLEAN NOT NULL,
    "variance_amount" DECIMAL(18,4),
    "within_tolerance" BOOLEAN NOT NULL DEFAULT true,
    "manager_override" BOOLEAN NOT NULL DEFAULT false,
    "override_notes" TEXT,
    "device_id" TEXT,
    "checked_by" UUID,
    "checked_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "count_check_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storage_confirmation" (
    "id" BIGSERIAL NOT NULL,
    "packet_tag_id" BIGINT NOT NULL,
    "bin_rfid_epc" TEXT NOT NULL,
    "ifs_location_no" TEXT,
    "warehouse" TEXT,
    "bin_no" TEXT,
    "confirmed_by" UUID,
    "confirmed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "synced_from_device" TEXT,

    CONSTRAINT "storage_confirmation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_verification_run" (
    "id" BIGSERIAL NOT NULL,
    "run_ref" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "location_no" TEXT,
    "warehouse" TEXT,
    "bin_rfid_epc" TEXT,
    "device_id" TEXT,
    "operator_id" UUID,
    "offline" BOOLEAN NOT NULL DEFAULT false,
    "synced_at" TIMESTAMPTZ,
    "found_count" INTEGER NOT NULL DEFAULT 0,
    "not_found_count" INTEGER NOT NULL DEFAULT 0,
    "extra_count" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "run_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "stock_verification_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_verification_line" (
    "id" BIGSERIAL NOT NULL,
    "run_id" BIGINT NOT NULL,
    "outcome" TEXT NOT NULL,
    "item_code" TEXT NOT NULL,
    "item_desc" TEXT,
    "lot_batch_no" TEXT,
    "epc" TEXT,
    "packet_tag_id" BIGINT,
    "qty_found" DECIMAL(18,4) NOT NULL,
    "qty_expected" DECIMAL(18,4) NOT NULL,
    "variance_qty" DECIMAL(18,4) NOT NULL,
    "note" TEXT,

    CONSTRAINT "stock_verification_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert" (
    "id" BIGSERIAL NOT NULL,
    "alert_type" TEXT NOT NULL DEFAULT 'GENERAL',
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'WARNING',
    "ref" TEXT,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "recipient_roles" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'in-app',
    "source_fn" TEXT,
    "meta" JSONB,
    "payload" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledged_by" UUID,
    "acknowledged_at" TIMESTAMPTZ,
    "resolved_at" TIMESTAMPTZ,

    CONSTRAINT "alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouses" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bays" (
    "id" SERIAL NOT NULL,
    "warehouse_id" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "bays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rows" (
    "id" SERIAL NOT NULL,
    "bay_id" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tiers" (
    "id" SERIAL NOT NULL,
    "row_id" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "tier_rfid" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bins" (
    "id" SERIAL NOT NULL,
    "tier_id" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "bin_rfid" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "bins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "binning_plan" (
    "id" BIGSERIAL NOT NULL,
    "plan_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "source" TEXT NOT NULL DEFAULT 'IFS',
    "fetched_by" UUID,
    "fetched_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activated_at" TIMESTAMPTZ,
    "archived_at" TIMESTAMPTZ,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "binning_plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "binning_plan_line" (
    "id" BIGSERIAL NOT NULL,
    "plan_id" BIGINT NOT NULL,
    "line_no" INTEGER NOT NULL,
    "rr_line_id" BIGINT,
    "packet_tag_id" BIGINT,
    "item_code" TEXT NOT NULL,
    "expected_qty" DECIMAL(18,4) NOT NULL,
    "bin_id" TEXT NOT NULL,
    "position_id" TEXT,
    "location_tag_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "binning_plan_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_download" (
    "id" BIGSERIAL NOT NULL,
    "plan_id" BIGINT NOT NULL,
    "device_id" BIGINT NOT NULL,
    "downloaded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "downloaded_by" UUID,
    "status" TEXT NOT NULL DEFAULT 'DOWNLOADED',
    "synced_at" TIMESTAMPTZ,
    "expires_at" TIMESTAMPTZ,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "plan_download_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_sync_state" (
    "id" BIGSERIAL NOT NULL,
    "plan_id" BIGINT NOT NULL,
    "device_id" BIGINT NOT NULL,
    "last_synced_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_confirmed_at" TIMESTAMPTZ,
    "pending_confirmations" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "plan_sync_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "placement_confirmation" (
    "id" BIGSERIAL NOT NULL,
    "plan_line_id" BIGINT NOT NULL,
    "packet_tag_id" BIGINT NOT NULL,
    "expected_location_tag_id" TEXT NOT NULL,
    "actual_location_tag_id" TEXT,
    "expected_bin_id" TEXT NOT NULL,
    "expected_position_id" TEXT,
    "actual_bin_id" TEXT,
    "actual_position_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "mismatch_reason" TEXT,
    "device_id" BIGINT NOT NULL,
    "operator_id" UUID NOT NULL,
    "is_offline" BOOLEAN NOT NULL DEFAULT false,
    "confirmed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "synced_at" TIMESTAMPTZ,
    "sync_log_id" BIGINT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "placement_confirmation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_log" (
    "id" BIGSERIAL NOT NULL,
    "device_id" BIGINT NOT NULL,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "confirmations_uploaded" INTEGER NOT NULL DEFAULT 0,
    "conflicts_detected" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "sync_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ifs_polling_config" (
    "id" UUID NOT NULL,
    "config_key" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "normal_interval_ms" INTEGER NOT NULL DEFAULT 300000,
    "failure_ranges" JSONB NOT NULL DEFAULT '[]',
    "stop_threshold" INTEGER NOT NULL DEFAULT 5,
    "batch_size" INTEGER NOT NULL DEFAULT 25,
    "fetch_ready_qc_status" TEXT NOT NULL DEFAULT 'INSPECTED',
    "re_poll_enabled" BOOLEAN NOT NULL DEFAULT true,
    "re_poll_interval_ms" INTEGER NOT NULL DEFAULT 300000,
    "notify_admin_roles" JSONB NOT NULL DEFAULT '["admin"]',
    "updated_by" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ifs_polling_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ifs_sync_state" (
    "id" UUID NOT NULL,
    "state_key" TEXT NOT NULL DEFAULT 'polling',
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "last_poll_started_at" TIMESTAMPTZ,
    "last_successful_poll" TIMESTAMPTZ,
    "last_failed_poll" TIMESTAMPTZ,
    "consecutive_failure_count" INTEGER NOT NULL DEFAULT 0,
    "current_interval_ms" INTEGER NOT NULL,
    "last_error" TEXT,
    "stop_reason" TEXT,
    "restarted_by" UUID,
    "restarted_at" TIMESTAMPTZ,
    "last_repoll_at" TIMESTAMPTZ,
    "last_repoll_count" INTEGER,
    "last_repoll_error" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ifs_sync_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ifs_gate_entry_sync_state" (
    "id" BIGSERIAL NOT NULL,
    "gate_entry_no" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "last_synced_at" TIMESTAMPTZ,
    "last_error" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ifs_gate_entry_sync_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ifs_sync_watermarks" (
    "id" UUID NOT NULL,
    "resource" TEXT NOT NULL,
    "last_synced_at" TIMESTAMPTZ NOT NULL,
    "last_cursor" TEXT,
    "status" TEXT NOT NULL DEFAULT 'HEALTHY',
    "last_error" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ifs_sync_watermarks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE INDEX "user_roles_role_id_idx" ON "user_roles"("role_id");

-- CreateIndex
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_jti_key" ON "sessions"("jti");

-- CreateIndex
CREATE INDEX "sessions_user_id_revoked_at_expires_at_idx" ON "sessions"("user_id", "revoked_at", "expires_at");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "rr_rr_no_key" ON "rr"("rr_no");

-- CreateIndex
CREATE INDEX "rr_rr_no_idx" ON "rr"("rr_no");

-- CreateIndex
CREATE INDEX "rr_lines_qc_status_idx" ON "rr_lines"("qc_status");

-- CreateIndex
CREATE INDEX "rr_lines_sits_status_idx" ON "rr_lines"("sits_status");

-- CreateIndex
CREATE UNIQUE INDEX "rr_lines_rr_id_rr_line_no_key" ON "rr_lines"("rr_id", "rr_line_no");

-- CreateIndex
CREATE INDEX "item_master_location_no_idx" ON "item_master"("location_no");

-- CreateIndex
CREATE INDEX "serial_item_code_idx" ON "serial"("item_code");

-- CreateIndex
CREATE UNIQUE INDEX "serial_item_code_serial_no_key" ON "serial"("item_code", "serial_no");

-- CreateIndex
CREATE UNIQUE INDEX "item_location_location_no_key" ON "item_location"("location_no");

-- CreateIndex
CREATE INDEX "item_location_warehouse_idx" ON "item_location"("warehouse");

-- CreateIndex
CREATE INDEX "approved_alternates_ordered_item_idx" ON "approved_alternates"("ordered_item");

-- CreateIndex
CREATE UNIQUE INDEX "approved_alternates_ordered_item_alternate_item_key" ON "approved_alternates"("ordered_item", "alternate_item");

-- CreateIndex
CREATE INDEX "line_count_rr_line_id_idx" ON "line_count"("rr_line_id");

-- CreateIndex
CREATE INDEX "line_count_method_idx" ON "line_count"("method");

-- CreateIndex
CREATE INDEX "line_count_variance_flag_idx" ON "line_count"("variance_flag");

-- CreateIndex
CREATE INDEX "line_count_counted_by_idx" ON "line_count"("counted_by");

-- CreateIndex
CREATE UNIQUE INDEX "packet_tags_epc_key" ON "packet_tags"("epc");

-- CreateIndex
CREATE UNIQUE INDEX "packet_tags_serial_number_key" ON "packet_tags"("serial_number");

-- CreateIndex
CREATE UNIQUE INDEX "packet_tags_barcode_key" ON "packet_tags"("barcode");

-- CreateIndex
CREATE INDEX "packet_tags_status_idx" ON "packet_tags"("status");

-- CreateIndex
CREATE UNIQUE INDEX "packet_tags_rr_line_id_packet_no_key" ON "packet_tags"("rr_line_id", "packet_no");

-- CreateIndex
CREATE INDEX "event_log_ref_idx" ON "event_log"("ref");

-- CreateIndex
CREATE INDEX "event_log_event_type_idx" ON "event_log"("event_type");

-- CreateIndex
CREATE UNIQUE INDEX "device_registry_device_id_key" ON "device_registry"("device_id");

-- CreateIndex
CREATE INDEX "device_registry_device_type_location_idx" ON "device_registry"("device_type", "location");

-- CreateIndex
CREATE INDEX "device_registry_controller_host_idx" ON "device_registry"("controller_host");

-- CreateIndex
CREATE INDEX "device_registry_is_active_idx" ON "device_registry"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "baseline_packet_tag_id_key" ON "baseline"("packet_tag_id");

-- CreateIndex
CREATE INDEX "baseline_method_idx" ON "baseline"("method");

-- CreateIndex
CREATE INDEX "baseline_variance_flag_idx" ON "baseline"("variance_flag");

-- CreateIndex
CREATE INDEX "baseline_counted_at_idx" ON "baseline"("counted_at");

-- CreateIndex
CREATE INDEX "baseline_counted_by_idx" ON "baseline"("counted_by");

-- CreateIndex
CREATE INDEX "variance_context_ref_idx" ON "variance"("context", "ref");

-- CreateIndex
CREATE INDEX "variance_disposition_idx" ON "variance"("disposition");

-- CreateIndex
CREATE UNIQUE INDEX "transfer_transfer_id_key" ON "transfer"("transfer_id");

-- CreateIndex
CREATE INDEX "transfer_status_idx" ON "transfer"("status");

-- CreateIndex
CREATE INDEX "transfer_line_transfer_id_idx" ON "transfer_line"("transfer_id");

-- CreateIndex
CREATE INDEX "transfer_line_packet_tag_id_idx" ON "transfer_line"("packet_tag_id");

-- CreateIndex
CREATE INDEX "transfer_line_rr_line_id_idx" ON "transfer_line"("rr_line_id");

-- CreateIndex
CREATE INDEX "transfer_line_epc_idx" ON "transfer_line"("epc");

-- CreateIndex
CREATE INDEX "transfer_line_is_received_idx" ON "transfer_line"("is_received");

-- CreateIndex
CREATE INDEX "transfer_line_is_missing_idx" ON "transfer_line"("is_missing");

-- CreateIndex
CREATE INDEX "count_check_packet_tag_id_idx" ON "count_check"("packet_tag_id");

-- CreateIndex
CREATE INDEX "count_check_baseline_id_idx" ON "count_check"("baseline_id");

-- CreateIndex
CREATE INDEX "count_check_matches_baseline_idx" ON "count_check"("matches_baseline");

-- CreateIndex
CREATE INDEX "count_check_checked_at_idx" ON "count_check"("checked_at");

-- CreateIndex
CREATE UNIQUE INDEX "storage_confirmation_packet_tag_id_key" ON "storage_confirmation"("packet_tag_id");

-- CreateIndex
CREATE INDEX "storage_confirmation_bin_rfid_epc_idx" ON "storage_confirmation"("bin_rfid_epc");

-- CreateIndex
CREATE UNIQUE INDEX "stock_verification_run_run_ref_key" ON "stock_verification_run"("run_ref");

-- CreateIndex
CREATE INDEX "stock_verification_run_trigger_idx" ON "stock_verification_run"("trigger");

-- CreateIndex
CREATE INDEX "stock_verification_run_location_no_idx" ON "stock_verification_run"("location_no");

-- CreateIndex
CREATE INDEX "stock_verification_run_run_at_idx" ON "stock_verification_run"("run_at");

-- CreateIndex
CREATE INDEX "stock_verification_line_run_id_idx" ON "stock_verification_line"("run_id");

-- CreateIndex
CREATE INDEX "stock_verification_line_outcome_idx" ON "stock_verification_line"("outcome");

-- CreateIndex
CREATE INDEX "stock_verification_line_item_code_idx" ON "stock_verification_line"("item_code");

-- CreateIndex
CREATE INDEX "alert_ref_idx" ON "alert"("ref");

-- CreateIndex
CREATE INDEX "alert_alert_type_idx" ON "alert"("alert_type");

-- CreateIndex
CREATE INDEX "alert_acknowledged_at_idx" ON "alert"("acknowledged_at");

-- CreateIndex
CREATE INDEX "alert_status_idx" ON "alert"("status");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_code_key" ON "warehouses"("code");

-- CreateIndex
CREATE INDEX "bays_warehouse_id_idx" ON "bays"("warehouse_id");

-- CreateIndex
CREATE UNIQUE INDEX "bays_warehouse_id_code_key" ON "bays"("warehouse_id", "code");

-- CreateIndex
CREATE INDEX "rows_bay_id_idx" ON "rows"("bay_id");

-- CreateIndex
CREATE UNIQUE INDEX "rows_bay_id_code_key" ON "rows"("bay_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "tiers_tier_rfid_key" ON "tiers"("tier_rfid");

-- CreateIndex
CREATE INDEX "tiers_row_id_idx" ON "tiers"("row_id");

-- CreateIndex
CREATE UNIQUE INDEX "tiers_row_id_code_key" ON "tiers"("row_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "bins_bin_rfid_key" ON "bins"("bin_rfid");

-- CreateIndex
CREATE INDEX "bins_tier_id_idx" ON "bins"("tier_id");

-- CreateIndex
CREATE UNIQUE INDEX "bins_tier_id_code_key" ON "bins"("tier_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "binning_plan_plan_id_key" ON "binning_plan"("plan_id");

-- CreateIndex
CREATE INDEX "binning_plan_status_idx" ON "binning_plan"("status");

-- CreateIndex
CREATE INDEX "binning_plan_fetched_at_idx" ON "binning_plan"("fetched_at");

-- CreateIndex
CREATE INDEX "binning_plan_line_plan_id_idx" ON "binning_plan_line"("plan_id");

-- CreateIndex
CREATE INDEX "binning_plan_line_rr_line_id_idx" ON "binning_plan_line"("rr_line_id");

-- CreateIndex
CREATE INDEX "binning_plan_line_packet_tag_id_idx" ON "binning_plan_line"("packet_tag_id");

-- CreateIndex
CREATE INDEX "binning_plan_line_bin_id_position_id_idx" ON "binning_plan_line"("bin_id", "position_id");

-- CreateIndex
CREATE INDEX "binning_plan_line_status_idx" ON "binning_plan_line"("status");

-- CreateIndex
CREATE UNIQUE INDEX "binning_plan_line_plan_id_line_no_key" ON "binning_plan_line"("plan_id", "line_no");

-- CreateIndex
CREATE INDEX "plan_download_plan_id_idx" ON "plan_download"("plan_id");

-- CreateIndex
CREATE INDEX "plan_download_device_id_idx" ON "plan_download"("device_id");

-- CreateIndex
CREATE INDEX "plan_download_status_idx" ON "plan_download"("status");

-- CreateIndex
CREATE INDEX "plan_download_downloaded_at_idx" ON "plan_download"("downloaded_at");

-- CreateIndex
CREATE UNIQUE INDEX "plan_download_plan_id_device_id_key" ON "plan_download"("plan_id", "device_id");

-- CreateIndex
CREATE INDEX "plan_sync_state_plan_id_idx" ON "plan_sync_state"("plan_id");

-- CreateIndex
CREATE INDEX "plan_sync_state_device_id_idx" ON "plan_sync_state"("device_id");

-- CreateIndex
CREATE INDEX "plan_sync_state_last_synced_at_idx" ON "plan_sync_state"("last_synced_at");

-- CreateIndex
CREATE UNIQUE INDEX "plan_sync_state_plan_id_device_id_key" ON "plan_sync_state"("plan_id", "device_id");

-- CreateIndex
CREATE INDEX "placement_confirmation_plan_line_id_idx" ON "placement_confirmation"("plan_line_id");

-- CreateIndex
CREATE INDEX "placement_confirmation_packet_tag_id_idx" ON "placement_confirmation"("packet_tag_id");

-- CreateIndex
CREATE INDEX "placement_confirmation_expected_location_tag_id_idx" ON "placement_confirmation"("expected_location_tag_id");

-- CreateIndex
CREATE INDEX "placement_confirmation_actual_location_tag_id_idx" ON "placement_confirmation"("actual_location_tag_id");

-- CreateIndex
CREATE INDEX "placement_confirmation_device_id_idx" ON "placement_confirmation"("device_id");

-- CreateIndex
CREATE INDEX "placement_confirmation_operator_id_idx" ON "placement_confirmation"("operator_id");

-- CreateIndex
CREATE INDEX "placement_confirmation_is_offline_idx" ON "placement_confirmation"("is_offline");

-- CreateIndex
CREATE INDEX "placement_confirmation_confirmed_at_idx" ON "placement_confirmation"("confirmed_at");

-- CreateIndex
CREATE INDEX "placement_confirmation_synced_at_idx" ON "placement_confirmation"("synced_at");

-- CreateIndex
CREATE INDEX "placement_confirmation_sync_log_id_idx" ON "placement_confirmation"("sync_log_id");

-- CreateIndex
CREATE INDEX "sync_log_device_id_idx" ON "sync_log"("device_id");

-- CreateIndex
CREATE INDEX "sync_log_started_at_idx" ON "sync_log"("started_at");

-- CreateIndex
CREATE INDEX "sync_log_status_idx" ON "sync_log"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ifs_polling_config_config_key_key" ON "ifs_polling_config"("config_key");

-- CreateIndex
CREATE UNIQUE INDEX "ifs_sync_state_state_key_key" ON "ifs_sync_state"("state_key");

-- CreateIndex
CREATE UNIQUE INDEX "ifs_gate_entry_sync_state_gate_entry_no_key" ON "ifs_gate_entry_sync_state"("gate_entry_no");

-- CreateIndex
CREATE INDEX "ifs_gate_entry_sync_state_status_idx" ON "ifs_gate_entry_sync_state"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ifs_sync_watermarks_resource_key" ON "ifs_sync_watermarks"("resource");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rr_lines" ADD CONSTRAINT "rr_lines_rr_id_fkey" FOREIGN KEY ("rr_id") REFERENCES "rr"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_master" ADD CONSTRAINT "item_master_location_no_fkey" FOREIGN KEY ("location_no") REFERENCES "item_location"("location_no") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serial" ADD CONSTRAINT "serial_item_code_fkey" FOREIGN KEY ("item_code") REFERENCES "item_master"("item_code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "line_count" ADD CONSTRAINT "line_count_rr_line_id_fkey" FOREIGN KEY ("rr_line_id") REFERENCES "rr_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "line_count" ADD CONSTRAINT "line_count_counted_by_fkey" FOREIGN KEY ("counted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packet_tags" ADD CONSTRAINT "packet_tags_rr_line_id_fkey" FOREIGN KEY ("rr_line_id") REFERENCES "rr_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packet_tags" ADD CONSTRAINT "packet_tags_line_count_id_fkey" FOREIGN KEY ("line_count_id") REFERENCES "line_count"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "baseline" ADD CONSTRAINT "baseline_packet_tag_id_fkey" FOREIGN KEY ("packet_tag_id") REFERENCES "packet_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "baseline" ADD CONSTRAINT "baseline_counted_by_fkey" FOREIGN KEY ("counted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_line" ADD CONSTRAINT "transfer_line_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "transfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_line" ADD CONSTRAINT "transfer_line_packet_tag_id_fkey" FOREIGN KEY ("packet_tag_id") REFERENCES "packet_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_line" ADD CONSTRAINT "transfer_line_rr_line_id_fkey" FOREIGN KEY ("rr_line_id") REFERENCES "rr_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "count_check" ADD CONSTRAINT "count_check_packet_tag_id_fkey" FOREIGN KEY ("packet_tag_id") REFERENCES "packet_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "count_check" ADD CONSTRAINT "count_check_baseline_id_fkey" FOREIGN KEY ("baseline_id") REFERENCES "baseline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storage_confirmation" ADD CONSTRAINT "storage_confirmation_packet_tag_id_fkey" FOREIGN KEY ("packet_tag_id") REFERENCES "packet_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_verification_line" ADD CONSTRAINT "stock_verification_line_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "stock_verification_run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert" ADD CONSTRAINT "alert_acknowledged_by_fkey" FOREIGN KEY ("acknowledged_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bays" ADD CONSTRAINT "bays_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rows" ADD CONSTRAINT "rows_bay_id_fkey" FOREIGN KEY ("bay_id") REFERENCES "bays"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tiers" ADD CONSTRAINT "tiers_row_id_fkey" FOREIGN KEY ("row_id") REFERENCES "rows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bins" ADD CONSTRAINT "bins_tier_id_fkey" FOREIGN KEY ("tier_id") REFERENCES "tiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "binning_plan" ADD CONSTRAINT "binning_plan_fetched_by_fkey" FOREIGN KEY ("fetched_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "binning_plan_line" ADD CONSTRAINT "binning_plan_line_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "binning_plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "binning_plan_line" ADD CONSTRAINT "binning_plan_line_rr_line_id_fkey" FOREIGN KEY ("rr_line_id") REFERENCES "rr_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "binning_plan_line" ADD CONSTRAINT "binning_plan_line_packet_tag_id_fkey" FOREIGN KEY ("packet_tag_id") REFERENCES "packet_tags"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_download" ADD CONSTRAINT "plan_download_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "binning_plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_download" ADD CONSTRAINT "plan_download_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "device_registry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_download" ADD CONSTRAINT "plan_download_downloaded_by_fkey" FOREIGN KEY ("downloaded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_sync_state" ADD CONSTRAINT "plan_sync_state_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "binning_plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_sync_state" ADD CONSTRAINT "plan_sync_state_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "device_registry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "placement_confirmation" ADD CONSTRAINT "placement_confirmation_plan_line_id_fkey" FOREIGN KEY ("plan_line_id") REFERENCES "binning_plan_line"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "placement_confirmation" ADD CONSTRAINT "placement_confirmation_packet_tag_id_fkey" FOREIGN KEY ("packet_tag_id") REFERENCES "packet_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "placement_confirmation" ADD CONSTRAINT "placement_confirmation_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "device_registry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "placement_confirmation" ADD CONSTRAINT "placement_confirmation_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "placement_confirmation" ADD CONSTRAINT "placement_confirmation_sync_log_id_fkey" FOREIGN KEY ("sync_log_id") REFERENCES "sync_log"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_log" ADD CONSTRAINT "sync_log_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "device_registry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

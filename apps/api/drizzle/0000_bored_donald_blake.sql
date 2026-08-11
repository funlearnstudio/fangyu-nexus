CREATE TYPE "public"."asset_type" AS ENUM('mod', 'plugin', 'resource_pack', 'shader', 'modpack', 'schematic', 'skin', 'datapack');--> statement-breakpoint
CREATE TYPE "public"."content_status" AS ENUM('draft', 'quarantined', 'review', 'published', 'rejected', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."edition" AS ENUM('java', 'bedrock');--> statement-breakpoint
CREATE TYPE "public"."release_channel" AS ENUM('release', 'snapshot', 'preview', 'historical');--> statement-breakpoint
CREATE TABLE "achievements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"rule" jsonb NOT NULL,
	"active_from" timestamp with time zone NOT NULL,
	"active_to" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asset_dependencies" (
	"asset_version_id" uuid NOT NULL,
	"depends_on_asset_id" uuid NOT NULL,
	"relation_type" text NOT NULL,
	"version_range" text,
	"loader_constraint" text,
	CONSTRAINT "asset_dependencies_asset_version_id_depends_on_asset_id_relation_type_pk" PRIMARY KEY("asset_version_id","depends_on_asset_id","relation_type")
);
--> statement-breakpoint
CREATE TABLE "asset_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"game_version_id" uuid,
	"loader" text,
	"version_number" text NOT NULL,
	"file_url" text,
	"sha256" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"source_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid,
	"source_id" uuid NOT NULL,
	"source_project_id" text NOT NULL,
	"type" "asset_type" NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"author_name" text NOT NULL,
	"license_id" uuid,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "biome_structures" (
	"biome_id" uuid NOT NULL,
	"structure_id" uuid NOT NULL,
	"game_version_id" uuid NOT NULL,
	"condition" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "biome_structures_biome_id_structure_id_game_version_id_pk" PRIMARY KEY("biome_id","structure_id","game_version_id")
);
--> statement-breakpoint
CREATE TABLE "biomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"namespace_id" text NOT NULL,
	"edition" "edition" NOT NULL,
	"game_version_id" uuid NOT NULL,
	"valid_from" text NOT NULL,
	"valid_to" text,
	"name" text NOT NULL,
	"climate" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"resources" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"parent_id" uuid,
	"body_ast" jsonb NOT NULL,
	"status" "content_status" DEFAULT 'published' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"user_id" uuid NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favorites_user_id_target_type_target_id_pk" PRIMARY KEY("user_id","target_type","target_id")
);
--> statement-breakpoint
CREATE TABLE "game_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"edition" "edition" NOT NULL,
	"player_uuid" text NOT NULL,
	"player_name" text NOT NULL,
	"skin_url" text,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"edition" "edition" NOT NULL,
	"version_name" text NOT NULL,
	"channel" "release_channel" NOT NULL,
	"data_version" integer,
	"released_at" timestamp with time zone NOT NULL,
	"is_supported" boolean DEFAULT false NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"source_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item_tags" (
	"item_version_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "item_tags_item_version_id_tag_id_pk" PRIMARY KEY("item_version_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "item_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"game_version_id" uuid NOT NULL,
	"valid_from" text NOT NULL,
	"valid_to" text,
	"name_key" text NOT NULL,
	"display_name" text NOT NULL,
	"stack_size" integer NOT NULL,
	"durability" integer,
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"namespace_id" text NOT NULL,
	"kind" text NOT NULL,
	"default_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "licenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"spdx_id" text,
	"name" text NOT NULL,
	"allow_modify" boolean DEFAULT false NOT NULL,
	"allow_commercial" boolean DEFAULT false NOT NULL,
	"allow_redistribute" boolean DEFAULT false NOT NULL,
	"text_url" text NOT NULL,
	"license_snapshot" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mob_drops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mob_version_id" uuid NOT NULL,
	"item_version_id" uuid NOT NULL,
	"min_count" integer DEFAULT 0 NOT NULL,
	"max_count" integer DEFAULT 1 NOT NULL,
	"chance_rule" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"condition" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mob_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mob_id" uuid NOT NULL,
	"game_version_id" uuid NOT NULL,
	"valid_from" text NOT NULL,
	"valid_to" text,
	"health" numeric(10, 2) NOT NULL,
	"armor" numeric(10, 2),
	"attack" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"behavior" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"breeding" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"namespace_id" text NOT NULL,
	"default_name" text NOT NULL,
	"category" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body_ast" jsonb NOT NULL,
	"edition" "edition",
	"game_version_id" uuid,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe_inputs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" uuid NOT NULL,
	"slot_index" integer,
	"ingredient_item_version_id" uuid,
	"ingredient_tag_id" uuid,
	"count" integer DEFAULT 1 NOT NULL,
	"choice_group" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"edition" "edition" NOT NULL,
	"game_version_id" uuid NOT NULL,
	"valid_from" text NOT NULL,
	"valid_to" text,
	"type" text NOT NULL,
	"output_item_version_id" uuid NOT NULL,
	"output_count" integer NOT NULL,
	"ticks" integer,
	"experience" numeric(10, 4),
	"pattern" jsonb,
	"source_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" uuid NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"evidence_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"assignee_id" uuid,
	"resolution" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "server_status_samples" (
	"server_id" uuid NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"probe_region" text NOT NULL,
	"online" boolean NOT NULL,
	"latency_ms" integer,
	"players_online" integer,
	"players_max" integer,
	"version_text" text,
	"protocol" integer,
	CONSTRAINT "server_status_samples_server_id_observed_at_probe_region_pk" PRIMARY KEY("server_id","observed_at","probe_region")
);
--> statement-breakpoint
CREATE TABLE "servers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid,
	"slug" text NOT NULL,
	"host_ciphertext" text,
	"public_host" text NOT NULL,
	"port" integer NOT NULL,
	"edition" "edition" NOT NULL,
	"region" text NOT NULL,
	"verified_at" timestamp with time zone,
	"status" text DEFAULT 'pending' NOT NULL,
	"source_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"source_key" text NOT NULL,
	"source_url" text NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"checksum" text NOT NULL,
	"provenance" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "structures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"namespace_id" text NOT NULL,
	"edition" "edition" NOT NULL,
	"game_version_id" uuid NOT NULL,
	"valid_from" text NOT NULL,
	"valid_to" text,
	"name" text NOT NULL,
	"generation_rule" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"edition" "edition" NOT NULL,
	"game_version_id" uuid NOT NULL,
	"namespace_id" text NOT NULL,
	"kind" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid,
	"object_key" text NOT NULL,
	"file_name" text NOT NULL,
	"byte_length" bigint NOT NULL,
	"mime_type" text NOT NULL,
	"declared_type" text NOT NULL,
	"detected_type" text,
	"sha256" text,
	"status" text DEFAULT 'quarantined' NOT NULL,
	"validation_result" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_achievements" (
	"user_id" uuid NOT NULL,
	"achievement_id" uuid NOT NULL,
	"awarded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "user_achievements_user_id_achievement_id_pk" PRIMARY KEY("user_id","achievement_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"handle" text NOT NULL,
	"email_hash" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"locale" text DEFAULT 'zh-TW' NOT NULL,
	"reputation" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"user_id" uuid NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"value" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "votes_user_id_target_type_target_id_pk" PRIMARY KEY("user_id","target_type","target_id")
);
--> statement-breakpoint
ALTER TABLE "asset_dependencies" ADD CONSTRAINT "asset_dependencies_asset_version_id_asset_versions_id_fk" FOREIGN KEY ("asset_version_id") REFERENCES "public"."asset_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_dependencies" ADD CONSTRAINT "asset_dependencies_depends_on_asset_id_assets_id_fk" FOREIGN KEY ("depends_on_asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_versions" ADD CONSTRAINT "asset_versions_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_versions" ADD CONSTRAINT "asset_versions_game_version_id_game_versions_id_fk" FOREIGN KEY ("game_version_id") REFERENCES "public"."game_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_versions" ADD CONSTRAINT "asset_versions_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_license_id_licenses_id_fk" FOREIGN KEY ("license_id") REFERENCES "public"."licenses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "biome_structures" ADD CONSTRAINT "biome_structures_biome_id_biomes_id_fk" FOREIGN KEY ("biome_id") REFERENCES "public"."biomes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "biome_structures" ADD CONSTRAINT "biome_structures_structure_id_structures_id_fk" FOREIGN KEY ("structure_id") REFERENCES "public"."structures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "biome_structures" ADD CONSTRAINT "biome_structures_game_version_id_game_versions_id_fk" FOREIGN KEY ("game_version_id") REFERENCES "public"."game_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "biomes" ADD CONSTRAINT "biomes_game_version_id_game_versions_id_fk" FOREIGN KEY ("game_version_id") REFERENCES "public"."game_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "biomes" ADD CONSTRAINT "biomes_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_profiles" ADD CONSTRAINT "game_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_versions" ADD CONSTRAINT "game_versions_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_tags" ADD CONSTRAINT "item_tags_item_version_id_item_versions_id_fk" FOREIGN KEY ("item_version_id") REFERENCES "public"."item_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_tags" ADD CONSTRAINT "item_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_versions" ADD CONSTRAINT "item_versions_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_versions" ADD CONSTRAINT "item_versions_game_version_id_game_versions_id_fk" FOREIGN KEY ("game_version_id") REFERENCES "public"."game_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_versions" ADD CONSTRAINT "item_versions_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mob_drops" ADD CONSTRAINT "mob_drops_mob_version_id_mob_versions_id_fk" FOREIGN KEY ("mob_version_id") REFERENCES "public"."mob_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mob_drops" ADD CONSTRAINT "mob_drops_item_version_id_item_versions_id_fk" FOREIGN KEY ("item_version_id") REFERENCES "public"."item_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mob_drops" ADD CONSTRAINT "mob_drops_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mob_versions" ADD CONSTRAINT "mob_versions_mob_id_mobs_id_fk" FOREIGN KEY ("mob_id") REFERENCES "public"."mobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mob_versions" ADD CONSTRAINT "mob_versions_game_version_id_game_versions_id_fk" FOREIGN KEY ("game_version_id") REFERENCES "public"."game_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mob_versions" ADD CONSTRAINT "mob_versions_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_game_version_id_game_versions_id_fk" FOREIGN KEY ("game_version_id") REFERENCES "public"."game_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_inputs" ADD CONSTRAINT "recipe_inputs_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_inputs" ADD CONSTRAINT "recipe_inputs_ingredient_item_version_id_item_versions_id_fk" FOREIGN KEY ("ingredient_item_version_id") REFERENCES "public"."item_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_inputs" ADD CONSTRAINT "recipe_inputs_ingredient_tag_id_tags_id_fk" FOREIGN KEY ("ingredient_tag_id") REFERENCES "public"."tags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_game_version_id_game_versions_id_fk" FOREIGN KEY ("game_version_id") REFERENCES "public"."game_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_output_item_version_id_item_versions_id_fk" FOREIGN KEY ("output_item_version_id") REFERENCES "public"."item_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_status_samples" ADD CONSTRAINT "server_status_samples_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "servers" ADD CONSTRAINT "servers_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "servers" ADD CONSTRAINT "servers_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "structures" ADD CONSTRAINT "structures_game_version_id_game_versions_id_fk" FOREIGN KEY ("game_version_id") REFERENCES "public"."game_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "structures" ADD CONSTRAINT "structures_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_game_version_id_game_versions_id_fk" FOREIGN KEY ("game_version_id") REFERENCES "public"."game_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_achievement_id_achievements_id_fk" FOREIGN KEY ("achievement_id") REFERENCES "public"."achievements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "achievements_code_unique" ON "achievements" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "asset_versions_asset_number_unique" ON "asset_versions" USING btree ("asset_id","version_number");--> statement-breakpoint
CREATE UNIQUE INDEX "assets_source_project_unique" ON "assets" USING btree ("source_id","source_project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "assets_slug_unique" ON "assets" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "audit_logs_target_idx" ON "audit_logs" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "biomes_version_namespace_unique" ON "biomes" USING btree ("game_version_id","namespace_id");--> statement-breakpoint
CREATE INDEX "comments_post_idx" ON "comments" USING btree ("post_id");--> statement-breakpoint
CREATE UNIQUE INDEX "game_profiles_edition_uuid_unique" ON "game_profiles" USING btree ("edition","player_uuid");--> statement-breakpoint
CREATE INDEX "game_profiles_user_idx" ON "game_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "game_versions_edition_name_unique" ON "game_versions" USING btree ("edition","version_name");--> statement-breakpoint
CREATE UNIQUE INDEX "item_versions_item_version_unique" ON "item_versions" USING btree ("item_id","game_version_id");--> statement-breakpoint
CREATE INDEX "item_versions_version_idx" ON "item_versions" USING btree ("game_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "items_namespace_id_unique" ON "items" USING btree ("namespace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "licenses_spdx_unique" ON "licenses" USING btree ("spdx_id");--> statement-breakpoint
CREATE INDEX "mob_drops_mob_idx" ON "mob_drops" USING btree ("mob_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mob_versions_mob_version_unique" ON "mob_versions" USING btree ("mob_id","game_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mobs_namespace_unique" ON "mobs" USING btree ("namespace_id");--> statement-breakpoint
CREATE INDEX "posts_author_idx" ON "posts" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "posts_version_status_idx" ON "posts" USING btree ("game_version_id","status");--> statement-breakpoint
CREATE INDEX "recipe_inputs_recipe_idx" ON "recipe_inputs" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "recipes_scope_output_idx" ON "recipes" USING btree ("edition","game_version_id","output_item_version_id");--> statement-breakpoint
CREATE INDEX "reports_status_idx" ON "reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "server_status_observed_idx" ON "server_status_samples" USING btree ("observed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "servers_slug_unique" ON "servers" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "servers_edition_region_idx" ON "servers" USING btree ("edition","region");--> statement-breakpoint
CREATE UNIQUE INDEX "sources_provider_key_unique" ON "sources" USING btree ("provider","source_key");--> statement-breakpoint
CREATE UNIQUE INDEX "structures_version_namespace_unique" ON "structures" USING btree ("game_version_id","namespace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_version_namespace_unique" ON "tags" USING btree ("game_version_id","namespace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uploads_object_key_unique" ON "uploads" USING btree ("object_key");--> statement-breakpoint
CREATE INDEX "uploads_status_expires_idx" ON "uploads" USING btree ("status","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_handle_unique" ON "users" USING btree ("handle");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_hash_unique" ON "users" USING btree ("email_hash");
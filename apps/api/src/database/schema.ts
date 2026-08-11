import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const editionEnum = pgEnum("edition", ["java", "bedrock"]);
export const releaseChannelEnum = pgEnum("release_channel", [
  "release",
  "snapshot",
  "preview",
  "historical",
]);
export const contentStatusEnum = pgEnum("content_status", [
  "draft",
  "quarantined",
  "review",
  "published",
  "rejected",
  "superseded",
]);
export const assetTypeEnum = pgEnum("asset_type", [
  "mod",
  "plugin",
  "resource_pack",
  "shader",
  "modpack",
  "schematic",
  "skin",
  "datapack",
]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
};

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    handle: text("handle").notNull(),
    emailHash: text("email_hash").notNull(),
    role: text("role").notNull().default("member"),
    locale: text("locale").notNull().default("zh-TW"),
    reputation: integer("reputation").notNull().default(0),
    status: text("status").notNull().default("active"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("users_handle_unique").on(table.handle),
    uniqueIndex("users_email_hash_unique").on(table.emailHash),
  ],
);

export const sources = pgTable(
  "sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider").notNull(),
    sourceKey: text("source_key").notNull(),
    sourceUrl: text("source_url").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
    checksum: text("checksum").notNull(),
    provenance: jsonb("provenance").notNull().default({}),
    isDemo: boolean("is_demo").notNull().default(false),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("sources_provider_key_unique").on(
      table.provider,
      table.sourceKey,
    ),
  ],
);

export const gameProfiles = pgTable(
  "game_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    edition: editionEnum("edition").notNull(),
    playerUuid: text("player_uuid").notNull(),
    playerName: text("player_name").notNull(),
    skinUrl: text("skin_url"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("game_profiles_edition_uuid_unique").on(
      table.edition,
      table.playerUuid,
    ),
    index("game_profiles_user_idx").on(table.userId),
  ],
);

export const gameVersions = pgTable(
  "game_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    edition: editionEnum("edition").notNull(),
    versionName: text("version_name").notNull(),
    channel: releaseChannelEnum("channel").notNull(),
    dataVersion: integer("data_version"),
    releasedAt: timestamp("released_at", { withTimezone: true }).notNull(),
    isSupported: boolean("is_supported").notNull().default(false),
    isDemo: boolean("is_demo").notNull().default(false),
    sourceId: uuid("source_id").references(() => sources.id),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("game_versions_edition_name_unique").on(
      table.edition,
      table.versionName,
    ),
  ],
);

export const items = pgTable(
  "items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    namespaceId: text("namespace_id").notNull(),
    kind: text("kind").notNull(),
    defaultName: text("default_name").notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("items_namespace_id_unique").on(table.namespaceId)],
);

export const itemVersions = pgTable(
  "item_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    gameVersionId: uuid("game_version_id")
      .notNull()
      .references(() => gameVersions.id, { onDelete: "cascade" }),
    validFrom: text("valid_from").notNull(),
    validTo: text("valid_to"),
    nameKey: text("name_key").notNull(),
    displayName: text("display_name").notNull(),
    stackSize: integer("stack_size").notNull(),
    durability: integer("durability"),
    properties: jsonb("properties").notNull().default({}),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("item_versions_item_version_unique").on(
      table.itemId,
      table.gameVersionId,
    ),
    index("item_versions_version_idx").on(table.gameVersionId),
  ],
);

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    edition: editionEnum("edition").notNull(),
    gameVersionId: uuid("game_version_id")
      .notNull()
      .references(() => gameVersions.id, { onDelete: "cascade" }),
    namespaceId: text("namespace_id").notNull(),
    kind: text("kind").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("tags_version_namespace_unique").on(
      table.gameVersionId,
      table.namespaceId,
    ),
  ],
);

export const itemTags = pgTable(
  "item_tags",
  {
    itemVersionId: uuid("item_version_id")
      .notNull()
      .references(() => itemVersions.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.itemVersionId, table.tagId] })],
);

export const recipes = pgTable(
  "recipes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    edition: editionEnum("edition").notNull(),
    gameVersionId: uuid("game_version_id")
      .notNull()
      .references(() => gameVersions.id, { onDelete: "cascade" }),
    validFrom: text("valid_from").notNull(),
    validTo: text("valid_to"),
    type: text("type").notNull(),
    outputItemVersionId: uuid("output_item_version_id")
      .notNull()
      .references(() => itemVersions.id),
    outputCount: integer("output_count").notNull(),
    ticks: integer("ticks"),
    experience: numeric("experience", { precision: 10, scale: 4 }),
    pattern: jsonb("pattern"),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id),
    ...timestamps,
  },
  (table) => [
    index("recipes_scope_output_idx").on(
      table.edition,
      table.gameVersionId,
      table.outputItemVersionId,
    ),
  ],
);

export const recipeInputs = pgTable(
  "recipe_inputs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    slotIndex: integer("slot_index"),
    ingredientItemVersionId: uuid("ingredient_item_version_id").references(
      () => itemVersions.id,
    ),
    ingredientTagId: uuid("ingredient_tag_id").references(() => tags.id),
    count: integer("count").notNull().default(1),
    choiceGroup: text("choice_group"),
    ...timestamps,
  },
  (table) => [index("recipe_inputs_recipe_idx").on(table.recipeId)],
);

export const mobs = pgTable(
  "mobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    namespaceId: text("namespace_id").notNull(),
    defaultName: text("default_name").notNull(),
    category: text("category").notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("mobs_namespace_unique").on(table.namespaceId)],
);

export const mobVersions = pgTable(
  "mob_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    mobId: uuid("mob_id")
      .notNull()
      .references(() => mobs.id, { onDelete: "cascade" }),
    gameVersionId: uuid("game_version_id")
      .notNull()
      .references(() => gameVersions.id, { onDelete: "cascade" }),
    validFrom: text("valid_from").notNull(),
    validTo: text("valid_to"),
    health: numeric("health", { precision: 10, scale: 2 }).notNull(),
    armor: numeric("armor", { precision: 10, scale: 2 }),
    attack: jsonb("attack").notNull().default({}),
    behavior: jsonb("behavior").notNull().default({}),
    breeding: jsonb("breeding").notNull().default({}),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("mob_versions_mob_version_unique").on(
      table.mobId,
      table.gameVersionId,
    ),
  ],
);

export const mobDrops = pgTable(
  "mob_drops",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    mobVersionId: uuid("mob_version_id")
      .notNull()
      .references(() => mobVersions.id, { onDelete: "cascade" }),
    itemVersionId: uuid("item_version_id")
      .notNull()
      .references(() => itemVersions.id),
    minCount: integer("min_count").notNull().default(0),
    maxCount: integer("max_count").notNull().default(1),
    chanceRule: jsonb("chance_rule").notNull().default({}),
    condition: jsonb("condition").notNull().default({}),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id),
    ...timestamps,
  },
  (table) => [index("mob_drops_mob_idx").on(table.mobVersionId)],
);

export const biomes = pgTable(
  "biomes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    namespaceId: text("namespace_id").notNull(),
    edition: editionEnum("edition").notNull(),
    gameVersionId: uuid("game_version_id")
      .notNull()
      .references(() => gameVersions.id),
    validFrom: text("valid_from").notNull(),
    validTo: text("valid_to"),
    name: text("name").notNull(),
    climate: jsonb("climate").notNull().default({}),
    resources: jsonb("resources").notNull().default({}),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("biomes_version_namespace_unique").on(
      table.gameVersionId,
      table.namespaceId,
    ),
  ],
);

export const structures = pgTable(
  "structures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    namespaceId: text("namespace_id").notNull(),
    edition: editionEnum("edition").notNull(),
    gameVersionId: uuid("game_version_id")
      .notNull()
      .references(() => gameVersions.id),
    validFrom: text("valid_from").notNull(),
    validTo: text("valid_to"),
    name: text("name").notNull(),
    generationRule: jsonb("generation_rule").notNull().default({}),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("structures_version_namespace_unique").on(
      table.gameVersionId,
      table.namespaceId,
    ),
  ],
);

export const biomeStructures = pgTable(
  "biome_structures",
  {
    biomeId: uuid("biome_id")
      .notNull()
      .references(() => biomes.id, { onDelete: "cascade" }),
    structureId: uuid("structure_id")
      .notNull()
      .references(() => structures.id, { onDelete: "cascade" }),
    gameVersionId: uuid("game_version_id")
      .notNull()
      .references(() => gameVersions.id, { onDelete: "cascade" }),
    condition: jsonb("condition").notNull().default({}),
  },
  (table) => [
    primaryKey({
      columns: [table.biomeId, table.structureId, table.gameVersionId],
    }),
  ],
);

export const licenses = pgTable(
  "licenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    spdxId: text("spdx_id"),
    name: text("name").notNull(),
    allowModify: boolean("allow_modify").notNull().default(false),
    allowCommercial: boolean("allow_commercial").notNull().default(false),
    allowRedistribute: boolean("allow_redistribute").notNull().default(false),
    textUrl: text("text_url").notNull(),
    licenseSnapshot: text("license_snapshot"),
    ...timestamps,
  },
  (table) => [uniqueIndex("licenses_spdx_unique").on(table.spdxId)],
);

export const assets = pgTable(
  "assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerUserId: uuid("owner_user_id").references(() => users.id),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id),
    sourceProjectId: text("source_project_id").notNull(),
    type: assetTypeEnum("type").notNull(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    authorName: text("author_name").notNull(),
    licenseId: uuid("license_id").references(() => licenses.id),
    status: contentStatusEnum("status").notNull().default("draft"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("assets_source_project_unique").on(
      table.sourceId,
      table.sourceProjectId,
    ),
    uniqueIndex("assets_slug_unique").on(table.slug),
  ],
);

export const assetVersions = pgTable(
  "asset_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    gameVersionId: uuid("game_version_id").references(() => gameVersions.id),
    loader: text("loader"),
    versionNumber: text("version_number").notNull(),
    fileUrl: text("file_url"),
    sha256: text("sha256").notNull(),
    metadata: jsonb("metadata").notNull().default({}),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("asset_versions_asset_number_unique").on(
      table.assetId,
      table.versionNumber,
    ),
  ],
);

export const assetDependencies = pgTable(
  "asset_dependencies",
  {
    assetVersionId: uuid("asset_version_id")
      .notNull()
      .references(() => assetVersions.id, { onDelete: "cascade" }),
    dependsOnAssetId: uuid("depends_on_asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    relationType: text("relation_type").notNull(),
    versionRange: text("version_range"),
    loaderConstraint: text("loader_constraint"),
  },
  (table) => [
    primaryKey({
      columns: [
        table.assetVersionId,
        table.dependsOnAssetId,
        table.relationType,
      ],
    }),
  ],
);

export const servers = pgTable(
  "servers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerUserId: uuid("owner_user_id").references(() => users.id),
    slug: text("slug").notNull(),
    hostCiphertext: text("host_ciphertext"),
    publicHost: text("public_host").notNull(),
    port: integer("port").notNull(),
    edition: editionEnum("edition").notNull(),
    region: text("region").notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    status: text("status").notNull().default("pending"),
    sourceId: uuid("source_id").references(() => sources.id),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("servers_slug_unique").on(table.slug),
    index("servers_edition_region_idx").on(table.edition, table.region),
  ],
);

export const serverStatusSamples = pgTable(
  "server_status_samples",
  {
    serverId: uuid("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
    probeRegion: text("probe_region").notNull(),
    online: boolean("online").notNull(),
    latencyMs: integer("latency_ms"),
    playersOnline: integer("players_online"),
    playersMax: integer("players_max"),
    versionText: text("version_text"),
    protocol: integer("protocol"),
  },
  (table) => [
    primaryKey({
      columns: [table.serverId, table.observedAt, table.probeRegion],
    }),
    index("server_status_observed_idx").on(table.observedAt),
  ],
);

export const posts = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id),
    type: text("type").notNull(),
    title: text("title").notNull(),
    bodyAst: jsonb("body_ast").notNull(),
    edition: editionEnum("edition"),
    gameVersionId: uuid("game_version_id").references(() => gameVersions.id),
    status: contentStatusEnum("status").notNull().default("draft"),
    ...timestamps,
  },
  (table) => [
    index("posts_author_idx").on(table.authorId),
    index("posts_version_status_idx").on(table.gameVersionId, table.status),
  ],
);

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id),
    parentId: uuid("parent_id"),
    bodyAst: jsonb("body_ast").notNull(),
    status: contentStatusEnum("status").notNull().default("published"),
    ...timestamps,
  },
  (table) => [index("comments_post_idx").on(table.postId)],
);

export const votes = pgTable(
  "votes",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetType: text("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    value: integer("value").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.targetType, table.targetId] }),
  ],
);

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reporterId: uuid("reporter_id")
      .notNull()
      .references(() => users.id),
    targetType: text("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    reason: text("reason").notNull(),
    evidenceKeys: jsonb("evidence_keys").notNull().default([]),
    status: text("status").notNull().default("open"),
    assigneeId: uuid("assignee_id").references(() => users.id),
    resolution: text("resolution"),
    ...timestamps,
  },
  (table) => [index("reports_status_idx").on(table.status)],
);

export const achievements = pgTable(
  "achievements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    rule: jsonb("rule").notNull(),
    activeFrom: timestamp("active_from", { withTimezone: true }).notNull(),
    activeTo: timestamp("active_to", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [uniqueIndex("achievements_code_unique").on(table.code)],
);

export const userAchievements = pgTable(
  "user_achievements",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    achievementId: uuid("achievement_id")
      .notNull()
      .references(() => achievements.id, { onDelete: "cascade" }),
    awardedAt: timestamp("awarded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    evidence: jsonb("evidence").notNull().default({}),
  },
  (table) => [primaryKey({ columns: [table.userId, table.achievementId] })],
);

export const favorites = pgTable(
  "favorites",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.targetType, table.targetId] }),
  ],
);

export const uploads = pgTable(
  "uploads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerUserId: uuid("owner_user_id").references(() => users.id),
    objectKey: text("object_key").notNull(),
    fileName: text("file_name").notNull(),
    byteLength: bigint("byte_length", { mode: "number" }).notNull(),
    mimeType: text("mime_type").notNull(),
    declaredType: text("declared_type").notNull(),
    detectedType: text("detected_type"),
    sha256: text("sha256"),
    status: text("status").notNull().default("quarantined"),
    validationResult: jsonb("validation_result").notNull().default({}),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("uploads_object_key_unique").on(table.objectKey),
    index("uploads_status_expires_idx").on(table.status, table.expiresAt),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorUserId: uuid("actor_user_id").references(() => users.id),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    ipHash: text("ip_hash"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("audit_logs_target_idx").on(table.targetType, table.targetId),
    index("audit_logs_created_idx").on(table.createdAt),
  ],
);

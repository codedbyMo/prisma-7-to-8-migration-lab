#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/e2b10078c8f762c7544b5ee625263cb0a291e127e8a70f90b78af01582d9d2d6/contract';
import endContract from '../../snapshots/e2b10078c8f762c7544b5ee625263cb0a291e127e8a70f90b78af01582d9d2d6/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey, sql } from '@prisma/orm-postgres/migration';

export default class M extends Migration<never, End> {
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createSchema({ schema: 'public' }),
      this.createTable({
        schema: 'public',
        table: 'Post',
        columns: [
          col('createdAt', 'timestamp(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('id', 'uuid', {
            notNull: true,
            default: fn(sql`gen_random_uuid()`),
            codecRef: { codecId: 'pg/uuid@1' },
          }),
          col('metadata', 'jsonb', { notNull: true, codecRef: { codecId: 'pg/jsonb@1' } }),
          col('price', 'numeric(10,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 10, scale: 2 } },
          }),
          col('title', 'character varying(255)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 255 } },
          }),
          col('updatedAt', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
        ],
        constraints: [primaryKey(['id'], { name: 'Post_pkey' })],
      }),
      this.createTable({
        schema: 'public',
        table: 'Tag',
        columns: [
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('label', 'character varying(100)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 100 } },
          }),
        ],
        constraints: [primaryKey(['id'], { name: 'Tag_pkey' })],
      }),
      this.createTable({
        schema: 'public',
        table: '_PostToTag',
        columns: [
          col('A', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('B', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['A', 'B'], { name: '_PostToTag_AB_pkey' })],
      }),
      this.createIndex({
        schema: 'public',
        table: '_PostToTag',
        index: '_PostToTag_B_index',
        columns: ['B'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: '_PostToTag',
        foreignKey: {
          name: '_PostToTag_A_fkey',
          columns: ['A'],
          references: { schema: 'public', table: 'Post', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: '_PostToTag',
        foreignKey: {
          name: '_PostToTag_B_fkey',
          columns: ['B'],
          references: { schema: 'public', table: 'Tag', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);

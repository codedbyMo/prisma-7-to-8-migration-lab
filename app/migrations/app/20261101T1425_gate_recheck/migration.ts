#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/75e7b46ee20377378c1b6d2f13bb90395d0c758153579b3c04fe25a565b5c38f/contract';
import endContract from '../../snapshots/75e7b46ee20377378c1b6d2f13bb90395d0c758153579b3c04fe25a565b5c38f/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/e2b10078c8f762c7544b5ee625263cb0a291e127e8a70f90b78af01582d9d2d6/contract';
import startContract from '../../snapshots/e2b10078c8f762c7544b5ee625263cb0a291e127e8a70f90b78af01582d9d2d6/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'Post',
        column: col('subtitle', 'character varying(255)', {
          codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 255 } },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);

#!/bin/sh
# Idempotent disposable-PostgreSQL setup for the migration lab.
# Everything lives under /home/hatch (persists across VM replacements);
# the postgres system user is recreated when missing (its /etc/passwd
# entry does not persist). Server: PostgreSQL 18.4 (zonkyio binaries via
# the embedded-postgres npm package), port 54399, database "lab".
set -e
# NOTE: the runtime overlay over /home/hatch refuses chown to another uid,
# so the live cluster lives in /home/postgres (ephemeral across VM
# replacements; rerun this script plus the migrate/seed steps after one).
PGHOME=/home/postgres
SRC=/home/hatch/workspace/prisma-7-to-8-migration-lab/tools/node_modules/@embedded-postgres/linux-x64/native

if ! id postgres >/dev/null 2>&1; then
  useradd -d "$PGHOME" -s /bin/sh postgres || true
fi
mkdir -p "$PGHOME"
if [ ! -x "$PGHOME/pg-native/bin/postgres" ]; then
  mkdir -p "$PGHOME/pg-native"
  cp -r "$SRC/bin" "$SRC/lib" "$SRC/share" "$PGHOME/pg-native/"
fi
chown -R postgres:postgres "$PGHOME"
chmod 755 "$PGHOME"

if [ ! -s "$PGHOME/pgdata/PG_VERSION" ]; then
  echo "labpass" > /tmp/pgpw.txt
  chown postgres:postgres /tmp/pgpw.txt && chmod 600 /tmp/pgpw.txt
  su postgres -s /bin/sh -c "$PGHOME/pg-native/bin/initdb -D $PGHOME/pgdata -U postgres --auth=password --pwfile=/tmp/pgpw.txt -E UTF8" >/dev/null
  echo "cluster initialised"
fi

if su postgres -s /bin/sh -c "$PGHOME/pg-native/bin/pg_ctl -D $PGHOME/pgdata status" >/dev/null 2>&1; then
  echo "server already running"
else
  su postgres -s /bin/sh -c "$PGHOME/pg-native/bin/pg_ctl -D $PGHOME/pgdata -l $PGHOME/pg.log -o '-p 54399 -c listen_addresses=127.0.0.1 -k /tmp' start"
fi

# Create the lab database if missing (via the maintenance database).
node -e "
import('/home/hatch/workspace/prisma-7-to-8-migration-lab/tools/node_modules/pg/lib/index.js').then(async (pg) => {
  const Client = pg.default.Client;
  const admin = new Client({host:'127.0.0.1', port:54399, user:'postgres', password:'labpass', database:'postgres'});
  await admin.connect();
  const r = await admin.query(\"select 1 from pg_database where datname='lab'\");
  if (r.rowCount === 0) { await admin.query('CREATE DATABASE lab'); console.log('database lab created'); }
  else { console.log('database lab exists'); }
  await admin.end();
}).catch(e => { console.error('DB_SETUP_FAIL', e.message); process.exit(1); });
"
echo "POSTGRES_READY postgresql://postgres:labpass@127.0.0.1:54399/lab"

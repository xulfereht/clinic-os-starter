#!/bin/bash
echo "Starting Legacy Data Migration..."

# Run migration parts sequentially
npx wrangler d1 execute DB --local --file migrations/legacy_data_import_part_1.sql
npx wrangler d1 execute DB --local --file migrations/legacy_data_import_part_2.sql
npx wrangler d1 execute DB --local --file migrations/legacy_data_import_part_3.sql
npx wrangler d1 execute DB --local --file migrations/legacy_data_import_part_4.sql
npx wrangler d1 execute DB --local --file migrations/legacy_data_import_part_5.sql
npx wrangler d1 execute DB --local --file migrations/legacy_data_import_part_6.sql
npx wrangler d1 execute DB --local --file migrations/legacy_data_import_part_7.sql
npx wrangler d1 execute DB --local --file migrations/legacy_data_import_part_8.sql
npx wrangler d1 execute DB --local --file migrations/legacy_data_import_part_9.sql

echo "Migration Complete."

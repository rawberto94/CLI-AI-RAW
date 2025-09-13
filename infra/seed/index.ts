import { seedRbac } from './rbac';

// This is a placeholder for seed scripts.
// TODO: Implement seed scripts for benchmark data and policy packs.

async function main() {
  await seedRbac();
  console.log('Seeding benchmark data...');
}

main().catch((error) => {
  console.error('Error seeding data:', error);
  process.exit(1);
});

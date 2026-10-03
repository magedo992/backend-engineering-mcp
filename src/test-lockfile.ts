import { LockfileReader } from './detection/readers/lockfile-reader.js';

const projectPath =
  'C:/Users/ahmed/OneDrive/Desktop/booking api';

const reader =
  new LockfileReader(projectPath);

console.log(
  'Lockfile exists:',
  reader.exists(),
);

console.log(
  'Express:',
  reader.getInstalledVersion('express'),
);

console.log(
  'Prisma:',
  reader.getInstalledVersion('prisma'),
);

console.log(
  'TypeScript:',
  reader.getInstalledVersion('typescript'),
);
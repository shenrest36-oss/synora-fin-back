const request = require('supertest');
const { prisma } = require('./src/database/prisma');
const app = require('./src/app').default;

(async () => {
  console.log('start');
  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ username: 'admin', password: '123' });
  console.log('login status', loginRes.status);
  console.log('token present', !!loginRes.body?.data?.accessToken);

  console.log('before delete');
  await prisma.accountDepartment.deleteMany();
  console.log('after accountDepartment');
  await prisma.chartOfAccount.deleteMany();
  console.log('after chartOfAccount');
  await prisma.accountSubcategory.deleteMany();
  console.log('after accountSubcategory');
  await prisma.accountType.deleteMany();
  console.log('after accountType');
  await prisma.accountCategory.deleteMany();
  console.log('after accountCategory');

  await prisma.$disconnect();
  console.log('done');
})().catch((err) => {
  console.error('ERR', err);
  process.exit(1);
});

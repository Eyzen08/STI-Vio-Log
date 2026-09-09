#!/usr/bin/env node
require('dotenv').config();
const pool = require('../src/config/database');
const { createAdministratorBootstrapService } = require('../src/services/administratorBootstrapService');

const fail = (message) => {
  process.stderr.write(`Bootstrap refused: ${message}\n`);
  process.exitCode = 1;
};

const run = async () => {
  if (process.env.ADMIN_BOOTSTRAP_ENABLED !== 'true') {
    fail('ADMIN_BOOTSTRAP_ENABLED must be explicitly set to true for this one command');
    return;
  }
  const role = process.argv.find((value) => value.startsWith('--role='))?.slice(7);
  const result = await createAdministratorBootstrapService({ pool }).bootstrap({
    role,
    username: process.env.ADMIN_BOOTSTRAP_USERNAME,
    password: process.env.ADMIN_BOOTSTRAP_PASSWORD,
    firstName: process.env.ADMIN_BOOTSTRAP_FIRST_NAME,
    lastName: process.env.ADMIN_BOOTSTRAP_LAST_NAME,
    email: process.env.ADMIN_BOOTSTRAP_EMAIL
  });
  process.stdout.write(`Created ${result.account.role} account ${result.account.username}. Password change is required at first login.\n`);
  if (result.generatedPassword) process.stdout.write(`One-time temporary password: ${result.generatedPassword}\n`);
};

run()
  .catch((error) => fail(error?.code === '23505' ? 'the username or email is already in use' : error.message))
  .finally(() => pool.end());

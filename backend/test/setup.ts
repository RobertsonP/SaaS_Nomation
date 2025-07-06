import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';

declare global {
  var app: INestApplication;
}

// Global test setup
beforeAll(async () => {
  // This will be populated by individual test files
});

afterAll(async () => {
  if (global.app) {
    await global.app.close();
  }
});
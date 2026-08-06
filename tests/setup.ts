process.env.JWT_SECRET = process.env.JWT_SECRET ?? "a".repeat(48);
process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgres://u:p@localhost:5432/kak_test";

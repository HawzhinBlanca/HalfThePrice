import { PrismaClient } from "@prisma/client";
import { getCorrelationId } from "./correlation";

const globalForPrisma = globalThis as unknown as {
  prisma: any;
};

const basePrisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
});

export const prisma = basePrisma.$extends({
  query: {
    auditEvent: {
      async create({ args, query }) {
        const corrId = getCorrelationId();
        if (corrId && !args.data.correlationId) {
          args.data.correlationId = corrId;
        }
        return query(args);
      },
      async createMany({ args, query }) {
        const corrId = getCorrelationId();
        if (corrId) {
          if (Array.isArray(args.data)) {
            for (const item of args.data) {
              if (!item.correlationId) {
                item.correlationId = corrId;
              }
            }
          } else if (args.data) {
            if (!(args.data as any).correlationId) {
              (args.data as any).correlationId = corrId;
            }
          }
        }
        return query(args);
      },
    },
  },
});

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

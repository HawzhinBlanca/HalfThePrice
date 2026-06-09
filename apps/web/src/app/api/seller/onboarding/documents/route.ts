import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { z } from "zod";
import { prisma } from "@htp/database";
import { uploadKycDocument } from "@htp/storage";
import { requireAuth, requireMutatingAuth, localizedError } from "@/lib/api";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const documentSchema = z.object({
  documentType: z.enum(["TRADE_LICENSE", "NATIONAL_ID", "OTHER"]),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1),
  contentBase64: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const auth = await requireMutatingAuth(request, ["SELLER", "ADMIN"]);
  if (auth instanceof NextResponse) return auth;

  const profile = await prisma.sellerProfile.findUnique({
    where: { userId: auth.user.id },
  });

  if (!profile) {
    return localizedError("NOT_FOUND", 404, request);
  }

  const body: unknown = await request.json();
  const parsed = documentSchema.safeParse(body);

  if (!parsed.success) {
    return localizedError("INVALID_INPUT", 400, request);
  }

  if (!ALLOWED_MIME_TYPES.has(parsed.data.mimeType)) {
    return localizedError("INVALID_INPUT", 400, request);
  }

  const buffer = Buffer.from(parsed.data.contentBase64, "base64");

  if (buffer.length === 0 || buffer.length > MAX_FILE_SIZE) {
    return localizedError("INVALID_INPUT", 400, request);
  }

  const ext = path.extname(parsed.data.fileName) || ".bin";
  const storedName = `${randomUUID()}${ext}`;

  const upload = await uploadKycDocument({
    key: storedName,
    body: buffer,
    mimeType: parsed.data.mimeType,
  });

  const document = await prisma.kycDocument.create({
    data: {
      sellerProfileId: profile.id,
      documentType: parsed.data.documentType,
      fileName: parsed.data.fileName,
      filePath: upload.key,
      mimeType: parsed.data.mimeType,
      fileSizeBytes: buffer.length,
    },
  });

  await prisma.auditEvent.create({
    data: {
      actorId: auth.user.id,
      objectType: "kyc_document",
      objectId: document.id,
      action: "DOCUMENT_UPLOADED",
      after: {
        documentType: document.documentType,
        fileName: document.fileName,
        fileSizeBytes: document.fileSizeBytes,
        storage: upload.storage,
      },
    },
  });

  return NextResponse.json(
    { ...document, storage: upload.storage },
    { status: 201 },
  );
}

export async function GET() {
  const auth = await requireAuth(["SELLER", "ADMIN"]);
  if (auth instanceof NextResponse) return auth;

  const profile = await prisma.sellerProfile.findUnique({
    where: { userId: auth.user.id },
    include: { kycDocuments: { orderBy: { uploadedAt: "desc" } } },
  });

  if (!profile) {
    return localizedError("NOT_FOUND", 404);
  }

  return NextResponse.json(profile.kycDocuments);
}

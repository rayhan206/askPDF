import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import argon2 from "argon2";
import { SignJWT, jwtVerify } from "jose";
import mongoose, { type Types as MongooseTypes } from "mongoose";
import type { ServerConfig } from "@askpdf/config";
import type { LoginRequest, RegisterRequest } from "@askpdf/contracts";
import {
  AuthSessionModel,
  UserModel,
  WorkspaceMemberModel,
  WorkspaceModel,
} from "@askpdf/database";
import { AppError } from "./errors.js";

const { Types } = mongoose;

export interface AuthContext {
  userId: string;
  sessionId: string;
}

export interface SessionResult {
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
  accessExpiresAt: string;
  user: {
    id: string;
    email?: string;
    phone?: string;
    displayName: string;
    status: "active" | "disabled";
  };
  workspaces: Array<{
    id: string;
    name: string;
    slug: string;
    role: "owner" | "admin" | "member" | "viewer";
  }>;
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

function refreshDigest(token: string, pepper: string): string {
  return createHmac("sha256", pepper).update(token).digest("hex");
}

function slugify(name: string): string {
  const base =
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 38) || "workspace";
  return `${base}-${randomBytes(4).toString("hex")}`;
}

function safeEqualHex(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export class AuthService {
  private readonly accessKey: Uint8Array;

  constructor(private readonly config: ServerConfig) {
    this.accessKey = new TextEncoder().encode(config.ACCESS_TOKEN_SECRET);
  }

  async register(
    input: RegisterRequest,
    userAgent: string,
    ipPrefix: string | null,
  ): Promise<SessionResult> {
    const databaseSession = await mongoose.startSession();
    try {
      let result: SessionResult | undefined;
      await databaseSession.withTransaction(async () => {
        const passwordHash = await argon2.hash(input.password, {
          type: argon2.argon2id,
          memoryCost: 65536,
          timeCost: 3,
          parallelism: 1,
        });
        const user = new UserModel({
          ...(input.email ? { email: input.email } : {}),
          ...(input.phone ? { phoneE164: input.phone } : {}),
          passwordHash,
          displayName: input.displayName,
        });
        await user.save({ session: databaseSession });
        const workspaceName = `${input.displayName}'s Workspace`;
        const workspace = new WorkspaceModel({
          name: workspaceName,
          slug: slugify(input.displayName),
          ownerId: user._id,
        });
        await workspace.save({ session: databaseSession });
        const membership = new WorkspaceMemberModel({
          workspaceId: workspace._id,
          userId: user._id,
          role: "owner",
          joinedAt: new Date(),
        });
        await membership.save({ session: databaseSession });
        result = await this.createSession(user._id, userAgent, ipPrefix, databaseSession);
      });
      if (!result) throw new AppError(500, "INTERNAL_ERROR", "Account creation did not complete.");
      return result;
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
        throw new AppError(
          409,
          input.email ? "EMAIL_ALREADY_EXISTS" : "PHONE_ALREADY_EXISTS",
          "An account already uses that identifier.",
        );
      }
      throw error;
    } finally {
      await databaseSession.endSession();
    }
  }

  async login(
    input: LoginRequest,
    userAgent: string,
    ipPrefix: string | null,
  ): Promise<SessionResult> {
    const normalized = input.identifier.includes("@")
      ? input.identifier.toLowerCase()
      : input.identifier;
    const query = normalized.includes("@") ? { email: normalized } : { phoneE164: normalized };
    const user = await UserModel.findOne(query).select("+passwordHash");
    const fallbackHash =
      "$argon2id$v=19$m=65536,t=3,p=1$bW9jay1zYWx0LWZvci10aW1pbmc$w8m2t8Vef3oEY8PEVfGvxGmQ4X8Xk6f8tY3Dm8XcX9E";
    const valid = await argon2
      .verify(user?.passwordHash ?? fallbackHash, input.password)
      .catch(() => false);
    if (!user || !valid)
      throw new AppError(401, "INVALID_CREDENTIALS", "The identifier or password is incorrect.");
    if (user.status !== "active")
      throw new AppError(403, "ACCOUNT_DISABLED", "This account is disabled.");
    user.lastLoginAt = new Date();
    await user.save();
    return this.createSession(user._id, userAgent, ipPrefix);
  }

  async authenticate(accessToken: string): Promise<AuthContext> {
    try {
      const verified = await jwtVerify(accessToken, this.accessKey, {
        issuer: this.config.JWT_ISSUER,
        audience: this.config.JWT_AUDIENCE,
        algorithms: ["HS256"],
      });
      if (
        verified.payload.typ !== "access" ||
        typeof verified.payload.sub !== "string" ||
        typeof verified.payload.sid !== "string"
      ) {
        throw new Error("Invalid claims");
      }
      const [user, session] = await Promise.all([
        UserModel.findOne({ _id: verified.payload.sub, status: "active" }).select("_id"),
        AuthSessionModel.findOne({
          _id: verified.payload.sid,
          revokedAt: null,
          expiresAt: { $gt: new Date() },
        }).select("_id"),
      ]);
      if (!user || !session) throw new Error("Inactive session");
      return { userId: verified.payload.sub, sessionId: verified.payload.sid };
    } catch {
      throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication is required.");
    }
  }

  async refresh(
    refreshToken: string,
    userAgent: string,
    ipPrefix: string | null,
  ): Promise<SessionResult> {
    const [sessionId] = refreshToken.split(".", 1);
    if (!sessionId || !Types.ObjectId.isValid(sessionId))
      throw new AppError(401, "INVALID_SESSION", "The session is invalid.");
    const oldSession = await AuthSessionModel.findById(sessionId).select("+refreshTokenHash");
    if (!oldSession || oldSession.expiresAt <= new Date())
      throw new AppError(401, "INVALID_SESSION", "The session is invalid.");
    const presentedHash = refreshDigest(refreshToken, this.config.REFRESH_TOKEN_PEPPER);
    if (!safeEqualHex(presentedHash, oldSession.refreshTokenHash))
      throw new AppError(401, "INVALID_SESSION", "The session is invalid.");
    if (oldSession.revokedAt) {
      await AuthSessionModel.updateMany(
        { userId: oldSession.userId, expiresAt: { $gt: new Date() } },
        { $set: { revokedAt: new Date() } },
      );
      throw new AppError(
        409,
        "SESSION_REUSE_DETECTED",
        "Session reuse was detected and active sessions were revoked.",
      );
    }
    const databaseSession = await mongoose.startSession();
    try {
      let result: SessionResult | undefined;
      await databaseSession.withTransaction(async () => {
        const claimed = await AuthSessionModel.findOneAndUpdate(
          { _id: oldSession._id, revokedAt: null },
          { $set: { revokedAt: new Date(), lastUsedAt: new Date() } },
          { new: true, session: databaseSession },
        );
        if (!claimed)
          throw new AppError(409, "SESSION_REUSE_DETECTED", "The session was already rotated.");
        result = await this.createSession(oldSession.userId, userAgent, ipPrefix, databaseSession);
        const newSessionId = result.accessToken
          ? this.decodeSessionId(result.accessToken)
          : undefined;
        if (!newSessionId) throw new AppError(500, "INTERNAL_ERROR", "Session rotation failed.");
        claimed.replacedBySessionId = new Types.ObjectId(newSessionId);
        await claimed.save({ session: databaseSession });
      });
      if (!result) throw new AppError(500, "INTERNAL_ERROR", "Session rotation failed.");
      return result;
    } finally {
      await databaseSession.endSession();
    }
  }

  async logout(sessionId: string): Promise<void> {
    await AuthSessionModel.updateOne(
      { _id: sessionId, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
  }

  async getProfile(
    userId: string,
    databaseSession?: mongoose.ClientSession,
  ): Promise<Pick<SessionResult, "user" | "workspaces">> {
    const userQuery = UserModel.findById(userId);
    if (databaseSession) userQuery.session(databaseSession);
    const user = await userQuery;
    if (!user || user.status !== "active")
      throw new AppError(403, "ACCOUNT_DISABLED", "This account is disabled.");
    const membershipQuery = WorkspaceMemberModel.find({ userId });
    if (databaseSession) membershipQuery.session(databaseSession);
    const memberships = await membershipQuery.lean();
    const workspaceQuery = WorkspaceModel.find({
      _id: { $in: memberships.map((item) => item.workspaceId) },
      deletedAt: null,
    });
    if (databaseSession) workspaceQuery.session(databaseSession);
    const workspaces = await workspaceQuery.lean();
    const roles = new Map(memberships.map((item) => [item.workspaceId.toHexString(), item.role]));
    return {
      user: {
        id: user._id.toHexString(),
        ...(user.email ? { email: user.email } : {}),
        ...(user.phoneE164 ? { phone: user.phoneE164 } : {}),
        displayName: user.displayName,
        status: user.status,
      },
      workspaces: workspaces.map((workspace) => ({
        id: workspace._id.toHexString(),
        name: workspace.name,
        slug: workspace.slug,
        role: roles.get(workspace._id.toHexString()) ?? "viewer",
      })),
    };
  }

  csrfToken(sessionId: string): string {
    const nonce = randomBytes(24).toString("base64url");
    const signature = createHmac("sha256", this.config.CSRF_SECRET)
      .update(`${sessionId}.${nonce}`)
      .digest("base64url");
    return `${nonce}.${signature}`;
  }

  verifyCsrf(sessionId: string, token: string): boolean {
    const [nonce, signature] = token.split(".");
    if (!nonce || !signature) return false;
    const expected = createHmac("sha256", this.config.CSRF_SECRET)
      .update(`${sessionId}.${nonce}`)
      .digest();
    const received = Buffer.from(signature, "base64url");
    return expected.length === received.length && timingSafeEqual(expected, received);
  }

  private async createSession(
    userId: MongooseTypes.ObjectId,
    userAgent: string,
    ipPrefix: string | null,
    databaseSession?: mongoose.ClientSession,
  ): Promise<SessionResult> {
    const refreshSecret = randomBytes(48).toString("base64url");
    const sessionId = new Types.ObjectId();
    const refreshToken = `${sessionId.toHexString()}.${refreshSecret}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.REFRESH_TOKEN_TTL_SECONDS * 1000);
    const session = new AuthSessionModel({
      _id: sessionId,
      userId,
      refreshTokenHash: refreshDigest(refreshToken, this.config.REFRESH_TOKEN_PEPPER),
      userAgentHash: digest(userAgent).toString("hex"),
      ipPrefix,
      expiresAt,
      lastUsedAt: now,
    });
    await session.save(databaseSession ? { session: databaseSession } : {});
    const accessExpiresAt = new Date(now.getTime() + this.config.ACCESS_TOKEN_TTL_SECONDS * 1000);
    const accessToken = await new SignJWT({ sid: sessionId.toHexString(), typ: "access" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(this.config.JWT_ISSUER)
      .setAudience(this.config.JWT_AUDIENCE)
      .setSubject(userId.toHexString())
      .setIssuedAt()
      .setExpirationTime(Math.floor(accessExpiresAt.getTime() / 1000))
      .sign(this.accessKey);
    const profile = await this.getProfile(userId.toHexString(), databaseSession);
    return {
      accessToken,
      refreshToken,
      csrfToken: this.csrfToken(sessionId.toHexString()),
      accessExpiresAt: accessExpiresAt.toISOString(),
      ...profile,
    };
  }

  private decodeSessionId(token: string): string | undefined {
    const payload = token.split(".")[1];
    if (!payload) return undefined;
    const decoded: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (
      typeof decoded !== "object" ||
      decoded === null ||
      !("sid" in decoded) ||
      typeof decoded.sid !== "string"
    )
      return undefined;
    return decoded.sid;
  }
}

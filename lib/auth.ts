import { passkey } from "@better-auth/passkey";
import { betterAuth, User as BetterAuthUser } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { admin, customSession, magicLink, openAPI, username } from "better-auth/plugins";
import { Account, UserRole } from "db/browser";
import { APP_CONFIG, APP_PREFIX } from "@/constants/app";
import { getAccountsByUserId } from "@/data/account";
import { getUserById } from "@/data/user";
import {
  sendDeleteUserEmail,
  sendEmailChangeEmail,
  sendEmailVerificationEmail,
  sendMagicLinkEmail,
  sendPasswordResetEmail,
} from "@/lib/email";
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";
import { UserWithRelations } from "@/types/prisma";
import { generateRandomUsername } from "@/utils/user";

export const auth = betterAuth({
  appName: APP_CONFIG.NAME,
  baseURL: process.env.BASE_URL,
  trustedOrigins: process.env.TRUSTED_ORIGINS?.split(",") || [],
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  plugins: [
    openAPI(), // http://localhost:3000/api/auth/reference
    customSession(async (session) => {
      const user: UserWithRelations | null = await getUserById(session.user.id);
      const accounts: Account[] = await getAccountsByUserId(session.user.id);

      return {
        user: {
          ...session.user,
          ...user,
        },
        session: session.session,
        accounts,
      };
    }),
    username({
      minUsernameLength: 4,
      maxUsernameLength: 32,
      usernameValidator: (username: string) => {
        if (username === "admin") {
          return false;
        }

        return true;
      },
    }),
    magicLink({
      sendMagicLink: async (data: { email: string; url: string; token: string }) => {
        await sendMagicLinkEmail(data);
      },
      expiresIn: 600, // 10 minutes
    }),
    passkey({
      rpID: process.env.HOSTNAME,
      rpName: APP_CONFIG.NAME,
      origin: process.env.BETTER_AUTH_URL,
      schema: {
        passkey: {
          modelName: "Passkey",
        },
      },
    }),
    admin(),
    nextCookies(), // Make sure this is the last plugin in the array
  ],
  user: {
    modelName: "User",
    additionalFields: {
      birthdate: {
        type: "date",
        required: false,
        input: true,
      },
      username: {
        type: "string",
        input: true,
      },
      language: {
        type: "string",
        defaultValue: "en",
        input: true,
      },
      role: {
        type: "string",
        required: false,
      },
      banned: {
        type: "boolean",
        required: false,
      },
      banReason: {
        type: "string",
        required: false,
      },
      banExpires: {
        type: "date",
        required: false,
      },
    },
    emailVerification: {
      enabled: true,
      sendVerificationEmail: async (data: { user: BetterAuthUser; newEmail: string; url: string; token: string }) => {
        await sendEmailChangeEmail(data);
      },
    },
    deleteUser: {
      enabled: true,
      sendDeleteAccountVerification: async (data: { user: BetterAuthUser; url: string; token: string }) => {
        await sendDeleteUserEmail(data);
      },
    },
  },
  session: {
    modelName: "Session",
    cookieCache: {
      enabled: true,
      maxAge: 60 * 60 * 24, // 1 day (matches freshAge)
    },
    expiresIn: 60 * 60 * 24 * 7, // 7 days (total session duration)
    updateAge: 60 * 60 * 24, // Updates session expiration every 1 day
  },
  account: {
    modelName: "Account",
    accountLinking: {
      enabled: true,
      trustedProviders: ["github", "google"],
      allowDifferentEmails: true,
    },
  },
  verification: {
    modelName: "Verification",
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    modelName: "RateLimit",
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async (data: { user: BetterAuthUser; url: string; token: string }) => {
      await sendEmailVerificationEmail(data);
    },
    expiresIn: 3600, // 1 hour
    autoSignInAfterVerification: true,
  },
  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
    requireEmailVerification: true,
    sendResetPassword: async (data: { user: BetterAuthUser; url: string; token: string }) => {
      await sendPasswordResetEmail(data);
    },
    resetPasswordTokenExpiresIn: 3600, // 1 hour
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  advanced: {
    database: {
      generateId: false,
    },
    cookiePrefix: APP_PREFIX,
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const username: string = generateRandomUsername(user.email);

          return {
            data: {
              ...user,
              // @ts-ignore
              ...(!user.username ? { username } : {}),
              role: UserRole.USER,
            },
          };
        },
        after: async (user) => {
          await prisma.userSettings.create({ data: { id: user.id } });
        },
      },
    },
  },
  onAPIError: {
    throw: true,
    onError: (error: unknown) => {
      logger.error(`Better-Auth API error: ${JSON.stringify(error)}`);
    },
    errorURL: "/error",
  },
  logger: {
    disabled: process.env.NODE_ENV === "production",
    level: "debug",
  },
});

export type Session = typeof auth.$Infer.Session;

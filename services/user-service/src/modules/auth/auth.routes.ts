import { Router } from "express";
import passport from "passport";
import { Strategy as GithubStrategy } from "passport-github2";
import { AuthController } from "./auth.controller";
import { env } from "../../config";
import { AuthService } from "./auth.service";

const authRoutes: Router = Router();

const controller = new AuthController();
const authService = new AuthService();

authRoutes.post("/signup", controller.signup.bind(controller));
authRoutes.post("/login", controller.login.bind(controller));
authRoutes.post("/refresh", controller.refresh.bind(controller));
authRoutes.post("/logout", controller.logout.bind(controller));
authRoutes.get(
  "/internal/github/token",
  controller.getGithubToken.bind(controller),
);

passport.use(
  new GithubStrategy(
    {
      clientID: env.GITHUB_CLIENT_ID!,
      clientSecret: env.GITHUB_CLIENT_SECRET!,
      callbackURL: env.GITHUB_CALLBACK_URL,
      scope: ["read:user", "user:email", "repo"],
      skipUserProfile: true,
    },
    async (
      accessToken: string,
      _refreshToken: string,
      profile: any,
      done: any,
    ) => {
      try {
        const profileRes = await fetch("https://api.github.com/user", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "synthex-auth/1.0",
          },
        });

        if (!profileRes.ok) {
          const details = await profileRes.text();
          throw new Error(
            `Failed to fetch user profile: ${profileRes.status} ${profileRes.statusText} ${details}`,
          );
        }

        const profileJson = (await profileRes.json()) as {
          id: number | string;
          login?: string;
          name?: string;
          email?: string | null;
          avatar_url?: string | null;
        };

        let email = profileJson.email ?? undefined;

        if (!email) {
          try {
            const emailRes = await fetch("https://api.github.com/user/emails", {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                "User-Agent": "synthex-auth/1.0",
              },
            });

            if (emailRes.ok) {
              const emails = (await emailRes.json()) as Array<{
                email: string;
                primary?: boolean;
                verified?: boolean;
              }>;

              const primaryVerified = emails.find(
                (entry) => entry.primary && entry.verified,
              );
              const verified = emails.find((entry) => entry.verified);
              email = primaryVerified?.email ?? verified?.email;
            }
          } catch {
            // best-effort; fall back to placeholder
          }
        }

        if (!email) {
          email = `${profileJson.id}@github.com`;
        }

        const tokens = await authService.handleOAuthLogin(
          "github",
          String(profileJson.id),
          {
            username:
              profileJson.login ?? profileJson.name ?? "github-user",
            email,
            avatarUrl: profileJson.avatar_url ?? undefined,
          },
          accessToken,
          profileRes.headers.get("x-oauth-scopes") ??
            "read:user,user:email,repo",
        );

        done(null, tokens);
      } catch (error) {
        done(error, null);
      }
    },
  ),
);

authRoutes.get("/github", passport.authenticate("github", { session: false }));

authRoutes.get(
  "/github/callback",
  passport.authenticate("github", { session: false, failureRedirect: "/" }),
  (req, res) => {
    const tokens = req.user as {
      accessToken: string;
      refreshToken: string;
    };

    const isProd = process.env.NODE_ENV === "production";
    res.cookie("refreshToken", tokens.refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.redirect(`${env.ORIGIN}/auth/callback#token=${tokens.accessToken}`);
  },
);

export { authRoutes };

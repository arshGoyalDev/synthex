import { Router } from "express";
import passport from "passport";
import { Strategy as GithubStrategy } from "passport-github2";
import { AuthController } from "./auth.controller";
import { env } from "../../config";
import { AuthService } from "./auth.service";

const authRoutes = Router();

const authService = new AuthService();
const controller = new AuthController();

authRoutes.post("/signup", controller.signup.bind(controller));
authRoutes.post("/login", controller.login.bind(controller));
authRoutes.post("/refresh", controller.refresh.bind(controller));
authRoutes.post("/logout", controller.logout.bind(controller));

passport.use(
  new GithubStrategy(
    {
      clientID: env.GITHUB_CLIENT_ID!,
      clientSecret: env.GITHUB_CLIENT_SECRET!,
      callbackURL: env.GITHUB_CALLBACK_URL,
      scope: ["user:email"],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0].value ?? `${profile.id}@github.com`;

        const tokens = await authService.handleOAuthLogin(
          "github",
          profile.id,
          {
            username: profile.username ?? profile.displayName,
            email,
            avatarUrl: profile.photos?.[0].value,
          },
        );

        done(null, tokens);
      } catch (error) {
        done(error, null);
      }
    },
  ),
);

authRoutes.get(
  "/github",
  passport.authenticate("github", { session: false }),
);

authRoutes.get(
  "/github/callback",
  passport.authenticate("github", { session: false, failureRedirect: "/" }),
  (req, res) => {
    const tokens = req.user as any;

    res.cookie("refreshToken", tokens.refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.redirect(`${env.ORIGIN}/auth/callback?token=${tokens.accessToken}`);
  },
);

export { authRoutes };

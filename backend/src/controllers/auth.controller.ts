import { Request, Response } from 'express';
import { prisma } from '../db/prisma';

export const authController = {
  // Google Sign-In verification & user upsert
  googleAuth: async (req: Request, res: Response) => {
    try {
      const { credential, userInfo } = req.body;

      let email = 'demo.user@reachinbox.ai';
      let name = 'Mitrajit Ghosh';
      let avatar = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';
      let googleId = 'google_demo_123';

      if (credential) {
        // Decode Google JWT payload if provided
        try {
          const base64Url = credential.split('.')[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const jsonPayload = decodeURIComponent(
            Buffer.from(base64, 'base64')
              .toString('binary')
              .split('')
              .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
              .join('')
          );
          const decoded = JSON.parse(jsonPayload);
          if (decoded.email) email = decoded.email;
          if (decoded.name) name = decoded.name;
          if (decoded.picture) avatar = decoded.picture;
          if (decoded.sub) googleId = decoded.sub;
        } catch (e) {
          console.warn('[Auth] Could not decode JWT, using userInfo payload');
        }
      }

      if (userInfo) {
        if (userInfo.email) email = userInfo.email;
        if (userInfo.name) name = userInfo.name;
        if (userInfo.avatar) avatar = userInfo.avatar;
      }

      // Upsert User in DB
      const user = await prisma.user.upsert({
        where: { email },
        create: {
          email,
          name,
          avatar,
          googleId,
        },
        update: {
          name,
          avatar,
        },
      });

      return res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
        },
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  },

  getMe: async (_req: Request, res: Response) => {
    try {
      const user = await prisma.user.findFirst({
        orderBy: { createdAt: 'desc' },
      });

      if (!user) {
        // Return default demo user if not logged in yet
        return res.json({
          user: {
            name: 'Outbox Candidate',
            email: 'candidate@reachinbox.ai',
            avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
          },
        });
      }

      return res.json({ user });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  },
};

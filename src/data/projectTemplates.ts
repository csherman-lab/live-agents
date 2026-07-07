import type { LucideIcon } from 'lucide-react';
import {
  Clapperboard,
  Compass,
  Music,
  Newspaper,
  Palette,
  Rocket,
} from 'lucide-react';

export interface ProjectTemplate {
  id: string;
  title: string;
  description: string;
  teamId: string;
  brief: string;
  icon: LucideIcon;
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'landing-page',
    title: 'Launch Landing Page',
    description: 'Copy, design & dev for a product launch',
    teamId: 'unboring-net',
    icon: Rocket,
    brief: `Create a high-converting landing page for a new SaaS product called "FlowState" — an AI productivity app for creative teams.

Deliverables:
- Hero headline and subheadline
- 3 key feature sections with benefit-focused copy
- Social proof section
- CTA strategy and button copy
- Visual direction notes for the designer`,
  },
  {
    id: 'pr-campaign',
    title: 'PR Campaign',
    description: 'Media strategy, press outreach & drafts',
    teamId: 'pr-agency',
    icon: Newspaper,
    brief: `Plan and draft a PR campaign announcing our Series A funding round ($12M led by Acme Ventures).

Goals:
- Target tech and business press (TechCrunch, Forbes, local business journals)
- Key messages: product traction, team background, vision
- Press release draft
- Media pitch emails for top 5 outlets`,
  },
  {
    id: 'brand-identity',
    title: 'Brand Identity',
    description: 'Visual identity for a lifestyle brand',
    teamId: 'photo-studio',
    icon: Palette,
    brief: `Develop a visual brand identity for "Drift" — a premium outdoor lifestyle brand targeting urban professionals who escape to nature on weekends.

Style: minimal, earthy, modern. Think Patagonia meets Apple.
Deliverables: color palette direction, mood board concepts, logo exploration notes, and brand voice guidelines.`,
  },
  {
    id: 'product-video',
    title: 'Product Video',
    description: 'Cinematic promo for your product',
    teamId: 'film-studio',
    icon: Clapperboard,
    brief: `Create a 30-second cinematic product video for a wireless noise-cancelling headphone called "Aura One."

Mood: premium, calm, immersive. Show someone putting on headphones in a busy café and entering a peaceful soundscape.
Include shot list, visual direction, and audio mood notes.`,
  },
  {
    id: 'strategy-session',
    title: 'Strategy Session',
    description: 'Roadmap & direction from an advisor',
    teamId: 'strategy-coach',
    icon: Compass,
    brief: `I'm building a B2B AI agent platform for mid-market companies. We have 3 design partners but no paying customers yet.

Help me define:
1. Ideal customer profile (ICP) refinement
2. Go-to-market priorities for the next 90 days
3. Key risks and how to de-risk them
4. Pricing model recommendation`,
  },
  {
    id: 'music-jingle',
    title: 'Brand Jingle',
    description: 'Short music piece for a brand',
    teamId: 'music-studio',
    icon: Music,
    brief: `Compose a 15-second brand jingle for "Spark" — an electric vehicle charging network.

Vibe: optimistic, futuristic, clean energy. Uplifting but not cheesy. Should work as a podcast ad intro and app notification sound.`,
  },
];

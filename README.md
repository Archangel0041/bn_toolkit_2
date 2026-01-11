# Battle Nations Toolkit

A comprehensive toolkit for Battle Nations, built with modern web technologies and powered by Supabase.

## Tech Stack

This project is built with:

- **Vite** - Fast build tool and dev server
- **TypeScript** - Type-safe JavaScript
- **React** - UI framework
- **shadcn-ui** - Beautiful UI components
- **Tailwind CSS** - Utility-first styling
- **Supabase** - Backend-as-a-Service (Database, Auth, Storage)

## Getting Started

### Prerequisites

- Node.js & npm - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)
- A Supabase project - [create one at supabase.com](https://supabase.com)

### Installation

```sh
# Step 1: Clone the repository
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory
cd BN_Toolkit

# Step 3: Install dependencies
npm install

# Step 4: Set up environment variables
# Copy .env.example to .env and fill in your Supabase credentials
cp .env.example .env

# Step 5: Start the development server
npm run dev
```

### Environment Variables

Create a `.env` file with your Supabase credentials:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
VITE_SUPABASE_PROJECT_ID=your_project_id
```

## Available Scripts

- `npm run dev` - Start development server with hot-reload
- `npm run build` - Build for production
- `npm run build:dev` - Build in development mode
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build locally

## Backend (Supabase)

This project uses Supabase for:

- **Database**: PostgreSQL database for storing game data
- **Authentication**: User authentication with OTP email verification
- **Storage**: File storage for unit images, status effects, and resources
- **Edge Functions**: Serverless functions for backend logic

### Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Run the migrations in the `supabase/migrations` folder
3. Configure authentication settings (enable email OTP)
4. Set up storage buckets as needed
5. Update your `.env` file with the project credentials

## Development

### Local Development

Use your preferred IDE or editor. Popular choices:

- VS Code
- WebStorm
- Cursor

Changes can be committed and pushed using standard Git workflows.

### GitHub Codespaces

- Navigate to your repository on GitHub
- Click the "Code" button
- Select "Codespaces" tab
- Click "New codespace"

## Deployment

You can deploy this project to various platforms:

- **Vercel** - Optimized for React/Vite projects
- **Netlify** - Easy deployment with Git integration
- **Cloudflare Pages** - Fast global CDN
- **GitHub Pages** - Free hosting for static sites

Make sure to set your environment variables on your hosting platform.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is private and not licensed for public use.

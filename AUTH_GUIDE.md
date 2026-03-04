# Authentication Guide with Supabase Auth

This guide explains how to add authentication to the Product Analyzer using Supabase Auth, integrated with your React frontend and Fastify backend.

## 1. Supabase Setup

1.  Go to your [Supabase Dashboard](https://supabase.com/dashboard).
2.  Enable **Email Auth** in `Authentication` > `Providers`.
3.  Go to `Project Settings` > `API` to get your `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_JWT_SECRET`.

## 2. Frontend Integration (React)

Install the Supabase Auth UI and client:

```bash
npm install --workspace=@product-analyzer/web @supabase/auth-ui-react @supabase/auth-ui-shared @supabase/supabase-js
```

### Add Auth Component (`apps/web/src/Auth.tsx`)

```tsx
import { createClient } from '@supabase/supabase-js'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export function Login() {
  return (
    <div className="max-w-md mx-auto mt-10 p-6 border rounded-lg shadow-sm">
      <Auth
        supabaseClient={supabase}
        appearance={{ theme: ThemeSupa }}
        providers={['github']}
      />
    </div>
  )
}
```

### Update `App.tsx` to handle Session

```tsx
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Login } from './Auth'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

function App() {
  const [session, setSession] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (!session) {
    return <Login />
  }

  return (
    <div>
      <h1>Product Analyzer</h1>
      <button onClick={() => supabase.auth.signOut()}>Sign Out</button>
      {/* Rest of your app components */}
    </div>
  )
}
```

## 3. Backend Integration (Fastify)

Install the JWT plugin:

```bash
npm install --workspace=@product-analyzer/api @fastify/jwt
```

### Update `server.ts` to verify JWT

```typescript
import fastifyJWT from '@fastify/jwt'

export function buildServer(opts: { /* ... */ }) {
  const app = Fastify({ logger: false });

  // Register JWT plugin with Supabase JWT Secret
  app.register(fastifyJWT, {
    secret: process.env.SUPABASE_JWT_SECRET!
  });

  // Global Auth Hook
  app.addHook("onRequest", async (request, reply) => {
    // Skip auth for health check and public routes
    if (request.url === "/health") return;

    try {
      await request.jwtVerify();
    } catch (err) {
      reply.code(401).send({ error: "Unauthorized", message: err.message });
    }
## 5. Automated Setup

To help you with this migration, I've created a `setup-deploy.js` script in the root directory. You can run it with:

```bash
node setup-deploy.js
```

This script will:
- Initialize a GitHub repo and push your code.
- Initialize Supabase locally.
- Link your project to Vercel.
- Provide instructions for setting up GitHub Secrets for automatic deployment.

  });

  // ... rest of routes
}
```

## 4. Environment Variables

### Frontend (`apps/web/.env`)
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Backend (`apps/api/.env`)
```
SUPABASE_JWT_SECRET=your-jwt-secret
```

## 5. Security Considerations

### Source DB (Read-Only)
Since the `SOURCE_DB` contains sensitive device snapshots, ensure only authenticated users can access the data. The `onRequest` hook already protects all routes, but for finer-grained control, you can implement a "User-Product" mapping in your Metadata DB to restrict users to specific products.

### Metadata DB (Row Level Security)
When using PostgreSQL, use **Row Level Security (RLS)** in Supabase to ensure users can only see/edit tracked fields for configurations they own.

To enforce user ownership:
```sql
ALTER TABLE configuration_fields ADD COLUMN user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();

ALTER TABLE configuration_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their own configuration fields"
ON configuration_fields
FOR ALL
USING (auth.uid() = user_id);
```


- **Source DB**: Since this is read-only, ensure your API only allows authorized users to query it.
- **Metadata DB**: When using PostgreSQL, you can use **Row Level Security (RLS)** in Supabase to ensure users can only see/edit tracked fields for configurations they have access to.

To enforce user ownership of configurations:
```sql
ALTER TABLE configuration_fields ADD COLUMN user_id UUID REFERENCES auth.users(id);

ALTER TABLE configuration_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their own configuration fields"
ON configuration_fields
FOR ALL
USING (auth.uid() = user_id);
```

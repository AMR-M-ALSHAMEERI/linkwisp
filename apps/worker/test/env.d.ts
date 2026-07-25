declare global {
  interface Env {
    TEST_MIGRATIONS: Array<{
      name: string;
      queries: string[];
    }>;
  }

  namespace Cloudflare {
    interface Env {
      TEST_MIGRATIONS: Array<{
        name: string;
        queries: string[];
      }>;
    }
  }
}

declare module "cloudflare:workers" {
  interface ProvidedEnv extends Env {
  }

  export const env: ProvidedEnv;
  export const exports: {
    default: Fetcher;
  };
}

export {};

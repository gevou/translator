import { neon, neonConfig } from "@neondatabase/serverless";
import { requireEnv } from "./env";

neonConfig.poolQueryViaFetch = true;

export const getDb = () => {
  const url = requireEnv("DATABASE_URL");
  return neon(url);
};

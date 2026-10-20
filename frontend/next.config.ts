import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Do not auto-generate AI agent rule files (AGENTS.md / CLAUDE.md).
  agentRules: false,
};

export default nextConfig;

import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  { ignores: [".next/**", "node_modules/**", "data/**", "next-env.d.ts", "mobile/**"] },
  ...nextCoreWebVitals,
];

export default eslintConfig;

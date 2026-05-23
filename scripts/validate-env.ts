import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// Colors for beautiful console output
const COLORS = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
};

interface EnvRule {
  key: string;
  required: boolean;
  validate?: (value: string) => { isValid: boolean; message: string };
  warning?: boolean;
}

const envRules: EnvRule[] = [
  {
    key: "DATABASE_URL",
    required: true,
    validate: (val) => {
      const isPg = val.startsWith("postgresql://") || val.startsWith("postgres://");
      return {
        isValid: isPg,
        message: "Must be a valid PostgreSQL connection string starting with postgresql:// or postgres://",
      };
    },
  },
  {
    key: "JWT_SECRET",
    required: true,
    validate: (val) => {
      return {
        isValid: val.length >= 8,
        message: "Should be at least 8 characters long for adequate security",
      };
    },
  },
  {
    key: "GEMINI_API_KEY",
    required: true,
    validate: (val) => {
      return {
        isValid: val.trim().length > 0 && val !== "your_gemini_api_key_here",
        message: "Must be a valid non-placeholder Google Gemini API key",
      };
    },
  },
  {
    key: "NEXTAUTH_SECRET",
    required: true,
    validate: (val) => {
      return {
        isValid: val.trim().length > 0 && val !== "your-nextauth-secret",
        message: "Must be a valid non-placeholder NextAuth secret",
      };
    },
  },
  {
    key: "NEXTAUTH_URL",
    required: true,
    validate: (val) => {
      try {
        new URL(val);
        return { isValid: true, message: "" };
      } catch {
        return { isValid: false, message: "Must be a valid absolute URL (e.g. http://localhost:3000)" };
      }
    },
  },
  {
    key: "GITHUB_APP_ID",
    required: false,
    warning: true,
  },
  {
    key: "GITHUB_APP_PRIVATE_KEY",
    required: false,
    warning: true,
  },
];

function runValidation() {
  console.log(`${COLORS.bold}${COLORS.cyan}=========================================`);
  console.log("🛠️  GitVerse Next.js Env Configuration Validator");
  console.log(`=========================================${COLORS.reset}\n`);

  const rootDir = process.cwd();
  const envLocalPath = path.join(rootDir, ".env.local");
  const envPath = path.join(rootDir, ".env");

  let loadedPath = "";

  if (fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath });
    loadedPath = ".env.local";
  } else if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    loadedPath = ".env";
  } else {
    console.error(
      `${COLORS.red}❌ Error: No environment configuration file found!${COLORS.reset}`
    );
    console.error(
      `Please copy ${COLORS.cyan}.env.example${COLORS.reset} to ${COLORS.cyan}.env.local${COLORS.reset} and fill in your values.\n`
    );
    process.exit(1);
  }

  console.log(`Loaded environment from: ${COLORS.green}${COLORS.bold}${loadedPath}${COLORS.reset}\n`);

  let errors = 0;
  let warnings = 0;

  for (const rule of envRules) {
    const value = process.env[rule.key];

    if (!value) {
      if (rule.required) {
        console.error(
          `${COLORS.red}❌ Missing Required:${COLORS.reset} ${COLORS.bold}${rule.key}${COLORS.reset}`
        );
        errors++;
      } else if (rule.warning) {
        console.warn(
          `${COLORS.yellow}⚠️  Missing Optional (Recommended):${COLORS.reset} ${COLORS.bold}${rule.key}${COLORS.reset}`
        );
        warnings++;
      }
      continue;
    }

    if (rule.validate) {
      const { isValid, message } = rule.validate(value);
      if (!isValid) {
        console.error(
          `${COLORS.red}❌ Invalid Format:${COLORS.reset} ${COLORS.bold}${rule.key}${COLORS.reset}`
        );
        console.error(`   👉 ${COLORS.yellow}${message}${COLORS.reset}`);
        errors++;
        continue;
      }
    }

    // Mask value for secure display
    const masked = value.length > 8 
      ? value.substring(0, 4) + "... [MASKED] ..." + value.substring(value.length - 4)
      : "*** [MASKED] ***";

    console.log(
      `${COLORS.green}✅ Validated:${COLORS.reset} ${COLORS.bold}${rule.key}${COLORS.reset} (${COLORS.cyan}${masked}${COLORS.reset})`
    );
  }

  console.log(`\n${COLORS.bold}${COLORS.cyan}-----------------------------------------${COLORS.reset}`);
  if (errors > 0) {
    console.error(
      `🚨 ${COLORS.red}${COLORS.bold}Validation Failed!${COLORS.reset} Found ${COLORS.bold}${errors}${COLORS.reset} error(s) and ${COLORS.bold}${warnings}${COLORS.reset} warning(s).`
    );
    console.error(
      `Please correct the configurations in your ${COLORS.cyan}${loadedPath}${COLORS.reset} file.\n`
    );
    process.exit(1);
  } else if (warnings > 0) {
    console.log(
      `✨ ${COLORS.yellow}${COLORS.bold}Validation Completed with Warnings!${COLORS.reset} All required configurations are valid. Found ${COLORS.bold}${warnings}${COLORS.reset} optional warning(s).`
    );
    console.log("Ready for development! Run `npm run dev` to start.\n");
  } else {
    console.log(
      `🎉 ${COLORS.green}${COLORS.bold}All Configurations are 100% Valid!${COLORS.reset} Excellent setup.`
    );
    console.log("Ready for development! Run `npm run dev` to start.\n");
  }
}

try {
  runValidation();
} catch (error) {
  console.error("An unexpected error occurred during validation:", error);
  process.exit(1);
}

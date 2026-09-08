/**
 * Move a user account to another workspace (creating the workspace settings when missing).
 *   node dist/scripts/assignWorkspace.js --email <email> --workspace <id|new>
 *   npm run auth:assign-workspace -- --email amar@example.com --workspace default
 *
 * `--workspace new` creates a fresh random workspace id. The user has to sign in again afterwards:
 * sessions carry the workspace id.
 */
import mongoose from "mongoose";
import { env } from "../config/env";
import { User } from "../models/User";
import { WorkspaceSettings } from "../models/WorkspaceSettings";
import { newWorkspaceId } from "../services/auth.service";

function usage(msg?: string): never {
  if (msg) console.error(`error: ${msg}\n`);
  console.error("usage: node dist/scripts/assignWorkspace.js --email <email> --workspace <id|new>");
  process.exit(2);
}

async function main() {
  const args = process.argv.slice(2);
  const opt = (k: string): string | undefined => {
    const i = args.indexOf(k);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const email = opt("--email")?.trim().toLowerCase();
  const target = opt("--workspace")?.trim();
  if (!email || !target) usage("--email and --workspace are required");
  if (target !== "new" && !/^[A-Za-z0-9_-]{1,64}$/.test(target)) usage(`invalid workspace id "${target}" (letters, digits, _ and - only)`);

  await mongoose.connect(env.MONGODB_URI, { dbName: env.DB_NAME });
  try {
    const user = await User.findOne({ email });
    if (!user) usage(`no account with email ${email}`);
    const from = user.workspaceId;
    const to = target === "new" ? newWorkspaceId() : target;
    let created = false;
    let settings = await WorkspaceSettings.findOne({ workspaceId: to });
    if (!settings) {
      settings = await WorkspaceSettings.create({ workspaceId: to, name: `${user.name}'s workspace` });
      created = true;
    }
    user.workspaceId = to;
    await user.save();
    console.log(JSON.stringify({ email: user.email, name: user.name, from, to, workspaceName: settings.name, workspaceCreated: created, db: env.DB_NAME }, null, 2));
    if (from !== to) console.log("Done. The user must sign out and back in (sessions carry the workspace id).");
    else console.log("Nothing changed: the user was already in that workspace.");
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

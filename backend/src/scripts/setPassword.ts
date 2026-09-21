/**
 * Reset an account's password when it has been forgotten (passwords are stored as one-way hashes,
 * nobody can read them back). Run it yourself on the server — it asks for the new password on the
 * terminal without echoing it, so the password never appears in shell history or logs.
 *
 *   ssh -t root@<server> 'cd /opt/matrix/backend && node dist/scripts/setPassword.js --email you@example.com'
 */
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { env } from "../config/env";
import { User } from "../models/User";

const KEY = { ctrlC: 3, ctrlD: 4, backspace: 8, lineFeed: 10, carriageReturn: 13, del: 127 };

function fail(msg: string): never {
  console.error(`error: ${msg}`);
  process.exit(2);
}

/** Read a line from the terminal without echoing it. */
function askHidden(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    if (!stdin.isTTY) return reject(new Error("no terminal attached — run over `ssh -t` or in a local shell"));
    process.stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let value = "";
    const finish = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off("data", onData);
      process.stdout.write("\n");
    };
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        const code = ch.charCodeAt(0);
        if (code === KEY.lineFeed || code === KEY.carriageReturn || code === KEY.ctrlD) {
          finish();
          return resolve(value);
        }
        if (code === KEY.ctrlC) {
          finish();
          process.exit(130);
        }
        if (code === KEY.del || code === KEY.backspace) value = value.slice(0, -1);
        else if (code >= 32) value += ch;
      }
    };
    stdin.on("data", onData);
  });
}

async function main() {
  const args = process.argv.slice(2);
  const i = args.indexOf("--email");
  const email = i >= 0 ? args[i + 1]?.trim().toLowerCase() : undefined;
  if (!email) fail("usage: node dist/scripts/setPassword.js --email <email>");

  await mongoose.connect(env.MONGODB_URI, { dbName: env.DB_NAME });
  try {
    const user = await User.findOne({ email });
    if (!user) fail(`no account with email ${email}`);
    const first = await askHidden(`New password for ${email} (min 8 characters): `);
    if (first.length < 8) fail("password must be at least 8 characters");
    const second = await askHidden("Repeat it: ");
    if (first !== second) fail("the two entries do not match — nothing changed");
    user.passwordHash = await bcrypt.hash(first, 11);
    await user.save();
    console.log(`Password updated for ${email}. Existing sessions stay signed in; use the new password next time.`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

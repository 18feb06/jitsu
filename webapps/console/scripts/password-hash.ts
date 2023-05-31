import minimist from "minimist";
import { createHash, getLog, randomId } from "juava";

const log = getLog("password-hash");

async function main(): Promise<void> {
  const args = minimist(process.argv.slice(2));
  if (!args._ || args._.length === 0) {
    log.atInfo().log("No secret provided as a first arg, generating a random one");
  }
  const secret = !args._ || args._.length === 0 ? randomId(16) : args._[0];
  log
    .atInfo()
    .log(
      `Calculating password hash. Using ${
        process.env.GLOBAL_HASH_SECRET ? "custom GLOBAL_HASH_SECRET" : "default hash secret"
      }`
    );
  log.atInfo().log(`Hashing ${secret} → ${createHash(args._[0])}`);
}

main();

import IORedis from "ioredis";
import { Queue } from "bullmq";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

// Ye 2 queue names try karega (jo bhi milta hai clear kar dega)
const QUEUE_NAMES = ["ifs-repoll", "ifs-repoll-scheduler", "ifs-polling", "ifs-polling-scheduler"];

async function clearAll() {
  console.log(`🔌 Connected to Redis: ${REDIS_URL}\n`);

  for (const name of QUEUE_NAMES) {
    try {
      const q = new Queue(name, { connection });
      const counts = await q.getJobCounts();
      const total = Object.values(counts).reduce((a, b) => a + b, 0);

      if (total === 0) {
        console.log(`⚪ ${name}: empty, skipping`);
        await q.close();
        continue;
      }

      console.log(`🗑️  ${name}: ${JSON.stringify(counts)} → clearing...`);
      await q.obliterate({ force: true });
      console.log(`✅ ${name}: cleared\n`);
      await q.close();
    } catch (err) {
      console.log(`⚠️  ${name}: ${err.message}\n`);
    }
  }

  await connection.quit();
  console.log("🎉 Done. Restart backend now.");
  process.exit(0);
}

clearAll().catch((e) => {
  console.error("❌ Failed:", e);
  process.exit(1);
});

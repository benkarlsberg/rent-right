import { closeSql } from "@/lib/pg";
import { startSampleTenancy } from "@/lib/seed";

startSampleTenancy()
  .then(async (id) => {
    console.log(`Sample Los Angeles tenancy ready for ${id}.`);
    await closeSql();
  })
  .catch(async (error) => {
    console.error(error);
    await closeSql();
    process.exit(1);
  });

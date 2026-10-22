import { migrate } from "@/lib/migrate";
import { closeSql } from "@/lib/pg";

migrate()
  .then(async () => {
    console.log("Migrations applied.");
    await closeSql();
  })
  .catch(async (error) => {
    console.error(error);
    await closeSql();
    process.exit(1);
  });

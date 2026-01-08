import { connect } from "mongoose";

const green = "\x1b[32m";
const reset = "\x1b[0m";
const red = "\x1b[31m";

const MongoDBConnectDB = async () => {
  try {
    // ✅ READ ENV AT RUNTIME (FIX)
    const MONGO_URI = process.env.MONGO_URI;

    if (!MONGO_URI) {
      throw new Error("MONGO_URI is missing in .env.staging");
    }

    await connect(MONGO_URI);

    console.log("**************************************");
    console.log(`${green}*    MongoDb DB Connection: OK ✅${reset}`);
    console.log("**************************************");
  } catch (error) {
    console.log("******************************************************");
    console.log(
      `${red}*    Error connecting to MongoDb DB: Failed connection${reset}`
    );
    console.log("******************************************************");
    console.error(error.message);
    process.exit(1);
  }
};

// const sequelize = new Sequelize(POSTGRES_URL, {
//   dialect: "postgres",
//   logging: false,
//   dialectOptions: {
//     ssl: {
//       require: true,
//       rejectUnauthorized: false, // For Supabase SSL
//     },
//   },
// });
// const PostgresConnectDB = async () => {
//   try {
//     await sequelize.authenticate();
//     console.log("**************************************");
//     console.log(`${green}*    Postgres DB Connection: OK ✅${reset}`);
//     console.log("**************************************");
//   } catch (err) {
//     console.log("******************************************************");
//     console.log(
//       `${red}*    Error connecting to Postgres DB: Failed connection${reset}`
//     );
//     console.log("******************************************************");
//     console.error(err);
//     process.exit(1);
//   }
// };
export default { MongoDBConnectDB };

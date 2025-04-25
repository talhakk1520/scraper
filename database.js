// const mysql = require('promise-mysql');

// const dbConfig = {
//   host: '68.66.228.176',
//   // host: 'localhost',
//   user: 'sharpg',
//   // user: 'root',
//   password: 'r0s41AVUX$Rgn:wj',
//   // password: '',
//   database: 'sharpg_usa',
//   // database: 'vendors',
//   multipleStatements: true
// };

// let connection;
// let pool;

// async function createPool() {
//   if (!pool) {
//     pool = mysql.createPool({
//       ...dbConfig,
//       waitForConnections: true,
//       connectionLimit: 10,
//       queueLimit: 0
//     });
//   }
// }

// // ------- DataBase Connection And Checking If Not Connect Then It Will Try 2 Times  ------- //

// async function createConnection() {
//   let attemptCount = 0;
//   const maxRetries = 2;

//   while (attemptCount < maxRetries) {
//     try {
//       connection = await mysql.createConnection(dbConfig);
//       return;
//     } catch (error) {
//       attemptCount++;
//       if (attemptCount === maxRetries) {
//         throw new Error(
//           `connection: Unable to connect to the database after ${maxRetries} attempts. Please check the database server and credentials.`
//         );
//       }
//       await new Promise(resolve => setTimeout(resolve, 2000));
//     }
//   }
// }

// async function getConnection() {
//   if (!connection) {
//     try {
//       await createConnection();
//     } catch (error) {
//       throw error;
//     }
//   } else {
//     try {
//       await connection.ping();
//     } catch (error) {
//       await createConnection();
//     }
//   }
//   return connection;
// }

// async function getPoolConnection() {
//   if (!pool) {
//     await createPool();
//   }
//   return pool;
// }

// module.exports = { getConnection, getPoolConnection };


const sql = require('mssql');

const dbConfig1 = {
  user: 'services_login',
  password: 'dRx*M<B6jKR!GkyJwH8V',
  server: '74.208.31.179',
  database: 'PU_Admin',
  port: 2421,
  options: {
    encrypt: false,
    trustServerCertificate: false
  }
};

const dbConfig2 = {
  user: 'services_login',
  password: 'dRx*M<B6jKR!GkyJwH8V',
  server: '74.208.31.179',
  database: 'vendor_inventory',
  port: 2421,
  options: {
    encrypt: false,
    trustServerCertificate: false
  }
};

let pool1, pool2;

async function getConnection1() {
  if (!pool1) {
    pool1 = await new sql.ConnectionPool(dbConfig1).connect();
  }
  return pool1;
}

async function getConnection2() {
  if (!pool2) {
    pool2 = await new sql.ConnectionPool(dbConfig2).connect();
  }
  return pool2;
}

module.exports = {
  getConnection1,
  getConnection2,
  sql
};

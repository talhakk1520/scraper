const mysql = require('promise-mysql');

const dbConfig = {
  host: '68.66.228.176',
  // host: 'localhost',
  user: 'sharpg',
  // user: 'root',
  password: 'r0s41AVUX$Rgn:wj',
  // password: '',
  database: 'sharpg_usa',
  // database: 'vendors',
  multipleStatements: true
};

let connection;
let pool;

async function createPool() {
  if (!pool) {
    pool = mysql.createPool({
      ...dbConfig,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
  }
}

// ------- DataBase Connection And Checking If Not Connect Then It Will Try 2 Times  ------- //

async function createConnection() {
  let attemptCount = 0;
  const maxRetries = 2;

  while (attemptCount < maxRetries) {
    try {
      connection = await mysql.createConnection(dbConfig);
      return;
    } catch (error) {
      attemptCount++;
      if (attemptCount === maxRetries) {
        throw new Error(
          `connection: Unable to connect to the database after ${maxRetries} attempts. Please check the database server and credentials.`
        );
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

async function getConnection() {
  if (!connection) {
    try {
      await createConnection();
    } catch (error) {
      throw error;
    }
  } else {
    try {
      await connection.ping();
    } catch (error) {
      await createConnection();
    }
  }
  return connection;
}

async function getPoolConnection() {
  if (!pool) {
    await createPool();
  }
  return pool;
}

module.exports = { getConnection, getPoolConnection };

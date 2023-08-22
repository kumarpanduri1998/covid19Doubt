const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const jwn = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

const app = express();
app.use(express.json());

let db = null;

const initializeAndDbServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log("Server is running at http://localhost:3000");
    });
  } catch (e) {
    console.log(`SERVER ERROR: ${e.message}`);
    process.exit(1);
  }
};

initializeAndDbServer();

const convertStateDbObjectToResponseObject = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

const convertDistrictDbObjectToResponseObject = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};
const authenticationToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT token");
      } else {
        next();
      }
    });
  }
};

//API 1
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const loginQuery = `SELECT * FROM user WHERE username='${username}';`;
  const userQuery = await db.get(loginQuery);
  if (userQuery === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      userQuery.password
    );
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//API 2
app.get("/states/", authenticationToken, async (request, response) => {
  const allStatesQuery = `SELECT * FROM state`;
  const statesArray = await db.all(allStatesQuery);
  response.send(
    statesArray.map((eachState) =>
      convertStateDbObjectToResponseObject(eachState)
    )
  );
});

//API 3
app.get("/states/:stateId/", authenticationToken, async (request, response) => {
  const { stateId } = request.params;
  const singleStateQuery = `SELECT * FROM state WHERE state_id=${stateId}`;
  const singleState = await db.get(singleStateQuery);
  response.send(convertStateDbObjectToResponseObject(singleState));
});

//API 4
app.post("/districts/", authenticationToken, async (request, response) => {
  const { stateId, districtName, cases, cured, active, deaths } = request.body;
  const postDistQuery = `INSERT INTO district (state_id,district_name,cases,cured,active,deaths)
                            VALUES (${stateId},"${districtName}",${cases}
                            ,${cured},${active},${deaths})`;
  await db.run(postDistQuery);
  response.send("District Successfully Added");
});

//API 5
app.get(
  "/districts/:districtId/",
  authenticationToken,
  async (request, reesponse) => {
    const { districtId } = request.params;
    const singleDistQuery = `SELECT * FROM district WHERE district_id=${districtId}`;
    const singleDist = await db.get(singleDistQuery);
    response.send(convertDistrictDbObjectToResponseObject(singleDist));
  }
);

//API 6
app.delete(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistQuery = `DELETE FROM district WHERE district_id=${districtId}`;
    await db.run(deleteDistQuery);
    response.send("District Removed");
  }
);

//API 7
app.put(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = response.body;
    const { districtId } = request.params;
    const updateDistQuery = `UPDATE district
                                SET district_name='${districtName}',state_id=${stateId},
                                cases=${cases},cured=${cured},
                                    active=${active},deaths=${deaths}
                                    WHERE district_id=${districtId}`;
    await db.run(updateDistQuery);
    response.send("District Details Updated");
  }
);

//API 8
app.get(
  "/states/:stateId/stats/",
  authenticationToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getQuery = `SELECT SUM(cases),SUM(cured),SUM(active),SUM(deaths)
                        FROM district WHERE state_id=${stateId}`;
    const stats = await db.get(getQuery);
    response.send({
      totalCases: stats["SUM(cases)"],
      totalCured: stats["SUM(cured)"],
      totalActive: stats["SUM(active)"],
      totalDeaths: stats["SUM(deaths)"],
    });
  }
);

module.exports = app;

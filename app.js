const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "games.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(4000, () => {
      console.log("Server Running at http://localhost:4000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid Jwt Token");
  } else {
    jwt.verify(jwtToken, "MY_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid Jwt Token");
      } else {
        request.phoneNumber = payload.phoneNumber;
        next();
      }
    });
  }
};

/*function convertDbObject(resultArray){
    let obj={}
    let userId=[]
    let totalPoints=[]
    let totalWins=[]
    for (let i of resultArray){
        let myArrays=(Object.keys(i))
        let key=(myArrays[2]).slice(-2)
        let value=obj.(myArrays[2])
        if obj[key]===undefined{
            obj[key]=value
        }else{
            obj[key]+=value
        }
        let key2=myArrays[3].slice(-2)
        let value2=obj.(myArrays[3])
         if (obj[key]===undefined){
            obj[key2]=value2
        }else{
            obj[key2]+=value2
        }
        if (i.win==="true"){
            
        } 
    }
}*/

app.post("/register/", async (request, response) => {
  const { phoneNumber, password, name, age, location, emailId } = request.body;
  const hashedPassword = bcrypt.hash(password, 10);
  const getUserQuery = `SELECT *
    FROM users
    WHERE phone_number=${phoneNumber}`;
  const dbUser = await db.get(getUserQuery);
  if (dbUser === undefined) {
    const createUserQuery = `INSERT INTO users(phone_number,password,name,age,location,email_id)
    VALUES (${parseInt(phoneNumber)},"${hashedPassword}","${name}",
    ${parseInt(age)},"${location}","${emailId}")`;
    if (phoneNumber.length == 10) {
      const dbQuery = await db.run(createUserQuery);
      response.status(200);
      response.send("User Created Successfully");
    } else {
      response.status(400);
      response.send("Invalid Phone Number");
    }
  } else {
    response.status(400);
    response.send("User Already Exists");
  }
});

app.post("/login/", async (request, response) => {
  const { phoneNumber, password } = request.body;
  const getUserQuery = `SELECT *
    FROM users
    WHERE phone_number=${phoneNumber}`;
  const dbUser = await db.get(getUserQuery);
  if (dbUser === undefined) {
    response.send("User doesn't exists");
  } else {
    const isPasswordMatched = bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched) {
      const payload = { phoneNumber: phoneNumber };
      const jwtToken = jwt.sign(payload, "MY_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(401);
      response.send("Invalid Password");
    }
  }
});

app.put("/users/update/", authenticateToken, async (request, response) => {
  const { phoneNumber } = request;
  const requestBody = request.body;
  let updateColumn = "";
  switch (true) {
    case requestBody.name !== undefined:
      updateColumn = "Name";
      break;
    case requestBody.age !== undefined:
      updateColumn = "Age";
      break;
    case requestBody.location !== undefined:
      updateColumn = "Location";
      break;
    case requestBody.email_id !== undefined:
      updateColumn = "EmailId";
      break;
  }
  const getUserQuery = `SELECT *
     FROM users
     WHERE phone_number=${phoneNumber};`;
  const alreadyUser = await db.get(getUserQuery);
  const {
    name = alreadyUser.name,
    age = alreadyUser.age,
    location = alreadyUser.location,
    emailId = alreadyUser.email_id,
  } = request.body;
  const updateUserDetails = `UPDATE users
     SET
          name="${name}",
          age=${age},
          location="${location}",
          email_id="${emailId}"
     WHERE phone_number=${phoneNumber}`;
  const updateDb = await db.run(updateUserDetails);
  response.send(`${updateColumn} Updated`);
});

app.get("/users/games/", authenticateToken, async (request, response) => {
  const { phoneNumber } = request;
  const getUserQuery = `SELECT game_name
    FROM all_games ;`;
  const dbGames = await db.all(getUserQuery);
  response.send(dbGames);
});

app.post(
  "/users/updateScores/",
  authenticateToken,
  async (request, response) => {
    const { phoneNumber } = request;
    const checkAdminQuery = `SELECT is_admin
    FROM users
    WHERE phone_number=${phoneNumber}`;
    const dbAdmin = await db.get(checkAdminQuery);
    if (dbAdmin === "false") {
      response.status(400);
      response.send("Only admin can change score details");
    } else {
      const { u1Id, u2Id, scoreU1, scoreU2, win, gameId } = request.body;
      const scoreUpdateQuery = `UPDATE game_scores (u1Id,u2Id,scoreU1,scoreU2,win,game_id)
        VALUES (${u1Id},${u2Id},${scoreU1},${scoreU2},"${win}",${gameId});`;
      const dbUpdate = await db.run(scoreUpdateQuery);
      response.send("Scores Updated");
    }
  }
);

app.get(
  "/users/games/:gameId/",
  authenticateToken,
  async (request, response) => {
    const { gameId } = request.params;
    const { phoneNumber } = request;
    const getGamesDetailsQuery = `SELECT *
    FROM game_scores
    WHERE game_id=${gameId};`;
    let resultArray = [];
    const dbGamesScores = await db.all(getGamesDetailsQuery);
    dbGamesScores.map((eachArray) => resultArray.push(eachArray));
    response.send(resultArray);
    //convertDbObject(resultArray)
  }
);
module.exports = app;

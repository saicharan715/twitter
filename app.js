const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());
const dbPath = path.join(__dirname, "twitterClone.db");

let db = null;

const initilizeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is running at http://localhost:3000");
    });
  } catch (e) {
    console.log(`DB ERROR: ${e.message}`);
    process.exit(1);
  }
};

initilizeDBAndServer();

const convert = (dbObj) => {
  return {
    userId: dbObj.user_id,
    name: dbObj.name,
    username: dbObj.username,
    password: dbObj.password,
    gender: dbObj.gender,
    followerId: dbObj.follower_id,
    followerUserId: dbObj.follower_user_id,
    followingUserId: dbObj.following_user_id,
    tweetId: dbObj.tweet_id,
    tweet: dbObj.tweet,
    dateTime: dbObj.date_time,
    replyId: dbObj.reply_id,
    reply: dbObj.reply,
    likeId: dbObj.like_id,
  };
};

//Authenticate Token
const authenticateToken = (request, response, next) => {
  let jwtToken;

  const authHeader = request.headers["authorization"];

  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "charan", async (error, payload) => {
      if (error) {
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//register API
app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;

  let hashedPassword = await bcrypt.hash(password, 10);

  let checkUsername = `
    SELECT * FROM user WHERE username = ${username};`;

  let userData = await db.run(checkUsername);

  if (userData === undefined) {
    let postNewQuery = `
        INSERT INTO user 
        VALUES ('${username}',
        '${password}',
        '${name}',
        '${gender}');`;

    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      let newUserDetails = await db.run(postNewQuery);
      response.status(200);
      response.send("User created successfully");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

//Login API
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `
    SELECT * FROM user WHERE username = ${username};`;

  const dbUser = await db.get(selectUserQuery);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "charan");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const getTweets = `
    SELECT username.user,
    tweet.tweet,
    dateTime.tweet
    FROM tweet INNER JOIN user 
    WHERE username.user = ${username}
    AND following_user_id.tweet = ${followingUserId}
    ORDER BY
    ASC
    OFFSET 0 
    LIMIT 5;`;

  const result = await db.all(getTweets);

  response.send(result.map((each) => convert(each)));
});

module.exports = app;

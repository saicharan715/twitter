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
    SELECT * FROM user WHERE username = '${username}';`;

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
    SELECT * FROM user WHERE username = '${username}';`;

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

//API 3
app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const { username } = request.params;
  const getTweets = `
    SELECT username,
    tweet,
    date_time
    FROM user NATURAL JOIN tweet 
    WHERE username = '${username}' 
    LIMIT 4
    ;`;

  const result = await db.all(getTweets);

  response.send(result.map((each) => convert(each)));
});

//API 4
app.get("/user/following/", authenticateToken, async (request, response) => {
  const { followingUserId } = request.params;
  const getFollowingNamesQuery = `
    SELECT name FROM user NATURAL JOIN follower 
    WHERE following_user_id = '${followingUserId}';`;

  const result = await db.all(getFollowingNamesQuery);
  response.send(result);
});

//API 5
app.get("/user/followers/", authenticateToken, async (request, response) => {
  const { followerUserId } = request.params;
  const getFollowerNamesQuery = `
    SELECT name FROM user NATURAL JOIN follower
    WHERE follower_user_id = '${followerUserId}';`;

  const result = await db.all(getFollowerNamesQuery);
  response.send(result);
});

//API 6
app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  const { tweetId } = request.params;

  const getTweets = `
    SELECT tweet,
    SUM(like_id.like) AS likes,
    SUM(reply.reply) AS replies,
    date_time AS dateTime
    FROM tweet NATURAL JOIN like NATURAL JOIN reply
    WHERE tweet_id = '${tweetId}';`;

  const tweet = await db.get(getTweets);
  if (tweet === undefined) {
    respose.status(401);
    response.send("Invalid Request");
  } else {
    response.send({ tweet });
  }
});

//API 7
app.get(
  "/tweets/:tweetId/likes/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;

    const getLikesQuery = `
    SELECT SUM(like_id) AS likes
    FROM like NATURAL JOIN tweet NATURAL JOIN user
    WHERE tweet_id = '${tweetId}';`;

    const result = await db.all(getLikesQuery);
    if (result === undefined) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      response.send({ result: [user.name] });
    }
  }
);

//API 8
app.get(
  "/tweets/:tweetId/replies/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;

    const getReplies = `
    SELECT name,
    reply
    FROM user NATURAL JOIN reply INNER JOIN tweet ON tweet_id.tweet = tweet_id.reply
    WHERE tweet_id = '${tweetId}';`;

    const result = await db.all(getReplies);
    if (result === undefined) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      response.send({ replies: [result] });
    }
  }
);

//API 9
app.get("/user/tweets/", authenticateToken, async (request, response) => {
  const { userId } = request.params;

  const getTweets = `
    SELECT tweet.tweet,
    SUM(like_id) AS likes,
    SUM(reply) AS replies,
    date_time AS dateTime
    FROM tweet NATURAL JOIN like NATURAL JOIN reply NATURAL JOIN user
    WHERE user_id = '${userId}';`;

  const result = await db.all(getTweets);
  response.send(result);
});

//API 10
app.post("/user/tweets/", authenticateToken, async (request, response) => {
  const { tweet } = request.body;

  const addTweet = `
    INSERT INTO tweet(tweet)
    VALUES ('${tweet}');`;

  const createTweet = await db.run(addTweet);
  response.send("Created a Tweet");
});

//API 11
app.delete("/tweets/:tweetId/", async (request, response) => {
  const { tweetId } = request.params;

  const deleteTweet = `
    DELETE FROM tweet WHERE tweet_id = ${tweetId};`;

  const result = await db.run(deleteTweet);
  if (result === undefined) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    response.send("Tweet Removed");
  }
});

module.exports = app;

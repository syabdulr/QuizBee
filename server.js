// load .env data into process.env
require("dotenv").config();

// Web server config
const sassMiddleware = require("./lib/sass-middleware");
const express = require("express");
const cookieSession = require("cookie-session");

const morgan = require("morgan");
const bcrypt = require("bcrypt"); // include bcrypt for password hashing

const PORT = process.env.PORT || 8080;
const app = express();

const db = require("./db/connection");
app.set("view engine", "ejs");

// Load the logger first so all (static) HTTP requests are logged to STDOUT
app.use(morgan("dev"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // middleware for handling JSON body content
app.use(
  "/styles",
  sassMiddleware({
    source: __dirname + "/styles",
    destination: __dirname + "/public/styles",
    isSass: false,
  })
);
app.use(express.static("public"));

app.use(
  cookieSession({
    secret: process.env.SESSION_SECRET || "default_secret",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === "production" },
  })
);

// app.use('/api/users', userApiRoutes); // If you have user API routes, you can include them here

// Home page
app.get("/", (req, res) => {
  const user_id = req.session.user_id; // Get user_id from session
  res.render("index", { user_id }); // Pass user_id as a local variable to your EJS file
});


app.get("/quizzes", (req, res) => {
  res.render("quiz", { user_id: req.session.user_id });
});

app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}`);
});

app.get("/register", (req, res) => {
  res.render("register");
});

app.post("/register", async (req, res) => {
  const { name, email, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10); // Hash the password

  db.query("INSERT INTO Users (name, email, password) VALUES ($1, $2, $3)", [
    name,
    email,
    hashedPassword,
  ])
    .then(() => {
      res.redirect("/");
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send("Server error");
    });
});

app.get("/quizzes/new", (req, res) => {
  res.render("quiz-create");
});

app.post("/quizzes", async (req, res) => {
  console.log(req.body);
  const { title, description, question_text, questions } = req.body;

  try {
    // start a transaction
    await db.query("BEGIN");
    console.log(questions);

    const quizResult = await db.query(
      "INSERT INTO Quizzes (title, description, is_public, creator_id) VALUES ($1, $2, $3, $4) RETURNING id",
      [title, description, true, 1]
    );
    const quizId = quizResult.rows[0].id;

    // Validate that all questions have text
    for (let question of questions) {
      if (!question.choices) {
        res.status(400).json({ error: "All questions must have text." });
        return;
      }
    }

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      console.log({ question: question.choices });
      const questionResult = await db.query(
        "INSERT INTO Questions (quiz_id, question_text) VALUES ($1, $2) RETURNING id",
        [quizId, question_text]
      );
      console.log(question_text, quizId);

      const questionId = questionResult.rows[0].id;
      for (let j = 0; j < question.choices.length; j++) {
        const choice = question.choices[j];
        await db.query(
          "INSERT INTO Choices (question_id, choice_text, is_correct) VALUES ($1, $2, $3)",
          [questionId, choice.text, choice.is_correct]
        );
        console.log(choice);
      }
    }

    // commit the transaction
    await db.query("COMMIT");

    res.status(200).json({ message: "Quiz added successfully" });
  } catch (err) {
    console.error(err);
    // something went wrong, rollback the transaction
    await db.query("ROLLBACK");
    res.status(500).json({ message: "Server error" });
  }
});

// Render login page
app.get('/login', function(req, res) {
  res.render('login', { user_id: req.session.user_id });
});


app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  console.log("REQUESTTT--------------", req.body);

  db.query("SELECT * FROM Users WHERE email = $1", [email])
    .then(async (result) => {
      if (result.rows.length > 0) {
        const user = result.rows[0]; // store the user object
        console.log("user is ", user.id);
        const match = await bcrypt.compare(password, user.password);
        console.log("session is", req.session);
        // res.cookie("userInfo", user_id); remove this
        if (match) {
          // Passwords match
          // set the cookie using cookie-session
          req.session.user_id = user.id; // This will set the cookie

          const userId = user.id;
          // id = user_id;
          res.redirect("/");
        } else {
          // Passwords don't match
          res.status(401).send("Invalid credentials");
        }
      } else {
        // No user with the provided email
        res.status(401).send("Invalid credentials");
      }
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send("Server error");
    });
});

app.get('/logout', function(req, res){
  req.session = null;
  res.redirect('/');
});


app.post("/displayQuizzes", (req, res) => {
  // Fetch quizzes from the database
  db.query("SELECT * FROM Quizzes")
    .then(async (result) => {
      const quizzes = await Promise.all(
        result.rows.map(async (quiz) => {
          const questionsResult = await db.query(
            "SELECT * FROM Questions WHERE quiz_id = $1",
            [quiz.id]
          );
          quiz.questions = questionsResult.rows;
          await Promise.all(
            quiz.questions.map(async (question) => {
              const choicesResult = await db.query(
                "SELECT * FROM Choices WHERE question_id = $1",
                [question.id]
              );
              question.choices = choicesResult.rows;
            })
          );
          return quiz;
        })
      );
      res.json({ quizzes });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send("Server error");
    });
});

app.post("/submitQuiz", async (req, res) => {
  const quizData = req.body;

  try {
    // start a transaction
    await db.query("BEGIN");

    let score = 0;
    let user_id = null;
    let quiz_id = null;
    for (const answer of quizData) {
      user_id = answer.user_id;
      quiz_id = answer.quiz_id;
      const choiceResult = await db.query(
        "SELECT * FROM Choices WHERE id = $1",
        [answer.choice_id]
      );

      if (choiceResult.rows.length > 0 && choiceResult.rows[0].is_correct) {
        score++;
      }
    }

    // Store the quiz attempt and answers in the database
    const quizAttemptResult = await db.query(
      "INSERT INTO QuizAttempts (quiz_id, user_id, score) VALUES ($1, $2, $3) RETURNING id",
      [quiz_id, user_id, score]
    );
    const quizAttemptId = quizAttemptResult.rows[0].id;

    for (const answer of quizData) {
      await db.query(
        "INSERT INTO Answers (quiz_attempt_id, choice_id) VALUES ($1, $2)",
        [quizAttemptId, answer.choice_id]
      );
    }

    // commit the transaction
    await db.query("COMMIT");

    res.status(200).json({ message: "Quiz submitted successfully", score });
  } catch (err) {
    console.error(err);
    // something went wrong, rollback the transaction
    await db.query("ROLLBACK");
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/submitQuizzes", async (req, res) => {
  const { user_id } = req.session;

  if (!user_id) {
    return res.status(400).render("error", { message: "User ID is required." });
  }

  try {
    const quizAttemptsResult = await db.query(
      "SELECT * FROM QuizAttempts WHERE user_id = $1",
      [user_id]
    );

    if (quizAttemptsResult.rows.length === 0) {
      return res
        .status(404)
        .render("error", { message: "No quiz attempts found for this user." });
    }

    const quizAttempts = quizAttemptsResult.rows;
    const results = [];

    for (const attempt of quizAttempts) {
      const quizResult = await db.query("SELECT * FROM Quizzes WHERE id = $1", [
        attempt.quiz_id,
      ]);
      if (quizResult.rows.length > 0) {
        const quiz = quizResult.rows[0];
        results.push({
          quiz_id: quiz.id,
          quiz_title: quiz.title,
          score: attempt.score,
        });
      }
    }

    res.status(200).render("submitQuizzes", { results });
  } catch (err) {
    console.error(err);
    res.status(500).render("error", { message: "Server error" });
  }
});

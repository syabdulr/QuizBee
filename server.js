// load .env data into process.env
require('dotenv').config();

// Web server config
const sassMiddleware = require('./lib/sass-middleware');
const express = require('express');
const morgan = require('morgan');
const bcrypt = require('bcrypt');  // include bcrypt for password hashing

const PORT = process.env.PORT || 8080;
const app = express();

const db = require('./db/connection');
app.set('view engine', 'ejs');

// Load the logger first so all (static) HTTP requests are logged to STDOUT
app.use(morgan('dev'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // middleware for handling JSON body content
app.use(
  '/styles',
  sassMiddleware({
    source: __dirname + '/styles',
    destination: __dirname + '/public/styles',
    isSass: false,
  })
);
app.use(express.static('public'));

// app.use('/api/users', userApiRoutes); // If you have user API routes, you can include them here

// Home page
app.get('/', (req, res) => {
  res.render('index');
});

app.get('/quizzes', (req, res) => {
  res.render('quiz');
});

app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}`);
});

app.get('/register', (req, res) => {
  res.render('register');
});

app.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10); // Hash the password

  db.query('INSERT INTO Users (name, email, password) VALUES ($1, $2, $3)', [name, email, hashedPassword])
    .then(() => {
      res.redirect('/');
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send('Server error');
    });
});

app.get('/quizzes/new', (req, res) => {
  res.render('quiz-create');
});

app.post('/quizzes', async (req, res) => {
  const { title, description, questions, answers } = req.body;
  console.log(req.body);
  try {
    // start a transaction
    await db.query('BEGIN');

    const quizResult = await db.query(`INSERT INTO Quizzes (title, description, is_public, creator_id) VALUES ($1, $2, $3, $4) RETURNING id`, [title, description, true, 1]);
    const quizId = quizResult.rows[0].id;

    for (let question of questions) {
      console.log(question);
      const questionResult = await db.query(`INSERT INTO Questions (quiz_id, question_text) VALUES ($1, $2) RETURNING id`, [quizId, question]);
      const questionId = questionResult.rows[0].id;
      for (let choice of answers) {
        if(Array.isArray(choice)){
          await db.query(`INSERT INTO Choices (question_id, choice_text, is_correct) VALUES ($1, $2, $3)`, [questionId, choice[0], true]);
        } else {
          await db.query(`INSERT INTO Choices (question_id, choice_text, is_correct) VALUES ($1, $2, $3)`, [questionId, choice, false]);
        }
      }
    }

    // commit the transaction
    await db.query('COMMIT');

    res.redirect('/quizzes');
  } catch (err) {
    console.error(err);
    // something went wrong, rollback the transaction
    await db.query('ROLLBACK');
    res.status(500).send('Server error');
  }
});

// Render login page
app.get('/login', (req, res) => {
  res.render('login');
});

// Handle login requests
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  db.query('SELECT * FROM Users WHERE email = $1', [email])
    .then(async (result) => {
      if (result.rows.length > 0) {
        const user = result.rows[0];
        const match = await bcrypt.compare(password, user.password);

        if (match) {
          // Passwords match
          // TODO: Handle login success (set up session/cookie, redirect to dashboard, etc.)
          res.send('Login success');
        } else {
          // Passwords don't match
          res.status(401).send('Invalid credentials');
        }
      } else {
        // No user with the provided email
        res.status(401).send('Invalid credentials');
      }
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send('Server error');
    });
});

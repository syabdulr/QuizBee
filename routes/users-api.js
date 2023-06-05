// quiz-api.js

/*
 * All routes for Quiz are defined here
 * Since this file is loaded in server.js into api/quizzes,
 *   these routes are mounted onto /api/quizzes
 */

const express = require('express');
const router  = express.Router();
const quizQueries = require('/db/queries/quizzes');

router.post('/', (req, res) => {
  const quizData = req.body;
  quizQueries.createQuiz(quizData)
    .then(quiz => {
      res.json({ quiz });
    })
    .catch(err => {
      res
        .status(500)
        .json({ error: err.message });
    });
});

module.exports = router;

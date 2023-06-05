-- 01_schema.sql
DROP TABLE IF EXISTS Answers CASCADE;
DROP TABLE IF EXISTS QuizAttempts CASCADE;
DROP TABLE IF EXISTS Choices CASCADE;
DROP TABLE IF EXISTS Questions CASCADE;
DROP TABLE IF EXISTS Quizzes CASCADE;
DROP TABLE IF EXISTS Users CASCADE;

CREATE TABLE Users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL
);

CREATE TABLE Quizzes (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    is_public BOOLEAN NOT NULL,
    creator_id INTEGER REFERENCES Users(id)
);

CREATE TABLE Questions (
    id SERIAL PRIMARY KEY,
    quiz_id INTEGER REFERENCES Quizzes(id),
    question_text TEXT NOT NULL
);

CREATE TABLE Choices (
    id SERIAL PRIMARY KEY,
    question_id INTEGER REFERENCES Questions(id),
    choice_text TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL
);

CREATE TABLE QuizAttempts (
    id SERIAL PRIMARY KEY,
    quiz_id INTEGER REFERENCES Quizzes(id),
    user_id INTEGER REFERENCES Users(id),
    score INTEGER
);

CREATE TABLE Answers (
    id SERIAL PRIMARY KEY,
    quiz_attempt_id INTEGER REFERENCES QuizAttempts(id),
    choice_id INTEGER REFERENCES Choices(id)
);

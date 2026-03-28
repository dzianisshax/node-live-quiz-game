import { Game } from "./types";
import { broadcastToGame } from "./utils.js";

/**
 * Starts a new question in the game, broadcasts the options to players, and initializes the timer.
 * @param {Game} game - The game instance transitioning to the next question.
 */
export const startQuestion = (game: Game) => {
  game.playerAnswers.clear();
  const q = game.questions[game.currentQuestion];
  game.questionStartTime = Date.now();

  broadcastToGame(game, "question", {
    questionNumber: game.currentQuestion + 1,
    totalQuestions: game.questions.length,
    text: q.text,
    options: q.options,
    timeLimitSec: q.timeLimitSec,
  });

  game.questionTimer = setTimeout(
    () => endQuestion(game),
    q.timeLimitSec * 1000,
  );
};

/**
 * Ends the current question, calculates scores based on response time, broadcasts results,
 * and handles the transition to the next question or the end of the game.
 * @param {Game} game - The game instance ending its current question.
 */
export const endQuestion = (game: Game) => {
  if (game.questionTimer) clearTimeout(game.questionTimer);
  const q = game.questions[game.currentQuestion];
  const playerResults: any[] = [];

  // Calculate scores
  game.players.forEach((p) => {
    const ans = game.playerAnswers.get(p.index);
    let pointsEarned = 0;
    let correct = false;

    if (ans && ans.answerIndex === q.correctIndex) {
      correct = true;
      const timeRemaining = Math.max(0, q.timeLimitSec * 1000 - ans.timestamp);
      pointsEarned = Math.round(
        1000 * (timeRemaining / (q.timeLimitSec * 1000)),
      );
    }

    p.score += pointsEarned;

    playerResults.push({
      name: p.name,
      answered: !!ans,
      correct,
      pointsEarned,
      totalScore: p.score,
    });
  });

  // Broadcast results
  broadcastToGame(game, "question_result", {
    questionIndex: game.currentQuestion,
    correctIndex: q.correctIndex,
    playerResults,
  });

  // Advance game flow
  game.currentQuestion++;
  if (game.currentQuestion < game.questions.length) {
    // 4-second intermission before the next question
    setTimeout(() => startQuestion(game), 4000);
  } else {
    game.status = "finished";
    const scoreboard = game.players
      .map((p) => ({ name: p.name, score: p.score }))
      .sort((a, b) => b.score - a.score)
      .map((p, idx) => ({ ...p, rank: idx + 1 }));

    setTimeout(() => {
      broadcastToGame(game, "game_finished", { scoreboard });
    }, 4000);
  }
};

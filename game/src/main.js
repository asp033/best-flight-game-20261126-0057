// Bootstrap: size the canvas to the window while keeping the game's
// 1280x720 stage, then hand the frame loop to game.js. Nothing here loads
// over the network; the whole game is the files beside this one.
import { VIEW } from './config.js';
import { createGame, startGameLoop } from './game.js';

const canvas = document.getElementById('stage');
canvas.width = VIEW.width;
canvas.height = VIEW.height;

function fitCanvas() {
  const scale = Math.min(window.innerWidth / VIEW.width, window.innerHeight / VIEW.height);
  canvas.style.width = `${Math.floor(VIEW.width * scale)}px`;
  canvas.style.height = `${Math.floor(VIEW.height * scale)}px`;
}

window.addEventListener('resize', fitCanvas);
fitCanvas();

const game = createGame(canvas);
startGameLoop(game);

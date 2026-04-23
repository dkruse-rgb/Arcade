const BOARD_SIZE = 8;
const LEVEL_GOAL_START = 80;
const LEVEL_GOAL_STEP = 30;
const SWIPE_THRESHOLD = 18;
const MAX_FRUIT_FLIGHTS = 12;

const FRUITS = [
  { type: 'apple', label: 'Apple', emoji: '🍎', unlockLevel: 1 },
  { type: 'banana', label: 'Banana', emoji: '🍌', unlockLevel: 1 },
  { type: 'grape', label: 'Grape', emoji: '🍇', unlockLevel: 1 },
  { type: 'orange', label: 'Orange', emoji: '🍊', unlockLevel: 1 },
  { type: 'strawberry', label: 'Strawberry', emoji: '🍓', unlockLevel: 1 },
  { type: 'watermelon', label: 'Watermelon', emoji: '🍉', unlockLevel: 2 },
  { type: 'pear', label: 'Pear', emoji: '🍐', unlockLevel: 3 },
  { type: 'peach', label: 'Peach', emoji: '🍑', unlockLevel: 4 }
];

const FRUIT_LOOKUP = Object.fromEntries(FRUITS.map((fruit) => [fruit.type, fruit]));

const boardElement = document.getElementById('board');
const levelValueElement = document.getElementById('level-value');
const scoreValueElement = document.getElementById('score-value');
const bombValueElement = document.getElementById('bomb-value');
const meterLabelElement = document.getElementById('meter-label');
const meterFillElement = document.getElementById('meter-fill');
const meterInlineLabelElement = document.getElementById('meter-inline-label');
const meterInlineFillElement = document.getElementById('meter-inline-fill');
const meterInlineTrackElement = document.querySelector('.inline-meter-track');
const meterTrackElement = document.querySelector('.meter-track');
const unlockTextElement = document.getElementById('unlock-text');
const newGameButton = document.getElementById('new-game-button');
const overlayElement = document.getElementById('board-overlay');
const overlayTitleElement = document.getElementById('overlay-title');
const overlayTextElement = document.getElementById('overlay-text');
const continueButton = document.getElementById('continue-button');

const fxLayer = document.createElement('div');
fxLayer.className = 'fx-layer';
document.body.appendChild(fxLayer);

const state = {
  board: [],
  level: 1,
  score: 0,
  bombsDetonated: 0,
  meter: 0,
  meterGoal: LEVEL_GOAL_START,
  busy: false,
  pendingLevelUp: false,
  availableFruits: [],
  swipeStart: null
};

function keyFor(row, col) {
  return `${row},${col}`;
}

function coordsFromKey(key) {
  return key.split(',').map(Number);
}

function inBounds(row, col) {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function getAvailableFruits(level) {
  return FRUITS.filter((fruit) => fruit.unlockLevel <= level);
}

function getNextLockedFruit(level) {
  return FRUITS.find((fruit) => fruit.unlockLevel > level) || null;
}

function getBombChance() {
  return Math.min(0.04 + (state.level - 1) * 0.012, 0.12);
}

function randomFruitPiece() {
  const fruit = state.availableFruits[Math.floor(Math.random() * state.availableFruits.length)];
  return { kind: 'fruit', type: fruit.type };
}

function randomPiece(allowBomb = true) {
  if (allowBomb && Math.random() < getBombChance()) {
    return { kind: 'bomb' };
  }
  return randomFruitPiece();
}

function countDirection(board, row, col, deltaRow, deltaCol, type) {
  let matches = 0;
  let nextRow = row + deltaRow;
  let nextCol = col + deltaCol;

  while (inBounds(nextRow, nextCol)) {
    const piece = board[nextRow][nextCol];
    if (!piece || piece.kind !== 'fruit' || piece.type !== type) {
      break;
    }
    matches += 1;
    nextRow += deltaRow;
    nextCol += deltaCol;
  }

  return matches;
}

function createsImmediateRun(board, row, col, piece) {
  if (!piece || piece.kind !== 'fruit') {
    return false;
  }

  const horizontalTotal =
    1 +
    countDirection(board, row, col, 0, -1, piece.type) +
    countDirection(board, row, col, 0, 1, piece.type);

  if (horizontalTotal >= 3) {
    return true;
  }

  const verticalTotal =
    1 +
    countDirection(board, row, col, -1, 0, piece.type) +
    countDirection(board, row, col, 1, 0, piece.type);

  return verticalTotal >= 3;
}

function createStartingBoard() {
  const board = Array.from({ length: BOARD_SIZE }, () => Array.from({ length: BOARD_SIZE }, () => null));

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      let piece = randomPiece(true);
      let safety = 0;
      while (createsImmediateRun(board, row, col, piece) && safety < 20) {
        piece = randomPiece(true);
        safety += 1;
      }
      board[row][col] = piece;
    }
  }

  return board;
}

function findMatches(board) {
  const matched = new Set();

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    let col = 0;
    while (col < BOARD_SIZE) {
      const piece = board[row][col];
      if (!piece || piece.kind !== 'fruit') {
        col += 1;
        continue;
      }

      let end = col + 1;
      while (
        end < BOARD_SIZE &&
        board[row][end] &&
        board[row][end].kind === 'fruit' &&
        board[row][end].type === piece.type
      ) {
        end += 1;
      }

      if (end - col >= 3) {
        for (let current = col; current < end; current += 1) {
          matched.add(keyFor(row, current));
        }
      }

      col = end;
    }
  }

  for (let col = 0; col < BOARD_SIZE; col += 1) {
    let row = 0;
    while (row < BOARD_SIZE) {
      const piece = board[row][col];
      if (!piece || piece.kind !== 'fruit') {
        row += 1;
        continue;
      }

      let end = row + 1;
      while (
        end < BOARD_SIZE &&
        board[end][col] &&
        board[end][col].kind === 'fruit' &&
        board[end][col].type === piece.type
      ) {
        end += 1;
      }

      if (end - row >= 3) {
        for (let current = row; current < end; current += 1) {
          matched.add(keyFor(current, col));
        }
      }

      row = end;
    }
  }

  return matched;
}

function getAdjacentBombs(matchSet) {
  const bombs = [];
  const seen = new Set();

  for (const matchKey of matchSet) {
    const [row, col] = coordsFromKey(matchKey);

    for (let deltaRow = -1; deltaRow <= 1; deltaRow += 1) {
      for (let deltaCol = -1; deltaCol <= 1; deltaCol += 1) {
        if (deltaRow === 0 && deltaCol === 0) {
          continue;
        }

        const nextRow = row + deltaRow;
        const nextCol = col + deltaCol;
        if (!inBounds(nextRow, nextCol)) {
          continue;
        }

        const piece = state.board[nextRow][nextCol];
        const bombKey = keyFor(nextRow, nextCol);
        if (piece && piece.kind === 'bomb' && !seen.has(bombKey)) {
          seen.add(bombKey);
          bombs.push([nextRow, nextCol]);
        }
      }
    }
  }

  return bombs;
}

function getTileElement(row, col) {
  return boardElement.querySelector(`.tile[data-row="${row}"][data-col="${col}"]`);
}

function sampleFlightCandidates(candidates) {
  if (candidates.length <= MAX_FRUIT_FLIGHTS) {
    return candidates;
  }

  const step = candidates.length / MAX_FRUIT_FLIGHTS;
  const sampled = [];

  for (let index = 0; index < MAX_FRUIT_FLIGHTS; index += 1) {
    sampled.push(candidates[Math.floor(index * step)]);
  }

  return sampled;
}

function createFruitFlights(candidates) {
  if (!meterInlineTrackElement) {
    return [];
  }

  const meterRect = meterInlineTrackElement.getBoundingClientRect();
  const sampledCandidates = sampleFlightCandidates(candidates);

  return sampledCandidates
    .map((candidate, index) => {
      const tileElement = getTileElement(candidate.row, candidate.col);
      if (!tileElement) {
        return null;
      }

      const tileRect = tileElement.getBoundingClientRect();
      const targetX = meterRect.left + Math.min(
        meterRect.width - 18,
        18 + (index / Math.max(sampledCandidates.length - 1, 1)) * Math.max(meterRect.width - 36, 0)
      );
      const targetY = meterRect.top + meterRect.height / 2;

      return {
        emoji: FRUIT_LOOKUP[candidate.type].emoji,
        startX: tileRect.left + tileRect.width / 2,
        startY: tileRect.top + tileRect.height / 2,
        endX: targetX,
        endY: targetY,
        size: Math.max(22, Math.min(tileRect.width * 0.72, 38))
      };
    })
    .filter(Boolean);
}

function createScorePopInfo(clearedKeys, scoreGain, bombCount) {
  if (!scoreGain) {
    return null;
  }

  const points = [];

  for (const clearedKey of clearedKeys) {
    const [row, col] = coordsFromKey(clearedKey);
    const tileElement = getTileElement(row, col);
    if (!tileElement) {
      continue;
    }

    const tileRect = tileElement.getBoundingClientRect();
    points.push({
      x: tileRect.left + tileRect.width / 2,
      y: tileRect.top + tileRect.height / 2
    });
  }

  const fallbackRect = boardElement.getBoundingClientRect();
  const averageX = points.length
    ? points.reduce((sum, point) => sum + point.x, 0) / points.length
    : fallbackRect.left + fallbackRect.width / 2;
  const averageY = points.length
    ? points.reduce((sum, point) => sum + point.y, 0) / points.length
    : fallbackRect.top + fallbackRect.height / 2;

  return {
    x: averageX,
    y: averageY,
    text: bombCount > 0 ? `+${scoreGain} 💥` : `+${scoreGain}`,
    variant: bombCount > 0 ? 'bomb' : 'fruit'
  };
}

async function animateFruitFlights(flights) {
  if (!flights.length) {
    return;
  }

  meterInlineTrackElement?.classList.add('is-pulsing');
  meterTrackElement?.classList.add('is-pulsing');

  const animationPromises = flights.map((flight, index) => {
    return new Promise((resolve) => {
      const fruitElement = document.createElement('div');
      fruitElement.className = 'flying-fruit';
      fruitElement.textContent = flight.emoji;
      fruitElement.style.width = `${flight.size}px`;
      fruitElement.style.height = `${flight.size}px`;
      fruitElement.style.fontSize = `${flight.size * 0.78}px`;
      fxLayer.appendChild(fruitElement);

      const apexY = Math.min(flight.startY, flight.endY) - (48 + Math.random() * 28);
      const midpointX = (flight.startX + flight.endX) / 2 + (Math.random() * 32 - 16);

      const animation = fruitElement.animate(
        [
          {
            transform: `translate(${flight.startX - flight.size / 2}px, ${flight.startY - flight.size / 2}px) scale(1) rotate(0deg)`,
            opacity: 1
          },
          {
            transform: `translate(${midpointX - flight.size / 2}px, ${apexY - flight.size / 2}px) scale(1.15) rotate(${Math.random() * 20 - 10}deg)`,
            opacity: 1,
            offset: 0.45
          },
          {
            transform: `translate(${flight.endX - flight.size / 2}px, ${flight.endY - flight.size / 2}px) scale(0.28) rotate(${Math.random() * 40 - 20}deg)`,
            opacity: 0.18
          }
        ],
        {
          duration: 560,
          delay: index * 42,
          easing: 'cubic-bezier(0.22, 0.9, 0.31, 1)',
          fill: 'forwards'
        }
      );

      animation.onfinish = () => {
        fruitElement.remove();
        resolve();
      };
    });
  });

  await Promise.all(animationPromises);

  meterInlineTrackElement?.classList.remove('is-pulsing');
  meterTrackElement?.classList.remove('is-pulsing');
}

async function animateScorePop(scorePop) {
  if (!scorePop) {
    return;
  }

  await new Promise((resolve) => {
    const scoreElement = document.createElement('div');
    scoreElement.className = `score-pop score-pop--${scorePop.variant}`;
    scoreElement.textContent = scorePop.text;
    fxLayer.appendChild(scoreElement);

    const animation = scoreElement.animate(
      [
        {
          transform: `translate(${scorePop.x - 30}px, ${scorePop.y - 16}px) scale(0.8)`,
          opacity: 0
        },
        {
          transform: `translate(${scorePop.x - 30}px, ${scorePop.y - 46}px) scale(1.06)`,
          opacity: 1,
          offset: 0.28
        },
        {
          transform: `translate(${scorePop.x - 30}px, ${scorePop.y - 96}px) scale(1)`,
          opacity: 0
        }
      ],
      {
        duration: 820,
        easing: 'cubic-bezier(0.18, 0.84, 0.32, 1)',
        fill: 'forwards'
      }
    );

    animation.onfinish = () => {
      scoreElement.remove();
      resolve();
    };
  });
}

function buildResolution({ matchSet = new Set(), initialBombs = [] }) {
  const cleared = new Set(matchSet);
  const bombQueue = [...initialBombs];
  const queuedBombs = new Set(initialBombs.map(([row, col]) => keyFor(row, col)));
  const processedBombs = new Set();

  for (const [row, col] of getAdjacentBombs(matchSet)) {
    const bombKey = keyFor(row, col);
    if (!queuedBombs.has(bombKey)) {
      bombQueue.push([row, col]);
      queuedBombs.add(bombKey);
    }
  }

  while (bombQueue.length > 0) {
    const [bombRow, bombCol] = bombQueue.shift();
    const bombKey = keyFor(bombRow, bombCol);
    const bombPiece = state.board[bombRow]?.[bombCol];

    if (processedBombs.has(bombKey) || !bombPiece || bombPiece.kind !== 'bomb') {
      continue;
    }

    processedBombs.add(bombKey);
    cleared.add(bombKey);

    for (let deltaRow = -2; deltaRow <= 2; deltaRow += 1) {
      for (let deltaCol = -2; deltaCol <= 2; deltaCol += 1) {
        const nextRow = bombRow + deltaRow;
        const nextCol = bombCol + deltaCol;
        if (!inBounds(nextRow, nextCol)) {
          continue;
        }

        const blastKey = keyFor(nextRow, nextCol);
        const piece = state.board[nextRow][nextCol];
        cleared.add(blastKey);

        if (piece && piece.kind === 'bomb' && !queuedBombs.has(blastKey)) {
          bombQueue.push([nextRow, nextCol]);
          queuedBombs.add(blastKey);
        }
      }
    }
  }

  let clearedFruitCount = 0;
  let bombCount = 0;
  const flightCandidates = [];

  for (const clearedKey of cleared) {
    const [row, col] = coordsFromKey(clearedKey);
    const piece = state.board[row][col];
    if (!piece) {
      continue;
    }

    if (piece.kind === 'bomb') {
      bombCount += 1;
    } else {
      clearedFruitCount += 1;
      flightCandidates.push({ row, col, type: piece.type });
    }

    state.board[row][col] = null;
  }

  const scoreGain = clearedFruitCount * 10 + bombCount * 75;
  const flights = createFruitFlights(flightCandidates);
  const scorePop = createScorePopInfo(cleared, scoreGain, bombCount);

  state.score += scoreGain;
  state.bombsDetonated += bombCount;

  if (!state.pendingLevelUp) {
    state.meter = Math.min(state.meterGoal, state.meter + clearedFruitCount + bombCount * 12);
    if (state.meter >= state.meterGoal) {
      state.pendingLevelUp = true;
    }
  }

  return {
    clearedCount: clearedFruitCount + bombCount,
    scoreGain,
    bombCount,
    flights,
    scorePop
  };
}

function collapseBoard() {
  for (let col = 0; col < BOARD_SIZE; col += 1) {
    let writeRow = BOARD_SIZE - 1;

    for (let row = BOARD_SIZE - 1; row >= 0; row -= 1) {
      if (state.board[row][col]) {
        state.board[writeRow][col] = state.board[row][col];
        if (writeRow !== row) {
          state.board[row][col] = null;
        }
        writeRow -= 1;
      }
    }

    while (writeRow >= 0) {
      state.board[writeRow][col] = null;
      writeRow -= 1;
    }
  }
}

function refillBoard() {
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (!state.board[row][col]) {
        state.board[row][col] = randomPiece(true);
      }
    }
  }
}

function swapPieces(fromRow, fromCol, toRow, toCol) {
  const temp = state.board[fromRow][fromCol];
  state.board[fromRow][fromCol] = state.board[toRow][toCol];
  state.board[toRow][toCol] = temp;
}

function collectMovedBombs(fromRow, fromCol, toRow, toCol) {
  const bombs = [];
  const positions = [
    [fromRow, fromCol],
    [toRow, toCol]
  ];
  const seen = new Set();

  for (const [row, col] of positions) {
    const piece = state.board[row][col];
    const bombKey = keyFor(row, col);
    if (piece && piece.kind === 'bomb' && !seen.has(bombKey)) {
      bombs.push([row, col]);
      seen.add(bombKey);
    }
  }

  return bombs;
}

function renderBoard() {
  boardElement.innerHTML = '';

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const piece = state.board[row][col];
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.dataset.row = String(row);
      tile.dataset.col = String(col);

      if (!piece) {
        tile.className = 'tile tile--empty';
        tile.disabled = true;
        tile.setAttribute('aria-hidden', 'true');
        boardElement.appendChild(tile);
        continue;
      }

      tile.className = `tile tile--${piece.kind === 'bomb' ? 'bomb' : piece.type}`;
      tile.setAttribute(
        'aria-label',
        piece.kind === 'bomb' ? `Bomb at row ${row + 1}, column ${col + 1}` : `${FRUIT_LOOKUP[piece.type].label} at row ${row + 1}, column ${col + 1}`
      );

      if (state.swipeStart && state.swipeStart.row === row && state.swipeStart.col === col) {
        tile.classList.add('is-active');
      }

      const tileInner = document.createElement('span');
      tileInner.className = 'tile-inner';

      const pieceElement = document.createElement('span');
      pieceElement.className = 'piece';
      pieceElement.textContent = piece.kind === 'bomb' ? '💣' : FRUIT_LOOKUP[piece.type].emoji;

      tileInner.appendChild(pieceElement);
      tile.appendChild(tileInner);
      boardElement.appendChild(tile);
    }
  }
}

function renderHud() {
  const meterText = `${state.meter} / ${state.meterGoal}`;
  const meterPercent = `${(state.meter / state.meterGoal) * 100}%`;

  levelValueElement.textContent = String(state.level);
  scoreValueElement.textContent = String(state.score);
  bombValueElement.textContent = String(state.bombsDetonated);
  meterLabelElement.textContent = meterText;
  meterFillElement.style.width = meterPercent;
  meterInlineLabelElement.textContent = meterText;
  meterInlineFillElement.style.width = meterPercent;

  const nextFruit = getNextLockedFruit(state.level);
  if (nextFruit) {
    unlockTextElement.textContent = `Level ${state.level}: ${state.availableFruits.length} fruit types active. Next unlock: ${nextFruit.label} at level ${nextFruit.unlockLevel}.`;
  } else {
    unlockTextElement.textContent = `All current fruit are unlocked. Bomb chance will keep ramping up as you climb.`;
  }
}

function renderAll() {
  renderBoard();
  renderHud();
}

function showLevelUpOverlay() {
  const nextLevel = state.level + 1;
  const nextFruit = getNextLockedFruit(state.level);
  overlayTitleElement.textContent = `Level ${nextLevel}`;
  overlayTextElement.textContent = nextFruit && nextFruit.unlockLevel === nextLevel
    ? `${nextFruit.label} joins the board next. Bombs are also a little more common now.`
    : 'Fresh board, higher goal, and bigger combo potential. Keep swiping.';
  overlayElement.classList.remove('hidden');
}

function hideLevelUpOverlay() {
  overlayElement.classList.add('hidden');
}

async function resolveBoard(initialResolutionInput = null) {
  let pendingInput = initialResolutionInput;

  while (true) {
    let resolution;

    if (pendingInput) {
      resolution = buildResolution(pendingInput);
      pendingInput = null;
      if (!resolution.clearedCount) {
        break;
      }
    } else {
      const matches = findMatches(state.board);
      if (matches.size === 0) {
        break;
      }
      resolution = buildResolution({ matchSet: matches });
    }

    renderAll();
    await Promise.all([
      animateFruitFlights(resolution.flights),
      animateScorePop(resolution.scorePop)
    ]);
    await wait(120);

    collapseBoard();
    refillBoard();
    renderAll();
    await wait(170);

    if (state.pendingLevelUp) {
      break;
    }
  }

  state.busy = false;

  if (state.pendingLevelUp) {
    showLevelUpOverlay();
  }
}

async function trySwap(fromRow, fromCol, toRow, toCol) {
  if (!inBounds(toRow, toCol) || state.busy || state.pendingLevelUp) {
    return;
  }

  state.busy = true;
  swapPieces(fromRow, fromCol, toRow, toCol);
  renderBoard();
  await wait(120);

  const movedBombs = collectMovedBombs(fromRow, fromCol, toRow, toCol);
  if (movedBombs.length > 0) {
    await resolveBoard({ initialBombs: movedBombs });
    return;
  }

  const matches = findMatches(state.board);
  if (matches.size === 0) {
    swapPieces(fromRow, fromCol, toRow, toCol);
    renderBoard();
    await wait(120);
    state.busy = false;
    return;
  }

  await resolveBoard({ matchSet: matches });
}

function advanceLevel() {
  state.level += 1;
  state.meterGoal = LEVEL_GOAL_START + (state.level - 1) * LEVEL_GOAL_STEP;
  state.meter = 0;
  state.pendingLevelUp = false;
  state.availableFruits = getAvailableFruits(state.level);
  state.board = createStartingBoard();
  hideLevelUpOverlay();
  renderAll();
}

function startNewBoard() {
  if (state.busy) {
    return;
  }

  state.pendingLevelUp = false;
  hideLevelUpOverlay();
  state.board = createStartingBoard();
  renderAll();
}

function handlePointerDown(event) {
  const tile = event.target.closest('.tile');
  if (!tile || state.busy || state.pendingLevelUp || tile.disabled) {
    return;
  }

  state.swipeStart = {
    row: Number(tile.dataset.row),
    col: Number(tile.dataset.col),
    x: event.clientX,
    y: event.clientY,
    id: event.pointerId
  };

  boardElement.setPointerCapture(event.pointerId);
  renderBoard();
}

function releasePointer(pointerId) {
  if (boardElement.hasPointerCapture(pointerId)) {
    boardElement.releasePointerCapture(pointerId);
  }
}

function clearSwipeState(pointerId) {
  if (!state.swipeStart) {
    return;
  }

  if (pointerId === undefined || state.swipeStart.id === pointerId) {
    state.swipeStart = null;
    renderBoard();
  }
}

function handlePointerUp(event) {
  if (!state.swipeStart || event.pointerId !== state.swipeStart.id) {
    return;
  }

  const { row, col, x, y } = state.swipeStart;
  releasePointer(event.pointerId);
  state.swipeStart = null;

  const deltaX = event.clientX - x;
  const deltaY = event.clientY - y;
  renderBoard();

  if (Math.hypot(deltaX, deltaY) < SWIPE_THRESHOLD) {
    return;
  }

  let nextRow = row;
  let nextCol = col;

  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    nextCol += deltaX > 0 ? 1 : -1;
  } else {
    nextRow += deltaY > 0 ? 1 : -1;
  }

  trySwap(row, col, nextRow, nextCol);
}

function handlePointerCancel(event) {
  if (!state.swipeStart || event.pointerId !== state.swipeStart.id) {
    return;
  }

  releasePointer(event.pointerId);
  clearSwipeState(event.pointerId);
}

function initializeGame() {
  state.availableFruits = getAvailableFruits(state.level);
  state.board = createStartingBoard();
  renderAll();
}

boardElement.addEventListener('pointerdown', handlePointerDown);
boardElement.addEventListener('pointerup', handlePointerUp);
boardElement.addEventListener('pointercancel', handlePointerCancel);
newGameButton.addEventListener('click', startNewBoard);
continueButton.addEventListener('click', advanceLevel);

initializeGame();